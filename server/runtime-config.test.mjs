import { describe, expect, it } from 'vitest'
import { loadRuntimeConfig } from './runtime-config.mjs'

const productionEnvironment = {
  NODE_ENV: 'production',
  COOKIE_SECURE: 'true',
  COOKIE_SAME_SITE: 'lax',
  EMAIL_CODE_SECRET: 'a'.repeat(64),
  SMTP_HOST: 'smtp.qq.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'sender@example.com',
  SMTP_PASSWORD: 'test-only-smtp-password',
  SMTP_FROM: '云栈 <sender@example.com>',
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

  it('adds Vercel deployment and production URLs as allowed origins', () => {
    const config = loadRuntimeConfig({
      ...productionEnvironment,
      RENDER_EXTERNAL_URL: '',
      VERCEL_URL: 'yunzhan-preview.vercel.app',
      VERCEL_PROJECT_PRODUCTION_URL: 'yunzhan.vercel.app',
    })
    expect([...config.allowedOrigins]).toEqual([
      'https://yunzhan-preview.vercel.app',
      'https://yunzhan.vercel.app',
    ])
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

  it('rejects malformed Vercel hostnames', () => {
    expect(() => loadRuntimeConfig({
      ...productionEnvironment,
      RENDER_EXTERNAL_URL: '',
      VERCEL_URL: 'https://yunzhan.vercel.app',
    })).toThrow('无效来源')
  })

  it('fails fast when production email secrets are missing', () => {
    expect(() => loadRuntimeConfig({
      ...productionEnvironment,
      SMTP_PASSWORD: '',
    })).toThrow('SMTP_PASSWORD')
  })

  it('rejects malformed SMTP ports and sender headers', () => {
    expect(() => loadRuntimeConfig({
      ...productionEnvironment,
      SMTP_PORT: '465x',
    })).toThrow('SMTP_PORT')
    expect(() => loadRuntimeConfig({
      ...productionEnvironment,
      SMTP_FROM: '云栈 <sender@example.com>\r\nBcc: other@example.com',
    })).toThrow('SMTP_FROM')
  })
})
