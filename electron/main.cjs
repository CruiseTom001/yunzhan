const { app, BrowserWindow, ipcMain, session, shell } = require('electron')
const fs = require('fs/promises')
const fsSync = require('fs')
const path = require('path')

const isDev = !app.isPackaged

const progressFileName = 'progress.json'
const backupFileName = 'progress.backup.json'
const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeAccountId(value) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || !accountIdPattern.test(value)) {
    throw new Error('invalid account id')
  }
  return value.toLowerCase()
}

function getProgressPaths(accountId = null) {
  const userDataDir = app.getPath('userData')
  const normalizedAccountId = normalizeAccountId(accountId)
  const dataDir = normalizedAccountId
    ? path.join(userDataDir, 'accounts', normalizedAccountId)
    : userDataDir
  return {
    dataDir,
    progressPath: path.join(dataDir, progressFileName),
    backupPath: path.join(dataDir, backupFileName),
    tempPath: path.join(dataDir, `${progressFileName}.tmp`),
  }
}

function createContentSecurityPolicy() {
  const configuredApiOrigin = getConfiguredApiOrigin()
  const developmentConnections = isDev
    ? ' http://localhost:5173 http://127.0.0.1:5173 http://localhost:8787 http://127.0.0.1:8787 ws://localhost:5173 ws://127.0.0.1:5173'
    : ''
  const apiConnection = configuredApiOrigin ? ` ${configuredApiOrigin}` : ''
  return [
    "default-src 'self'",
    `connect-src 'self' https://api.deepseek.com${developmentConnections}${apiConnection}`,
    isDev ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

function getConfiguredApiOrigin() {
  const value = process.env.YUNZHAN_API_ORIGIN || readApiOriginFromConfig()
  if (!value) return isDev ? 'http://127.0.0.1:8787' : ''
  try {
    const target = new URL(value)
    if (target.protocol !== 'https:' && !(isDev && target.protocol === 'http:')) {
      console.warn('Ignored insecure YUNZHAN_API_ORIGIN.')
      return ''
    }
    return target.origin
  } catch {
    console.warn('Ignored invalid YUNZHAN_API_ORIGIN.')
    return ''
  }
}

function readApiOriginFromConfig() {
  const configPath = path.join(__dirname, 'api-config.json')
  try {
    const stats = fsSync.statSync(configPath)
    if (stats.size > 2048) return ''
    const parsed = JSON.parse(fsSync.readFileSync(configPath, 'utf8'))
    return parsed && typeof parsed === 'object' && typeof parsed.apiOrigin === 'string'
      ? parsed.apiOrigin.trim()
      : ''
  } catch {
    return ''
  }
}

function registerSecurityHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [createContentSecurityPolicy()],
        'X-Content-Type-Options': ['nosniff'],
      },
    })
  })
}

function registerIpc() {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getApiBaseUrl', () => getConfiguredApiOrigin())
  ipcMain.handle('app:openDataFolder', () => shell.openPath(app.getPath('userData')))

  ipcMain.handle('progress:load', async (_event, accountId) => {
    const { progressPath, backupPath } = getProgressPaths(accountId)
    const readJson = async (filePath, source) => {
      const raw = await fs.readFile(filePath, 'utf8')
      return {
        source,
        path: filePath,
        payload: JSON.parse(raw),
      }
    }

    try {
      return await readJson(progressPath, 'primary')
    } catch (primaryError) {
      try {
        return await readJson(backupPath, 'backup')
      } catch {
        if (primaryError && primaryError.code !== 'ENOENT') {
          console.warn('Failed to read progress file:', primaryError)
        }
        return null
      }
    }
  })

  ipcMain.handle('progress:save', async (_event, payload) => {
    // 深度防御：限制磁盘文件大小，防止异常大的 payload 撑爆 userData
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !payload.progress) {
      return { ok: false, error: 'invalid progress payload' }
    }
    const { dataDir, progressPath, backupPath, tempPath } = getProgressPaths(payload.accountId)
    await fs.mkdir(dataDir, { recursive: true })

    const payloadJson = JSON.stringify(payload)
    if (payloadJson.length > 10 * 1024 * 1024) {
      return { ok: false, error: 'payload too large', path: progressPath }
    }

    try {
      await fs.copyFile(progressPath, backupPath)
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        console.warn('Failed to refresh progress backup:', error)
      }
    }

    const envelope = {
      ...payload,
      version: 1,
      updatedAt: Date.now(),
    }
    await fs.writeFile(tempPath, JSON.stringify(envelope, null, 2), 'utf8')
    await fs.rename(tempPath, progressPath)

    return {
      ok: true,
      path: progressPath,
      updatedAt: envelope.updatedAt,
    }
  })

  ipcMain.handle('progress:clear', async (_event, accountId) => {
    const { progressPath, backupPath, tempPath } = getProgressPaths(accountId)
    await Promise.allSettled([
      fs.rm(progressPath, { force: true }),
      fs.rm(backupPath, { force: true }),
      fs.rm(tempPath, { force: true }),
    ])
    return { ok: true }
  })
}

function isExternalWebUrl(url) {
  try {
    const protocol = new URL(url).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function openExternalWebUrl(url) {
  if (!isExternalWebUrl(url)) return
  void shell.openExternal(url).catch(error => {
    console.warn('Failed to open external URL:', error)
  })
}

function isAllowedAppNavigation(url) {
  try {
    const target = new URL(url)
    if (!isDev) return target.protocol === 'file:'
    return target.origin === 'http://localhost:5173' || target.origin === 'http://127.0.0.1:5173'
  } catch {
    return false
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '云栈',
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalWebUrl(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAppNavigation(url)) return
    event.preventDefault()
    openExternalWebUrl(url)
  })

  // 隐藏菜单栏（生产环境）
  if (!isDev) {
    win.setMenuBarVisibility(false)
  }

  if (isDev) {
    // 开发模式：加载 Vite 开发服务器
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    // 生产模式：加载构建后的文件
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 监听页面标题变化，防止被页面修改
  win.on('page-title-updated', (e) => {
    e.preventDefault()
  })
}

app.whenReady().then(() => {
  registerSecurityHeaders()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
