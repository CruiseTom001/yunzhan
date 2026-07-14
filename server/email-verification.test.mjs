import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createEmailChallenge, verifyEmailChallengeCode } from './email-verification.mjs'
import { sendVerificationCode } from './email-service.mjs'

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
    const challenge = createEmailChallenge('learner@example.com', '127.0.0.1', 'registration')

    expect(challenge.code).toMatch(/^\d{6}$/)
    expect(challenge.codeDigest).toHaveLength(64)
    expect(challenge.requestIpDigest).toHaveLength(64)
    expect(verifyEmailChallengeCode({
      id: challenge.id,
      code_digest: challenge.codeDigest,
      purpose: challenge.purpose,
    }, 'learner@example.com', challenge.code)).toBe(true)
    expect(verifyEmailChallengeCode({
      id: challenge.id,
      code_digest: challenge.codeDigest,
      purpose: challenge.purpose,
    }, 'learner@example.com', '999999')).toBe(false)
  })

  it('keeps registration and password reset codes isolated', () => {
    const challenge = createEmailChallenge('learner@example.com', '127.0.0.1', 'password_reset')
    expect(verifyEmailChallengeCode({
      id: challenge.id,
      code_digest: challenge.codeDigest,
      purpose: 'registration',
    }, 'learner@example.com', challenge.code)).toBe(false)
    expect(verifyEmailChallengeCode({
      id: challenge.id,
      code_digest: challenge.codeDigest,
      purpose: challenge.purpose,
    }, 'learner@example.com', challenge.code)).toBe(true)
  })

  it('rejects delivery when SMTP configuration is missing', async () => {
    await expect(sendVerificationCode({
      to: 'learner@example.com',
      code: '123456',
      purpose: 'registration',
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

    const messageId = await sendVerificationCode({
      to: 'LEARNER@example.com',
      code: '123456',
      purpose: 'registration',
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

  it('uses dedicated password reset email content', async () => {
    configureTestSmtp()
    let deliveredMessage
    const createTransport = () => ({
      async sendMail(message) {
        deliveredMessage = message
        return {
          accepted: ['learner@example.com'],
          messageId: '<password-reset@example.com>',
          rejected: [],
        }
      },
    })

    await sendVerificationCode({
      to: 'learner@example.com',
      code: '654321',
      purpose: 'password_reset',
    }, { createTransport })

    expect(deliveredMessage.subject).toBe('云栈密码重置验证码')
    expect(deliveredMessage.text).toContain('654321')
    expect(deliveredMessage.text).toContain('密码重置')
  })
})
