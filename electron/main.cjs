const { app, BrowserWindow, ipcMain, session } = require('electron')
const { execFile } = require('child_process')
const path = require('path')

const isDev = !app.isPackaged
const allowedCommands = new Set(['pwd', 'whoami', 'hostname', 'date', 'ls', 'dir', 'docker'])

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
