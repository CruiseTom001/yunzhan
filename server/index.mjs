import 'dotenv/config'
import crypto, { randomBytes, randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { pool, withTransaction } from './db.mjs'
import { sendVerificationCode } from './email-service.mjs'
import { createEmailChallenge, verifyEmailChallengeCode } from './email-verification.mjs'
import { requestStudyNoteAi, requestStudyNoteAiStream } from './ai-provider.mjs'
import { loadRuntimeConfig } from './runtime-config.mjs'
import { isDesktopOriginAllowed } from './origin-validation.mjs'
import {
  isRecord,
  normalizeEmail,
  parsePagination,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateProgressPayload,
  validateRole,
  validateStatus,
  validateUsername,
  validateUuid,
  validateVerificationCode,
} from './validation.mjs'

const app = express()
const runtimeConfig = loadRuntimeConfig()
const {
  allowElectronFileOrigin,
  allowedOrigins,
  port,
  sameSite,
  secureCookie,
  serveStatic,
  trustProxy,
} = runtimeConfig

const sessionCookieName = 'yunzhan_session'
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000
const LOGIN_ATTEMPT_LIMIT = 5
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
const EMAIL_CODE_COOLDOWN_SECONDS = 60
const EMAIL_CODE_MAX_PER_HOUR = 5
const EMAIL_CODE_MAX_PER_IP_HOUR = 20
const STUDY_NOTE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const STUDY_NOTE_CONTENT_MAX_LENGTH = 20_000
const STUDY_NOTE_POLISHED_MAX_LENGTH = 30_000
const AI_PROVIDER_NAME_MAX_LENGTH = 80
const AI_MODEL_MAX_LENGTH = 128

app.set('trust proxy', trustProxy ? 1 : false)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))
app.use(express.json({ limit: '2mb', strict: true }))
app.use(cookieParser())
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }
    if (allowElectronFileOrigin && (origin === 'null' || origin.startsWith('file://'))) {
      callback(null, true)
      return
    }
    callback(new Error('origin_not_allowed'))
  },
}))

app.use((request, response, next) => {
  if (request.path.startsWith('/api/')) {
    response.setHeader('Cache-Control', 'no-store')
  }
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next()
    return
  }

  const origin = request.get('origin')
  const isAllowedWebOrigin = Boolean(origin && allowedOrigins.has(origin))
  const isAllowedDesktopOrigin = isDesktopOriginAllowed(
    origin,
    request.get('x-yunzhan-client'),
    allowElectronFileOrigin,
  )
  if (isAllowedWebOrigin || isAllowedDesktopOrigin) {
    next()
    return
  }
  response.status(403).json({ error: '请求来源未获授权。' })
})

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: secureCookie,
    sameSite,
    path: '/',
    maxAge: sessionDurationMs,
  }
}

function clearSessionCookie(response) {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: secureCookie,
    sameSite,
    path: '/',
  })
}

function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email ?? null,
    emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at).getTime() : null,
    role: row.role,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).getTime() : null,
  }
}

function summarizeProgress(payload) {
  if (!isRecord(payload)) {
    return { completedChapters: 0, quizAnswers: 0, studyDays: 0, totalTimeSpent: 0 }
  }
  const completedChapters = isRecord(payload.completedChapters)
    ? Object.values(payload.completedChapters).reduce(
      (sum, chapters) => sum + (Array.isArray(chapters) ? chapters.length : 0),
      0,
    )
    : 0
  return {
    completedChapters,
    quizAnswers: isRecord(payload.quizRecords) ? Object.keys(payload.quizRecords).length : 0,
    studyDays: Array.isArray(payload.studyDays) ? payload.studyDays.length : 0,
    totalTimeSpent: typeof payload.totalTimeSpent === 'number' ? payload.totalTimeSpent : 0,
  }
}

function hasOnlyKeys(value, allowedKeys) {
  return isRecord(value) && Object.keys(value).every(key => allowedKeys.has(key))
}

function validateStudyNoteDate(value) {
  if (typeof value !== 'string' || !STUDY_NOTE_DATE_RE.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null
  return value
}

function formatStudyNoteDate(value) {
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return ''
}

function toStudyNote(row) {
  return {
    id: String(row.id),
    date: formatStudyNoteDate(row.note_date),
    content: row.content,
    polishedContent: row.polished_content,
    aiProviderName: row.ai_provider_name ?? null,
    aiModel: row.ai_model ?? null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

function validateStudyNoteContent(value, maxLength, allowEmpty = false) {
  if (typeof value !== 'string') return null
  const content = value.trim()
  if ((!allowEmpty && content.length < 1) || content.length > maxLength) return null
  return content
}

function validateAiText(value, maxLength) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text.length >= 1 && text.length <= maxLength ? text : null
}

// ---------- 语义版本比较(后端内联,与 src/utils/semver.ts 同义) ----------
// 服务端由 node 直接运行(不编译 .ts),不能跨目录 import 前端实现。
const SEMVER_RE_SERVER = /^\d+\.\d+\.\d+$/

/**
 * 比较两个 x.y.z 版本号。返回 -1 / 0 / 1。
 * 非法返回 0(视为相等,避免 reduce 误判),调用方应在入参已校验场景使用。
 */
function compareVersionsServer(a, b) {
  if (!SEMVER_RE_SERVER.test(a) || !SEMVER_RE_SERVER.test(b)) return 0
  const [aM, am, ap] = a.split('.').map(Number)
  const [bM, bm, bp] = b.split('.').map(Number)
  if (aM !== bM) return aM < bM ? -1 : 1
  if (am !== bm) return am < bm ? -1 : 1
  if (ap !== bp) return ap < bp ? -1 : 1
  return 0
}

async function writeAudit(client, actorUserId, action, targetUserId, metadata = {}) {
  await client.query(
    `INSERT INTO audit_logs (actor_user_id, action, target_user_id, metadata)
     VALUES ($1, $2, $3, $4::JSONB)`,
    [actorUserId, action, targetUserId, JSON.stringify(metadata)],
  )
}

async function requireAuth(request, response, next) {
  const token = request.cookies[sessionCookieName]
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) {
    response.status(401).json({ error: '请先登录。' })
    return
  }

  const tokenHash = hashSessionToken(token)
  const result = await pool.query(
    `WITH active_session AS (
       UPDATE sessions
          SET last_used_at = NOW()
        WHERE token_hash = $1 AND expires_at > NOW()
       RETURNING id, user_id
     )
     SELECT u.*, s.id AS session_id
       FROM active_session s
       JOIN users u ON u.id = s.user_id
      WHERE u.status = 'active'`,
    [tokenHash],
  )
  const user = result.rows[0]
  if (!user) {
    clearSessionCookie(response)
    response.status(401).json({ error: '登录已失效，请重新登录。' })
    return
  }

  request.auth = toPublicUser(user)
  request.sessionId = user.session_id
  request.sessionTokenHash = tokenHash
  next()
}

function requireSuperAdmin(request, response, next) {
  if (request.auth?.role !== 'super_admin') {
    response.status(403).json({ error: '仅超管可以执行此操作。' })
    return
  }
  next()
}

function getRequestIp(request) {
  return typeof request.ip === 'string' && request.ip.length <= 128 ? request.ip : 'unknown'
}

function readUserAgent(request) {
  const userAgent = request.get('user-agent')
  return typeof userAgent === 'string' ? userAgent.trim().slice(0, 256) : ''
}

function getLoginAttemptKey(request, identifier) {
  return crypto
    .createHash('sha256')
    .update(`${getRequestIp(request)}\u0000${identifier}`)
    .digest('hex')
}

async function isLoginRateLimited(key) {
  const result = await pool.query(
    `SELECT attempt_count
       FROM login_attempts
      WHERE attempt_key = $1 AND reset_at > NOW()`,
    [key],
  )
  return (result.rows[0]?.attempt_count ?? 0) >= LOGIN_ATTEMPT_LIMIT
}

async function recordLoginFailure(key) {
  await pool.query(
    `INSERT INTO login_attempts (attempt_key, attempt_count, reset_at)
     VALUES ($1, 1, $2)
     ON CONFLICT (attempt_key) DO UPDATE
       SET attempt_count = CASE
             WHEN login_attempts.reset_at <= NOW() THEN 1
             ELSE LEAST(login_attempts.attempt_count + 1, $3)
           END,
           reset_at = CASE
             WHEN login_attempts.reset_at <= NOW() THEN EXCLUDED.reset_at
             ELSE login_attempts.reset_at
           END,
           updated_at = NOW()`,
    [key, new Date(Date.now() + LOGIN_ATTEMPT_WINDOW_MS), LOGIN_ATTEMPT_LIMIT],
  )
}

async function clearLoginFailures(key) {
  await pool.query('DELETE FROM login_attempts WHERE attempt_key = $1', [key])
}

async function ensureAdminContinuity(client, targetUser, nextRole, nextStatus) {
  const removesActiveAdmin = targetUser.role === 'super_admin'
    && targetUser.status === 'active'
    && (nextRole !== 'super_admin' || nextStatus !== 'active')
  if (!removesActiveAdmin) return

  const countResult = await client.query(
    `SELECT COUNT(*)::INTEGER AS count
       FROM users
      WHERE role = 'super_admin' AND status = 'active'`,
  )
  if (countResult.rows[0].count <= 1) {
    const error = new Error('不能停用、降级或删除最后一个可用超管账号。')
    error.statusCode = 409
    throw error
  }
}

async function prepareEmailChallenge({ canSend, email, purpose, requestIp }) {
  const challenge = createEmailChallenge(email, requestIp, purpose)
  const shouldSend = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [email])
    await client.query(
      `DELETE FROM email_verification_challenges
        WHERE created_at < NOW() - INTERVAL '7 days'`,
    )
    const limitsResult = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE email = $1)::INTEGER AS email_count,
         COUNT(*) FILTER (WHERE request_ip_digest = $2)::INTEGER AS ip_count,
         MAX(created_at) FILTER (
           WHERE email = $1 AND delivery_status IN ('pending', 'sent', 'suppressed')
         ) AS last_email_at
       FROM email_verification_challenges
       WHERE created_at > NOW() - INTERVAL '1 hour'
         AND (email = $1 OR request_ip_digest = $2)`,
      [email, challenge.requestIpDigest],
    )
    const limits = limitsResult.rows[0]
    if (limits.email_count >= EMAIL_CODE_MAX_PER_HOUR || limits.ip_count >= EMAIL_CODE_MAX_PER_IP_HOUR) {
      const error = new Error('验证码发送过于频繁，请稍后再试。')
      error.statusCode = 429
      throw error
    }
    if (limits.last_email_at) {
      const elapsedSeconds = (Date.now() - new Date(limits.last_email_at).getTime()) / 1000
      if (elapsedSeconds < EMAIL_CODE_COOLDOWN_SECONDS) {
        const error = new Error(`请在 ${Math.ceil(EMAIL_CODE_COOLDOWN_SECONDS - elapsedSeconds)} 秒后重新发送。`)
        error.statusCode = 429
        throw error
      }
    }

    const eligible = await canSend(client)
    await client.query(
      `UPDATE email_verification_challenges
          SET consumed_at = NOW()
        WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL`,
      [email, purpose],
    )
    await client.query(
      `INSERT INTO email_verification_challenges
        (id, email, purpose, code_digest, request_ip_digest, delivery_status, expires_at, consumed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        challenge.id,
        email,
        purpose,
        challenge.codeDigest,
        challenge.requestIpDigest,
        eligible ? 'pending' : 'suppressed',
        new Date(Date.now() + EMAIL_CODE_TTL_MS),
        eligible ? null : new Date(),
      ],
    )
    return eligible
  })
  return { challenge, shouldSend }
}

async function deliverEmailChallenge({ challenge, email, shouldSend }) {
  if (!shouldSend) return
  try {
    const providerMessageId = await sendVerificationCode({
      to: email,
      code: challenge.code,
      purpose: challenge.purpose,
    })
    await pool.query(
      `UPDATE email_verification_challenges
          SET delivery_status = 'sent', provider_message_id = $2
        WHERE id = $1 AND delivery_status = 'pending'`,
      [challenge.id, providerMessageId],
    )
  } catch (error) {
    await pool.query(
      `UPDATE email_verification_challenges
          SET delivery_status = 'failed', consumed_at = NOW()
        WHERE id = $1`,
      [challenge.id],
    )
    throw error
  }
}

app.get('/api/health', asyncRoute(async (_request, response) => {
  await pool.query('SELECT 1')
  response.json({ ok: true })
}))

app.post('/api/auth/register/code', asyncRoute(async (request, response) => {
  if (!isRecord(request.body)) {
    response.status(400).json({ error: '邮箱参数无效。' })
    return
  }
  const email = validateEmail(request.body.email)
  if (!email) {
    response.status(400).json({ error: '请输入有效的邮箱地址。' })
    return
  }

  const prepared = await prepareEmailChallenge({
    email,
    purpose: 'registration',
    requestIp: getRequestIp(request),
    canSend: async client => (await client.query('SELECT 1 FROM users WHERE email = $1', [email])).rowCount === 0,
  })
  await deliverEmailChallenge({ ...prepared, email })

  response.json({
    ok: true,
    cooldownSeconds: EMAIL_CODE_COOLDOWN_SECONDS,
    message: '如果该邮箱可用于注册，验证码将发送到邮箱。',
  })
}))

app.post('/api/auth/register', asyncRoute(async (request, response) => {
  if (!isRecord(request.body)) {
    response.status(400).json({ error: '注册参数无效。' })
    return
  }
  const email = validateEmail(request.body.email)
  const code = validateVerificationCode(request.body.code)
  const username = validateUsername(request.body.username)
  const displayName = validateDisplayName(request.body.displayName)
  const password = validatePassword(request.body.password)
  if (!email || !code || !username || !displayName || !password) {
    response.status(400).json({ error: '邮箱、验证码、用户名、显示名称或密码不符合要求。' })
    return
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + sessionDurationMs)
  try {
    const registration = await withTransaction(async (client) => {
      const challengeResult = await client.query(
        `SELECT id, purpose, code_digest, attempt_count
           FROM email_verification_challenges
          WHERE email = $1
            AND purpose = 'registration'
            AND delivery_status = 'sent'
            AND consumed_at IS NULL
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE`,
        [email],
      )
      const activeChallenge = challengeResult.rows[0]
      if (!activeChallenge || activeChallenge.attempt_count >= 5) return { status: 'invalid_code' }
      if (!verifyEmailChallengeCode(activeChallenge, email, code)) {
        await client.query(
          `UPDATE email_verification_challenges
              SET attempt_count = LEAST(attempt_count + 1, 5),
                  consumed_at = CASE WHEN attempt_count + 1 >= 5 THEN NOW() ELSE consumed_at END
            WHERE id = $1`,
          [activeChallenge.id],
        )
        return { status: 'invalid_code' }
      }

      const existing = await client.query(
        'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) OR email = $2',
        [username, email],
      )
      if (existing.rowCount > 0) return { status: 'unavailable' }

      const passwordHash = await bcrypt.hash(password, 12)
      const userResult = await client.query(
        `INSERT INTO users
          (id, username, display_name, email, email_verified_at, password_hash, role, status)
         VALUES ($1, $2, $3, $4, NOW(), $5, 'user', 'active')
         RETURNING *`,
        [randomUUID(), username, displayName, email, passwordHash],
      )
      const user = userResult.rows[0]
      await client.query(
        'UPDATE email_verification_challenges SET consumed_at = NOW() WHERE id = $1',
        [activeChallenge.id],
      )
      await client.query(
        `INSERT INTO sessions (id, token_hash, user_id, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), hashSessionToken(token), user.id, readUserAgent(request), expiresAt],
      )
      await writeAudit(client, user.id, 'auth.register', user.id, { emailVerified: true })
      return { status: 'created', user }
    })

    if (registration.status === 'invalid_code') {
      response.status(400).json({ error: '验证码无效、已过期或尝试次数过多。' })
      return
    }
    if (registration.status === 'unavailable') {
      response.status(409).json({ error: '用户名或邮箱不可用，请更换后重试。' })
      return
    }
    response.cookie(sessionCookieName, token, sessionCookieOptions())
    response.status(201).json({ user: toPublicUser(registration.user) })
  } catch (error) {
    if (error?.code === '23505') {
      response.status(409).json({ error: '用户名或邮箱不可用，请更换后重试。' })
      return
    }
    throw error
  }
}))

app.post('/api/auth/password-reset/code', asyncRoute(async (request, response) => {
  if (!isRecord(request.body)) {
    response.status(400).json({ error: '邮箱参数无效。' })
    return
  }
  const email = validateEmail(request.body.email)
  if (!email) {
    response.status(400).json({ error: '请输入有效的邮箱地址。' })
    return
  }

  const prepared = await prepareEmailChallenge({
    email,
    purpose: 'password_reset',
    requestIp: getRequestIp(request),
    canSend: async client => (await client.query(
      `SELECT 1
         FROM users
        WHERE email = $1
          AND email_verified_at IS NOT NULL
          AND status = 'active'`,
      [email],
    )).rowCount === 1,
  })
  await deliverEmailChallenge({ ...prepared, email })

  response.json({
    ok: true,
    cooldownSeconds: EMAIL_CODE_COOLDOWN_SECONDS,
    message: '如果该邮箱已绑定可用账号，验证码将发送到邮箱。',
  })
}))

app.post('/api/auth/password-reset', asyncRoute(async (request, response) => {
  if (!isRecord(request.body)) {
    response.status(400).json({ error: '密码重置参数无效。' })
    return
  }
  const email = validateEmail(request.body.email)
  const code = validateVerificationCode(request.body.code)
  const password = validatePassword(request.body.password)
  if (!email || !code || !password) {
    response.status(400).json({ error: '邮箱、验证码或新密码不符合要求。' })
    return
  }

  const resetResult = await withTransaction(async (client) => {
    const challengeResult = await client.query(
      `SELECT id, purpose, code_digest, attempt_count
         FROM email_verification_challenges
        WHERE email = $1
          AND purpose = 'password_reset'
          AND delivery_status = 'sent'
          AND consumed_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [email],
    )
    const activeChallenge = challengeResult.rows[0]
    if (!activeChallenge || activeChallenge.attempt_count >= 5) return { status: 'invalid_code' }
    if (!verifyEmailChallengeCode(activeChallenge, email, code)) {
      await client.query(
        `UPDATE email_verification_challenges
            SET attempt_count = LEAST(attempt_count + 1, 5),
                consumed_at = CASE WHEN attempt_count + 1 >= 5 THEN NOW() ELSE consumed_at END
          WHERE id = $1`,
        [activeChallenge.id],
      )
      return { status: 'invalid_code' }
    }

    const userResult = await client.query(
      `SELECT *
         FROM users
        WHERE email = $1
          AND email_verified_at IS NOT NULL
          AND status = 'active'
        FOR UPDATE`,
      [email],
    )
    const user = userResult.rows[0]
    if (!user) {
      await client.query(
        'UPDATE email_verification_challenges SET consumed_at = NOW() WHERE id = $1',
        [activeChallenge.id],
      )
      return { status: 'invalid_code' }
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await client.query(
      `UPDATE users
          SET password_hash = $2,
              password_changed_at = NOW(),
              updated_at = NOW()
        WHERE id = $1`,
      [user.id, passwordHash],
    )
    await client.query(
      `UPDATE email_verification_challenges
          SET consumed_at = NOW()
        WHERE email = $1 AND purpose = 'password_reset' AND consumed_at IS NULL`,
      [email],
    )
    await client.query('DELETE FROM sessions WHERE user_id = $1', [user.id])
    await writeAudit(client, user.id, 'auth.password.reset', user.id, { method: 'verified_email' })
    return { status: 'updated' }
  })

  if (resetResult.status !== 'updated') {
    response.status(400).json({ error: '验证码无效、已过期或尝试次数过多。' })
    return
  }
  clearSessionCookie(response)
  response.json({ ok: true })
}))

app.post('/api/auth/login', asyncRoute(async (request, response) => {
  if (!isRecord(request.body)) {
    response.status(400).json({ error: '登录参数无效。' })
    return
  }
  const normalizedIdentifier = typeof request.body.username === 'string'
    ? request.body.username.trim().toLowerCase()
    : ''
  const email = validateEmail(request.body.username)
  const username = email ? null : validateUsername(request.body.username)
  const password = validatePassword(request.body.password)
  const attemptKey = getLoginAttemptKey(request, normalizedIdentifier.slice(0, 254))
  if (await isLoginRateLimited(attemptKey)) {
    response.status(429).json({ error: '登录失败次数过多，请 15 分钟后再试。' })
    return
  }

  if ((!username && !email) || !password) {
    await recordLoginFailure(attemptKey)
    response.status(401).json({ error: '用户名或密码错误，或账号已停用。' })
    return
  }

  const result = email
    ? await pool.query('SELECT * FROM users WHERE email = $1', [normalizeEmail(email)])
    : await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username])
  const user = result.rows[0]
  const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false
  if (!user || !passwordMatches || user.status !== 'active') {
    await recordLoginFailure(attemptKey)
    response.status(401).json({ error: '用户名或密码错误，或账号已停用。' })
    return
  }

  await clearLoginFailures(attemptKey)
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + sessionDurationMs)
  await withTransaction(async (client) => {
    await client.query('DELETE FROM sessions WHERE expires_at <= NOW()')
    await client.query(
      `INSERT INTO sessions (id, token_hash, user_id, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), hashSessionToken(token), user.id, readUserAgent(request), expiresAt],
    )
    await client.query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [user.id])
    await writeAudit(client, user.id, 'auth.login', user.id)
  })
  response.cookie(sessionCookieName, token, sessionCookieOptions())
  response.json({ user: toPublicUser({ ...user, last_login_at: new Date() }) })
}))

app.post('/api/auth/logout', requireAuth, asyncRoute(async (request, response) => {
  const token = request.cookies[sessionCookieName]
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashSessionToken(token)])
  clearSessionCookie(response)
  response.json({ ok: true })
}))

app.patch('/api/account/profile', requireAuth, asyncRoute(async (request, response) => {
  const allowedKeys = new Set(['username', 'displayName'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '资料参数无效。' })
    return
  }
  const username = request.body.username === undefined ? undefined : validateUsername(request.body.username)
  const displayName = request.body.displayName === undefined
    ? undefined
    : validateDisplayName(request.body.displayName)
  if (
    (request.body.username !== undefined && !username)
    || (request.body.displayName !== undefined && !displayName)
    || (username === undefined && displayName === undefined)
  ) {
    response.status(400).json({ error: '用户名或显示名称不符合要求。' })
    return
  }

  try {
    const updatedUser = await withTransaction(async (client) => {
      const fields = []
      const values = []
      const addField = (column, value) => {
        values.push(value)
        fields.push(`${column} = $${values.length}`)
      }
      if (username !== undefined) addField('username', username)
      if (displayName !== undefined) addField('display_name', displayName)
      fields.push('updated_at = NOW()')
      values.push(request.auth.id)
      const result = await client.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values,
      )
      await writeAudit(client, request.auth.id, 'account.profile.update', request.auth.id, {
        displayNameChanged: displayName !== undefined && displayName !== request.auth.displayName,
        usernameChanged: username !== undefined && username !== request.auth.username,
      })
      return result.rows[0]
    })
    response.json({ user: toPublicUser(updatedUser) })
  } catch (error) {
    if (error?.code === '23505') {
      response.status(409).json({ error: '用户名已存在。' })
      return
    }
    throw error
  }
}))

app.post('/api/account/password', requireAuth, asyncRoute(async (request, response) => {
  const allowedKeys = new Set(['currentPassword', 'newPassword'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '密码参数无效。' })
    return
  }
  const currentPassword = validatePassword(request.body.currentPassword)
  const newPassword = validatePassword(request.body.newPassword)
  if (!currentPassword || !newPassword) {
    response.status(400).json({ error: '当前密码或新密码不符合要求。' })
    return
  }

  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [request.auth.id])
  const passwordHash = result.rows[0]?.password_hash
  const currentPasswordMatches = passwordHash ? await bcrypt.compare(currentPassword, passwordHash) : false
  if (!currentPasswordMatches) {
    response.status(401).json({ error: '当前密码错误。' })
    return
  }
  if (await bcrypt.compare(newPassword, passwordHash)) {
    response.status(409).json({ error: '新密码不能与当前密码相同。' })
    return
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12)
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users
          SET password_hash = $2, password_changed_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [request.auth.id, newPasswordHash],
    )
    await client.query(
      'DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2',
      [request.auth.id, request.sessionTokenHash],
    )
    await writeAudit(client, request.auth.id, 'account.password.update', request.auth.id)
  })
  response.json({ ok: true })
}))

app.post('/api/account/email/code', requireAuth, asyncRoute(async (request, response) => {
  const allowedKeys = new Set(['email', 'currentPassword'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '邮箱参数无效。' })
    return
  }
  const email = validateEmail(request.body.email)
  const currentPassword = validatePassword(request.body.currentPassword)
  if (!email || !currentPassword) {
    response.status(400).json({ error: '新邮箱或当前密码不符合要求。' })
    return
  }
  if (email === request.auth.email) {
    response.status(409).json({ error: '新邮箱不能与当前邮箱相同。' })
    return
  }
  const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [request.auth.id])
  const passwordMatches = userResult.rows[0]
    ? await bcrypt.compare(currentPassword, userResult.rows[0].password_hash)
    : false
  if (!passwordMatches) {
    response.status(401).json({ error: '当前密码错误。' })
    return
  }

  const prepared = await prepareEmailChallenge({
    email,
    purpose: 'email_change',
    requestIp: getRequestIp(request),
    canSend: async client => (await client.query('SELECT 1 FROM users WHERE email = $1', [email])).rowCount === 0,
  })
  await deliverEmailChallenge({ ...prepared, email })
  response.json({
    ok: true,
    cooldownSeconds: EMAIL_CODE_COOLDOWN_SECONDS,
    message: '如果该邮箱可以绑定，验证码将发送到新邮箱。',
  })
}))

app.post('/api/account/email', requireAuth, asyncRoute(async (request, response) => {
  const allowedKeys = new Set(['email', 'code', 'currentPassword'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '邮箱验证参数无效。' })
    return
  }
  const email = validateEmail(request.body.email)
  const code = validateVerificationCode(request.body.code)
  const currentPassword = validatePassword(request.body.currentPassword)
  if (!email || !code || !currentPassword) {
    response.status(400).json({ error: '新邮箱、验证码或当前密码不符合要求。' })
    return
  }

  try {
    const updatedUser = await withTransaction(async (client) => {
      const challengeResult = await client.query(
        `SELECT id, purpose, code_digest, attempt_count
           FROM email_verification_challenges
          WHERE email = $1
            AND purpose = 'email_change'
            AND delivery_status = 'sent'
            AND consumed_at IS NULL
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE`,
        [email],
      )
      const challenge = challengeResult.rows[0]
      if (!challenge || challenge.attempt_count >= 5) return null
      if (!verifyEmailChallengeCode(challenge, email, code)) {
        await client.query(
          `UPDATE email_verification_challenges
              SET attempt_count = LEAST(attempt_count + 1, 5),
                  consumed_at = CASE WHEN attempt_count + 1 >= 5 THEN NOW() ELSE consumed_at END
            WHERE id = $1`,
          [challenge.id],
        )
        return null
      }

      const userResult = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [request.auth.id])
      const user = userResult.rows[0]
      if (!user || !await bcrypt.compare(currentPassword, user.password_hash)) return null
      const result = await client.query(
        `UPDATE users
            SET email = $2, email_verified_at = NOW(), updated_at = NOW()
          WHERE id = $1
          RETURNING *`,
        [request.auth.id, email],
      )
      await client.query(
        `UPDATE email_verification_challenges
            SET consumed_at = NOW()
          WHERE email = $1 AND purpose = 'email_change' AND consumed_at IS NULL`,
        [email],
      )
      await writeAudit(client, request.auth.id, 'account.email.update', request.auth.id)
      return result.rows[0]
    })
    if (!updatedUser) {
      response.status(400).json({ error: '验证码无效、已过期，或当前密码错误。' })
      return
    }
    response.json({ user: toPublicUser(updatedUser) })
  } catch (error) {
    if (error?.code === '23505') {
      response.status(409).json({ error: '该邮箱已被其他账号使用。' })
      return
    }
    throw error
  }
}))

app.get('/api/account/sessions', requireAuth, asyncRoute(async (request, response) => {
  const result = await pool.query(
    `SELECT id, user_agent, created_at, last_used_at, expires_at
       FROM sessions
      WHERE user_id = $1 AND expires_at > NOW()
      ORDER BY last_used_at DESC`,
    [request.auth.id],
  )
  response.json({
    sessions: result.rows.map(row => ({
      id: row.id,
      userAgent: row.user_agent ?? '',
      current: row.id === request.sessionId,
      createdAt: new Date(row.created_at).getTime(),
      lastUsedAt: new Date(row.last_used_at).getTime(),
      expiresAt: new Date(row.expires_at).getTime(),
    })),
  })
}))

app.delete('/api/account/sessions/others', requireAuth, asyncRoute(async (request, response) => {
  const result = await withTransaction(async (client) => {
    const deleted = await client.query(
      'DELETE FROM sessions WHERE user_id = $1 AND id <> $2',
      [request.auth.id, request.sessionId],
    )
    await writeAudit(client, request.auth.id, 'account.sessions.revoke_others', request.auth.id, {
      revokedCount: deleted.rowCount,
    })
    return deleted.rowCount
  })
  response.json({ ok: true, revokedCount: result })
}))

app.delete('/api/account/sessions/:id', requireAuth, asyncRoute(async (request, response) => {
  const sessionId = validateUuid(request.params.id)
  if (!sessionId) {
    response.status(400).json({ error: '会话 ID 无效。' })
    return
  }
  const result = await withTransaction(async (client) => {
    const deleted = await client.query(
      'DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [sessionId, request.auth.id],
    )
    if (deleted.rowCount === 0) return false
    await writeAudit(client, request.auth.id, 'account.session.revoke', request.auth.id, {
      currentSession: sessionId === request.sessionId,
    })
    return true
  })
  if (!result) {
    response.status(404).json({ error: '会话不存在。' })
    return
  }
  if (sessionId === request.sessionId) clearSessionCookie(response)
  response.json({ ok: true, currentSessionRevoked: sessionId === request.sessionId })
}))

app.get('/api/account/export', requireAuth, asyncRoute(async (request, response) => {
  const result = await pool.query(
    `SELECT payload, version, updated_at
       FROM user_progress
      WHERE user_id = $1`,
    [request.auth.id],
  )
  const progress = result.rows[0]
  response.json({
    account: request.auth,
    progress: progress?.payload ?? null,
    progressVersion: progress?.version ?? 0,
    progressUpdatedAt: progress?.updated_at ? new Date(progress.updated_at).getTime() : null,
    exportedAt: Date.now(),
  })
}))

app.delete('/api/account', requireAuth, asyncRoute(async (request, response) => {
  const allowedKeys = new Set(['currentPassword', 'confirmation'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '注销参数无效。' })
    return
  }
  const currentPassword = validatePassword(request.body.currentPassword)
  const confirmation = typeof request.body.confirmation === 'string' ? request.body.confirmation.trim() : ''
  if (!currentPassword || confirmation !== request.auth.username) {
    response.status(400).json({ error: '密码或用户名确认不正确。' })
    return
  }

  const deleted = await withTransaction(async (client) => {
    const userResult = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [request.auth.id])
    const user = userResult.rows[0]
    if (!user || !await bcrypt.compare(currentPassword, user.password_hash)) return false
    await ensureAdminContinuity(client, user, 'user', 'disabled')
    const progressResult = await client.query(
      'SELECT * FROM user_progress WHERE user_id = $1',
      [request.auth.id],
    )
    await client.query(
      `INSERT INTO deleted_user_backups
        (original_user_id, deleted_by, user_snapshot, progress_snapshot)
       VALUES ($1, $2, $3::JSONB, $4::JSONB)`,
      [
        request.auth.id,
        request.auth.id,
        JSON.stringify(user),
        progressResult.rows[0] ? JSON.stringify(progressResult.rows[0]) : null,
      ],
    )
    await writeAudit(client, request.auth.id, 'account.delete', request.auth.id, { username: user.username })
    await client.query('DELETE FROM users WHERE id = $1', [request.auth.id])
    return true
  })
  if (!deleted) {
    response.status(401).json({ error: '当前密码错误。' })
    return
  }
  clearSessionCookie(response)
  response.json({ ok: true })
}))

app.get('/api/auth/me', requireAuth, (request, response) => {
  response.json({ user: request.auth })
})

app.get('/api/progress', requireAuth, asyncRoute(async (request, response) => {
  const result = await pool.query(
    'SELECT payload, version, updated_at FROM user_progress WHERE user_id = $1',
    [request.auth.id],
  )
  const row = result.rows[0]
  response.json(row
    ? {
      hasProgress: true,
      progress: row.payload,
      version: row.version,
      updatedAt: new Date(row.updated_at).getTime(),
    }
    : { hasProgress: false, progress: null, version: 0, updatedAt: 0 })
}))

app.put('/api/progress', requireAuth, asyncRoute(async (request, response) => {
  if (!isRecord(request.body) || !validateProgressPayload(request.body.progress)) {
    response.status(400).json({ error: '学习进度格式无效。' })
    return
  }
  const expectedVersion = request.body.expectedVersion
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    response.status(400).json({ error: '进度版本无效。' })
    return
  }

  const result = await withTransaction(async (client) => {
    const currentResult = await client.query(
      'SELECT payload, version, updated_at FROM user_progress WHERE user_id = $1 FOR UPDATE',
      [request.auth.id],
    )
    const current = currentResult.rows[0]
    const currentVersion = current?.version ?? 0
    if (currentVersion !== expectedVersion) {
      return { conflict: true, current }
    }
    if (current && JSON.stringify(current.payload) !== JSON.stringify(request.body.progress)) {
      await client.query(
        `INSERT INTO progress_backups (user_id, payload, version, reason)
         VALUES ($1, $2::JSONB, $3, 'automatic_sync')`,
        [request.auth.id, JSON.stringify(current.payload), current.version],
      )
      await client.query(
        `DELETE FROM progress_backups
          WHERE user_id = $1
            AND id NOT IN (
              SELECT id
                FROM progress_backups
               WHERE user_id = $1
               ORDER BY created_at DESC, id DESC
               LIMIT 20
            )`,
        [request.auth.id],
      )
    }
    const nextVersion = currentVersion + 1
    const savedResult = await client.query(
      `INSERT INTO user_progress (user_id, payload, version, updated_at)
       VALUES ($1, $2::JSONB, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET payload = EXCLUDED.payload, version = EXCLUDED.version, updated_at = NOW()
       RETURNING version, updated_at`,
      [request.auth.id, JSON.stringify(request.body.progress), nextVersion],
    )
    return { conflict: false, saved: savedResult.rows[0] }
  })

  if (result.conflict) {
    response.status(409).json({
      error: '云端进度已被其他设备更新。',
      progress: result.current?.payload ?? null,
      version: result.current?.version ?? 0,
      updatedAt: result.current?.updated_at ? new Date(result.current.updated_at).getTime() : 0,
    })
    return
  }
  response.json({
    ok: true,
    version: result.saved.version,
    updatedAt: new Date(result.saved.updated_at).getTime(),
  })
}))

app.get('/api/study-notes', requireAuth, asyncRoute(async (request, response) => {
  const { limit, offset } = parsePagination(request.query)
  const [notesResult, countResult] = await Promise.all([
    pool.query(
      `SELECT id, note_date, content, polished_content, ai_provider_name, ai_model, created_at, updated_at
         FROM study_notes
        WHERE user_id = $1
        ORDER BY note_date DESC, id DESC
        LIMIT $2 OFFSET $3`,
      [request.auth.id, limit, offset],
    ),
    pool.query(
      'SELECT COUNT(*)::INTEGER AS count FROM study_notes WHERE user_id = $1',
      [request.auth.id],
    ),
  ])
  response.json({
    notes: notesResult.rows.map(toStudyNote),
    total: countResult.rows[0].count,
    limit,
    offset,
  })
}))

app.put('/api/study-notes/:date', requireAuth, asyncRoute(async (request, response) => {
  const noteDate = validateStudyNoteDate(request.params.date)
  if (!noteDate) {
    response.status(400).json({ error: '学习记录日期无效。' })
    return
  }
  const allowedKeys = new Set(['content', 'polishedContent', 'aiProviderName', 'aiModel'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '学习记录参数无效。' })
    return
  }
  const content = validateStudyNoteContent(request.body.content, STUDY_NOTE_CONTENT_MAX_LENGTH)
  if (!content) {
    response.status(400).json({ error: '学习记录内容需为 1-20000 个字符。' })
    return
  }
  const polishedContent = request.body.polishedContent === undefined
    ? ''
    : validateStudyNoteContent(request.body.polishedContent, STUDY_NOTE_POLISHED_MAX_LENGTH, true)
  if (polishedContent === null) {
    response.status(400).json({ error: '润色内容不能超过 30000 个字符。' })
    return
  }
  const aiProviderName = request.body.aiProviderName === undefined || request.body.aiProviderName === null
    ? null
    : validateAiText(request.body.aiProviderName, AI_PROVIDER_NAME_MAX_LENGTH)
  const aiModel = request.body.aiModel === undefined || request.body.aiModel === null
    ? null
    : validateAiText(request.body.aiModel, AI_MODEL_MAX_LENGTH)
  if (
    (request.body.aiProviderName !== undefined && request.body.aiProviderName !== null && !aiProviderName)
    || (request.body.aiModel !== undefined && request.body.aiModel !== null && !aiModel)
  ) {
    response.status(400).json({ error: 'AI 供应商名称或模型无效。' })
    return
  }

  const result = await pool.query(
    `INSERT INTO study_notes
       (user_id, note_date, content, polished_content, ai_provider_name, ai_model)
     VALUES ($1, $2::DATE, $3, $4, $5, $6)
     ON CONFLICT (user_id, note_date) DO UPDATE
        SET content = EXCLUDED.content,
            polished_content = EXCLUDED.polished_content,
            ai_provider_name = EXCLUDED.ai_provider_name,
            ai_model = EXCLUDED.ai_model,
            updated_at = NOW()
     RETURNING id, note_date, content, polished_content, ai_provider_name, ai_model, created_at, updated_at`,
    [request.auth.id, noteDate, content, polishedContent, aiProviderName, aiModel],
  )
  response.json({ note: toStudyNote(result.rows[0]) })
}))

app.delete('/api/study-notes/:date', requireAuth, asyncRoute(async (request, response) => {
  const noteDate = validateStudyNoteDate(request.params.date)
  if (!noteDate) {
    response.status(400).json({ error: '学习记录日期无效。' })
    return
  }
  await pool.query(
    'DELETE FROM study_notes WHERE user_id = $1 AND note_date = $2::DATE',
    [request.auth.id, noteDate],
  )
  response.json({ ok: true })
}))

app.post('/api/study-notes/ai/test', requireAuth, asyncRoute(async (_request, response) => {
  const result = await requestStudyNoteAi({ purpose: 'test' })
  response.json(result)
}))

app.post('/api/study-notes/ai/polish', requireAuth, asyncRoute(async (request, response) => {
  const allowedKeys = new Set(['content'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: 'AI 润色参数无效。' })
    return
  }
  const content = validateStudyNoteContent(request.body.content, STUDY_NOTE_CONTENT_MAX_LENGTH)
  if (!content) {
    response.status(400).json({ error: '学习记录内容需为 1-20000 个字符。' })
    return
  }
  const result = await requestStudyNoteAi({ content, purpose: 'polish' })
  response.json(result)
}))

app.post('/api/study-notes/ai/polish-stream', requireAuth, asyncRoute(async (request, response) => {
  const allowedKeys = new Set(['content'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: 'AI 润色参数无效。' })
    return
  }
  const content = validateStudyNoteContent(request.body.content, STUDY_NOTE_CONTENT_MAX_LENGTH)
  if (!content) {
    response.status(400).json({ error: '学习记录内容需为 1-20000 个字符。' })
    return
  }

  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  let finished = false
  function sendEvent(event, data) {
    if (finished) return
    response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }
  function shutdown() {
    if (finished) return
    finished = true
    response.end()
  }

  try {
    await requestStudyNoteAiStream({
      content,
      onDelta(text) {
        sendEvent('delta', { content: text })
      },
      onDone(result) {
        sendEvent('done', { providerName: result.providerName, model: result.model })
        shutdown()
      },
      onError(errorMessage) {
        sendEvent('error', { error: errorMessage })
        shutdown()
      },
    })
  } catch (error) {
    if (!finished) {
      sendEvent('error', { error: 'AI 润色服务异常。' })
      shutdown()
    }
  }
}))

app.get('/api/admin/audit-logs', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const { limit, offset } = parsePagination(request.query)
  const query = typeof request.query.query === 'string' ? request.query.query.trim().slice(0, 64) : ''
  const action = typeof request.query.action === 'string' ? request.query.action.trim().slice(0, 64) : ''
  if (action && !/^[a-z0-9._-]+$/.test(action)) {
    response.status(400).json({ error: '审计动作筛选条件无效。' })
    return
  }
  const search = `%${query}%`
  const parameters = [action, search, limit, offset]
  const [logsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT l.id, l.action, l.metadata, l.created_at,
              actor.id AS actor_id, actor.username AS actor_username,
              actor.display_name AS actor_display_name,
              target.id AS target_id, target.username AS target_username,
              target.display_name AS target_display_name
         FROM audit_logs l
         LEFT JOIN users actor ON actor.id = l.actor_user_id
         LEFT JOIN users target ON target.id = l.target_user_id
        WHERE ($1 = '' OR l.action = $1)
          AND ($2 = '%%'
            OR l.action ILIKE $2
            OR actor.username ILIKE $2
            OR actor.display_name ILIKE $2
            OR target.username ILIKE $2
            OR target.display_name ILIKE $2)
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT $3 OFFSET $4`,
      parameters,
    ),
    pool.query(
      `SELECT COUNT(*)::INTEGER AS count
         FROM audit_logs l
         LEFT JOIN users actor ON actor.id = l.actor_user_id
         LEFT JOIN users target ON target.id = l.target_user_id
        WHERE ($1 = '' OR l.action = $1)
          AND ($2 = '%%'
            OR l.action ILIKE $2
            OR actor.username ILIKE $2
            OR actor.display_name ILIKE $2
            OR target.username ILIKE $2
            OR target.display_name ILIKE $2)`,
      [action, search],
    ),
  ])
  response.json({
    logs: logsResult.rows.map(row => ({
      id: String(row.id),
      action: row.action,
      metadata: isRecord(row.metadata) ? row.metadata : {},
      createdAt: new Date(row.created_at).getTime(),
      actor: row.actor_id ? {
        id: row.actor_id,
        username: row.actor_username,
        displayName: row.actor_display_name,
      } : null,
      target: row.target_id ? {
        id: row.target_id,
        username: row.target_username,
        displayName: row.target_display_name,
      } : null,
    })),
    total: countResult.rows[0].count,
    limit,
    offset,
  })
}))

app.get('/api/admin/users', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const { limit, offset } = parsePagination(request.query)
  const query = typeof request.query.query === 'string' ? request.query.query.trim().slice(0, 64) : ''
  const search = `%${query}%`
  const [usersResult, countResult] = await Promise.all([
    pool.query(
      `SELECT u.*, p.payload, p.updated_at AS progress_updated_at
         FROM users u
         LEFT JOIN user_progress p ON p.user_id = u.id
        WHERE ($1 = '%%' OR u.username ILIKE $1 OR u.display_name ILIKE $1)
        ORDER BY u.created_at DESC
        LIMIT $2 OFFSET $3`,
      [search, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::INTEGER AS count
         FROM users
        WHERE ($1 = '%%' OR username ILIKE $1 OR display_name ILIKE $1)`,
      [search],
    ),
  ])
  response.json({
    users: usersResult.rows.map(row => ({
      ...toPublicUser(row),
      progressSummary: summarizeProgress(row.payload),
      progressUpdatedAt: row.progress_updated_at ? new Date(row.progress_updated_at).getTime() : null,
    })),
    total: countResult.rows[0].count,
    limit,
    offset,
  })
}))

app.post('/api/admin/users', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  if (!isRecord(request.body)) {
    response.status(400).json({ error: '用户参数无效。' })
    return
  }
  const username = validateUsername(request.body.username)
  const displayName = validateDisplayName(request.body.displayName)
  const password = validatePassword(request.body.password)
  const role = validateRole(request.body.role ?? 'user')
  const status = validateStatus(request.body.status ?? 'active')
  if (!username || !displayName || !password || !role || !status) {
    response.status(400).json({ error: '用户名、显示名称、密码、角色或状态不符合要求。' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  try {
    const user = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO users (id, username, display_name, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [randomUUID(), username, displayName, passwordHash, role, status],
      )
      await writeAudit(client, request.auth.id, 'admin.user.create', result.rows[0].id, { username, role, status })
      return result.rows[0]
    })
    response.status(201).json({ user: toPublicUser(user) })
  } catch (error) {
    if (error?.code === '23505') {
      response.status(409).json({ error: '用户名已存在。' })
      return
    }
    throw error
  }
}))

app.patch('/api/admin/users/:id', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const targetId = validateUuid(request.params.id)
  if (!targetId || !isRecord(request.body)) {
    response.status(400).json({ error: '用户参数无效。' })
    return
  }

  const requestedUsername = request.body.username === undefined ? undefined : validateUsername(request.body.username)
  const requestedDisplayName = request.body.displayName === undefined ? undefined : validateDisplayName(request.body.displayName)
  const requestedRole = request.body.role === undefined ? undefined : validateRole(request.body.role)
  const requestedStatus = request.body.status === undefined ? undefined : validateStatus(request.body.status)
  const requestedPassword = request.body.password === undefined || request.body.password === ''
    ? undefined
    : validatePassword(request.body.password)
  if (
    (request.body.username !== undefined && !requestedUsername)
    || (request.body.displayName !== undefined && !requestedDisplayName)
    || (request.body.role !== undefined && !requestedRole)
    || (request.body.status !== undefined && !requestedStatus)
    || (request.body.password !== undefined && request.body.password !== '' && !requestedPassword)
  ) {
    response.status(400).json({ error: '更新字段不符合要求。' })
    return
  }
  try {
    const updatedUser = await withTransaction(async (client) => {
      const targetResult = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [targetId])
      const target = targetResult.rows[0]
      if (!target) return null
      const nextRole = requestedRole ?? target.role
      const nextStatus = requestedStatus ?? target.status
      if (targetId === request.auth.id && (nextRole !== target.role || nextStatus !== target.status)) {
        const error = new Error('不能修改当前登录超管自己的角色或状态。')
        error.statusCode = 409
        throw error
      }
      await ensureAdminContinuity(client, target, nextRole, nextStatus)

      const fields = []
      const values = []
      const addField = (column, value) => {
        values.push(value)
        fields.push(`${column} = $${values.length}`)
      }
      if (requestedUsername) addField('username', requestedUsername)
      if (requestedDisplayName) addField('display_name', requestedDisplayName)
      if (requestedRole) addField('role', requestedRole)
      if (requestedStatus) addField('status', requestedStatus)
      if (requestedPassword) {
        addField('password_hash', await bcrypt.hash(requestedPassword, 12))
        fields.push('password_changed_at = NOW()')
      }
      if (fields.length === 0) return target
      fields.push('updated_at = NOW()')
      values.push(targetId)
      const result = await client.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values,
      )
      if (requestedPassword || requestedStatus === 'disabled') {
        await client.query('DELETE FROM sessions WHERE user_id = $1', [targetId])
      }
      await writeAudit(client, request.auth.id, 'admin.user.update', targetId, {
        usernameChanged: Boolean(requestedUsername),
        displayNameChanged: Boolean(requestedDisplayName),
        role: requestedRole,
        status: requestedStatus,
        passwordChanged: Boolean(requestedPassword),
      })
      return result.rows[0]
    })
    if (!updatedUser) {
      response.status(404).json({ error: '用户不存在。' })
      return
    }
    response.json({ user: toPublicUser(updatedUser) })
  } catch (error) {
    if (error?.code === '23505') {
      response.status(409).json({ error: '用户名已存在。' })
      return
    }
    throw error
  }
}))

app.delete('/api/admin/users/:id', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const targetId = validateUuid(request.params.id)
  if (!targetId) {
    response.status(400).json({ error: '用户 ID 无效。' })
    return
  }
  if (targetId === request.auth.id) {
    response.status(409).json({ error: '不能删除当前登录账号。' })
    return
  }

  const deleted = await withTransaction(async (client) => {
    const userResult = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [targetId])
    const target = userResult.rows[0]
    if (!target) return false
    await ensureAdminContinuity(client, target, 'user', 'disabled')
    const progressResult = await client.query('SELECT * FROM user_progress WHERE user_id = $1', [targetId])
    await client.query(
      `INSERT INTO deleted_user_backups
        (original_user_id, deleted_by, user_snapshot, progress_snapshot)
       VALUES ($1, $2, $3::JSONB, $4::JSONB)`,
      [
        targetId,
        request.auth.id,
        JSON.stringify(target),
        progressResult.rows[0] ? JSON.stringify(progressResult.rows[0]) : null,
      ],
    )
    await writeAudit(client, request.auth.id, 'admin.user.delete', targetId, { username: target.username })
    await client.query('DELETE FROM users WHERE id = $1', [targetId])
    return true
  })
  if (!deleted) {
    response.status(404).json({ error: '用户不存在。' })
    return
  }
  response.json({ ok: true })
}))

app.get('/api/admin/users/:id/progress', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const targetId = validateUuid(request.params.id)
  if (!targetId) {
    response.status(400).json({ error: '用户 ID 无效。' })
    return
  }
  const result = await pool.query(
    `SELECT u.id, u.username, u.display_name, p.payload, p.version, p.updated_at
       FROM users u
       LEFT JOIN user_progress p ON p.user_id = u.id
      WHERE u.id = $1`,
    [targetId],
  )
  const row = result.rows[0]
  if (!row) {
    response.status(404).json({ error: '用户不存在。' })
    return
  }
  response.json({
    user: { id: row.id, username: row.username, displayName: row.display_name },
    progress: row.payload ?? null,
    summary: summarizeProgress(row.payload),
    version: row.version ?? 0,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,
  })
}))

if (serveStatic) {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
  const distDirectory = path.resolve(currentDirectory, '../dist')
  const assetsDirectory = path.join(distDirectory, 'assets')
  app.use('/assets', express.static(assetsDirectory, {
    immutable: true,
    maxAge: '1y',
  }))
  app.use(express.static(distDirectory, { index: 'index.html', maxAge: 0 }))
  app.use((request, response, next) => {
    if (request.method !== 'GET' || request.path.startsWith('/api/')) {
      next()
      return
    }
    response.setHeader('Cache-Control', 'no-store')
    response.sendFile(path.join(distDirectory, 'index.html'))
  })
}

app.post('/api/feedback', requireAuth, asyncRoute(async (request, response) => {
  const allowedKeys = new Set(['category', 'content', 'contact'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '反馈参数无效。' })
    return
  }
  const category = typeof request.body.category === 'string' ? request.body.category.trim() : ''
  if (!['suggestion', 'bug', 'other'].includes(category)) {
    response.status(400).json({ error: '反馈类别无效。' })
    return
  }
  const content = typeof request.body.content === 'string' ? request.body.content.trim() : ''
  if (content.length < 1 || content.length > 2000) {
    response.status(400).json({ error: '反馈内容需为 1-2000 个字符。' })
    return
  }
  const contact = typeof request.body.contact === 'string' && request.body.contact.trim().length > 0
    ? request.body.contact.trim().slice(0, 128)
    : null

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO feedback (user_id, category, content, contact)
       VALUES ($1, $2, $3, $4)`,
      [request.auth.id, category, content, contact],
    )
    await writeAudit(client, request.auth.id, 'feedback.submit', request.auth.id, { category })
  })
  response.json({ ok: true })
}))

app.get('/api/feedback/mine', requireAuth, asyncRoute(async (request, response) => {
  const result = await pool.query(
    `SELECT id, category, content, contact, status, created_at, seen_at
       FROM feedback
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20`,
    [request.auth.id],
  )
  response.json({
    feedbacks: result.rows.map(row => ({
      id: String(row.id),
      category: row.category,
      content: row.content,
      contact: row.contact ?? null,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      seenAt: row.seen_at ? new Date(row.seen_at).getTime() : null,
    })),
  })
}))

app.get('/api/admin/feedback', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const { limit, offset } = parsePagination(request.query)
  const status = typeof request.query.status === 'string' ? request.query.status.trim().slice(0, 16) : ''
  if (status && !['open', 'seen', 'resolved'].includes(status)) {
    response.status(400).json({ error: '状态筛选条件无效。' })
    return
  }
  const [feedbacksResult, countResult] = await Promise.all([
    pool.query(
      `SELECT f.id, f.category, f.content, f.contact, f.status,
              f.created_at, f.seen_at,
              u.id AS user_id, u.username AS user_username, u.display_name AS user_display_name
         FROM feedback f
         LEFT JOIN users u ON u.id = f.user_id
        WHERE ($1 = '' OR f.status = $1)
        ORDER BY f.created_at DESC, f.id DESC
        LIMIT $2 OFFSET $3`,
      [status, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::INTEGER AS count
         FROM feedback
        WHERE ($1 = '' OR status = $1)`,
      [status],
    ),
  ])
  response.json({
    feedbacks: feedbacksResult.rows.map(row => ({
      id: String(row.id),
      category: row.category,
      content: row.content,
      contact: row.contact ?? null,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      seenAt: row.seen_at ? new Date(row.seen_at).getTime() : null,
      user: row.user_id ? {
        id: row.user_id,
        username: row.user_username,
        displayName: row.user_display_name,
      } : null,
    })),
    total: countResult.rows[0].count,
    limit,
    offset,
  })
}))

app.patch('/api/admin/feedback/:id', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const feedbackId = Number.parseInt(request.params.id ?? '', 10)
  if (!Number.isInteger(feedbackId) || feedbackId < 1) {
    response.status(400).json({ error: '反馈 ID 无效。' })
    return
  }
  const allowedKeys = new Set(['status'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '反馈更新参数无效。' })
    return
  }
  const status = typeof request.body.status === 'string' ? request.body.status.trim() : ''
  if (!['open', 'seen', 'resolved'].includes(status)) {
    response.status(400).json({ error: '反馈状态无效。' })
    return
  }
  const result = await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE feedback
          SET status = $2,
              seen_at = CASE WHEN $2 <> 'open' AND seen_at IS NULL THEN NOW() ELSE seen_at END
        WHERE id = $1
        RETURNING id, status`,
      [feedbackId, status],
    )
    if (updated.rowCount === 0) return null
    await writeAudit(client, request.auth.id, 'feedback.update', request.auth.id, { feedbackId, status })
    return updated.rows[0]
  })
  if (!result) {
    response.status(404).json({ error: '反馈不存在。' })
    return
  }
  response.json({ ok: true, status: result.status })
}))

app.get('/api/announcements/latest', requireAuth, asyncRoute(async (request, response) => {
  const result = await pool.query(
    `SELECT a.id, a.title, a.content, a.published_at
       FROM announcements a
       LEFT JOIN announcement_reads r
         ON r.announcement_id = a.id AND r.user_id = $1
      WHERE a.active = true
        AND r.user_id IS NULL
        AND a.published_at <= NOW()
      ORDER BY a.published_at DESC, a.id DESC
      LIMIT 1`,
    [request.auth.id],
  )
  const row = result.rows[0]
  if (!row) {
    response.json({ announcement: null })
    return
  }
  response.json({
    announcement: {
      id: String(row.id),
      title: row.title,
      content: row.content,
      publishedAt: new Date(row.published_at).getTime(),
    },
  })
}))

app.post('/api/announcements/:id/read', requireAuth, asyncRoute(async (request, response) => {
  const announcementId = Number.parseInt(request.params.id ?? '', 10)
  if (!Number.isInteger(announcementId) || announcementId < 1) {
    response.status(400).json({ error: '公告 ID 无效。' })
    return
  }
  await pool.query(
    `INSERT INTO announcement_reads (user_id, announcement_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, announcement_id) DO NOTHING`,
    [request.auth.id, announcementId],
  )
  response.json({ ok: true })
}))

app.get('/api/admin/announcements', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const { limit, offset } = parsePagination(request.query)
  const [announcementsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT a.id, a.title, a.content, a.published_at, a.active,
              a.created_at, a.updated_at
         FROM announcements a
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query(
      'SELECT COUNT(*)::INTEGER AS count FROM announcements',
    ),
  ])
  response.json({
    announcements: announcementsResult.rows.map(row => ({
      id: String(row.id),
      title: row.title,
      content: row.content,
      publishedAt: new Date(row.published_at).getTime(),
      active: row.active,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    })),
    total: countResult.rows[0].count,
    limit,
    offset,
  })
}))

app.post('/api/admin/announcements', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const allowedKeys = new Set(['title', 'content', 'active', 'publishedAt'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '公告参数无效。' })
    return
  }
  if (typeof request.body.title !== 'string') {
    response.status(400).json({ error: '公告标题无效。' })
    return
  }
  const title = request.body.title.trim()
  if (title.length < 1 || title.length > 120) {
    response.status(400).json({ error: '公告标题需为 1-120 个字符。' })
    return
  }
  if (typeof request.body.content !== 'string') {
    response.status(400).json({ error: '公告内容无效。' })
    return
  }
  const content = request.body.content.trim()
  if (content.length < 1 || content.length > 4000) {
    response.status(400).json({ error: '公告内容需为 1-4000 个字符。' })
    return
  }
  const active = request.body.active === undefined ? true : Boolean(request.body.active)
  let publishedAt = 'NOW()'
  const params = [title, content, active, request.auth.id]
  if (request.body.publishedAt !== undefined) {
    const ts = Number(request.body.publishedAt)
    if (!Number.isFinite(ts) || ts <= 0) {
      response.status(400).json({ error: '公告发布时间无效。' })
      return
    }
    publishedAt = 'TO_TIMESTAMP($5)'
    params.push(ts)
  }
  const result = await withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO announcements (title, content, active, created_by, published_at)
       VALUES ($1, $2, $3, $4, ${publishedAt})
       RETURNING id, title, content, published_at, active, created_at, updated_at`,
      params,
    )
    await writeAudit(client, request.auth.id, 'announcement.create', request.auth.id, { title })
    return inserted.rows[0]
  })
  response.json({
    announcement: {
      id: String(result.id),
      title: result.title,
      content: result.content,
      publishedAt: new Date(result.published_at).getTime(),
      active: result.active,
      createdAt: new Date(result.created_at).getTime(),
      updatedAt: new Date(result.updated_at).getTime(),
    },
  })
}))

app.patch('/api/admin/announcements/:id', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const announcementId = Number.parseInt(request.params.id ?? '', 10)
  if (!Number.isInteger(announcementId) || announcementId < 1) {
    response.status(400).json({ error: '公告 ID 无效。' })
    return
  }
  const allowedKeys = new Set(['title', 'content', 'active'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '公告更新参数无效。' })
    return
  }
  const fields = []
  const values = []
  if (request.body.title !== undefined) {
    const title = typeof request.body.title === 'string' ? request.body.title.trim() : ''
    if (title.length < 1 || title.length > 120) {
      response.status(400).json({ error: '公告标题需为 1-120 个字符。' })
      return
    }
    values.push(title)
    fields.push(`title = $${values.length}`)
  }
  if (request.body.content !== undefined) {
    const content = typeof request.body.content === 'string' ? request.body.content.trim() : ''
    if (content.length < 1 || content.length > 4000) {
      response.status(400).json({ error: '公告内容需为 1-4000 个字符。' })
      return
    }
    values.push(content)
    fields.push(`content = $${values.length}`)
  }
  if (request.body.active !== undefined) {
    values.push(Boolean(request.body.active))
    fields.push(`active = $${values.length}`)
  }
  if (fields.length === 0) {
    response.status(400).json({ error: '没有需要更新的字段。' })
    return
  }
  values.push('NOW()')
  fields.push(`updated_at = $${values.length}`)
  values.push(announcementId)
  const result = await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE announcements
          SET ${fields.join(', ')}
        WHERE id = $${values.length}
        RETURNING id, title, content, published_at, active, created_at, updated_at`,
      values,
    )
    if (updated.rowCount === 0) return null
    await writeAudit(client, request.auth.id, 'announcement.update', request.auth.id, { announcementId })
    return updated.rows[0]
  })
  if (!result) {
    response.status(404).json({ error: '公告不存在。' })
    return
  }
  response.json({
    announcement: {
      id: String(result.id),
      title: result.title,
      content: result.content,
      publishedAt: new Date(result.published_at).getTime(),
      active: result.active,
      createdAt: new Date(result.created_at).getTime(),
      updatedAt: new Date(result.updated_at).getTime(),
    },
  })
}))


// ---------- 桌面端版本发布 ----------

// 公开端点:桌面端启动时拉取,可能用户未登录,因此不加 requireAuth
app.get('/api/desktop/latest-version', asyncRoute(async (_request, response) => {
  const result = await pool.query(
    `SELECT version, min_supported AS "minSupported", download_url AS "downloadUrl",
            release_notes AS "releaseNotes"
       FROM desktop_releases
      WHERE enabled = 1`,
  )
  if (result.rowCount === 0) {
    response.json({ version: null, minSupported: null, downloadUrl: null, releaseNotes: null })
    return
  }
  // 在 JS 侧做语义版本比较,避免 SQLite 字符串排序把 1.10.0 排在 1.2.0 之前
  const latest = result.rows.reduce((acc, row) => {
    if (!acc) return row
    return compareVersionsServer(row.version, acc.version) > 0 ? row : acc
  }, null)
  response.json(latest)
}))

app.get('/api/admin/desktop-releases', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const { limit, offset } = parsePagination(request.query)
  const [releasesResult, countResult] = await Promise.all([
    pool.query(
      `SELECT id, version, min_supported AS "minSupported", download_url AS "downloadUrl",
              release_notes AS "releaseNotes", enabled, created_at, updated_at
         FROM desktop_releases
        ORDER BY created_at DESC, id DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query('SELECT COUNT(*)::INTEGER AS count FROM desktop_releases'),
  ])
  response.json({
    releases: releasesResult.rows.map(row => ({
      id: Number(row.id),
      version: row.version,
      minSupported: row.minSupported,
      downloadUrl: row.downloadUrl,
      releaseNotes: row.releaseNotes,
      enabled: row.enabled === 1,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    })),
    total: countResult.rows[0].count,
    limit,
    offset,
  })
}))

app.post('/api/admin/desktop-releases', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const allowedKeys = new Set(['version', 'minSupported', 'downloadUrl', 'releaseNotes', 'enabled'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '桌面端版本参数无效。' })
    return
  }
  if (typeof request.body.version !== 'string' || !SEMVER_RE_SERVER.test(request.body.version)) {
    response.status(400).json({ error: '版本号需为 x.y.z 形式纯数字。' })
    return
  }
  const version = request.body.version
  if (typeof request.body.minSupported !== 'string' || !SEMVER_RE_SERVER.test(request.body.minSupported)) {
    response.status(400).json({ error: '最低兼容版本需为 x.y.z 形式纯数字。' })
    return
  }
  const minSupported = request.body.minSupported
  if (typeof request.body.downloadUrl !== 'string' || !/^https?:\/\//.test(request.body.downloadUrl) || request.body.downloadUrl.length > 500) {
    response.status(400).json({ error: '下载地址需为 http(s):// 开头且不超过 500 字符。' })
    return
  }
  const downloadUrl = request.body.downloadUrl
  const releaseNotesRaw = typeof request.body.releaseNotes === 'string' ? request.body.releaseNotes : ''
  if (releaseNotesRaw.length > 2000) {
    response.status(400).json({ error: '发布说明不超过 2000 字符。' })
    return
  }
  const releaseNotes = releaseNotesRaw
  const enabled = request.body.enabled === undefined ? true : Boolean(request.body.enabled)

  try {
    const result = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO desktop_releases (version, min_supported, download_url, release_notes, enabled)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, version, min_supported, download_url, release_notes, enabled, created_at, updated_at`,
        [version, minSupported, downloadUrl, releaseNotes, enabled ? 1 : 0],
      )
      await writeAudit(client, request.auth.id, 'desktop_release.create', request.auth.id, { version })
      return inserted.rows[0]
    })
    response.json({
      release: {
        id: Number(result.id),
        version: result.version,
        minSupported: result.min_supported,
        downloadUrl: result.download_url,
        releaseNotes: result.release_notes,
        enabled: result.enabled === 1,
        createdAt: new Date(result.created_at).getTime(),
        updatedAt: new Date(result.updated_at).getTime(),
      },
    })
  } catch (error) {
    // version 唯一约束冲突
    if (error?.code === '23505') {
      response.status(400).json({ error: '该版本号已存在。' })
      return
    }
    throw error
  }
}))

app.patch('/api/admin/desktop-releases/:id', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const releaseId = Number.parseInt(request.params.id ?? '', 10)
  if (!Number.isInteger(releaseId) || releaseId < 1) {
    response.status(400).json({ error: '版本记录 ID 无效。' })
    return
  }
  // version 不可改:版本号是身份(UNIQUE),需要换版本应新建一条再停用旧的
  const allowedKeys = new Set(['minSupported', 'downloadUrl', 'releaseNotes', 'enabled'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '桌面端版本更新参数无效。' })
    return
  }

  const fields = []
  const values = []
  if (request.body.minSupported !== undefined) {
    if (typeof request.body.minSupported !== 'string' || !SEMVER_RE_SERVER.test(request.body.minSupported)) {
      response.status(400).json({ error: '最低兼容版本需为 x.y.z 形式纯数字。' })
      return
    }
    values.push(request.body.minSupported)
    fields.push(`min_supported = $${values.length}`)
  }
  if (request.body.downloadUrl !== undefined) {
    if (typeof request.body.downloadUrl !== 'string' || !/^https?:\/\//.test(request.body.downloadUrl) || request.body.downloadUrl.length > 500) {
      response.status(400).json({ error: '下载地址需为 http(s):// 开头且不超过 500 字符。' })
      return
    }
    values.push(request.body.downloadUrl)
    fields.push(`download_url = $${values.length}`)
  }
  if (request.body.releaseNotes !== undefined) {
    if (typeof request.body.releaseNotes !== 'string' || request.body.releaseNotes.length > 2000) {
      response.status(400).json({ error: '发布说明不超过 2000 字符。' })
      return
    }
    values.push(request.body.releaseNotes)
    fields.push(`release_notes = $${values.length}`)
  }
  if (request.body.enabled !== undefined) {
    values.push(Boolean(request.body.enabled) ? 1 : 0)
    fields.push(`enabled = $${values.length}`)
  }
  if (fields.length === 0) {
    response.status(400).json({ error: '没有需要更新的字段。' })
    return
  }
  values.push('NOW()')
  fields.push(`updated_at = $${values.length}`)
  values.push(releaseId)

  const result = await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE desktop_releases
          SET ${fields.join(', ')}
        WHERE id = $${values.length}
        RETURNING id, version, min_supported, download_url, release_notes, enabled, created_at, updated_at`,
      values,
    )
    if (updated.rowCount === 0) return null
    await writeAudit(client, request.auth.id, 'desktop_release.update', request.auth.id, { releaseId })
    return updated.rows[0]
  })
  if (!result) {
    response.status(404).json({ error: '版本记录不存在。' })
    return
  }
  response.json({
    release: {
      id: Number(result.id),
      version: result.version,
      minSupported: result.min_supported,
      downloadUrl: result.download_url,
      releaseNotes: result.release_notes,
      enabled: result.enabled === 1,
      createdAt: new Date(result.created_at).getTime(),
      updatedAt: new Date(result.updated_at).getTime(),
    },
  })
}))

app.delete('/api/admin/desktop-releases/:id', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const releaseId = Number.parseInt(request.params.id ?? '', 10)
  if (!Number.isInteger(releaseId) || releaseId < 1) {
    response.status(400).json({ error: '版本记录 ID 无效。' })
    return
  }
  const result = await withTransaction(async (client) => {
    const found = await client.query('SELECT version FROM desktop_releases WHERE id = $1', [releaseId])
    if (found.rowCount === 0) return null
    await writeAudit(client, request.auth.id, 'desktop_release.delete', request.auth.id, { version: found.rows[0].version })
    await client.query('DELETE FROM desktop_releases WHERE id = $1', [releaseId])
    return true
  })
  if (!result) {
    response.status(404).json({ error: '版本记录不存在。' })
    return
  }
  response.json({ ok: true })
}))
app.use((error, _request, response, _next) => {
  if (error?.message === 'origin_not_allowed') {
    response.status(403).json({ error: '请求来源未获授权。' })
    return
  }
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500
  if (statusCode >= 500) {
    console.error('[server]', error)
  }
  response.status(statusCode).json({ error: statusCode >= 500 ? '服务器内部错误。' : error.message })
})

if (process.env.VERCEL !== '1') {
  const server = app.listen(port, () => {
    console.info(`云栈账号服务已启动：http://127.0.0.1:${port}`)
  })

  async function shutdown(signal) {
    console.info(`收到 ${signal}，正在关闭账号服务。`)
    server.close(async () => {
      await pool.end()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

export default app
