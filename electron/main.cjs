const { app, BrowserWindow, ipcMain, session } = require('electron')
const { execFile } = require('child_process')
const fs = require('fs/promises')
const path = require('path')

const isDev = !app.isPackaged

// 实验终端白名单：扩为只读/查询类命令集，
// 让网站讲解的命令能在真实终端跑一遍形成阅读→操作闭环。
// 故意排除 rm/mv/mkfs/dd/kill -9 等破坏性命令。
const allowedCommands = new Set([
  // 信息查看
  'pwd', 'whoami', 'hostname', 'date', 'id', 'uname', 'uptime', 'echo',
  // 文件查看（只读）
  'ls', 'dir', 'cat', 'less', 'head', 'tail', 'stat', 'file', 'wc',
  // 查找与文本过滤（只读）
  'find', 'grep', 'which', 'whereis', 'locate',
  // 进程/资源监控（只读）
  'ps', 'top', 'free', 'df', 'du',
  // 网络（只读探测）
  'ping', 'curl', 'dig', 'nslookup', 'traceroute', 'mtr',
  // systemd 服务查询与日志查看（只读子命令由用户自负）
  'systemctl', 'journalctl',
  // Kubernetes 集群只读查询（get/describe/logs 由用户自负）
  'kubectl',
  // git 只读子命令（status/log/diff/branch 由用户自负）
  'git',
  // 容器（只读状态子命令由用户自负）
  'docker',
])
const progressFileName = 'progress.json'
const backupFileName = 'progress.backup.json'

function getProgressPaths() {
  const dataDir = app.getPath('userData')
  return {
    dataDir,
    progressPath: path.join(dataDir, progressFileName),
    backupPath: path.join(dataDir, backupFileName),
    tempPath: path.join(dataDir, `${progressFileName}.tmp`),
  }
}

function createContentSecurityPolicy() {
  return [
    "default-src 'self'",
    isDev ? "connect-src 'self' http://localhost:5173 http://127.0.0.1:5173 ws://localhost:5173 ws://127.0.0.1:5173 https://api.deepseek.com" : "connect-src 'self' https://api.deepseek.com",
    "script-src 'self' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
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

function parseCommand(input) {
  const parts = String(input || '').trim().split(/\s+/).filter(Boolean)
  const command = parts[0]
  const args = parts.slice(1).filter(arg => !/[;&|`$<>]/.test(arg))
  return { command, args }
}

function registerIpc() {
  ipcMain.handle('terminal:exec', async (_event, input) => {
    const { command, args } = parseCommand(input)
    if (!command || !allowedCommands.has(command)) {
      return { exitCode: 127, stdout: '', stderr: `命令不在实验白名单中: ${command || '(empty)'}` }
    }

    return new Promise((resolve) => {
      execFile(command, args, {
        cwd: app.getPath('temp'),
        timeout: 8000,
        windowsHide: true,
        maxBuffer: 1024 * 128,
      }, (error, stdout, stderr) => {
        resolve({
          exitCode: error && typeof error.code === 'number' ? error.code : 0,
          stdout,
          stderr,
        })
      })
    })
  })

  ipcMain.handle('app:getPath', (_event, name) => app.getPath(name || 'userData'))
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('progress:load', async () => {
    const { progressPath, backupPath } = getProgressPaths()
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
    const { dataDir, progressPath, backupPath, tempPath } = getProgressPaths()
    await fs.mkdir(dataDir, { recursive: true })

    // 深度防御：限制磁盘文件大小，防止异常大的 payload 撑爆 userData
    const payloadJson = JSON.stringify(payload ?? {})
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
      version: 1,
      updatedAt: Date.now(),
      ...payload,
    }
    await fs.writeFile(tempPath, JSON.stringify(envelope, null, 2), 'utf8')
    await fs.rename(tempPath, progressPath)

    return {
      ok: true,
      path: progressPath,
      updatedAt: envelope.updatedAt,
    }
  })

  ipcMain.handle('progress:clear', async () => {
    const { progressPath, backupPath, tempPath } = getProgressPaths()
    await Promise.allSettled([
      fs.rm(progressPath, { force: true }),
      fs.rm(backupPath, { force: true }),
      fs.rm(tempPath, { force: true }),
    ])
    return { ok: true }
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '云栈',
    icon: path.join(__dirname, '../public/favicon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
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
