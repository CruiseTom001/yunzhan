import nodemailer from 'nodemailer'
import { validateEmail } from './validation.mjs'

const EMAIL_TIMEOUT_MS = 10_000
const MAX_SMTP_HOST_LENGTH = 253
const MAX_SMTP_PASSWORD_LENGTH = 512
const MAX_SMTP_FROM_LENGTH = 320
const SMTP_HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i
const VERIFICATION_CODE_PATTERN = /^\d{6}$/
const EMAIL_PURPOSE_CONTENT = Object.freeze({
  password_reset: {
    heading: '云栈密码重置',
    introduction: '你的密码重置验证码是：',
    subject: '云栈密码重置验证码',
  },
  registration: {
    heading: '云栈注册验证',
    introduction: '你的注册验证码是：',
    subject: '云栈注册验证码',
  },
})

function createServiceUnavailableError(message) {
  const error = new Error(message)
  error.statusCode = 503
  return error
}

function parseSmtpPort(value) {
  if (typeof value !== 'string' || !/^\d{1,5}$/.test(value)) return null
  const port = Number.parseInt(value ?? '', 10)
  return Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : null
}

function readFromAddress(value) {
  if (typeof value !== 'string') return null
  const from = value.trim()
  if (from.length < 3 || from.length > MAX_SMTP_FROM_LENGTH || /[\r\n]/.test(from)) return null
  const angleAddressMatch = from.match(/<([^<>]+)>$/)
  const email = validateEmail(angleAddressMatch?.[1] ?? from)
  return email === null ? null : from
}

function readConfiguration(environment = process.env) {
  const host = environment.SMTP_HOST?.trim() ?? ''
  const port = parseSmtpPort(environment.SMTP_PORT)
  const secureValue = environment.SMTP_SECURE
  const user = validateEmail(environment.SMTP_USER)
  const password = environment.SMTP_PASSWORD
  const from = readFromAddress(environment.SMTP_FROM)
  const secure = secureValue === 'true'
  const hasValidSecureValue = secureValue === 'true' || secureValue === 'false'

  if (
    host.length > MAX_SMTP_HOST_LENGTH
    || !SMTP_HOST_PATTERN.test(host)
    || port === null
    || !hasValidSecureValue
    || user === null
    || typeof password !== 'string'
    || password.length < 8
    || password.length > MAX_SMTP_PASSWORD_LENGTH
    || from === null
  ) {
    throw createServiceUnavailableError('SMTP 邮件服务尚未配置。')
  }

  return { from, host, password, port, secure, user }
}

function createTransportOptions(configuration) {
  return {
    auth: {
      pass: configuration.password,
      user: configuration.user,
    },
    connectionTimeout: EMAIL_TIMEOUT_MS,
    greetingTimeout: EMAIL_TIMEOUT_MS,
    host: configuration.host,
    port: configuration.port,
    requireTLS: !configuration.secure,
    secure: configuration.secure,
    socketTimeout: EMAIL_TIMEOUT_MS,
    tls: {
      minVersion: 'TLSv1.2',
      servername: configuration.host,
    },
  }
}

function createMessage({ code, from, purpose, to }) {
  const content = EMAIL_PURPOSE_CONTENT[purpose]
  if (!content) throw new Error('验证码邮件用途无效。')
  return {
    from,
    html: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.7"><h2>${content.heading}</h2><p>${content.introduction}</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>验证码 10 分钟内有效，请勿转发给他人。如非本人操作，请忽略此邮件。</p></div>`,
    subject: content.subject,
    text: `${content.introduction}${code}。验证码 10 分钟内有效，请勿转发给他人。如非本人操作，请忽略此邮件。`,
    to,
  }
}

function isSuccessfulDelivery(result, recipient) {
  return typeof result?.messageId === 'string'
    && result.messageId.length > 0
    && result.messageId.length <= 512
    && Array.isArray(result.accepted)
    && result.accepted.some(address => String(address).toLowerCase() === recipient)
}

export async function sendVerificationCode(
  { to, code, purpose },
  { createTransport = nodemailer.createTransport } = {},
) {
  const recipient = validateEmail(to)
  if (recipient === null) throw new Error('收件邮箱格式无效。')
  if (!VERIFICATION_CODE_PATTERN.test(code)) throw new Error('验证码格式无效。')
  if (!EMAIL_PURPOSE_CONTENT[purpose]) throw new Error('验证码邮件用途无效。')

  const configuration = readConfiguration()
  const transporter = createTransport(createTransportOptions(configuration))

  try {
    const result = await transporter.sendMail(createMessage({
      code,
      from: configuration.from,
      purpose,
      to: recipient,
    }))
    if (!isSuccessfulDelivery(result, recipient)) {
      throw createServiceUnavailableError('验证码邮件发送失败。')
    }
    return result.messageId
  } catch (error) {
    if (error instanceof Error && Number.isInteger(error.statusCode)) throw error
    throw createServiceUnavailableError('验证码邮件发送失败。')
  }
}
