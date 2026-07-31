const CLOSE_RESOLVE_ACTIONS = new Set(['quit', 'tray', 'cancel'])
const CLOSE_ACK_FALLBACK_MS = 1500

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function createDesktopCloseManager(deps) {
  const {
    app,
    Tray,
    Menu,
    nativeImage,
    closeBehaviorStorage,
    getUpdaterState,
    iconPath,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    closeAckFallbackMs = CLOSE_ACK_FALLBACK_MS,
  } = deps

  let mainWindow = null
  let tray = null
  let allowQuit = false
  let closeRequestPending = false
  let closeRequestGeneration = 0
  let closeAckReceived = false
  let closeAckFallbackTimer = null

  function validateResolvePayload(payload) {
    if (!isPlainObject(payload)) return null
    if (typeof payload.action !== 'string' || !CLOSE_RESOLVE_ACTIONS.has(payload.action)) {
      return null
    }
    return {
      action: payload.action,
      remember: payload.remember === true,
    }
  }

  function clearCloseAckFallbackTimer() {
    if (closeAckFallbackTimer === null) return
    clearTimeoutFn(closeAckFallbackTimer)
    closeAckFallbackTimer = null
  }

  function scheduleCloseAckFallback(behavior, generation) {
    clearCloseAckFallbackTimer()
    closeAckFallbackTimer = setTimeoutFn(() => {
      closeAckFallbackTimer = null
      if (!closeRequestPending || generation !== closeRequestGeneration || closeAckReceived) {
        return
      }

      // Renderer never acknowledged — likely closed before Vue subscribed.
      closeRequestPending = false
      if (behavior === 'quit') {
        performQuit()
        return
      }
      if (behavior === 'tray') {
        hideToTray()
        return
      }
      // ask: release pending so the next close can retry
    }, closeAckFallbackMs)
  }

  function notifyRendererCloseRequested() {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
      return
    }

    const behavior = closeBehaviorStorage.getCloseBehaviorSync()
    closeRequestPending = true
    closeAckReceived = false
    closeRequestGeneration += 1
    const generation = closeRequestGeneration
    mainWindow.webContents.send('app:closeRequested', { behavior })
    scheduleCloseAckFallback(behavior, generation)
  }

  function attachWindow(win) {
    mainWindow = win
    win.on('close', (event) => {
      if (allowQuit) return

      event.preventDefault()

      const updaterState = getUpdaterState()
      if (updaterState && updaterState.status === 'installing') {
        allowQuit = true
        clearCloseAckFallbackTimer()
        closeRequestPending = false
        win.destroy()
        return
      }

      if (win.isDestroyed() || win.webContents.isDestroyed()) return

      // Always (re)notify renderer. If the first event was missed before the
      // Vue listener subscribed, a later close must not be permanently ignored.
      notifyRendererCloseRequested()
    })
  }

  function acknowledgeCloseFromRenderer() {
    if (!closeRequestPending) {
      return { ok: true, ignored: true }
    }
    closeAckReceived = true
    clearCloseAckFallbackTimer()
    return { ok: true, ignored: false }
  }

  async function resolveCloseFromRenderer(payload) {
    const validated = validateResolvePayload(payload)
    if (!validated) {
      return { ok: false, reason: 'invalid_payload' }
    }

    clearCloseAckFallbackTimer()
    closeRequestPending = false
    closeAckReceived = false

    if (validated.action === 'cancel') {
      return { ok: true, action: 'cancel' }
    }

    const updaterState = getUpdaterState()
    if (updaterState && updaterState.status === 'installing' && validated.action === 'tray') {
      return { ok: false, reason: 'installing' }
    }

    if (validated.remember) {
      await closeBehaviorStorage.setCloseBehavior(validated.action)
    }

    if (validated.action === 'quit') {
      performQuit()
    } else if (validated.action === 'tray') {
      hideToTray()
    }

    return { ok: true, action: validated.action }
  }

  function performQuit() {
    allowQuit = true
    clearCloseAckFallbackTimer()
    closeRequestPending = false
    destroyTray()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close()
      return
    }
    app.quit()
  }

  function hideToTray() {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.hide()
    ensureTray()
  }

  function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  }

  function ensureTray() {
    if (tray) return
    const image = nativeImage.createFromPath(iconPath)
    tray = new Tray(image)
    tray.setToolTip('云栈')
    const contextMenu = Menu.buildFromTemplate([
      { label: '打开云栈', click: () => showMainWindow() },
      { type: 'separator' },
      { label: '退出应用', click: () => quitFromTray() },
    ])
    tray.setContextMenu(contextMenu)
    tray.on('click', () => showMainWindow())
  }

  function destroyTray() {
    if (!tray) return
    tray.destroy()
    tray = null
  }

  function quitFromTray() {
    allowQuit = true
    clearCloseAckFallbackTimer()
    closeRequestPending = false
    closeAckReceived = false
    destroyTray()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy()
    }
    app.quit()
  }

  function registerLifecycleHooks() {
    app.on('before-quit', () => {
      clearCloseAckFallbackTimer()
      destroyTray()
    })
  }

  function getInternalState() {
    return {
      allowQuit,
      closeRequestPending,
      closeAckReceived,
      hasTray: Boolean(tray),
      hasCloseAckFallbackTimer: closeAckFallbackTimer !== null,
    }
  }

  function resetInternalStateForTests() {
    clearCloseAckFallbackTimer()
    allowQuit = false
    closeRequestPending = false
    closeAckReceived = false
    closeRequestGeneration = 0
  }

  return {
    attachWindow,
    acknowledgeCloseFromRenderer,
    resolveCloseFromRenderer,
    quitFromTray,
    showMainWindow,
    performQuit,
    hideToTray,
    destroyTray,
    validateResolvePayload,
    registerLifecycleHooks,
    getInternalState,
    resetInternalStateForTests,
    CLOSE_ACK_FALLBACK_MS: closeAckFallbackMs,
  }
}

module.exports = {
  createDesktopCloseManager,
  CLOSE_RESOLVE_ACTIONS,
  CLOSE_ACK_FALLBACK_MS,
}
