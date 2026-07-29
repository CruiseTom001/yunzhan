import fs from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import pg from 'pg'

const { Client } = pg

function logStep(message) {
  console.info(`[verify:phase2:real:postgres] ${message}`)
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      ...options,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', chunk => { stdout += String(chunk) })
    child.stderr?.on('data', chunk => { stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(`${path.basename(command)} ${args.join(' ')} failed (${code}): ${stderr || stdout}`))
    })
  })
}

function startBackgroundProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
    detached: false,
    ...options,
  })
  child.stderr?.on('data', chunk => {
    const message = String(chunk).trim()
    if (message) logStep(message)
  })
  child.on('error', (error) => {
    logStep(`postgres 进程异常：${error.message}`)
  })
  return child
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForPostgres({ host, port, user, database, timeoutMs = 30_000 }) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const client = new Client({
      host,
      port,
      user,
      database,
      connectionTimeoutMillis: 2_000,
    })
    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      return
    } catch {
      await client.end().catch(() => undefined)
      await sleep(300)
    }
  }
  throw new Error(`PostgreSQL 在 ${timeoutMs}ms 内未就绪（${host}:${port}）`)
}

async function resolveSystemPostgresNative() {
  const installRoot = path.join('C:', 'Program Files', 'PostgreSQL')
  if (!(await pathExists(installRoot))) return null
  const versions = (await fs.readdir(installRoot))
    .filter(name => /^\d+$/.test(name))
    .sort((left, right) => Number(right) - Number(left))
  for (const version of versions) {
    const root = path.join(installRoot, version)
    const initdb = path.join(root, 'bin', 'initdb.exe')
    if (await pathExists(initdb)) {
      return {
        binDir: path.join(root, 'bin'),
        initdb,
        postgres: path.join(root, 'bin', 'postgres.exe'),
        pgCtl: path.join(root, 'bin', 'pg_ctl.exe'),
        root,
        label: `系统 PostgreSQL ${version}`,
      }
    }
  }
  return null
}

async function ensureAsciiPostgresNative(projectRoot) {
  const systemNative = await resolveSystemPostgresNative()
  if (systemNative) {
    logStep(`使用${systemNative.label}：${systemNative.root}`)
    return systemNative
  }

  const embeddedRoot = path.join(projectRoot, 'node_modules', '@embedded-postgres', 'windows-x64', 'native')
  const embeddedInitdb = path.join(embeddedRoot, 'bin', 'initdb.exe')
  if (process.platform === 'win32' && await pathExists(embeddedInitdb)) {
    logStep(`使用嵌入式 PostgreSQL 二进制：${embeddedRoot}`)
    return {
      binDir: path.join(embeddedRoot, 'bin'),
      initdb: embeddedInitdb,
      postgres: path.join(embeddedRoot, 'bin', 'postgres.exe'),
      pgCtl: path.join(embeddedRoot, 'bin', 'pg_ctl.exe'),
      root: embeddedRoot,
      label: '嵌入式 PostgreSQL 二进制',
    }
  }

  throw new Error('未找到可用 PostgreSQL。请安装 PostgreSQL 17，或在 Windows 开发机执行 npm i -D @embedded-postgres/windows-x64。')
}

function buildSpawnEnv(binDir) {
  return {
    ...process.env,
    LC_ALL: 'C',
    LANG: 'C',
    LC_CTYPE: 'C',
    PATH: `${binDir};${process.env.PATH ?? ''}`,
  }
}

export async function startLocalRealPostgres(projectRoot) {
  const native = await ensureAsciiPostgresNative(projectRoot)
  const dataDir = path.join(os.tmpdir(), 'yunzhan-pg-data', String(Date.now()))
  await fs.mkdir(dataDir, { recursive: true })
  const port = 55432 + Math.floor(Math.random() * 1000)
  const user = 'yunzhan'
  const database = 'yunzhan'
  const spawnEnv = buildSpawnEnv(native.binDir)

  logStep(`initdb -> ${dataDir}`)
  await runCommand(native.initdb, [
    `--pgdata=${dataDir}`,
    '--auth=trust',
    `--username=${user}`,
    '--locale=C',
    '--encoding=UTF8',
    '--lc-messages=C',
  ], { env: spawnEnv, cwd: native.binDir })

  logStep(`postgres start @127.0.0.1:${port}`)
  const postgresProcess = startBackgroundProcess(native.postgres, [
    '-D', dataDir,
    '-p', String(port),
  ], { env: spawnEnv, cwd: native.binDir })

  await waitForPostgres({
    host: '127.0.0.1',
    port,
    user,
    database: 'postgres',
  })

  logStep(`create database ${database}`)
  const adminClient = new Client({
    host: '127.0.0.1',
    port,
    user,
    database: 'postgres',
    connectionTimeoutMillis: 10_000,
  })
  await adminClient.connect()
  try {
    await adminClient.query(`CREATE DATABASE ${database}`)
  } finally {
    await adminClient.end()
  }

  const databaseUrl = `postgresql://${encodeURIComponent(user)}@127.0.0.1:${port}/${database}`
  logStep('本地 PostgreSQL 已就绪')
  return {
    databaseUrl,
    async stop() {
      logStep('停止本地 PostgreSQL')
      if (!postgresProcess.killed) {
        postgresProcess.kill()
      }
      await runCommand(native.pgCtl, [
        'stop',
        '-D', dataDir,
        '-m', 'fast',
      ], { env: spawnEnv, cwd: native.binDir }).catch(() => undefined)
      await fs.rm(dataDir, { recursive: true, force: true }).catch(() => undefined)
    },
  }
}
