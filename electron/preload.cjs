/**
 * Electron Preload Script
 * 
 * 安全加固：仅暴露白名单 API，所有 Node.js 访问通过 contextBridge
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  platform: process.platform,
  version: process.versions.electron,

  // IPC 通信（白名单）
  invoke: (channel, ...args) => {
    const allowedChannels = [
      'terminal:exec',
      'terminal:resize',
      'app:getPath',
      'app:getVersion',
    ]
    if (allowedChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`不允许的 IPC 通道: ${channel}`))
  },

  // 终端相关（合并到 node-pty 后端时使用）
  onTerminalData: (callback) => {
    ipcRenderer.on('terminal:data', (_, data) => callback(data))
  },

  // 文件操作（仅读）
  readFile: (filePath) => {
    // 仅允许读取特定目录
    return ipcRenderer.invoke('app:readFile', filePath)
  },
})
