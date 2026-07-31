const fs = require('fs/promises')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

const PREFS_SCHEMA_VERSION = 1
const SESSION_SCHEMA_VERSION = 1
const SESSION_COOKIE_NAME = 'yunzhan_session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const IDENTIFIER_MAX_LENGTH = 254
const SESSION_TOKEN_MAX_LENGTH = 128
const PREFS_FILE_NAME = 'desktop-login-preferences.json'
const SESSION_FILE_NAME = 'desktop-auto-login.bin'
const AUTO_LOGIN_PERSIST_WARNING = '已登录，但自动登录信息保存失败，请重试。'

const LINUX_INSECURE_BACKEND = 'basic_text'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function defaultPreferences() {
  return {
    schemaVersion: PREFS_SCHEMA_VERSION,
    rememberIdentifier: false,
    autoLogin: false,
    identifier: '',
  }
}

function createDesktopAuthStorage(deps) {
  const {
    safeStorage,
    app,
    desktopApiCookies,
    platform,
    logWarning = (message) => console.warn(message),
  } = deps

  let persistOperation = Promise.resolve()

  function getUserDataPath() {
    return app.getPath('userData')
  }

  function getPreferencesPath() {
    return path.join(getUserDataPath(), PREFS_FILE_NAME)
  }

  function getSessionFilePath() {
    return path.join(getUserDataPath(), SESSION_FILE_NAME)
  }

  function isAppReady() {
    return typeof app.isReady === 'function' ? app.isReady() : true
  }

  function getSelectedStorageBackend() {
    if (platform !== 'linux') return null
    if (!safeStorage || typeof safeStorage.getSelectedStorageBackend !== 'function') {
      return 'unknown'
    }
    if (!isAppReady()) return 'unknown'
    return safeStorage.getSelectedStorageBackend()
  }

  function isAutoLoginStorageAvailable() {
    if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function') {
      return false
    }
    if (!isAppReady() || !safeStorage.isEncryptionAvailable()) {
      return false
    }
    if (platform === 'linux' && getSelectedStorageBackend() === LINUX_INSECURE_BACKEND) {
      return false
    }
    return true
  }

  function getAutoLoginDisabledReason() {
    if (isAutoLoginStorageAvailable()) return null
    if (platform === 'linux' && getSelectedStorageBackend() === LINUX_INSECURE_BACKEND) {
      return '当前 Linux 环境无法安全保存自动登录信息，已禁用自动登录。'
    }
    if (!safeStorage?.isEncryptionAvailable?.() || !isAppReady()) {
      return '当前系统无法安全保存自动登录信息，已禁用自动登录。'
    }
    return '当前系统无法安全保存自动登录信息，已禁用自动登录。'
  }

  function normalizeIdentifier(value) {
    if (typeof value !== 'string') return ''
    const trimmed = value.trim()
    if (trimmed.length < 1 || trimmed.length > IDENTIFIER_MAX_LENGTH) return ''
    return trimmed
  }

  function validatePreferencesInput(value) {
    if (!isPlainObject(value)) throw new Error('invalid preferences payload')
    let rememberIdentifier = value.rememberIdentifier === true
    let autoLogin = value.autoLogin === true
    if (autoLogin) {
      rememberIdentifier = true
    }
    if (!isAutoLoginStorageAvailable()) {
      autoLogin = false
    }
    let identifier = normalizeIdentifier(value.identifier)
    if (!rememberIdentifier) {
      identifier = ''
      autoLogin = false
    }
    return {
      schemaVersion: PREFS_SCHEMA_VERSION,
      rememberIdentifier,
      autoLogin,
      identifier,
    }
  }

  function buildPreferenceResponse(preferences, warning = null) {
    const autoLoginAvailable = isAutoLoginStorageAvailable()
    return {
      rememberIdentifier: preferences.rememberIdentifier,
      autoLogin: autoLoginAvailable ? preferences.autoLogin : false,
      identifier: preferences.rememberIdentifier ? preferences.identifier : '',
      autoLoginAvailable,
      autoLoginDisabledReason: autoLoginAvailable ? null : getAutoLoginDisabledReason(),
      warning,
    }
  }

  async function readPreferencesFile() {
    try {
      const raw = await fs.readFile(getPreferencesPath(), 'utf8')
      const parsed = JSON.parse(raw)
      if (!isPlainObject(parsed) || parsed.schemaVersion !== PREFS_SCHEMA_VERSION) {
        return defaultPreferences()
      }
      return validatePreferencesInput({
        rememberIdentifier: parsed.rememberIdentifier === true,
        autoLogin: parsed.autoLogin === true,
        identifier: typeof parsed.identifier === 'string' ? parsed.identifier : '',
      })
    } catch (error) {
      if (error && error.code === 'ENOENT') return defaultPreferences()
      return defaultPreferences()
    }
  }

  function createPreferenceTempPath() {
    return `${getPreferencesPath()}.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`
  }

  async function cleanupPreferenceTempFiles() {
    const dir = getUserDataPath()
    let entries = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      return
    }
    await Promise.allSettled(
      entries
        .filter((entry) => entry.startsWith(`${PREFS_FILE_NAME}.`) && entry.endsWith('.tmp'))
        .map((entry) => fs.rm(path.join(dir, entry), { force: true })),
    )
  }

  async function writePreferencesFile(preferences) {
    const validated = validatePreferencesInput(preferences)
    const tempPath = createPreferenceTempPath()
    await fs.mkdir(getUserDataPath(), { recursive: true })
    try {
      await fs.writeFile(tempPath, JSON.stringify(validated, null, 2), 'utf8')
      await fs.rename(tempPath, getPreferencesPath())
      return validated
    } catch {
      await fs.rm(tempPath, { force: true }).catch(() => {})
      throw new Error('preferences_write_failed')
    }
  }

  function validateSessionPayload(value) {
    if (!isPlainObject(value)) return null
    if (value.schemaVersion !== SESSION_SCHEMA_VERSION) return null
    if (value.cookieName !== SESSION_COOKIE_NAME) return null
    if (typeof value.token !== 'string'
      || value.token.length < 16
      || value.token.length > SESSION_TOKEN_MAX_LENGTH) return null
    if (!Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) return null
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      cookieName: SESSION_COOKIE_NAME,
      token: value.token,
      expiresAt: value.expiresAt,
    }
  }

  async function encryptSessionPayload(payload) {
    const serialized = JSON.stringify(payload)
    if (typeof safeStorage.encryptStringAsync === 'function') {
      return safeStorage.encryptStringAsync(serialized)
    }
    if (typeof safeStorage.encryptString === 'function') {
      return safeStorage.encryptString(serialized)
    }
    throw new Error('safeStorage encrypt unavailable')
  }

  async function decryptSessionPayload(buffer) {
    if (typeof safeStorage.decryptStringAsync === 'function') {
      const decrypted = await safeStorage.decryptStringAsync(buffer)
      return JSON.parse(decrypted)
    }
    if (typeof safeStorage.decryptString === 'function') {
      return JSON.parse(safeStorage.decryptString(buffer))
    }
    throw new Error('safeStorage decrypt unavailable')
  }

  function createSessionTempPath() {
    return `${getSessionFilePath()}.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`
  }

  async function cleanupSessionTempFiles() {
    const dir = getUserDataPath()
    let entries = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      return
    }
    await Promise.allSettled(
      entries
        .filter((entry) => entry.startsWith(`${SESSION_FILE_NAME}.`) && entry.endsWith('.tmp'))
        .map((entry) => fs.rm(path.join(dir, entry), { force: true })),
    )
  }

  async function deleteSessionFileBestEffort() {
    try {
      await fs.rm(getSessionFilePath(), { force: true })
    } catch (error) {
      logWarning('Failed to remove desktop auto-login session file.')
      if (error && typeof error.message === 'string') {
        logWarning(error.message.slice(0, 120))
      }
    }
    await cleanupSessionTempFiles()
  }

  async function persistAutoLoginSessionFromMemoryCookie() {
    if (!isAutoLoginStorageAvailable()) {
      return { ok: false, reason: 'storage_unavailable' }
    }
    const token = desktopApiCookies.get(SESSION_COOKIE_NAME)
    if (typeof token !== 'string' || token.length < 16 || token.length > SESSION_TOKEN_MAX_LENGTH) {
      return { ok: false, reason: 'missing_session_cookie' }
    }
    const payload = validateSessionPayload({
      schemaVersion: SESSION_SCHEMA_VERSION,
      cookieName: SESSION_COOKIE_NAME,
      token,
      expiresAt: Date.now() + SESSION_DURATION_MS,
    })
    if (!payload) return { ok: false, reason: 'invalid_session_payload' }

    const tempPath = createSessionTempPath()
    try {
      const encrypted = await encryptSessionPayload(payload)
      await fs.mkdir(getUserDataPath(), { recursive: true })
      await fs.writeFile(tempPath, encrypted)
      await fs.rename(tempPath, getSessionFilePath())
      return { ok: true }
    } catch {
      await fs.rm(tempPath, { force: true }).catch(() => {})
      await deleteSessionFileBestEffort()
      return { ok: false, reason: 'persist_failed' }
    }
  }

  function runAuthStateExclusive(task) {
    const next = persistOperation.then(task, task)
    persistOperation = next.catch(() => {})
    return next
  }

  function clearMemorySessionCookie() {
    desktopApiCookies.delete(SESSION_COOKIE_NAME)
  }

  async function restoreAutoLoginSessionToCookies() {
    try {
      const preferences = await readPreferencesFile()
      if (preferences.autoLogin !== true) {
        await deleteSessionFileBestEffort()
        return { restored: false, reason: 'auto_login_disabled' }
      }
      if (!isAutoLoginStorageAvailable()) {
        await deleteSessionFileBestEffort()
        return { restored: false, reason: getAutoLoginDisabledReason() }
      }
      let encrypted
      try {
        encrypted = await fs.readFile(getSessionFilePath())
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          return { restored: false, reason: 'missing_session_file' }
        }
        logWarning('Failed to read desktop auto-login session file.')
        await deleteSessionFileBestEffort()
        return { restored: false, reason: 'read_failed' }
      }

      let parsed
      try {
        parsed = await decryptSessionPayload(encrypted)
      } catch {
        logWarning('Failed to decrypt desktop auto-login session file.')
        await deleteSessionFileBestEffort()
        return { restored: false, reason: 'decrypt_failed' }
      }

      const payload = validateSessionPayload(parsed)
      if (!payload) {
        await deleteSessionFileBestEffort()
        return { restored: false, reason: 'expired_or_invalid' }
      }
      desktopApiCookies.set(payload.cookieName, payload.token)
      return { restored: true }
    } catch {
      logWarning('Unexpected desktop auto-login restore failure.')
      await deleteSessionFileBestEffort()
      return { restored: false, reason: 'unexpected_restore_failure' }
    }
  }

  async function clearDesktopAutoLogin(options = {}) {
    return runAuthStateExclusive(async () => {
      const keepIdentifier = options.keepIdentifier === true
      const current = await readPreferencesFile()
      const hadAutoLogin = current.autoLogin === true
      clearMemorySessionCookie()
      await deleteSessionFileBestEffort()
      const next = {
        rememberIdentifier: keepIdentifier ? current.rememberIdentifier : false,
        autoLogin: false,
        identifier: keepIdentifier ? current.identifier : '',
      }
      const saved = await writePreferencesFile(next)
      await cleanupPreferenceTempFiles()
      return {
        ...buildPreferenceResponse(saved),
        hadAutoLogin,
      }
    })
  }

  async function getDesktopLoginPreferences() {
    const preferences = await readPreferencesFile()
    return buildPreferenceResponse(preferences)
  }

  async function setDesktopLoginPreferences(input) {
    return runAuthStateExclusive(async () => {
      const validated = validatePreferencesInput(input)

      if (!validated.autoLogin) {
        await deleteSessionFileBestEffort()
        const saved = await writePreferencesFile(validated)
        await cleanupPreferenceTempFiles()
        return buildPreferenceResponse(saved)
      }

      if (!isAutoLoginStorageAvailable()) {
        const unavailable = { ...validated, autoLogin: false }
        await deleteSessionFileBestEffort()
        const saved = await writePreferencesFile(unavailable)
        await cleanupPreferenceTempFiles()
        return buildPreferenceResponse(saved)
      }

      const withoutAutoLogin = { ...validated, autoLogin: false }

      async function rollbackEnableAutoLoginFailure() {
        await deleteSessionFileBestEffort()
        await cleanupPreferenceTempFiles()
        try {
          const saved = await writePreferencesFile(withoutAutoLogin)
          return buildPreferenceResponse(saved, AUTO_LOGIN_PERSIST_WARNING)
        } catch {
          logWarning('Failed to rollback desktop auto-login preferences after enable failure.')
          const current = await readPreferencesFile()
          return buildPreferenceResponse(
            { ...current, autoLogin: false },
            AUTO_LOGIN_PERSIST_WARNING,
          )
        }
      }

      try {
        await writePreferencesFile(withoutAutoLogin)

        const persistResult = await persistAutoLoginSessionFromMemoryCookie()
        if (!persistResult.ok) {
          return rollbackEnableAutoLoginFailure()
        }

        const saved = await writePreferencesFile(validated)
        await cleanupPreferenceTempFiles()
        return buildPreferenceResponse(saved)
      } catch {
        return rollbackEnableAutoLoginFailure()
      }
    })
  }

  return {
    SESSION_COOKIE_NAME,
    SESSION_FILE_NAME,
    PREFS_FILE_NAME,
    AUTO_LOGIN_PERSIST_WARNING,
    getPreferencesPath,
    getSessionFilePath,
    isAutoLoginStorageAvailable,
    getAutoLoginDisabledReason,
    getDesktopLoginPreferences,
    setDesktopLoginPreferences,
    clearDesktopAutoLogin,
    restoreAutoLoginSessionToCookies,
    persistAutoLoginSessionFromMemoryCookie,
    deleteSessionFileBestEffort,
    clearMemorySessionCookie,
    validatePreferencesInput,
    validateSessionPayload,
    runAuthStateExclusive,
    runPersistExclusive: runAuthStateExclusive,
    cleanupPreferenceTempFiles,
  }
}

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  SESSION_FILE_NAME,
  PREFS_FILE_NAME,
  AUTO_LOGIN_PERSIST_WARNING,
  IDENTIFIER_MAX_LENGTH,
  LINUX_INSECURE_BACKEND,
  createDesktopAuthStorage,
}
