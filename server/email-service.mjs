const RESEND_API_URL = 'https://api.resend.com/emails'
const EMAIL_TIMEOUT_MS = 10_000
const VERIFICATION_CODE_PATTERN = /^\d{6}$/

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readConfiguration() {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (
    typeof apiKey !== 'string'
    || !apiKey.startsWith('re_')
    || apiKey.length > 512
    || typeof from !== 'string'
    || from.length < 3
    || from.length > 320
    || /[\r\n]/.test(from)
  ) {
    const error = new Error('Resend 邮件服务尚未配置。')
    error.statusCode = 503
    throw error
  }
  return { apiKey, from }
}

export async function sendRegistrationCode({ to, code, idempotencyKey }) {
  if (!VERIFICATION_CODE_PATTERN.test(code)) throw new Error('验证码格式无效。')
  const { apiKey, from } = readConfiguration()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS)
  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'User-Agent': 'Yunzhan-Account-Service/1.0',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: '云栈注册验证码',
        text: `你的云栈注册验证码是：${code}。验证码 10 分钟内有效，请勿转发给他人。`,
        html: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.7"><h2>云栈注册验证</h2><p>你的注册验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>验证码 10 分钟内有效，请勿转发给他人。</p></div>`,
        tags: [{ name: 'message_type', value: 'registration_code' }],
      }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !isRecord(payload) || typeof payload.id !== 'string' || payload.id.length > 128) {
      const error = new Error('验证码邮件发送失败。')
      error.statusCode = 503
      throw error
    }
    return payload.id
  } catch (error) {
    if (error instanceof Error && Number.isInteger(error.statusCode)) throw error
    const deliveryError = new Error('验证码邮件发送失败。')
    deliveryError.statusCode = 503
    throw deliveryError
  } finally {
    clearTimeout(timeoutId)
  }
}
