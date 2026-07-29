#!/usr/bin/env node
/**
 * Phase 2 公告验证入口：
 * - 默认 PGLite（无 DATABASE_URL 且未指定 --real）
 * - --real：使用 DATABASE_URL / --database-url 连接真实 PostgreSQL
 * - --spawn-local：无 DATABASE_URL 时自动启动本地真实 PostgreSQL 并连接
 */
import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { PGlite } from '@electric-sql/pglite'
import { runPhase2Verification } from './verify-announcement-phase2-lib.mjs'
import { startLocalRealPostgres } from './start-local-postgres-verify.mjs'

function readDatabaseUrl(argv) {
  const flagIndex = argv.indexOf('--database-url')
  if (flagIndex >= 0 && argv[flagIndex + 1]) {
    return argv[flagIndex + 1].trim()
  }
  return typeof process.env.DATABASE_URL === 'string' ? process.env.DATABASE_URL.trim() : ''
}

function maskDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl)
    if (parsed.password) parsed.password = '***'
    return parsed.toString()
  } catch {
    return '[invalid DATABASE_URL]'
  }
}

function assertSafeTestDatabaseUrl(databaseUrl, argv) {
  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL 格式无效。')
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL 必须是 postgresql:// 连接串。')
  }
  const host = parsed.hostname.toLowerCase()
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  if (!isLocal && !argv.includes('--confirm-test-database')) {
    throw new Error('远程测试库需显式确认：追加 --confirm-test-database（仅用于非生产测试库）。')
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const wantsReal = argv.includes('--real') || argv.includes('--spawn-local') || Boolean(readDatabaseUrl(argv))
  const spawnLocal = argv.includes('--spawn-local') || (wantsReal && !readDatabaseUrl(argv))

  if (!wantsReal) {
    const db = new PGlite()
    try {
      await runPhase2Verification(db, { label: 'verify:phase2:pglite' })
    } finally {
      await db.close()
    }
    return
  }

  let databaseUrl = readDatabaseUrl(argv)
  let stopLocalPostgres = null
  if (!databaseUrl) {
    if (!spawnLocal) {
      console.error('缺少 DATABASE_URL。请在 .env 配置、使用 --database-url，或追加 --spawn-local 启动本地真实 PostgreSQL。')
      process.exit(1)
    }
    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const started = await startLocalRealPostgres(projectRoot)
    databaseUrl = started.databaseUrl
    stopLocalPostgres = started.stop
    console.info(`[verify:phase2:real] 已启动本地真实 PostgreSQL：${maskDatabaseUrl(databaseUrl)}`)
  } else {
    console.info(`[verify:phase2:real] 使用 DATABASE_URL：${maskDatabaseUrl(databaseUrl)}`)
  }

  assertSafeTestDatabaseUrl(databaseUrl, argv)

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 2,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  })
  try {
    await runPhase2Verification(pool, { label: 'verify:phase2:real' })
  } finally {
    await pool.end()
    if (stopLocalPostgres) {
      await stopLocalPostgres()
    }
  }
}

await main()
