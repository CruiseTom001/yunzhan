const UPDATER_PUBLIC_FIELDS = [
  'status',
  'version',
  'percent',
  'transferred',
  'total',
  'bytesPerSecond',
  'errorCode',
  'errorMessage',
]

const UPDATER_STATUSES = new Set([
  'idle',
  'checking',
  'available',
  'downloading',
  'downloaded',
  'installing',
  'upToDate',
  'error',
])

function createInitialUpdaterState() {
  return {
    status: 'idle',
    version: null,
    percent: null,
    transferred: null,
    total: null,
    bytesPerSecond: null,
    errorCode: null,
    errorMessage: null,
  }
}

function sanitizeUpdaterState(state) {
  const next = createInitialUpdaterState()
  if (!state || typeof state !== 'object') return next

  if (typeof state.status === 'string' && UPDATER_STATUSES.has(state.status)) {
    next.status = state.status
  }
  if (typeof state.version === 'string' && state.version.trim()) {
    next.version = state.version.trim()
  }
  if (typeof state.percent === 'number' && Number.isFinite(state.percent)) {
    next.percent = Math.max(0, Math.min(100, state.percent))
  }
  if (typeof state.transferred === 'number' && Number.isFinite(state.transferred) && state.transferred >= 0) {
    next.transferred = state.transferred
  }
  if (typeof state.total === 'number' && Number.isFinite(state.total) && state.total >= 0) {
    next.total = state.total
  }
  if (typeof state.bytesPerSecond === 'number' && Number.isFinite(state.bytesPerSecond) && state.bytesPerSecond >= 0) {
    next.bytesPerSecond = state.bytesPerSecond
  }
  if (typeof state.errorCode === 'string' && state.errorCode.trim()) {
    next.errorCode = state.errorCode.trim()
  }
  if (typeof state.errorMessage === 'string' && state.errorMessage.trim()) {
    next.errorMessage = state.errorMessage.trim()
  }
  return next
}

function getPublicUpdaterState(state) {
  const sanitized = sanitizeUpdaterState(state)
  const result = {}
  UPDATER_PUBLIC_FIELDS.forEach((field) => {
    result[field] = sanitized[field]
  })
  return result
}

function mapUpdaterError(error) {
  const fallback = {
    errorCode: 'update_failed',
    errorMessage: '检查更新失败，请稍后再试。',
  }
  if (!error) return fallback

  const message = typeof error === 'string'
    ? error
    : typeof error.message === 'string'
      ? error.message
      : ''

  const normalized = message.toLowerCase()

  if (normalized.includes('dev environment') || normalized.includes('开发环境')) {
    return {
      errorCode: 'dev_disabled',
      errorMessage: '开发环境不执行自动更新。',
    }
  }

  if (
    normalized.includes('net::')
    || normalized.includes('network')
    || normalized.includes('enotfound')
    || normalized.includes('econnrefused')
    || normalized.includes('etimedout')
    || normalized.includes('网络')
    || normalized.includes('连接')
  ) {
    return {
      errorCode: 'network_error',
      errorMessage: '网络连接失败，请检查网络后重试。',
    }
  }

  if (
    normalized.includes('404')
    || normalized.includes('not found')
    || normalized.includes('latest.yml')
    || normalized.includes('could not find')
  ) {
    return {
      errorCode: 'feed_missing',
      errorMessage: '更新信息不存在或格式错误，请稍后再试。',
    }
  }

  if (normalized.includes('github') && (normalized.includes('403') || normalized.includes('429'))) {
    return {
      errorCode: 'github_unreachable',
      errorMessage: '无法访问 GitHub 更新服务，请稍后再试。',
    }
  }

  if (normalized.includes('sha512') || normalized.includes('checksum') || normalized.includes('integrity')) {
    return {
      errorCode: 'checksum_failed',
      errorMessage: '安装包校验失败，请重新下载。',
    }
  }

  if (normalized.includes('already the latest') || normalized.includes('no update')) {
    return {
      errorCode: 'already_latest',
      errorMessage: '当前已是最新版本。',
    }
  }

  if (normalized.includes('download') && normalized.includes('cancel')) {
    return {
      errorCode: 'download_cancelled',
      errorMessage: '下载已取消。',
    }
  }

  if (normalized.includes('download')) {
    return {
      errorCode: 'download_failed',
      errorMessage: '下载失败，请稍后重试。',
    }
  }

  if (normalized.includes('install') || normalized.includes('quitandinstall')) {
    return {
      errorCode: 'install_failed',
      errorMessage: '安装启动失败，请稍后重试。',
    }
  }

  return fallback
}

function canStartDownload(state, enabled) {
  if (!enabled) {
    return { ok: false, reason: 'dev_disabled' }
  }
  if (state.status === 'downloading') {
    return { ok: false, reason: 'already_downloading' }
  }
  if (state.status === 'downloaded' || state.status === 'installing') {
    return { ok: false, reason: 'already_downloaded' }
  }
  if (state.status !== 'available' && state.status !== 'error') {
    return { ok: false, reason: 'not_available' }
  }
  return { ok: true }
}

function canStartInstall(state, enabled) {
  if (!enabled) {
    return { ok: false, reason: 'dev_disabled' }
  }
  if (state.status === 'installing') {
    return { ok: false, reason: 'already_installing' }
  }
  if (state.status === 'error' && state.errorCode === 'install_failed') {
    return { ok: true }
  }
  if (state.status !== 'downloaded') {
    return { ok: false, reason: 'not_downloaded' }
  }
  return { ok: true }
}

function mapDownloadProgress(progress) {
  if (!progress || typeof progress !== 'object') {
    return {
      percent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
    }
  }
  const percent = typeof progress.percent === 'number' && Number.isFinite(progress.percent)
    ? Math.max(0, Math.min(100, progress.percent))
    : null
  const transferred = typeof progress.transferred === 'number' && Number.isFinite(progress.transferred)
    ? progress.transferred
    : null
  const total = typeof progress.total === 'number' && Number.isFinite(progress.total)
    ? progress.total
    : null
  const bytesPerSecond = typeof progress.bytesPerSecond === 'number' && Number.isFinite(progress.bytesPerSecond)
    ? progress.bytesPerSecond
    : null
  return { percent, transferred, total, bytesPerSecond }
}

function containsSensitiveErrorText(text) {
  if (typeof text !== 'string') return false
  const normalized = text.toLowerCase()
  return (
    normalized.includes(':\\')
    || normalized.includes('/users/')
    || normalized.includes('/home/')
    || normalized.includes('appdata')
    || normalized.includes('token')
    || normalized.includes('authorization')
    || normalized.includes('stack')
    || normalized.includes('at ')
  )
}

module.exports = {
  UPDATER_PUBLIC_FIELDS,
  createInitialUpdaterState,
  sanitizeUpdaterState,
  getPublicUpdaterState,
  mapUpdaterError,
  canStartDownload,
  canStartInstall,
  mapDownloadProgress,
  containsSensitiveErrorText,
}
