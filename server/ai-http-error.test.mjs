import { describe, expect, it, vi } from 'vitest'
import { formatAiProviderHttpError, isBusyRetryableAiHttpStatus } from './ai-http-error.mjs'

describe('formatAiProviderHttpError', () => {
  it('appends busy retry hint only for HTTP 529', () => {
    expect(formatAiProviderHttpError(529)).toBe(
      'AI 供应商返回错误：HTTP 529。供应商当前可能繁忙，请稍后重试。',
    )
    expect(isBusyRetryableAiHttpStatus(529)).toBe(true)
  })

  it('does not tell users to retry for 401/403/404', () => {
    expect(formatAiProviderHttpError(401)).toBe('AI 供应商返回错误：HTTP 401。')
    expect(formatAiProviderHttpError(403)).toBe('AI 供应商返回错误：HTTP 403。')
    expect(formatAiProviderHttpError(404)).toBe('AI 供应商返回错误：HTTP 404。')
    expect(formatAiProviderHttpError(401)).not.toContain('请稍后重试')
    expect(formatAiProviderHttpError(403)).not.toContain('供应商当前可能繁忙')
    expect(formatAiProviderHttpError(404)).not.toContain('请稍后重试')
  })

  it('never embeds API keys in the message', () => {
    const message = formatAiProviderHttpError(529)
    expect(message).toBe('AI 供应商返回错误：HTTP 529。供应商当前可能繁忙，请稍后重试。')
    expect(message).not.toContain('sk-live-secret-key')
    expect(message).not.toMatch(/Authorization/i)
    expect(message).not.toMatch(/api[_-]?key/i)
    // 函数签名只接受 status，无法把上游秘密拼进文案。
    expect(formatAiProviderHttpError.length).toBe(1)
  })
})

describe('formatAiProviderHttpError used by callers', () => {
  it('keeps function pure for stream/non-stream reuse', () => {
    const spy = vi.fn(formatAiProviderHttpError)
    expect(spy(500)).toBe('AI 供应商返回错误：HTTP 500。')
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
