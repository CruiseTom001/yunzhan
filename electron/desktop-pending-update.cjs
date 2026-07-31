const fs = require('fs/promises')
const fsSync = require('fs')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

const SCHEMA_VERSION = 1
const MARKER_FILE_NAME = 'desktop-pending-update.json'
const DEFAULT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000
const SEMVER_RE = /^\d+\.\d+\.\d+$/

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSemver(value) {
  return typeof value === 'string' && SEMVER_RE.test(value)
}

function compareVersions(a, b) {
  const [aMajor, aMinor, aPatch] = a.split('.').map(Number)
  const [bMajor, bMinor, bPatch] = b.split('.').map(Number)
  if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1
  if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1
  return 0
}

function createDesktopPendingUpdateStorage(deps) {
  const {
    app,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
    logWarning = (message) => console.warn(message),
  } = deps

  function getUserDataPath() {
    return app.getPath('userData')
  }

  function getMarkerPath() {
    return path.join(getUserDataPath(), MARKER_FILE_NAME)
  }

  function createMarkerTempPath() {
    return `${getMarkerPath()}.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`
  }

  function parseMarker(raw) {
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
    if (!isPlainObject(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
      return null
    }
    if (!isSemver(parsed.version)) {
      return null
    }
    if (typeof parsed.downloadedAt !== 'number' || !Number.isFinite(parsed.downloadedAt) || parsed.downloadedAt <= 0) {
      return null
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      version: parsed.version,
      downloadedAt: parsed.downloadedAt,
    }
  }

  async function cleanupMarkerTempFiles() {
    const dir = getUserDataPath()
    let entries = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      return
    }
    await Promise.allSettled(
      entries
        .filter((entry) => entry.startsWith(`${MARKER_FILE_NAME}.`) && entry.endsWith('.tmp'))
        .map((entry) => fs.rm(path.join(dir, entry), { force: true })),
    )
  }

  async function clearPendingUpdateMarker() {
    await cleanupMarkerTempFiles()
    try {
      await fs.rm(getMarkerPath(), { force: true })
    } catch {
      // ignore
    }
  }

  function clearPendingUpdateMarkerSync() {
    try {
      const dir = getUserDataPath()
      const entries = fsSync.readdirSync(dir)
      for (const entry of entries) {
        if (entry.startsWith(`${MARKER_FILE_NAME}.`) && entry.endsWith('.tmp')) {
          try {
            fsSync.rmSync(path.join(dir, entry), { force: true })
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
    try {
      fsSync.rmSync(getMarkerPath(), { force: true })
    } catch {
      // ignore
    }
  }

  function writePendingUpdateMarkerSync(version, downloadedAt = Date.now()) {
    if (!isSemver(version)) {
      logWarning('Desktop pending update marker skipped: invalid version.')
      return { ok: false, reason: 'invalid_version' }
    }
    const next = {
      schemaVersion: SCHEMA_VERSION,
      version,
      downloadedAt,
    }
    const tempPath = createMarkerTempPath()
    try {
      fsSync.mkdirSync(getUserDataPath(), { recursive: true })
      fsSync.writeFileSync(tempPath, JSON.stringify(next, null, 2), 'utf8')
      fsSync.renameSync(tempPath, getMarkerPath())
      return { ok: true, marker: next }
    } catch {
      try {
        fsSync.rmSync(tempPath, { force: true })
      } catch {
        // ignore
      }
      logWarning('Desktop pending update marker write failed.')
      return { ok: false, reason: 'write_failed' }
    }
  }

  async function writePendingUpdateMarker(version, downloadedAt = Date.now()) {
    return writePendingUpdateMarkerSync(version, downloadedAt)
  }

  function resolvePendingUpdateMarkerSync(options = {}) {
    const currentVersion = options.currentVersion
    const now = typeof options.now === 'number' ? options.now : Date.now()

    let raw
    try {
      raw = fsSync.readFileSync(getMarkerPath(), 'utf8')
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return { action: 'none' }
      }
      clearPendingUpdateMarkerSync()
      return { action: 'cleared', reason: 'read_failed' }
    }

    const marker = parseMarker(raw)
    if (!marker) {
      clearPendingUpdateMarkerSync()
      return { action: 'cleared', reason: 'corrupt' }
    }

    if (!isSemver(currentVersion)) {
      clearPendingUpdateMarkerSync()
      return { action: 'cleared', reason: 'invalid_current_version' }
    }

    if (now - marker.downloadedAt > maxAgeMs) {
      clearPendingUpdateMarkerSync()
      return { action: 'cleared', reason: 'expired' }
    }

    if (compareVersions(currentVersion, marker.version) >= 0) {
      clearPendingUpdateMarkerSync()
      return { action: 'cleared', reason: 'already_installed' }
    }

    return { action: 'restore', marker }
  }

  return {
    MARKER_FILE_NAME,
    DEFAULT_MAX_AGE_MS: maxAgeMs,
    writePendingUpdateMarker,
    writePendingUpdateMarkerSync,
    clearPendingUpdateMarker,
    clearPendingUpdateMarkerSync,
    resolvePendingUpdateMarkerSync,
    parseMarker,
    isSemver,
    compareVersions,
  }
}

module.exports = {
  createDesktopPendingUpdateStorage,
  MARKER_FILE_NAME,
  SCHEMA_VERSION,
  DEFAULT_MAX_AGE_MS,
}
