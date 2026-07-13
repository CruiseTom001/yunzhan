import pg from 'pg'

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL 未配置，账号服务无法启动。')
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number.parseInt(process.env.DB_POOL_SIZE ?? '10', 10),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
})

export async function withTransaction(callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
