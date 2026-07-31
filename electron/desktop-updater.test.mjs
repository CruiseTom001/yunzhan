import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createDesktopUpdater } = require('./desktop-updater.cjs')
const { createDesktopPendingUpdateStorage } = require('./desktop-pending-update.cjs')

const autoUpdaterHandlers = new Map()
const autoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  allowPrerelease: false,
  on: vi.fn((event, handler) => {
    autoUpdaterHandlers.set(event, handler)
  }),
  checkForUpdates: vi.fn(async () => undefined),
  downloadUpdate: vi.fn(async () => undefined),
  quitAndInstall: vi.fn(),
}

const BrowserWindow = {
  getAllWindows: () => [],
}

function emit(event, payload) {
  const handler = autoUpdaterHandlers.get(event)
  if (handler) handler(payload)
}

const tempDirs = []

async function createPendingStorage() {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'yunzhan-updater-marker-'))
  tempDirs.push(userData)
  return createDesktopPendingUpdateStorage({
    app: { getPath: () => userData },
    logWarning: () => {},
  })
}

function createTestUpdater(options = {}) {
  autoUpdaterHandlers.clear()
  autoUpdater.checkForUpdates.mockReset()
  autoUpdater.downloadUpdate.mockReset()
  autoUpdater.quitAndInstall.mockReset()
  autoUpdater.on.mockClear()

  return createDesktopUpdater({
    isPackaged: options.isPackaged ?? true,
    platform: options.platform ?? 'win32',
    BrowserWindow,
    autoUpdater,
    pendingUpdateStorage: options.pendingUpdateStorage ?? null,
    getAppVersion: options.getAppVersion ?? (() => '1.2.9'),
  })
}

describe('desktop-updater service', () => {
  beforeEach(() => {
    autoUpdaterHandlers.clear()
  })

  afterEach(async () => {
    await Promise.allSettled(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it('rejects real updates in development environment', async () => {
    const updater = createTestUpdater({ isPackaged: false })
    const state = await updater.checkForUpdates()
    expect(state.status).toBe('error')
    expect(state.errorCode).toBe('dev_disabled')
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('transitions through check, download, and install in packaged Windows runtime', async () => {
    const updater = createTestUpdater()

    autoUpdater.checkForUpdates.mockImplementation(async () => {
      emit('checking-for-update')
      emit('update-available', { version: '1.3.0' })
    })

    const available = await updater.checkForUpdates()
    expect(available.status).toBe('available')
    expect(available.version).toBe('1.3.0')

    autoUpdater.downloadUpdate.mockImplementation(async () => {
      emit('download-progress', { percent: 50, transferred: 500, total: 1000, bytesPerSecond: 100 })
      emit('update-downloaded', { version: '1.3.0' })
    })

    const downloaded = await updater.downloadUpdate()
    expect(downloaded.status).toBe('downloaded')
    expect(downloaded.percent).toBe(100)

    const installing = updater.installUpdate()
    expect(installing.status).toBe('installing')
    await new Promise((resolve) => setImmediate(resolve))
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })

  it('rejects install before download completes', async () => {
    const updater = createTestUpdater()

    autoUpdater.checkForUpdates.mockImplementation(async () => {
      emit('checking-for-update')
      emit('update-available', { version: '1.3.0' })
    })
    await updater.checkForUpdates()

    const state = updater.installUpdate()
    expect(state.status).not.toBe('installing')
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('rejects duplicate download while downloading', async () => {
    const updater = createTestUpdater()

    autoUpdater.checkForUpdates.mockImplementation(async () => {
      emit('update-available', { version: '1.3.0' })
    })
    await updater.checkForUpdates()

    autoUpdater.downloadUpdate.mockImplementation(async () => {
      emit('download-progress', { percent: 10, transferred: 100, total: 1000, bytesPerSecond: 50 })
      await new Promise((resolve) => setTimeout(resolve, 20))
      emit('update-downloaded', { version: '1.3.0' })
    })

    const first = updater.downloadUpdate()
    const second = updater.downloadUpdate()
    await Promise.all([first, second])
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1)
  })

  it('maps updater errors to safe public messages', async () => {
    const updater = createTestUpdater()
    autoUpdater.checkForUpdates.mockRejectedValue(new Error('404 latest.yml missing at C:\\secret\\latest.yml'))
    const state = await updater.checkForUpdates()
    expect(state.status).toBe('error')
    expect(state.errorCode).toBe('feed_missing')
    expect(state.errorMessage).not.toContain('C:\\secret')
  })

  it('handles quitAndInstall synchronous failures without leaking local paths', async () => {
    const updater = createTestUpdater()

    autoUpdater.checkForUpdates.mockImplementation(async () => {
      emit('update-available', { version: '1.3.0' })
    })
    await updater.checkForUpdates()

    autoUpdater.downloadUpdate.mockImplementation(async () => {
      emit('update-downloaded', { version: '1.3.0' })
    })
    await updater.downloadUpdate()

    autoUpdater.quitAndInstall.mockImplementation(() => {
      throw new Error('failed to launch C:\\Users\\secret\\setup.exe')
    })

    const installing = updater.installUpdate()
    expect(installing.status).toBe('installing')
    await new Promise((resolve) => setImmediate(resolve))

    const state = updater.getState()
    expect(state.status).toBe('error')
    expect(state.errorCode).toBe('install_failed')
    expect(state.errorMessage).not.toContain('C:\\Users')
    expect(state.errorMessage).toContain('安装启动失败')
  })

  it('allows retrying install after quitAndInstall failure', async () => {
    const updater = createTestUpdater()

    autoUpdater.checkForUpdates.mockImplementation(async () => {
      emit('update-available', { version: '1.3.0' })
    })
    await updater.checkForUpdates()

    autoUpdater.downloadUpdate.mockImplementation(async () => {
      emit('update-downloaded', { version: '1.3.0' })
    })
    await updater.downloadUpdate()

    autoUpdater.quitAndInstall.mockImplementationOnce(() => {
      throw new Error('install failed')
    })

    updater.installUpdate()
    await new Promise((resolve) => setImmediate(resolve))
    expect(updater.getState().status).toBe('error')

    autoUpdater.quitAndInstall.mockImplementation(() => undefined)
    const retry = updater.installUpdate()
    expect(retry.status).toBe('installing')
  })

  it('writes pending marker on update-downloaded', async () => {
    const pendingUpdateStorage = await createPendingStorage()
    const updater = createTestUpdater({ pendingUpdateStorage })

    autoUpdater.checkForUpdates.mockImplementation(async () => {
      emit('update-available', { version: '1.3.0' })
    })
    await updater.checkForUpdates()
    autoUpdater.downloadUpdate.mockImplementation(async () => {
      emit('update-downloaded', { version: '1.3.0' })
    })
    await updater.downloadUpdate()

    const resolved = pendingUpdateStorage.resolvePendingUpdateMarkerSync({
      currentVersion: '1.2.9',
      now: Date.now(),
    })
    expect(resolved.action).toBe('restore')
    expect(resolved.marker.version).toBe('1.3.0')
  })

  it('restores downloaded state from pending marker on startup', async () => {
    const pendingUpdateStorage = await createPendingStorage()
    await pendingUpdateStorage.writePendingUpdateMarker('1.3.0', Date.now())

    const updater = createTestUpdater({
      pendingUpdateStorage,
      getAppVersion: () => '1.2.9',
    })
    expect(updater.getState()).toMatchObject({
      status: 'downloaded',
      version: '1.3.0',
      percent: 100,
    })
  })

  it('clears marker and stays idle when app already reached marker version', async () => {
    const pendingUpdateStorage = await createPendingStorage()
    await pendingUpdateStorage.writePendingUpdateMarker('1.3.0', Date.now())

    const updater = createTestUpdater({
      pendingUpdateStorage,
      getAppVersion: () => '1.3.0',
    })
    expect(updater.getState().status).toBe('idle')
    expect(pendingUpdateStorage.resolvePendingUpdateMarkerSync({
      currentVersion: '1.3.0',
      now: Date.now(),
    }).action).toBe('none')
  })

  it('keeps marker after install failure so restart can restore', async () => {
    const pendingUpdateStorage = await createPendingStorage()
    const updater = createTestUpdater({ pendingUpdateStorage })

    autoUpdater.checkForUpdates.mockImplementation(async () => {
      emit('update-available', { version: '1.3.0' })
    })
    await updater.checkForUpdates()
    autoUpdater.downloadUpdate.mockImplementation(async () => {
      emit('update-downloaded', { version: '1.3.0' })
    })
    await updater.downloadUpdate()

    autoUpdater.quitAndInstall.mockImplementation(() => {
      throw new Error('install failed')
    })
    updater.installUpdate()
    await new Promise((resolve) => setImmediate(resolve))
    expect(updater.getState().status).toBe('error')

    const resolved = pendingUpdateStorage.resolvePendingUpdateMarkerSync({
      currentVersion: '1.2.9',
      now: Date.now(),
    })
    expect(resolved.action).toBe('restore')
  })

  it('does not re-check GitHub when already downloaded', async () => {
    const pendingUpdateStorage = await createPendingStorage()
    await pendingUpdateStorage.writePendingUpdateMarker('1.3.0', Date.now())
    const updater = createTestUpdater({
      pendingUpdateStorage,
      getAppVersion: () => '1.2.9',
    })

    const state = await updater.checkForUpdates()
    expect(state.status).toBe('downloaded')
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })
})
