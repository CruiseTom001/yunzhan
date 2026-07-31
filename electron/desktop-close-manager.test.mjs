import { describe, expect, it, vi } from 'vitest'
import { createDesktopCloseManager } from './desktop-close-manager.cjs'

function createMockWindow() {
  const listeners = new Map()
  return {
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      send: vi.fn(),
    },
    hide: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    isVisible: () => true,
    isMinimized: () => false,
    close: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn((event, handler) => {
      listeners.set(event, handler)
    }),
    emitClose(event) {
      const handler = listeners.get(event)
      const prevent = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
      handler?.(prevent)
      return prevent
    },
  }
}

function createManager(overrides = {}) {
  const app = {
    quit: vi.fn(),
    on: vi.fn(),
  }
  const closeBehaviorStorage = {
    getCloseBehaviorSync: vi.fn(() => 'ask'),
    setCloseBehavior: vi.fn(async (value) => ({ closeBehavior: value })),
  }
  const manager = createDesktopCloseManager({
    app,
    Tray: vi.fn(function Tray() {
      this.setToolTip = vi.fn()
      this.setContextMenu = vi.fn()
      this.on = vi.fn()
      this.destroy = vi.fn()
    }),
    Menu: {
      buildFromTemplate: vi.fn(() => ({})),
    },
    nativeImage: {
      createFromPath: vi.fn(() => ({})),
    },
    closeBehaviorStorage,
    getUpdaterState: vi.fn(() => ({ status: 'idle' })),
    iconPath: '/tmp/icon.ico',
    ...overrides,
  })
  return { manager, app, closeBehaviorStorage }
}

describe('desktop close manager', () => {
  it('requests renderer confirmation on first close when behavior is ask', () => {
    const { manager } = createManager()
    const win = createMockWindow()
    manager.attachWindow(win)

    const event = win.emitClose('close')
    expect(event.defaultPrevented).toBe(true)
    expect(win.webContents.send).toHaveBeenCalledWith('app:closeRequested', { behavior: 'ask' })
  })

  it('re-sends close requests while pending so missed listeners can recover', () => {
    const { manager } = createManager()
    const win = createMockWindow()
    manager.attachWindow(win)

    win.emitClose('close')
    win.emitClose('close')
    expect(win.webContents.send).toHaveBeenCalledTimes(2)
    expect(manager.getInternalState().closeRequestPending).toBe(true)
  })

  it('cancels ack fallback after renderer acknowledges', () => {
    const timers = []
    const { manager } = createManager({
      closeAckFallbackMs: 20,
      setTimeoutFn: (fn, ms) => {
        const handle = { fn, ms, cleared: false }
        timers.push(handle)
        return handle
      },
      clearTimeoutFn: (handle) => {
        if (handle) handle.cleared = true
      },
    })
    const win = createMockWindow()
    manager.attachWindow(win)
    win.emitClose('close')
    expect(manager.getInternalState().hasCloseAckFallbackTimer).toBe(true)

    expect(manager.acknowledgeCloseFromRenderer()).toEqual({ ok: true, ignored: false })
    expect(manager.getInternalState().closeAckReceived).toBe(true)
    expect(manager.getInternalState().hasCloseAckFallbackTimer).toBe(false)
    expect(timers[0]?.cleared).toBe(true)
  })

  it('falls back to quit when remembered quit never receives renderer ack', async () => {
    let scheduled = null
    const { manager } = createManager({
      closeBehaviorStorage: {
        getCloseBehaviorSync: vi.fn(() => 'quit'),
        setCloseBehavior: vi.fn(async (value) => ({ closeBehavior: value })),
      },
      closeAckFallbackMs: 10,
      setTimeoutFn: (fn) => {
        scheduled = fn
        return 1
      },
      clearTimeoutFn: vi.fn(),
    })
    const win = createMockWindow()
    manager.attachWindow(win)
    win.emitClose('close')
    expect(typeof scheduled).toBe('function')

    scheduled()
    expect(win.close).toHaveBeenCalled()
    expect(manager.getInternalState().closeRequestPending).toBe(false)
  })

  it('falls back to tray when remembered tray never receives renderer ack', async () => {
    let scheduled = null
    const { manager } = createManager({
      closeBehaviorStorage: {
        getCloseBehaviorSync: vi.fn(() => 'tray'),
        setCloseBehavior: vi.fn(async (value) => ({ closeBehavior: value })),
      },
      closeAckFallbackMs: 10,
      setTimeoutFn: (fn) => {
        scheduled = fn
        return 1
      },
      clearTimeoutFn: vi.fn(),
    })
    const win = createMockWindow()
    manager.attachWindow(win)
    win.emitClose('close')

    scheduled()
    expect(win.hide).toHaveBeenCalled()
    expect(manager.getInternalState().hasTray).toBe(true)
  })

  it('quits without dialog when allowQuit is set through resolve', async () => {
    const { manager } = createManager()
    const win = createMockWindow()
    manager.attachWindow(win)

    await manager.resolveCloseFromRenderer({ action: 'quit', remember: false })
    expect(win.close).toHaveBeenCalled()
  })

  it('hides window to tray when tray action is resolved', async () => {
    const { manager } = createManager()
    const win = createMockWindow()
    manager.attachWindow(win)

    await manager.resolveCloseFromRenderer({ action: 'tray', remember: false })
    expect(win.hide).toHaveBeenCalled()
    expect(manager.getInternalState().hasTray).toBe(true)
  })

  it('remembers preference when resolve payload includes remember', async () => {
    const { manager, closeBehaviorStorage } = createManager()
    const win = createMockWindow()
    manager.attachWindow(win)

    await manager.resolveCloseFromRenderer({ action: 'quit', remember: true })
    expect(closeBehaviorStorage.setCloseBehavior).toHaveBeenCalledWith('quit')
  })

  it('clears pending state on cancel', async () => {
    const { manager } = createManager()
    const win = createMockWindow()
    manager.attachWindow(win)
    win.emitClose('close')

    await manager.resolveCloseFromRenderer({ action: 'cancel', remember: false })
    expect(manager.getInternalState().closeRequestPending).toBe(false)
  })

  it('allows destroy during installing update without tray bypass', () => {
    const { manager } = createManager({
      getUpdaterState: vi.fn(() => ({ status: 'installing' })),
    })
    const win = createMockWindow()
    manager.attachWindow(win)

    const event = win.emitClose('close')
    expect(event.defaultPrevented).toBe(true)
    expect(win.destroy).toHaveBeenCalled()
    expect(win.webContents.send).not.toHaveBeenCalled()
  })

  it('blocks tray resolve while installing update', async () => {
    const { manager } = createManager({
      getUpdaterState: vi.fn(() => ({ status: 'installing' })),
    })
    const result = await manager.resolveCloseFromRenderer({ action: 'tray', remember: false })
    expect(result).toEqual({ ok: false, reason: 'installing' })
  })

  it('quits from tray without sending close request again', () => {
    const { manager, app } = createManager()
    const win = createMockWindow()
    manager.attachWindow(win)

    manager.quitFromTray()
    expect(win.destroy).toHaveBeenCalled()
    expect(app.quit).toHaveBeenCalled()
    expect(manager.getInternalState().allowQuit).toBe(true)
  })

  it('rejects invalid resolve payloads', async () => {
    const { manager } = createManager()
    await expect(manager.resolveCloseFromRenderer({ action: 'noop' })).resolves.toEqual({
      ok: false,
      reason: 'invalid_payload',
    })
  })
})
