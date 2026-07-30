export const ANNOUNCEMENT_CLIENT_CHANNEL_WEB = 'web'
export const ANNOUNCEMENT_CLIENT_CHANNEL_DESKTOP = 'desktop'

/**
 * Parse announcement display channel from X-Yunzhan-Client header value.
 * Only an exact desktop identifier maps to desktop; everything else falls back to web.
 * This is used for announcement visibility only, not authentication.
 */
export function parseAnnouncementClientChannel(headerValue) {
  if (typeof headerValue === 'string' && headerValue.trim().toLowerCase() === 'desktop') {
    return ANNOUNCEMENT_CLIENT_CHANNEL_DESKTOP
  }
  return ANNOUNCEMENT_CLIENT_CHANNEL_WEB
}

export function resolveAnnouncementClientChannelFromHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return ANNOUNCEMENT_CLIENT_CHANNEL_WEB
  }
  return parseAnnouncementClientChannel(headers['x-yunzhan-client'])
}

export function resolveAnnouncementClientChannelFromRequest(request) {
  return resolveAnnouncementClientChannelFromHeaders(request?.headers)
}
