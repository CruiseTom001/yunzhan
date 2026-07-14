import { validateEmail } from './validation.mjs'

const LOCAL_DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]
const SMTP_HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

function readBoolean(value) {
  return value === 'true'
}

function readPort(value) {
  if (typeof value !== 'string' || !/^\d{1,5}$/.test(value)) return null
  const port = Number.parseInt(value, 10)
  return Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : null
}

function readFromAddress(value) {
  if (typeof value !== 'string') return null
  const from = value.trim()
  if (from.length < 3 || from.length > 320 || /[\r\n]/.test(from)) return null
  const angleAddressMatch = from.match(/<([^<>]+)>$/)
  return validateEmail(angleAddressMatch?.[1] ?? from) === null ? null : from
}

function normalizeOrigin(value, production) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null
  try {
    const parsed = new URL(value)
    const isAllowedProtocol = parsed.protocol === 'https:'
      || (!production && parsed.protocol === 'http:')
    const hasRootPathOnly = parsed.pathname === '/' && !parsed.search && !parsed.hash
    const hasNoCredentials = !parsed.username && !parsed.password
    return isAllowedProtocol && hasRootPathOnly && hasNoCredentials ? parsed.origin : null
  } catch {
    return null
  }
}

function readVercelOrigin(hostname) {
  if (hostname === undefined || hostname === '') return undefined
  if (typeof hostname !== 'string' || hostname.length > 253) return null
  if (hostname.includes('/') || hostname.includes('@') || hostname.includes(':')) return null
  return `https://${hostname}`
}

function readAllowedOrigins(environment, production) {
  const configuredOrigins = (environment.APP_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
  const rawOrigins = [
    ...configuredOrigins,
    environment.RENDER_EXTERNAL_URL?.trim(),
    readVercelOrigin(environment.VERCEL_URL?.trim()),
    readVercelOrigin(environment.VERCEL_PROJECT_PRODUCTION_URL?.trim()),
  ].filter(origin => origin !== undefined && origin !== '')
  const effectiveOrigins = rawOrigins.length > 0 || production
    ? rawOrigins
    : LOCAL_DEVELOPMENT_ORIGINS
  const normalizedOrigins = effectiveOrigins.map(origin => normalizeOrigin(origin, production))
  if (normalizedOrigins.some(origin => origin === null)) {
    throw new Error('部署环境包含无效来源。')
  }
  if (normalizedOrigins.length === 0) {
    throw new Error('生产环境必须配置至少一个 HTTPS 来源。')
  }
  return new Set(normalizedOrigins)
}

function validateProductionEmailConfig(environment) {
  if ((environment.EMAIL_CODE_SECRET ?? '').length < 32) {
    throw new Error('生产环境 EMAIL_CODE_SECRET 必须至少 32 个字符。')
  }
  const smtpHost = environment.SMTP_HOST?.trim() ?? ''
  if (!SMTP_HOST_PATTERN.test(smtpHost)) {
    throw new Error('生产环境必须配置有效的 SMTP_HOST。')
  }
  const smtpPort = readPort(environment.SMTP_PORT)
  if (smtpPort === null) {
    throw new Error('生产环境必须配置有效的 SMTP_PORT。')
  }
  if (environment.SMTP_SECURE !== 'true' && environment.SMTP_SECURE !== 'false') {
    throw new Error('生产环境 SMTP_SECURE 只能是 true 或 false。')
  }
  if (validateEmail(environment.SMTP_USER) === null) {
    throw new Error('生产环境必须配置有效的 SMTP_USER。')
  }
  const smtpPassword = environment.SMTP_PASSWORD ?? ''
  if (smtpPassword.length < 8 || smtpPassword.length > 512) {
    throw new Error('生产环境必须配置有效的 SMTP_PASSWORD。')
  }
  if (readFromAddress(environment.SMTP_FROM) === null) {
    throw new Error('生产环境必须配置 SMTP_FROM。')
  }
}

export function loadRuntimeConfig(environment = process.env) {
  const production = environment.NODE_ENV === 'production'
  const port = readPort(environment.PORT ?? '8787')
  if (port === null) {
    throw new Error('PORT 必须是有效端口。')
  }

  const sameSiteValue = environment.COOKIE_SAME_SITE ?? 'lax'
  if (sameSiteValue !== 'lax' && sameSiteValue !== 'none') {
    throw new Error('COOKIE_SAME_SITE 只能是 lax 或 none。')
  }
  const secureCookie = readBoolean(environment.COOKIE_SECURE)
  if (sameSiteValue === 'none' && !secureCookie) {
    throw new Error('COOKIE_SAME_SITE=none 时必须同时配置 COOKIE_SECURE=true。')
  }
  if (production && !secureCookie) {
    throw new Error('生产环境必须配置 COOKIE_SECURE=true。')
  }
  if (production) validateProductionEmailConfig(environment)

  return {
    allowElectronFileOrigin: readBoolean(environment.ALLOW_ELECTRON_FILE_ORIGIN),
    allowedOrigins: readAllowedOrigins(environment, production),
    port,
    sameSite: sameSiteValue,
    secureCookie,
    serveStatic: readBoolean(environment.SERVE_STATIC),
    trustProxy: readBoolean(environment.TRUST_PROXY),
  }
}
