/**
 * Electron Preload Script
 *
 * 安全加固：仅暴露白名单 API，所有 Node.js 访问通过 contextBridge
 */
const { contextBridge, ipcRenderer } = require('electron')

// 白名单通道：每项都必须在 main.cjs 的 registerIpc() 中注册了对应 handler，
// 否则调用会报 "No handler registered"。
const allowedChannels = [
  'app:getVersion',
  'app:getApiBaseUrl',
  'app:openDataFolder',
  'progress:load',
  'progress:save',
  'progress:clear',
]

contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  platform: process.platform,
  version: process.versions.electron,

  // IPC 通信（白名单）
  invoke: (channel, ...args) => {
    if (allowedChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`不允许的 IPC 通道: ${channel}`))
  },
})
