import crypto, { randomInt, randomUUID } from 'node:crypto'

const VERIFICATION_CODE_MAX = 1_000_000
const VERIFICATION_CODE_LENGTH = 6
const MINIMUM_SECRET_LENGTH = 32

function readVerificationSecret() {
  const secret = process.env.EMAIL_CODE_SECRET
  if (typeof secret !== 'string' || secret.length < MINIMUM_SECRET_LENGTH) {
    const error = new Error('EMAIL_CODE_SECRET 未配置或长度不足。')
    error.statusCode = 503
    throw error
  }
  return secret
}

function createDigest(parts) {
  return crypto
    .createHmac('sha256', readVerificationSecret())
    .update(parts.join('\u0000'))
    .digest('hex')
}

export function createEmailChallenge(email, requestIp) {
  const id = randomUUID()
  const code = randomInt(0, VERIFICATION_CODE_MAX).toString().padStart(VERIFICATION_CODE_LENGTH, '0')
  return {
    id,
    code,
    codeDigest: createDigest(['registration', email, id, code]),
    requestIpDigest: createDigest(['request-ip', requestIp]),
  }
}

export function verifyEmailChallengeCode(challenge, email, code) {
  if (!challenge || typeof challenge.id !== 'string' || typeof challenge.code_digest !== 'string') return false
  const expected = Buffer.from(challenge.code_digest, 'hex')
  const actual = Buffer.from(createDigest(['registration', email, challenge.id, code]), 'hex')
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}
