import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from './db.mjs'
import { validateDisplayName, validatePassword, validateUsername } from './validation.mjs'

const username = validateUsername(process.env.BOOTSTRAP_ADMIN_USERNAME)
const displayName = validateDisplayName(process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME ?? '云栈管理员')
const password = validatePassword(process.env.BOOTSTRAP_ADMIN_PASSWORD)

if (!username || !displayName || !password) {
  throw new Error('请配置合法的 BOOTSTRAP_ADMIN_USERNAME、BOOTSTRAP_ADMIN_DISPLAY_NAME 和 BOOTSTRAP_ADMIN_PASSWORD。密码至少 10 位且同时包含字母和数字。')
}

try {
  const passwordHash = await bcrypt.hash(password, 12)
  const result = await pool.query(
    `INSERT INTO users (id, username, display_name, password_hash, role, status)
     VALUES ($1, $2, $3, $4, 'super_admin', 'active')
     ON CONFLICT (username) DO NOTHING
     RETURNING id`,
    [randomUUID(), username, displayName, passwordHash],
  )
  if (result.rowCount === 0) {
    throw new Error('该超管用户名已存在，未覆盖原账号。')
  }
  console.info(`已创建超管账号：${username}`)
} finally {
  await pool.end()
}
