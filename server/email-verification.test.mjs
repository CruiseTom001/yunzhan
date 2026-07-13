import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createEmailChallenge, verifyEmailChallengeCode } from './email-verification.mjs'
import { sendRegistrationCode } from './email-service.mjs'

const originalSecret = process.env.EMAIL_CODE_SECRET
const originalApiKey = process.env.RESEND_API_KEY
const originalFrom = process.env.RESEND_FROM_EMAIL

beforeAll(() => {
  process.env.EMAIL_CODE_SECRET = 'test-only-secret-that-is-longer-than-32-characters'
  delete process.env.RESEND_API_KEY
  delete process.env.RESEND_FROM_EMAIL
})

afterAll(() => {
  if (originalSecret === undefined) delete process.env.EMAIL_CODE_SECRET
  else process.env.EMAIL_CODE_SECRET = originalSecret
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY
  else process.env.RESEND_API_KEY = originalApiKey
  if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL
  else process.env.RESEND_FROM_EMAIL = originalFrom
})

describe('email verification challenge', () => {
  it('creates a six-digit code and verifies only the matching challenge', () => {
    const challenge = createEmailChallenge('learner@example.com', '127.0.0.1')

    expect(challenge.code).toMatch(/^\d{6}$/)
    expect(challenge.codeDigest).toHaveLength(64)
    expect(challenge.requestIpDigest).toHaveLength(64)
    expect(verifyEmailChallengeCode({
      id: challenge.id,
      code_digest: challenge.codeDigest,
    }, 'learner@example.com', challenge.code)).toBe(true)
    expect(verifyEmailChallengeCode({
      id: challenge.id,
      code_digest: challenge.codeDigest,
    }, 'learner@example.com', '999999')).toBe(false)
  })

  it('rejects delivery when Resend configuration is missing', async () => {
    await expect(sendRegistrationCode({
      to: 'learner@example.com',
      code: '123456',
      idempotencyKey: 'test-request',
    })).rejects.toThrow('Resend 邮件服务尚未配置')
  })
})
