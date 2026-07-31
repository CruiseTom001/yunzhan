import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createDesktopPendingUpdateStorage, MARKER_FILE_NAME } = require('./desktop-pending-update.cjs')

async function createTempStorage() {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'yunzhan-pending-update-'))
  const storage = createDesktopPendingUpdateStorage({
    app: { getPath: () => userData },
    logWarning: () => {},
  })
  return { userData, storage }
}

describe('desktop pending update marker', () => {
  const tempDirs = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it('writes marker atomically after update-downloaded payload', async () => {
    const { userData, storage } = await createTempStorage()
    tempDirs.push(userData)

    const result = await storage.writePendingUpdateMarker('1.3.0', 1_700_000_000_000)
    expect(result.ok).toBe(true)

    const raw = await fs.readFile(path.join(userData, MARKER_FILE_NAME), 'utf8')
    const parsed = JSON.parse(raw)
    expect(parsed).toEqual({
      schemaVersion: 1,
      version: '1.3.0',
      downloadedAt: 1_700_000_000_000,
    })
    expect(JSON.stringify(parsed)).not.toMatch(/api[_-]?key|token|cookie|password/i)
  })

  it('restores marker when current version is older', async () => {
    const { userData, storage } = await createTempStorage()
    tempDirs.push(userData)
    await storage.writePendingUpdateMarker('1.3.0', Date.now())

    const resolved = storage.resolvePendingUpdateMarkerSync({
      currentVersion: '1.2.9',
      now: Date.now(),
    })
    expect(resolved.action).toBe('restore')
    expect(resolved.marker.version).toBe('1.3.0')
  })

  it('clears marker after new version is installed', async () => {
    const { userData, storage } = await createTempStorage()
    tempDirs.push(userData)
    await storage.writePendingUpdateMarker('1.3.0', Date.now())

    const resolved = storage.resolvePendingUpdateMarkerSync({
      currentVersion: '1.3.0',
      now: Date.now(),
    })
    expect(resolved.action).toBe('cleared')
    expect(resolved.reason).toBe('already_installed')

    await expect(fs.access(path.join(userData, MARKER_FILE_NAME))).rejects.toBeTruthy()
  })

  it('keeps marker file when install fails (no clear on write path)', async () => {
    const { userData, storage } = await createTempStorage()
    tempDirs.push(userData)
    await storage.writePendingUpdateMarker('1.3.0', Date.now())

    // Install failure must not clear the marker; only explicit clear / resolve does.
    const resolved = storage.resolvePendingUpdateMarkerSync({
      currentVersion: '1.2.9',
      now: Date.now(),
    })
    expect(resolved.action).toBe('restore')
    await expect(fs.access(path.join(userData, MARKER_FILE_NAME))).resolves.toBeUndefined()
  })

  it('safely clears corrupt markers', async () => {
    const { userData, storage } = await createTempStorage()
    tempDirs.push(userData)
    await fs.writeFile(path.join(userData, MARKER_FILE_NAME), '{not-json', 'utf8')

    const resolved = storage.resolvePendingUpdateMarkerSync({
      currentVersion: '1.2.9',
      now: Date.now(),
    })
    expect(resolved).toEqual({ action: 'cleared', reason: 'corrupt' })
    await expect(fs.access(path.join(userData, MARKER_FILE_NAME))).rejects.toBeTruthy()
  })

  it('clears expired markers', async () => {
    const { userData, storage } = await createTempStorage()
    tempDirs.push(userData)
    const old = Date.now() - (15 * 24 * 60 * 60 * 1000)
    await storage.writePendingUpdateMarker('1.3.0', old)

    const resolved = storage.resolvePendingUpdateMarkerSync({
      currentVersion: '1.2.9',
      now: Date.now(),
    })
    expect(resolved.action).toBe('cleared')
    expect(resolved.reason).toBe('expired')
  })
})
