import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createEmailChallenge, verifyEmailChallengeCode } from './email-verification.mjs'
import { sendRegistrationCode } from './email-service.mjs'

const SMTP_ENVIRONMENT_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
]
const originalSecret = process.env.EMAIL_CODE_SECRET
const originalSmtpEnvironment = Object.fromEntries(
  SMTP_ENVIRONMENT_KEYS.map(key => [key, process.env[key]]),
)

function configureTestSmtp() {
  process.env.SMTP_HOST = 'smtp.example.com'
  process.env.SMTP_PORT = '465'
  process.env.SMTP_SECURE = 'true'
  process.env.SMTP_USER = 'sender@example.com'
  process.env.SMTP_PASSWORD = 'test-only-smtp-password'
  process.env.SMTP_FROM = '云栈 <sender@example.com>'
}

beforeAll(() => {
  process.env.EMAIL_CODE_SECRET = 'test-only-secret-that-is-longer-than-32-characters'
  SMTP_ENVIRONMENT_KEYS.forEach(key => delete process.env[key])
})

afterAll(() => {
  if (originalSecret === undefined) delete process.env.EMAIL_CODE_SECRET
  else process.env.EMAIL_CODE_SECRET = originalSecret
  SMTP_ENVIRONMENT_KEYS.forEach((key) => {
    const originalValue = originalSmtpEnvironment[key]
    if (originalValue === undefined) delete process.env[key]
    else process.env[key] = originalValue
  })
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

  it('rejects delivery when SMTP configuration is missing', async () => {
    await expect(sendRegistrationCode({
      to: 'learner@example.com',
      code: '123456',
    })).rejects.toThrow('SMTP 邮件服务尚未配置')
  })

  it('sends the registration code through a TLS SMTP transport', async () => {
    configureTestSmtp()
    let transportOptions
    let deliveredMessage
    const createTransport = (options) => {
      transportOptions = options
      return {
        async sendMail(message) {
          deliveredMessage = message
          return {
            accepted: ['learner@example.com'],
            messageId: '<test-message@example.com>',
            rejected: [],
          }
        },
      }
    }

    const messageId = await sendRegistrationCode({
      to: 'LEARNER@example.com',
      code: '123456',
    }, { createTransport })

    expect(messageId).toBe('<test-message@example.com>')
    expect(transportOptions).toMatchObject({
      auth: {
        pass: 'test-only-smtp-password',
        user: 'sender@example.com',
      },
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      tls: { minVersion: 'TLSv1.2' },
    })
    expect(deliveredMessage).toMatchObject({
      from: '云栈 <sender@example.com>',
      subject: '云栈注册验证码',
      to: 'learner@example.com',
    })
    expect(deliveredMessage.text).toContain('123456')
  })
})
