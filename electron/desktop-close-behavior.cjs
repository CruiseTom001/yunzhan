const fs = require('fs/promises')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

const SCHEMA_VERSION = 1
const PREFS_FILE_NAME = 'desktop-close-preferences.json'
const CLOSE_BEHAVIORS = new Set(['ask', 'quit', 'tray'])

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function defaultPreferences() {
  return {
    schemaVersion: SCHEMA_VERSION,
    closeBehavior: 'ask',
  }
}

function normalizeCloseBehavior(value) {
  if (typeof value === 'string' && CLOSE_BEHAVIORS.has(value)) {
    return value
  }
  return 'ask'
}

function createDesktopCloseBehaviorStorage(deps) {
  const {
    app,
    logWarning = (message) => console.warn(message),
  } = deps

  let cached = null

  function getUserDataPath() {
    return app.getPath('userData')
  }

  function getPreferencesPath() {
    return path.join(getUserDataPath(), PREFS_FILE_NAME)
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

  async function readPreferencesFile() {
    try {
      const raw = await fs.readFile(getPreferencesPath(), 'utf8')
      const parsed = JSON.parse(raw)
      if (!isPlainObject(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
        return defaultPreferences()
      }
      return {
        schemaVersion: SCHEMA_VERSION,
        closeBehavior: normalizeCloseBehavior(parsed.closeBehavior),
      }
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return defaultPreferences()
      }
      return defaultPreferences()
    }
  }

  async function init() {
    cached = await readPreferencesFile()
    return cached
  }

  function getCloseBehaviorSync() {
    if (!cached) {
      return 'ask'
    }
    return cached.closeBehavior
  }

  async function getCloseBehavior() {
    if (!cached) {
      await init()
    }
    return { closeBehavior: cached.closeBehavior }
  }

  function validateSetInput(payload) {
    if (!isPlainObject(payload)) return null
    if (typeof payload.closeBehavior !== 'string' || !CLOSE_BEHAVIORS.has(payload.closeBehavior)) {
      return null
    }
    return { closeBehavior: payload.closeBehavior }
  }

  async function setCloseBehavior(closeBehavior) {
    const normalized = normalizeCloseBehavior(closeBehavior)
    const next = {
      schemaVersion: SCHEMA_VERSION,
      closeBehavior: normalized,
    }
    const tempPath = createPreferenceTempPath()
    await fs.mkdir(getUserDataPath(), { recursive: true })
    try {
      await fs.writeFile(tempPath, JSON.stringify(next, null, 2), 'utf8')
      await fs.rename(tempPath, getPreferencesPath())
      cached = next
      return { closeBehavior: normalized }
    } catch {
      await fs.rm(tempPath, { force: true }).catch(() => {})
      logWarning('Desktop close preference write failed; falling back to ask.')
      cached = defaultPreferences()
      return { closeBehavior: 'ask' }
    }
  }

  async function resetCloseBehavior() {
    return setCloseBehavior('ask')
  }

  return {
    init,
    getCloseBehavior,
    getCloseBehaviorSync,
    setCloseBehavior,
    resetCloseBehavior,
    validateSetInput,
    cleanupPreferenceTempFiles,
    PREFS_FILE_NAME,
    CLOSE_BEHAVIORS,
  }
}

module.exports = {
  createDesktopCloseBehaviorStorage,
  PREFS_FILE_NAME,
  CLOSE_BEHAVIORS,
  SCHEMA_VERSION,
}
