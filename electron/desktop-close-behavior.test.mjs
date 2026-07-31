import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDesktopCloseBehaviorStorage,
  PREFS_FILE_NAME,
} from './desktop-close-behavior.cjs'

describe('desktop close behavior storage', () => {
  let tempDir = ''
  let warnings = []

  const app = {
    getPath: () => tempDir,
  }

  function createStorage() {
    return createDesktopCloseBehaviorStorage({
      app,
      logWarning: (message) => warnings.push(message),
    })
  }

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yunzhan-desktop-close-'))
    warnings = []
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('defaults to ask when preference file is missing', async () => {
    const storage = createStorage()
    await storage.init()
    await expect(storage.getCloseBehavior()).resolves.toEqual({ closeBehavior: 'ask' })
  })

  it('persists quit preference with atomic write', async () => {
    const storage = createStorage()
    await storage.init()
    await storage.setCloseBehavior('quit')
    const raw = await fs.readFile(path.join(tempDir, PREFS_FILE_NAME), 'utf8')
    expect(JSON.parse(raw)).toEqual({
      schemaVersion: 1,
      closeBehavior: 'quit',
    })
    expect(raw.includes('password')).toBe(false)
    expect(raw.includes('token')).toBe(false)
    expect(raw.includes('apiKey')).toBe(false)
  })

  it('keeps preference after restart init', async () => {
    const storage = createStorage()
    await storage.init()
    await storage.setCloseBehavior('tray')

    const restarted = createStorage()
    await restarted.init()
    await expect(restarted.getCloseBehavior()).resolves.toEqual({ closeBehavior: 'tray' })
  })

  it('falls back to ask when preference file is corrupted', async () => {
    await fs.writeFile(path.join(tempDir, PREFS_FILE_NAME), '{not-json', 'utf8')
    const storage = createStorage()
    await storage.init()
    expect(storage.getCloseBehaviorSync()).toBe('ask')
  })

  it('falls back to ask when schema version is invalid', async () => {
    await fs.writeFile(path.join(tempDir, PREFS_FILE_NAME), JSON.stringify({
      schemaVersion: 99,
      closeBehavior: 'quit',
    }), 'utf8')
    const storage = createStorage()
    await storage.init()
    expect(storage.getCloseBehaviorSync()).toBe('ask')
  })

  it('rejects invalid set payload values', () => {
    const storage = createStorage()
    expect(storage.validateSetInput(null)).toBeNull()
    expect(storage.validateSetInput({ closeBehavior: 'hide' })).toBeNull()
    expect(storage.validateSetInput({ closeBehavior: 'quit' })).toEqual({ closeBehavior: 'quit' })
  })

  it('falls back to ask when preference write fails', async () => {
    const storage = createStorage()
    await storage.init()
    vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('disk full'))
    await expect(storage.setCloseBehavior('tray')).resolves.toEqual({ closeBehavior: 'ask' })
    expect(warnings.some((message) => message.includes('falling back to ask'))).toBe(true)
    expect(storage.getCloseBehaviorSync()).toBe('ask')
  })

  it('resets close behavior to ask', async () => {
    const storage = createStorage()
    await storage.init()
    await storage.setCloseBehavior('quit')
    await expect(storage.resetCloseBehavior()).resolves.toEqual({ closeBehavior: 'ask' })
  })
})
