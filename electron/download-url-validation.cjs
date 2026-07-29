/**
 * 与 src/utils/desktopDownloadUrl.ts 保持同步。
 */
const ALLOWED_HOSTS = new Set([
  'github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
])

const MAX_URL_LENGTH = 500

function isAllowedDesktopDownloadUrl(url) {
  if (typeof url !== 'string') return false
  if (url.length === 0 || url.length > MAX_URL_LENGTH) return false

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false
  return ALLOWED_HOSTS.has(parsed.hostname)
}

module.exports = {
  ALLOWED_HOSTS,
  MAX_URL_LENGTH,
  isAllowedDesktopDownloadUrl,
}
