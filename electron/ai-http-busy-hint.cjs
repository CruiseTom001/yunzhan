'use strict'

/**
 * Electron AI HTTP 错误文案（与网页端 529 提示语义一致）。
 * @param {number|string} status
 * @param {string} baseMessage
 * @returns {string}
 */
function appendAiHttpBusyRetryHint(status, baseMessage) {
  const message = typeof baseMessage === 'string' ? baseMessage : ''
  if (Number(status) === 529) {
    return `${message}供应商当前可能繁忙，请稍后重试。`
  }
  return message
}

module.exports = {
  appendAiHttpBusyRetryHint,
}
