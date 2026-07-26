export type AuthMode = 'login' | 'register' | 'forgot-password'

const VALID_AUTH_MODES = new Set<AuthMode>(['login', 'register', 'forgot-password'])

const UNSAFE_REDIRECT_PROTOCOLS = ['javascript:', 'data:', 'vbscript:']

export function parseAuthMode(value: unknown): AuthMode {
  if (typeof value === 'string' && VALID_AUTH_MODES.has(value as AuthMode)) {
    return value as AuthMode
  }
  return 'login'
}

export function isAuthMode(value: unknown): value is AuthMode {
  return typeof value === 'string' && VALID_AUTH_MODES.has(value as AuthMode)
}

function isUnsafeRedirectPath(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return true
  if (trimmed.startsWith('//')) return true
  const lowered = trimmed.toLowerCase()
  if (UNSAFE_REDIRECT_PROTOCOLS.some((protocol) => lowered.startsWith(protocol))) return true
  if (lowered.includes('/login')) return true
  if (lowered.includes('auth=')) return true
  return false
}

export function readSafeRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed || isUnsafeRedirectPath(trimmed)) return fallback
  return trimmed
}

export function buildLandingAuthQuery(input: {
  auth: AuthMode
  redirect?: unknown
}): Record<string, string> {
  const query: Record<string, string> = { auth: input.auth }
  const safeRedirect = readSafeRedirect(input.redirect, '')
  if (safeRedirect && safeRedirect !== '/') {
    query.redirect = safeRedirect
  }
  return query
}

export function buildLoginCompatRedirect(query: Record<string, unknown>) {
  const auth = parseAuthMode(query.mode ?? query.auth ?? 'login')
  return {
    name: 'landing' as const,
    query: buildLandingAuthQuery({ auth, redirect: query.redirect }),
  }
}

export function buildUnauthenticatedGuardRedirect(fullPath: string): {
  name: 'landing'
  query?: Record<string, string>
} {
  const normalized = fullPath.trim() || '/'
  if (normalized === '/') {
    return { name: 'landing' }
  }
  return {
    name: 'landing',
    query: buildLandingAuthQuery({ auth: 'login', redirect: normalized }),
  }
}

export function stripAuthQuery(query: Record<string, unknown>): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (key === 'auth') continue
    if (typeof value === 'string') next[key] = value
  }
  return next
}
