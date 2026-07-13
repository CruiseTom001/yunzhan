import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './db.mjs'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = path.join(currentDirectory, 'migrations')

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  const files = (await fs.readdir(migrationsDirectory))
    .filter(file => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file])
    if (applied.rowCount > 0) {
      console.info(`[migration] skipped ${file}`)
      continue
    }
    const sql = await fs.readFile(path.join(migrationsDirectory, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.info(`[migration] applied ${file}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
} finally {
  await pool.end()
}
