const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_{}|~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i
const VERIFICATION_CODE_PATTERN = /^\d{6}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_PROGRESS_KEYS = new Set([
  'completedChapters',
  'quizRecords',
  'achievements',
  'lastVisited',
  'lastRoute',
  'totalTimeSpent',
  'bookmarks',
  'studyDays',
  'commandHistory',
  'labRecords',
  'reviewCards',
  'syncSnapshots',
  'communityDrafts',
  'userProfile',
])
const SAFE_RECORD_KEY_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/
const STUDY_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isFiniteNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isNonNegativeInteger(value) {
  return isFiniteNonNegativeNumber(value) && Number.isInteger(value)
}

function isBoundedString(value, maxLength, allowEmpty = true) {
  return typeof value === 'string'
    && value.length <= maxLength
    && (allowEmpty || value.length > 0)
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every(key => allowedKeys.has(key))
}

function validateStringArray(value, maxItems, maxLength) {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every(item => isBoundedString(item, maxLength, false))
}

function validateRecord(value, maxEntries, validator) {
  if (!isRecord(value)) return false
  const entries = Object.entries(value)
  return entries.length <= maxEntries
    && entries.every(([key, item]) => SAFE_RECORD_KEY_PATTERN.test(key) && validator(item))
}

function validateQuizRecord(value) {
  return isRecord(value)
    && hasOnlyKeys(value, new Set(['answeredAt', 'isCorrect', 'attempts']))
    && isFiniteNonNegativeNumber(value.answeredAt)
    && typeof value.isCorrect === 'boolean'
    && isNonNegativeInteger(value.attempts)
}

function validateBookmark(value) {
  return isRecord(value)
    && hasOnlyKeys(value, new Set(['courseId', 'chapterIndex', 'note', 'createdAt']))
    && isBoundedString(value.courseId, 64, false)
    && isNonNegativeInteger(value.chapterIndex)
    && (value.note === undefined || isBoundedString(value.note, 4000))
    && isFiniteNonNegativeNumber(value.createdAt)
}

function validateCommandHistoryItem(value) {
  return isRecord(value)
    && hasOnlyKeys(value, new Set(['command', 'output', 'exitCode', 'source', 'createdAt']))
    && isBoundedString(value.command, 4096, false)
    && isBoundedString(value.output, 100_000)
    && isNonNegativeInteger(value.exitCode)
    && value.exitCode <= 255
    && (value.source === 'terminal' || value.source === 'course' || value.source === 'lab')
    && isFiniteNonNegativeNumber(value.createdAt)
}

function validateBooleanRecord(value, maxEntries) {
  return validateRecord(value, maxEntries, item => typeof item === 'boolean')
}

function validateStringRecord(value, maxEntries, maxLength) {
  return validateRecord(value, maxEntries, item => isBoundedString(item, maxLength))
}

function validateLabRecord(value) {
  return isRecord(value)
    && hasOnlyKeys(value, new Set([
      'labId',
      'status',
      'startedAt',
      'completedAt',
      'checkResults',
      'checkMessages',
      'lastCheckedAt',
    ]))
    && isBoundedString(value.labId, 128, false)
    && (value.status === 'not_started' || value.status === 'in_progress' || value.status === 'passed')
    && (value.startedAt === undefined || isFiniteNonNegativeNumber(value.startedAt))
    && (value.completedAt === undefined || isFiniteNonNegativeNumber(value.completedAt))
    && validateBooleanRecord(value.checkResults, 100)
    && (value.checkMessages === undefined || validateStringRecord(value.checkMessages, 100, 2000))
    && (value.lastCheckedAt === undefined || isFiniteNonNegativeNumber(value.lastCheckedAt))
}

function validateReviewCard(value) {
  return isRecord(value)
    && hasOnlyKeys(value, new Set([
      'id',
      'sourceType',
      'sourceId',
      'categoryId',
      'prompt',
      'answer',
      'nextReviewAt',
      'intervalDays',
      'ease',
      'repetitions',
      'lapses',
      'updatedAt',
    ]))
    && isBoundedString(value.id, 128, false)
    && (value.sourceType === 'quiz' || value.sourceType === 'concept' || value.sourceType === 'lab')
    && isBoundedString(value.sourceId, 128, false)
    && isBoundedString(value.categoryId, 64, false)
    && isBoundedString(value.prompt, 20_000, false)
    && isBoundedString(value.answer, 40_000)
    && isFiniteNonNegativeNumber(value.nextReviewAt)
    && isFiniteNonNegativeNumber(value.intervalDays)
    && isFiniteNonNegativeNumber(value.ease)
    && isNonNegativeInteger(value.repetitions)
    && isNonNegativeInteger(value.lapses)
    && isFiniteNonNegativeNumber(value.updatedAt)
}

function validateSyncSnapshot(value) {
  return isRecord(value)
    && hasOnlyKeys(value, new Set(['id', 'createdAt', 'deviceName', 'checksum']))
    && isBoundedString(value.id, 128, false)
    && isFiniteNonNegativeNumber(value.createdAt)
    && isBoundedString(value.deviceName, 128, false)
    && isBoundedString(value.checksum, 256, false)
}

function validateCommunityDraft(value) {
  return isRecord(value)
    && hasOnlyKeys(value, new Set(['id', 'type', 'title', 'content', 'tags', 'createdAt']))
    && isBoundedString(value.id, 128, false)
    && (value.type === 'lab-note' || value.type === 'yaml' || value.type === 'command')
    && isBoundedString(value.title, 256, false)
    && isBoundedString(value.content, 100_000)
    && validateStringArray(value.tags, 30, 64)
    && isFiniteNonNegativeNumber(value.createdAt)
}

function validateUserProfile(value) {
  return isRecord(value)
    && hasOnlyKeys(value, new Set(['id', 'name', 'targetRole', 'level', 'createdAt']))
    && isBoundedString(value.id, 128, false)
    && isBoundedString(value.name, 64, false)
    && isBoundedString(value.targetRole, 128)
    && isFiniteNonNegativeNumber(value.level)
    && isFiniteNonNegativeNumber(value.createdAt)
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function validateEmail(value) {
  const email = normalizeEmail(value)
  if (email.length < 3 || email.length > 254) return null
  const separatorIndex = email.lastIndexOf('@')
  if (separatorIndex < 1 || separatorIndex > 64) return null
  return EMAIL_PATTERN.test(email) ? email : null
}

export function validateVerificationCode(value) {
  return typeof value === 'string' && VERIFICATION_CODE_PATTERN.test(value) ? value : null
}

export function validateUsername(value) {
  const username = normalizeUsername(value)
  return USERNAME_PATTERN.test(username) ? username : null
}

export function validateDisplayName(value) {
  if (typeof value !== 'string') return null
  const displayName = value.trim()
  return displayName.length >= 1 && displayName.length <= 64 ? displayName : null
}

export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) return null
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) return null
  return value
}

export function validateRole(value) {
  return value === 'user' || value === 'super_admin' ? value : null
}

export function validateStatus(value) {
  return value === 'active' || value === 'disabled' ? value : null
}

export function validateUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null
}

export function validateProgressPayload(value) {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  if (keys.length !== ALLOWED_PROGRESS_KEYS.size || keys.some(key => !ALLOWED_PROGRESS_KEYS.has(key))) return false
  return validateRecord(
    value.completedChapters,
    100,
    chapterIndexes => Array.isArray(chapterIndexes)
      && chapterIndexes.length <= 500
      && chapterIndexes.every(isNonNegativeInteger),
  )
    && validateRecord(value.quizRecords, 10_000, validateQuizRecord)
    && validateStringArray(value.achievements, 500, 128)
    && isBoundedString(value.lastVisited, 2048)
    && isBoundedString(value.lastRoute, 2048)
    && isFiniteNonNegativeNumber(value.totalTimeSpent)
    && Array.isArray(value.bookmarks)
    && value.bookmarks.length <= 2000
    && value.bookmarks.every(validateBookmark)
    && Array.isArray(value.studyDays)
    && value.studyDays.length <= 10_000
    && value.studyDays.every(day => typeof day === 'string' && STUDY_DAY_PATTERN.test(day))
    && Array.isArray(value.commandHistory)
    && value.commandHistory.length <= 200
    && value.commandHistory.every(validateCommandHistoryItem)
    && validateRecord(value.labRecords, 2000, validateLabRecord)
    && validateRecord(value.reviewCards, 10_000, validateReviewCard)
    && Array.isArray(value.syncSnapshots)
    && value.syncSnapshots.length <= 20
    && value.syncSnapshots.every(validateSyncSnapshot)
    && Array.isArray(value.communityDrafts)
    && value.communityDrafts.length <= 1000
    && value.communityDrafts.every(validateCommunityDraft)
    && validateUserProfile(value.userProfile)
}

export function parsePagination(query) {
  const rawLimit = Number.parseInt(typeof query.limit === 'string' ? query.limit : '20', 10)
  const rawOffset = Number.parseInt(typeof query.offset === 'string' ? query.offset : '0', 10)
  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  }
}
