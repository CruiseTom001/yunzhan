const LOCAL_DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

function readBoolean(value) {
  return value === 'true'
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

function readAllowedOrigins(environment, production) {
  const configuredOrigins = (environment.APP_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
  const rawOrigins = [
    ...configuredOrigins,
    environment.RENDER_EXTERNAL_URL?.trim(),
  ].filter(Boolean)
  const effectiveOrigins = rawOrigins.length > 0 || production
    ? rawOrigins
    : LOCAL_DEVELOPMENT_ORIGINS
  const normalizedOrigins = effectiveOrigins.map(origin => normalizeOrigin(origin, production))
  if (normalizedOrigins.some(origin => origin === null)) {
    throw new Error('APP_ORIGINS 或 RENDER_EXTERNAL_URL 包含无效来源。')
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
  if (!environment.RESEND_API_KEY?.startsWith('re_')) {
    throw new Error('生产环境必须配置有效的 RESEND_API_KEY。')
  }
  const fromEmail = environment.RESEND_FROM_EMAIL?.trim() ?? ''
  if (!fromEmail || !fromEmail.includes('@')) {
    throw new Error('生产环境必须配置 RESEND_FROM_EMAIL。')
  }
}

export function loadRuntimeConfig(environment = process.env) {
  const production = environment.NODE_ENV === 'production'
  const port = Number.parseInt(environment.PORT ?? '8787', 10)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
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
