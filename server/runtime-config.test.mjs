import { describe, expect, it } from 'vitest'
import { loadRuntimeConfig } from './runtime-config.mjs'

const productionEnvironment = {
  NODE_ENV: 'production',
  COOKIE_SECURE: 'true',
  COOKIE_SAME_SITE: 'lax',
  EMAIL_CODE_SECRET: 'a'.repeat(64),
  RESEND_API_KEY: 're_test_key',
  RESEND_FROM_EMAIL: '云栈 <verify@example.com>',
  RENDER_EXTERNAL_URL: 'https://yunzhan-example.onrender.com',
  SERVE_STATIC: 'true',
  TRUST_PROXY: 'true',
}

describe('runtime config', () => {
  it('uses local origins only during development', () => {
    const config = loadRuntimeConfig({})
    expect([...config.allowedOrigins]).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ])
  })

  it('adds the Render public URL as an allowed production origin', () => {
    const config = loadRuntimeConfig(productionEnvironment)
    expect(config.allowedOrigins.has('https://yunzhan-example.onrender.com')).toBe(true)
    expect(config.secureCookie).toBe(true)
  })

  it('rejects non-HTTPS and path-bearing production origins', () => {
    expect(() => loadRuntimeConfig({
      ...productionEnvironment,
      RENDER_EXTERNAL_URL: 'http://yunzhan-example.onrender.com',
    })).toThrow('无效来源')
    expect(() => loadRuntimeConfig({
      ...productionEnvironment,
      RENDER_EXTERNAL_URL: 'https://yunzhan-example.onrender.com/app',
    })).toThrow('无效来源')
  })

  it('fails fast when production email secrets are missing', () => {
    expect(() => loadRuntimeConfig({
      ...productionEnvironment,
      RESEND_API_KEY: '',
    })).toThrow('RESEND_API_KEY')
  })
})
