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
import { sendRegistrationCode } from './email-service.mjs'
import { createEmailChallenge, verifyEmailChallengeCode } from './email-verification.mjs'
import { loadRuntimeConfig } from './runtime-config.mjs'
import {
  isRecord,
  normalizeEmail,
  normalizeUsername,
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
const loginAttempts = new Map()
const MAX_LOGIN_ATTEMPT_KEYS = 10_000
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
const EMAIL_CODE_COOLDOWN_SECONDS = 60
const EMAIL_CODE_MAX_PER_HOUR = 5
const EMAIL_CODE_MAX_PER_IP_HOUR = 20

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
    if (origin === 'null' && allowElectronFileOrigin) {
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
  const isAllowedDesktopOrigin = origin === 'null'
    && allowElectronFileOrigin
    && request.get('x-yunzhan-client') === 'desktop'
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

  const result = await pool.query(
    `SELECT u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > NOW()
        AND u.status = 'active'`,
    [hashSessionToken(token)],
  )
  const user = result.rows[0]
  if (!user) {
    clearSessionCookie(response)
    response.status(401).json({ error: '登录已失效，请重新登录。' })
    return
  }

  request.auth = toPublicUser(user)
  next()
}

function requireSuperAdmin(request, response, next) {
  if (request.auth?.role !== 'super_admin') {
    response.status(403).json({ error: '仅超管可以执行此操作。' })
    return
  }
  next()
}

function getLoginAttemptKey(request, username) {
  return `${request.ip}:${username}`
}

function getRequestIp(request) {
  return typeof request.ip === 'string' && request.ip.length <= 128 ? request.ip : 'unknown'
}

function isLoginRateLimited(key) {
  const now = Date.now()
  const record = loginAttempts.get(key)
  if (!record || record.resetAt <= now) {
    loginAttempts.delete(key)
    return false
  }
  return record.count >= 5
}

function recordLoginFailure(key) {
  const now = Date.now()
  if (loginAttempts.size >= MAX_LOGIN_ATTEMPT_KEYS && !loginAttempts.has(key)) {
    for (const [storedKey, record] of loginAttempts) {
      if (record.resetAt <= now) loginAttempts.delete(storedKey)
    }
    if (loginAttempts.size >= MAX_LOGIN_ATTEMPT_KEYS) {
      const oldestKey = loginAttempts.keys().next().value
      if (typeof oldestKey === 'string') loginAttempts.delete(oldestKey)
    }
  }
  const current = loginAttempts.get(key)
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return
  }
  current.count += 1
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

  const challenge = createEmailChallenge(email, getRequestIp(request))
  const prepared = await withTransaction(async (client) => {
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
           WHERE email = $1 AND delivery_status IN ('pending', 'sent')
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

    const existingUser = await client.query('SELECT 1 FROM users WHERE email = $1', [email])
    if (existingUser.rowCount > 0) return { shouldSend: false }

    await client.query(
      `UPDATE email_verification_challenges
          SET consumed_at = NOW()
        WHERE email = $1 AND consumed_at IS NULL`,
      [email],
    )
    await client.query(
      `INSERT INTO email_verification_challenges
        (id, email, purpose, code_digest, request_ip_digest, expires_at)
       VALUES ($1, $2, 'registration', $3, $4, $5)`,
      [
        challenge.id,
        email,
        challenge.codeDigest,
        challenge.requestIpDigest,
        new Date(Date.now() + EMAIL_CODE_TTL_MS),
      ],
    )
    return { shouldSend: true }
  })

  if (prepared.shouldSend) {
    try {
      const providerMessageId = await sendRegistrationCode({
        to: email,
        code: challenge.code,
        idempotencyKey: challenge.id,
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
        `SELECT id, code_digest, attempt_count
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
        'SELECT 1 FROM users WHERE username = $1 OR email = $2',
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
        `INSERT INTO sessions (token_hash, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [hashSessionToken(token), user.id, expiresAt],
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
  if (isLoginRateLimited(attemptKey)) {
    response.status(429).json({ error: '登录失败次数过多，请 15 分钟后再试。' })
    return
  }

  if ((!username && !email) || !password) {
    recordLoginFailure(attemptKey)
    response.status(401).json({ error: '用户名或密码错误，或账号已停用。' })
    return
  }

  const result = email
    ? await pool.query('SELECT * FROM users WHERE email = $1', [normalizeEmail(email)])
    : await pool.query('SELECT * FROM users WHERE username = $1', [username])
  const user = result.rows[0]
  const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false
  if (!user || !passwordMatches || user.status !== 'active') {
    recordLoginFailure(attemptKey)
    response.status(401).json({ error: '用户名或密码错误，或账号已停用。' })
    return
  }

  loginAttempts.delete(attemptKey)
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + sessionDurationMs)
  await withTransaction(async (client) => {
    await client.query('DELETE FROM sessions WHERE expires_at <= NOW()')
    await client.query(
      `INSERT INTO sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [hashSessionToken(token), user.id, expiresAt],
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
