const {
  createInitialUpdaterState,
  getPublicUpdaterState,
  mapUpdaterError,
  canStartDownload,
  canStartInstall,
  mapDownloadProgress,
} = require('./desktop-updater-state.cjs')

const UPDATER_EVENT_CHANNEL = 'updater:stateChanged'

function createDesktopUpdater(options) {
  const BrowserWindow = options.BrowserWindow ?? require('electron').BrowserWindow
  const autoUpdater = options.autoUpdater ?? require('electron-updater').autoUpdater
  const isPackaged = options.isPackaged === true
  const platform = options.platform ?? process.platform
  const enabled = isPackaged && platform === 'win32'
  const pendingUpdateStorage = options.pendingUpdateStorage ?? null
  const getAppVersion = typeof options.getAppVersion === 'function'
    ? options.getAppVersion
    : () => {
      try {
        return require('electron').app.getVersion()
      } catch {
        return '0.0.0'
      }
    }

  let state = createInitialUpdaterState()
  let checkInFlight = false
  let downloadInFlight = false
  let installInFlight = false

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false

  function setState(patch) {
    state = {
      ...state,
      ...patch,
      errorCode: patch.errorCode ?? null,
      errorMessage: patch.errorMessage ?? null,
    }
    broadcastState()
  }

  function broadcastState() {
    const payload = getPublicUpdaterState(state)
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win.isDestroyed()) return
      win.webContents.send(UPDATER_EVENT_CHANNEL, payload)
    })
    return payload
  }

  function devDisabledError() {
    return {
      errorCode: 'dev_disabled',
      errorMessage: '开发环境不执行自动更新。',
    }
  }

  function persistPendingMarker(version) {
    if (!pendingUpdateStorage || typeof version !== 'string') {
      return { ok: false, reason: 'skipped' }
    }
    if (typeof pendingUpdateStorage.writePendingUpdateMarkerSync === 'function') {
      return pendingUpdateStorage.writePendingUpdateMarkerSync(version)
    }
    return { ok: false, reason: 'unsupported' }
  }

  function restoreFromPendingMarker() {
    if (!pendingUpdateStorage) return
    const resolved = pendingUpdateStorage.resolvePendingUpdateMarkerSync({
      currentVersion: getAppVersion(),
      now: Date.now(),
    })
    if (resolved.action !== 'restore' || !resolved.marker) return
    state = {
      ...createInitialUpdaterState(),
      status: 'downloaded',
      version: resolved.marker.version,
      percent: 100,
      errorCode: null,
      errorMessage: null,
    }
  }

  function registerEvents() {
    autoUpdater.on('checking-for-update', () => {
      checkInFlight = true
      setState({
        status: 'checking',
        version: null,
        percent: null,
        transferred: null,
        total: null,
        bytesPerSecond: null,
        errorCode: null,
        errorMessage: null,
      })
    })

    autoUpdater.on('update-not-available', () => {
      checkInFlight = false
      setState({
        status: 'upToDate',
        version: null,
        percent: null,
        transferred: null,
        total: null,
        bytesPerSecond: null,
        errorCode: null,
        errorMessage: null,
      })
    })

    autoUpdater.on('update-available', (info) => {
      checkInFlight = false
      setState({
        status: 'available',
        version: typeof info?.version === 'string' ? info.version : null,
        percent: null,
        transferred: null,
        total: null,
        bytesPerSecond: null,
        errorCode: null,
        errorMessage: null,
      })
    })

    autoUpdater.on('download-progress', (progress) => {
      const mapped = mapDownloadProgress(progress)
      setState({
        status: 'downloading',
        percent: mapped.percent,
        transferred: mapped.transferred,
        total: mapped.total,
        bytesPerSecond: mapped.bytesPerSecond,
        errorCode: null,
        errorMessage: null,
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      downloadInFlight = false
      const version = typeof info?.version === 'string' ? info.version : state.version
      setState({
        status: 'downloaded',
        version,
        percent: 100,
        errorCode: null,
        errorMessage: null,
      })
      persistPendingMarker(version)
    })

    autoUpdater.on('error', (error) => {
      checkInFlight = false
      downloadInFlight = false
      installInFlight = false
      const mapped = mapUpdaterError(error)
      // Keep pending marker on install/download failures so the next launch can restore.
      setState({
        status: 'error',
        errorCode: mapped.errorCode,
        errorMessage: mapped.errorMessage,
      })
    })
  }

  async function checkForUpdates() {
    if (!enabled) {
      const mapped = devDisabledError()
      setState({
        status: 'error',
        errorCode: mapped.errorCode,
        errorMessage: mapped.errorMessage,
      })
      return getPublicUpdaterState(state)
    }
    // Preserve a completed download across restarts / re-checks.
    if (state.status === 'downloaded' || state.status === 'installing') {
      return getPublicUpdaterState(state)
    }
    if (checkInFlight || downloadInFlight || installInFlight) {
      return getPublicUpdaterState(state)
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      const mapped = mapUpdaterError(error)
      checkInFlight = false
      setState({
        status: 'error',
        errorCode: mapped.errorCode,
        errorMessage: mapped.errorMessage,
      })
    }
    return getPublicUpdaterState(state)
  }

  async function downloadUpdate() {
    const allowed = canStartDownload(state, enabled)
    if (!allowed.ok) {
      if (allowed.reason === 'dev_disabled') {
        const mapped = devDisabledError()
        setState({
          status: 'error',
          errorCode: mapped.errorCode,
          errorMessage: mapped.errorMessage,
        })
      }
      return getPublicUpdaterState(state)
    }
    if (downloadInFlight) return getPublicUpdaterState(state)

    downloadInFlight = true
    setState({
      status: 'downloading',
      percent: 0,
      transferred: 0,
      total: state.total,
      bytesPerSecond: 0,
      errorCode: null,
      errorMessage: null,
    })

    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      downloadInFlight = false
      const mapped = mapUpdaterError(error)
      setState({
        status: 'error',
        errorCode: mapped.errorCode,
        errorMessage: mapped.errorMessage,
      })
    }
    return getPublicUpdaterState(state)
  }

  function installUpdate() {
    const allowed = canStartInstall(state, enabled)
    if (!allowed.ok) {
      if (allowed.reason === 'dev_disabled') {
        const mapped = devDisabledError()
        setState({
          status: 'error',
          errorCode: mapped.errorCode,
          errorMessage: mapped.errorMessage,
        })
      }
      return getPublicUpdaterState(state)
    }
    if (installInFlight) return getPublicUpdaterState(state)

    installInFlight = true
    setState({
      status: 'installing',
      errorCode: null,
      errorMessage: null,
    })

    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(false, true)
      } catch {
        installInFlight = false
        // Marker intentionally retained so the user can retry after restart.
        setState({
          status: 'error',
          errorCode: 'install_failed',
          errorMessage: '安装启动失败，请稍后重试。',
        })
      }
    })

    return getPublicUpdaterState(state)
  }

  function getState() {
    return getPublicUpdaterState(state)
  }

  registerEvents()
  restoreFromPendingMarker()

  return {
    enabled,
    getState,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    eventChannel: UPDATER_EVENT_CHANNEL,
    restoreFromPendingMarker,
    persistPendingMarker,
  }
}

module.exports = {
  createDesktopUpdater,
  UPDATER_EVENT_CHANNEL,
}
