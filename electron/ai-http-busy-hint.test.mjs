import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { appendAiHttpBusyRetryHint } = require('./ai-http-busy-hint.cjs')

describe('appendAiHttpBusyRetryHint', () => {
  it('appends busy retry hint for HTTP 529 while keeping original status text', () => {
    const message = appendAiHttpBusyRetryHint(
      529,
      'AI 供应商返回错误：HTTP 529，overloaded。',
    )
    expect(message).toBe('AI 供应商返回错误：HTTP 529，overloaded。供应商当前可能繁忙，请稍后重试。')
    expect(message).toContain('HTTP 529')
    expect(message).toContain('overloaded')
  })

  it('does not append busy retry hint for 401/403/404', () => {
    for (const status of [401, 403, 404]) {
      const base = `AI 供应商返回错误：HTTP ${status}，denied。`
      expect(appendAiHttpBusyRetryHint(status, base)).toBe(base)
      expect(appendAiHttpBusyRetryHint(status, base)).not.toContain('供应商当前可能繁忙')
    }
  })
})
