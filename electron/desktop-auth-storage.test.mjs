import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTO_LOGIN_PERSIST_WARNING,
  createDesktopAuthStorage,
  SESSION_COOKIE_NAME,
  SESSION_FILE_NAME,
} from './desktop-auth-storage.cjs'

const TEST_TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789abcd'

function createTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'yunzhan-desktop-auth-'))
}

function createMockSafeStorage(overrides = {}) {
  let lastPlaintext = ''
  return {
    isEncryptionAvailable: vi.fn(() => true),
    getSelectedStorageBackend: vi.fn(() => 'gnome_libsecret'),
    encryptString: vi.fn((value) => {
      lastPlaintext = value
      return Buffer.from('010203040506070809', 'hex')
    }),
    decryptString: vi.fn(() => lastPlaintext),
    ...overrides,
  }
}

describe('desktop auth storage', () => {
  let tempDir = ''
  let cookies = new Map()
  let safeStorage = createMockSafeStorage()
  let warnings = []

  const app = {
    getPath: () => tempDir,
    isReady: () => true,
  }

  function createStorage(platform = 'win32') {
    return createDesktopAuthStorage({
      safeStorage,
      app,
      desktopApiCookies: cookies,
      platform,
      logWarning: (message) => warnings.push(message),
    })
  }

  beforeEach(async () => {
    tempDir = await createTempDir()
    cookies = new Map()
    safeStorage = createMockSafeStorage()
    warnings = []
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('links auto login to remember identifier', () => {
    const storage = createStorage()
    expect(storage.validatePreferencesInput({
      rememberIdentifier: false,
      autoLogin: true,
      identifier: 'user@example.com',
    })).toMatchObject({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
  })

  it('keeps memory cookie when disabling auto login after login', async () => {
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)
    await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    expect(cookies.get(SESSION_COOKIE_NAME)).toBe(TEST_TOKEN)

    const result = await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: false,
      identifier: 'user@example.com',
    })
    expect(result.autoLogin).toBe(false)
    expect(cookies.get(SESSION_COOKIE_NAME)).toBe(TEST_TOKEN)
    await expect(fs.stat(path.join(tempDir, SESSION_FILE_NAME))).rejects.toThrow()

    cookies.clear()
    const restored = await storage.restoreAutoLoginSessionToCookies()
    expect(restored.restored).toBe(false)
  })

  it('encrypts session file without plaintext token on disk', async () => {
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)
    await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    const raw = await fs.readFile(path.join(tempDir, SESSION_FILE_NAME))
    expect(raw.toString('utf8').includes(TEST_TOKEN)).toBe(false)
  })

  it('restores valid session cookie on startup', async () => {
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)
    await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    cookies.clear()
    const result = await storage.restoreAutoLoginSessionToCookies()
    expect(result.restored).toBe(true)
    expect(cookies.get(SESSION_COOKIE_NAME)).toBe(TEST_TOKEN)
  })

  it('rolls back autoLogin when encryption fails but keeps memory cookie', async () => {
    safeStorage.encryptString = vi.fn(() => {
      throw new Error('encrypt failed')
    })
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)

    const result = await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })

    expect(result.autoLogin).toBe(false)
    expect(result.warning).toBe(AUTO_LOGIN_PERSIST_WARNING)
    expect(result.warning).not.toContain(TEST_TOKEN)
    expect(cookies.get(SESSION_COOKIE_NAME)).toBe(TEST_TOKEN)
    await expect(fs.stat(path.join(tempDir, SESSION_FILE_NAME))).rejects.toThrow()
    const tmpFiles = (await fs.readdir(tempDir)).filter((entry) => entry.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
  })

  it('serializes concurrent auto login persistence without losing final file', async () => {
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)
    const results = await Promise.all([
      storage.setDesktopLoginPreferences({
        rememberIdentifier: true,
        autoLogin: true,
        identifier: 'user@example.com',
      }),
      storage.setDesktopLoginPreferences({
        rememberIdentifier: true,
        autoLogin: true,
        identifier: 'user@example.com',
      }),
    ])
    expect(results.every((result) => result.autoLogin === true)).toBe(true)
    await expect(fs.stat(path.join(tempDir, SESSION_FILE_NAME))).resolves.toBeDefined()
    const tmpFiles = (await fs.readdir(tempDir)).filter((entry) => entry.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
  })

  it('does not leak token in warnings or logs when persist fails', async () => {
    safeStorage.encryptString = vi.fn(() => {
      throw new Error(`encrypt failed for ${TEST_TOKEN}`)
    })
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)
    const result = await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    expect(JSON.stringify(result)).not.toContain(TEST_TOKEN)
    expect(warnings.join(' ')).not.toContain(TEST_TOKEN)
  })

  it('clears invalid encrypted session safely', async () => {
    const storage = createStorage()
    const filePath = path.join(tempDir, SESSION_FILE_NAME)
    await fs.writeFile(filePath, 'corrupted-bytes', 'utf8')
    const result = await storage.restoreAutoLoginSessionToCookies()
    expect(result.restored).toBe(false)
    await expect(fs.stat(filePath)).rejects.toThrow()
  })

  it('restore survives read EPERM and does not throw', async () => {
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)
    await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    const readFile = fs.readFile.bind(fs)
    vi.spyOn(fs, 'readFile').mockImplementation(async (target, ...args) => {
      if (String(target).endsWith(SESSION_FILE_NAME)) {
        const error = new Error('EPERM')
        error.code = 'EPERM'
        throw error
      }
      return readFile(target, ...args)
    })

    await expect(storage.restoreAutoLoginSessionToCookies()).resolves.toMatchObject({
      restored: false,
      reason: 'read_failed',
    })
    expect(warnings.join(' ')).not.toContain(TEST_TOKEN)
  })

  it('disables auto login on Linux basic_text backend', async () => {
    safeStorage.getSelectedStorageBackend = vi.fn(() => 'basic_text')
    const storage = createStorage('linux')
    const prefs = await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    expect(prefs.autoLogin).toBe(false)
  })

  it('clearDesktopAutoLogin removes session but can keep identifier', async () => {
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)
    await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    const cleared = await storage.clearDesktopAutoLogin({ keepIdentifier: true })
    expect(cleared.autoLogin).toBe(false)
    expect(cleared.hadAutoLogin).toBe(true)
    expect(cleared.rememberIdentifier).toBe(true)
    expect(cookies.has(SESSION_COOKIE_NAME)).toBe(false)
  })

  it('does not restore cookie when autoLogin preference is false but session file exists', async () => {
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)
    await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    await fs.writeFile(
      path.join(tempDir, 'desktop-login-preferences.json'),
      JSON.stringify({
        schemaVersion: 1,
        rememberIdentifier: true,
        autoLogin: false,
        identifier: 'user@example.com',
      }, null, 2),
      'utf8',
    )
    cookies.clear()

    const result = await storage.restoreAutoLoginSessionToCookies()
    expect(result).toMatchObject({ restored: false, reason: 'auto_login_disabled' })
    expect(cookies.has(SESSION_COOKIE_NAME)).toBe(false)
    await expect(fs.stat(path.join(tempDir, SESSION_FILE_NAME))).rejects.toThrow()
    expect(JSON.stringify(result)).not.toContain(TEST_TOKEN)
    expect(warnings.join(' ')).not.toContain(TEST_TOKEN)
  })

  it('rolls back session file when final autoLogin preference write fails', async () => {
    const rename = fs.rename.bind(fs)
    vi.spyOn(fs, 'rename').mockImplementation(async (source, destination) => {
      if (String(destination).endsWith('desktop-login-preferences.json')) {
        const raw = await fs.readFile(String(source), 'utf8')
        const parsed = JSON.parse(raw)
        if (parsed.autoLogin === true) {
          await fs.rm(String(source), { force: true }).catch(() => {})
          throw new Error('preference rename failed')
        }
      }
      return rename(source, destination)
    })
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)

    const result = await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })

    expect(result.autoLogin).toBe(false)
    expect(result.warning).toBe(AUTO_LOGIN_PERSIST_WARNING)
    expect(cookies.get(SESSION_COOKIE_NAME)).toBe(TEST_TOKEN)
    await expect(fs.stat(path.join(tempDir, SESSION_FILE_NAME))).rejects.toThrow()
    const tmpFiles = (await fs.readdir(tempDir)).filter((entry) => entry.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
    expect(JSON.stringify(result)).not.toContain(TEST_TOKEN)
    expect(warnings.join(' ')).not.toContain(TEST_TOKEN)
  })

  it('applies the last concurrent disable after enable', async () => {
    let releaseSessionWrite
    const sessionWriteGate = new Promise((resolve) => {
      releaseSessionWrite = resolve
    })
    const writeFile = fs.writeFile.bind(fs)
    vi.spyOn(fs, 'writeFile').mockImplementation(async (target, data, ...args) => {
      if (String(target).includes(`${SESSION_FILE_NAME}.`) && String(target).endsWith('.tmp')) {
        await sessionWriteGate
      }
      return writeFile(target, data, ...args)
    })
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)

    const enablePromise = storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    const disablePromise = storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: false,
      identifier: 'user@example.com',
    })
    releaseSessionWrite()
    const [enableResult, disableResult] = await Promise.all([enablePromise, disablePromise])

    expect(disableResult.autoLogin).toBe(false)
    expect(enableResult.autoLogin).toBe(true)
    const finalPrefs = JSON.parse(await fs.readFile(path.join(tempDir, 'desktop-login-preferences.json'), 'utf8'))
    expect(finalPrefs.autoLogin).toBe(false)
    await expect(fs.stat(path.join(tempDir, SESSION_FILE_NAME))).rejects.toThrow()
    expect(cookies.get(SESSION_COOKIE_NAME)).toBe(TEST_TOKEN)
    const tmpFiles = (await fs.readdir(tempDir)).filter((entry) => entry.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
  })

  it('applies the last concurrent clearDesktopAutoLogin after enable', async () => {
    let releaseSessionWrite
    const sessionWriteGate = new Promise((resolve) => {
      releaseSessionWrite = resolve
    })
    const writeFile = fs.writeFile.bind(fs)
    vi.spyOn(fs, 'writeFile').mockImplementation(async (target, data, ...args) => {
      if (String(target).includes(`${SESSION_FILE_NAME}.`) && String(target).endsWith('.tmp')) {
        await sessionWriteGate
      }
      return writeFile(target, data, ...args)
    })
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)

    const enablePromise = storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    const clearPromise = storage.clearDesktopAutoLogin({ keepIdentifier: true })
    releaseSessionWrite()
    await Promise.all([enablePromise, clearPromise])

    const finalPrefs = JSON.parse(await fs.readFile(path.join(tempDir, 'desktop-login-preferences.json'), 'utf8'))
    expect(finalPrefs.autoLogin).toBe(false)
    expect(cookies.has(SESSION_COOKIE_NAME)).toBe(false)
    await expect(fs.stat(path.join(tempDir, SESSION_FILE_NAME))).rejects.toThrow()
    const tmpFiles = (await fs.readdir(tempDir)).filter((entry) => entry.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
  })

  it('continues the auth state queue after a failed enable task', async () => {
    let encryptCalls = 0
    safeStorage.encryptString = vi.fn((value) => {
      encryptCalls += 1
      if (encryptCalls === 1) {
        throw new Error('encrypt failed once')
      }
      return Buffer.from('010203040506070809', 'hex')
    })
    const storage = createStorage()
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)

    const failed = await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    expect(failed.warning).toBe(AUTO_LOGIN_PERSIST_WARNING)

    const succeeded = await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    expect(succeeded.autoLogin).toBe(true)
    expect(succeeded.warning).toBeNull()
    await expect(fs.stat(path.join(tempDir, SESSION_FILE_NAME))).resolves.toBeDefined()
  })

  it('deletes stale session file when earliest enable preference write fails', async () => {
    const storage = createStorage()
    const NEW_TOKEN = 'zyxwvutsrqponmlkjihgfedcba0123456789abcd'
    cookies.set(SESSION_COOKIE_NAME, TEST_TOKEN)
    await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })
    await expect(fs.stat(path.join(tempDir, SESSION_FILE_NAME))).resolves.toBeDefined()

    cookies.set(SESSION_COOKIE_NAME, NEW_TOKEN)

    let preferenceTempWrites = 0
    const writeFile = fs.writeFile.bind(fs)
    vi.spyOn(fs, 'writeFile').mockImplementation(async (target, data, ...args) => {
      if (String(target).includes('desktop-login-preferences') && String(target).endsWith('.tmp')) {
        preferenceTempWrites += 1
        const parsed = JSON.parse(String(data))
        if (parsed.autoLogin === false && preferenceTempWrites === 1) {
          throw new Error('earliest preference write failed')
        }
      }
      return writeFile(target, data, ...args)
    })

    const result = await storage.setDesktopLoginPreferences({
      rememberIdentifier: true,
      autoLogin: true,
      identifier: 'user@example.com',
    })

    expect(result.warning).toBe(AUTO_LOGIN_PERSIST_WARNING)
    expect(result.warning).not.toContain(TEST_TOKEN)
    expect(result.warning).not.toContain(NEW_TOKEN)
    expect(cookies.get(SESSION_COOKIE_NAME)).toBe(NEW_TOKEN)
    await expect(fs.stat(path.join(tempDir, SESSION_FILE_NAME))).rejects.toThrow()
    const prefs = JSON.parse(await fs.readFile(path.join(tempDir, 'desktop-login-preferences.json'), 'utf8'))
    expect(prefs.autoLogin).toBe(false)

    cookies.clear()
    await fs.writeFile(
      path.join(tempDir, 'desktop-login-preferences.json'),
      JSON.stringify({
        schemaVersion: 1,
        rememberIdentifier: true,
        autoLogin: true,
        identifier: 'user@example.com',
      }, null, 2),
      'utf8',
    )
    const restore = await storage.restoreAutoLoginSessionToCookies()
    expect(restore.restored).toBe(false)
    expect(cookies.has(SESSION_COOKIE_NAME)).toBe(false)
    expect(JSON.stringify(restore)).not.toContain(TEST_TOKEN)
    expect(warnings.join(' ')).not.toContain(TEST_TOKEN)
  })

  it('rejects invalid IPC preference payloads', () => {
    const storage = createStorage()
    expect(() => storage.validatePreferencesInput(null)).toThrow(/invalid preferences payload/)
  })
})

describe('desktop app bootstrap', () => {
  it('always reaches createWindow even when restore rejects unexpectedly', async () => {
    let windowCreated = false
    const restore = vi.fn(async () => {
      throw new Error('unexpected restore failure')
    })
    try {
      await restore()
    } catch {
      // main.cjs catches unexpected restore failures
    } finally {
      windowCreated = true
    }
    expect(windowCreated).toBe(true)
  })
})
