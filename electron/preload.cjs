/**
 * Electron Preload Script
 *
 * 安全加固：仅暴露白名单 API，所有 Node.js 访问通过 contextBridge
 */
const { contextBridge, ipcRenderer } = require('electron')

const allowedInvokeChannels = [
  'app:getVersion',
  'app:getApiBaseUrl',
  'app:openDataFolder',
  'desktop:apiRequest',
  'ai:polishStudyNote',
  'ai:testProvider',
  'progress:load',
  'progress:save',
  'progress:clear',
  'updater:getState',
  'updater:check',
  'updater:download',
  'updater:install',
]

const UPDATER_EVENT_CHANNEL = 'updater:stateChanged'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron,

  invoke: (channel, ...args) => {
    if (allowedInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`不允许的 IPC 通道: ${channel}`))
  },

  getUpdaterState: () => ipcRenderer.invoke('updater:getState'),

  checkForDesktopUpdate: () => ipcRenderer.invoke('updater:check'),

  downloadDesktopUpdate: () => ipcRenderer.invoke('updater:download'),

  installDesktopUpdate: () => ipcRenderer.invoke('updater:install'),

  onDesktopUpdaterStateChanged: (listener) => {
    if (typeof listener !== 'function') {
      return () => {}
    }
    const wrapped = (_event, state) => listener(state)
    ipcRenderer.on(UPDATER_EVENT_CHANNEL, wrapped)
    return () => {
      ipcRenderer.removeListener(UPDATER_EVENT_CHANNEL, wrapped)
    }
  },
})
