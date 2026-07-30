/**
 * AI 供应商 HTTP 错误文案统一格式（网页服务端非流式 / 流式共用）。
 * 仅输出状态码与 529 重试提示，不接受上游错误正文，避免误传密钥。
 * Electron / 浏览器直连继续使用各自的供应商错误脱敏逻辑。
 */

export const AI_HTTP_BUSY_RETRY_HINT = '供应商当前可能繁忙，请稍后重试。'

/**
 * @param {number} status
 * @returns {string}
 */
export function formatAiProviderHttpError(status) {
  const code = Number(status)
  const safeStatus = Number.isInteger(code) && code >= 100 && code <= 599 ? code : 502
  const base = `AI 供应商返回错误：HTTP ${safeStatus}。`
  if (safeStatus === 529) {
    return `${base}${AI_HTTP_BUSY_RETRY_HINT}`
  }
  return base
}

/**
 * @param {number} status
 * @returns {boolean}
 */
export function isBusyRetryableAiHttpStatus(status) {
  return Number(status) === 529
}
