export const SESSION_COOKIE_NAME = 'yunzhan_session'
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse login remember flag. Missing field defaults to true for legacy clients.
 */
export function parseLoginRememberInput(body) {
  if (!isRecord(body) || !('remember' in body)) {
    return { ok: true, value: true }
  }
  if (typeof body.remember === 'boolean') {
    return { ok: true, value: body.remember }
  }
  return { ok: false, value: null }
}

export function buildSessionCookieOptions(remember, cookieConfig) {
  const options = {
    httpOnly: true,
    secure: cookieConfig.secure,
    sameSite: cookieConfig.sameSite,
    path: '/',
  }
  if (remember) {
    options.maxAge = SESSION_DURATION_MS
  }
  return options
}

export function buildClearSessionCookieOptions(cookieConfig) {
  return {
    httpOnly: true,
    secure: cookieConfig.secure,
    sameSite: cookieConfig.sameSite,
    path: '/',
  }
}

export function readSessionTokenFromLoginResponse(responseJson) {
  if (!isRecord(responseJson)) return null
  if ('token' in responseJson || 'sessionToken' in responseJson) return null
  return responseJson
}
