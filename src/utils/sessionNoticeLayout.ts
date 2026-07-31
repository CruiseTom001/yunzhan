export const SESSION_NOTICE_HEADER_OFFSET = '4rem'
export const SESSION_NOTICE_Z_INDEX = 45

export function readSessionNoticeTopPx(topValue = SESSION_NOTICE_HEADER_OFFSET): number {
  if (topValue.endsWith('rem')) return parseFloat(topValue) * 16
  if (topValue.endsWith('px')) return parseFloat(topValue)
  return Number.parseFloat(topValue) || 0
}
