import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targets = [
  path.join(root, 'api'),
  path.join(root, 'server'),
  path.join(root, 'electron'),
]
const extensions = new Set(['.mjs', '.cjs'])

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(target))
    else if (extensions.has(path.extname(entry.name))) files.push(target)
  }
  return files
}

const files = (await Promise.all(targets.map(collectFiles))).flat().sort()
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    process.exitCode = result.status ?? 1
    break
  }
}

if (!process.exitCode) console.info(`[syntax] OK: 已检查 ${files.length} 个服务端与 Electron 文件`)
