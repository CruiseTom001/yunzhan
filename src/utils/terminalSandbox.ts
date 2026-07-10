export interface SandboxResult {
  output: string
  clear?: boolean
  exitCode?: number
}

type NodeKind = 'dir' | 'file' | 'link'

interface FsNode {
  path: string
  kind: NodeKind
  mode: string
  owner: string
  group: string
  size: number
  mtime: string
  content?: string
  target?: string
}

const HOME = '/home/user/devops-lab'
const BLUE = '\x1b[1;34m'
const CYAN = '\x1b[1;36m'
const GREEN = '\x1b[1;32m'
const YELLOW = '\x1b[1;33m'
const RESET = '\x1b[0m'

let currentDir = HOME
let previousDir = HOME

const fsNodes = new Map<string, FsNode>()
const envVars = new Map<string, string>([
  ['PATH', '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'],
  ['HOME', HOME],
  ['USER', 'user'],
  ['SHELL', '/bin/bash'],
  ['PWD', HOME],
])
const commandHistory: string[] = []

export const sandboxWelcomeLines = [
  `${CYAN}云栈 DevOps 实验终端${RESET}`,
  '\x1b[2m输入 help 查看可用模拟命令；命令会用于实验判定与进度记录。\x1b[0m',
]

function addNode(node: FsNode) {
  fsNodes.set(node.path, node)
}

function addDir(path: string, mode = 'drwxr-xr-x', owner = 'root', group = 'root', mtime = 'Jul 06 10:00') {
  addNode({ path, kind: 'dir', mode, owner, group, size: 4096, mtime })
}

function addFile(path: string, content: string, size = content.length, mode = '-rw-r--r--', owner = 'user', group = 'user', mtime = 'Jul 06 10:30') {
  addNode({ path, kind: 'file', mode, owner, group, size, mtime, content })
}

function addLink(path: string, target: string, owner = 'user', group = 'user', mtime = 'Jul 06 10:35') {
  addNode({ path, kind: 'link', mode: 'lrwxrwxrwx', owner, group, size: target.length, mtime, target })
}

function seedFileSystem() {
  [
    '/',
    '/bin',
    '/dev',
    '/etc',
    '/etc/nginx',
    '/home',
    '/home/user',
    HOME,
    `${HOME}/logs`,
    `${HOME}/scripts`,
    '/proc',
    '/tmp',
    '/tmp/test',
    '/usr',
    '/var',
    '/var/log',
    '/var/log/nginx',
    '/app',
    '/app/config',
    '/app/data',
    '/app/data/logs',
    '/app/logs',
    '/backup',
    '/backup/config',
  ].forEach(path => addDir(path, path.startsWith('/home/user') ? 'drwxr-xr-x' : 'drwxr-xr-x', path.startsWith('/home/user') ? 'user' : 'root', path.startsWith('/home/user') ? 'user' : 'root'))

  addFile(`${HOME}/README.md`, '# DevOps Lab\nThis directory is used by the Yunzhan training sandbox.\n', 68)
  addFile(`${HOME}/app.log`, 'INFO service started\nWARN cache warmup slow\nERROR upstream timeout\n', 128)
  addFile(`${HOME}/deploy.sh`, '#!/usr/bin/env bash\necho deploy\n', 32, '-rwxr-xr-x')
  addFile(`${HOME}/logs/app.log`, 'INFO boot\nINFO health check ok\nERROR nginx upstream timeout\n', 1024)
  addFile(`${HOME}/logs/error.log`, 'ERROR api returned 502\nERROR database connection retry\n', 2048)
  addFile(`${HOME}/scripts/backup.sh`, '#!/usr/bin/env bash\ntar -czf backup.tgz /app/data\n', 54, '-rwxr-xr-x')
  addFile('/etc/os-release', 'NAME="Yunzhan Training Linux"\nVERSION="2026 Lab"\nID=yunzhan\n', 62, '-rw-r--r--', 'root', 'root')
  addFile('/etc/hosts', '127.0.0.1 localhost\n10.0.0.8 devops-server\n', 46, '-rw-r--r--', 'root', 'root')
  addFile('/etc/resolv.conf', 'nameserver 223.5.5.5\nnameserver 8.8.8.8\n', 42, '-rw-r--r--', 'root', 'root')
  addFile('/etc/nginx/nginx.conf', 'server {\n    listen 80;\n    server_name app.example.com;\n}\n', 61, '-rw-r--r--', 'root', 'root')
  addFile('/var/log/app.log', 'INFO request completed\nERROR nginx upstream timeout\nWARN retrying backend\n', 157286400, '-rw-r-----', 'root', 'adm', 'Jul 06 10:31')
  addFile('/var/log/nginx/access.log', '10.0.0.21 - - "GET / HTTP/1.1" 200 612\n10.0.0.34 - - "GET /api HTTP/1.1" 200 128\n', 188743680, '-rw-r-----', 'nginx', 'adm', 'Jul 06 10:32')
  addFile('/var/log/nginx/error.log', '2026/07/06 10:31:22 [error] upstream timed out\n', 73400320, '-rw-r-----', 'nginx', 'adm', 'Jul 06 10:31')
  addFile('/tmp/empty.tmp', '', 0, '-rw-r--r--', 'user', 'user', 'Jul 06 09:20')
  addFile('/app/config/app.yml', 'server:\n  port: 8080\nlogging:\n  level: info\n', 44, '-rw-r--r--', 'deploy', 'deploy')
  addFile('/app/logs/app.log', 'INFO app started\nERROR payment timeout\n', 2048, '-rw-r--r--', 'deploy', 'deploy')
  addFile('/app/logs/old.log', 'INFO rotated log\n', 1024, '-rw-r--r--', 'deploy', 'deploy', 'May 21 08:00')
}

seedFileSystem()

function stripInlineComment(input: string): string {
  let quote: '"' | "'" | null = null
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if ((char === '"' || char === "'") && input[i - 1] !== '\\') {
      quote = quote === char ? null : quote ?? char
    }
    if (char === '#' && quote === null && (i === 0 || /\s/.test(input[i - 1]))) {
      return input.slice(0, i).trim()
    }
  }
  return input.trim()
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if ((char === '"' || char === "'") && input[i - 1] !== '\\') {
      quote = quote === char ? null : quote ?? char
      continue
    }
    if (/\s/.test(char) && quote === null) {
      if (current) tokens.push(current)
      current = ''
      continue
    }
    current += char
  }

  if (current) tokens.push(current)
  return tokens
}

function normalizePath(input = '.', base = currentDir): string {
  const expanded = input === '~' ? HOME : input.replace(/^~(?=\/|$)/, HOME)
  const raw = expanded.startsWith('/') ? expanded : `${base}/${expanded}`
  const stack: string[] = []

  for (const part of raw.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }

  return `/${stack.join('/')}`.replace(/\/$/, '') || '/'
}

function parentPath(path: string): string {
  if (path === '/') return '/'
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  return parts.length ? `/${parts.join('/')}` : '/'
}

function baseName(path: string): string {
  if (path === '/') return '/'
  return path.split('/').filter(Boolean).pop() ?? '/'
}

function isDir(path: string): boolean {
  return fsNodes.get(path)?.kind === 'dir'
}

function displayName(node: FsNode): string {
  const name = baseName(node.path)
  if (node.kind === 'dir') return `${BLUE}${name}${RESET}`
  if (node.kind === 'link') return `${CYAN}${name}${RESET}`
  if (node.mode.includes('x')) return `${GREEN}${name}${RESET}`
  return name
}

function listChildren(dir: string, includeHidden = false): FsNode[] {
  const children = [...fsNodes.values()].filter(node => node.path !== dir && parentPath(node.path) === dir)
  if (!includeHidden) return children.filter(node => !baseName(node.path).startsWith('.'))
  return [
    { path: `${dir}/.`, kind: 'dir', mode: 'drwxr-xr-x', owner: 'user', group: 'user', size: 4096, mtime: 'Jul 06 10:00' },
    { path: `${dir}/..`, kind: 'dir', mode: 'drwxr-xr-x', owner: 'user', group: 'user', size: 4096, mtime: 'Jul 06 10:00' },
    ...children,
    { path: `${dir}/.bashrc`, kind: 'file', mode: '-rw-r--r--', owner: 'user', group: 'user', size: 231, mtime: 'Jul 06 09:00' },
    { path: `${dir}/.profile`, kind: 'file', mode: '-rw-r--r--', owner: 'user', group: 'user', size: 97, mtime: 'Jul 06 09:01' },
  ]
}

function formatLong(node: FsNode, showInode = false): string {
  const inode = showInode ? `${Math.abs(hashCode(node.path)) % 900000 + 100000} ` : ''
  const target = node.kind === 'link' && node.target ? ` -> ${node.target}` : ''
  return `${inode}${node.mode}  1 ${node.owner.padEnd(6)} ${node.group.padEnd(6)} ${String(node.size).padStart(8)} ${node.mtime} ${baseName(node.path)}${target}`
}

function hashCode(value: string): number {
  return value.split('').reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
}

function formatSize(size: number): string {
  if (size >= 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(1)}G`
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(0)}M`
  if (size >= 1024) return `${(size / 1024).toFixed(0)}K`
  return String(size)
}

function formatLongHuman(node: FsNode, showInode = false): string {
  const inode = showInode ? `${Math.abs(hashCode(node.path)) % 900000 + 100000} ` : ''
  const target = node.kind === 'link' && node.target ? ` -> ${node.target}` : ''
  return `${inode}${node.mode}  1 ${node.owner.padEnd(6)} ${node.group.padEnd(6)} ${formatSize(node.size).padStart(5)} ${node.mtime} ${baseName(node.path)}${target}`
}

function permissionFromOctal(value: string): string {
  const map: Record<string, string> = {
    '0': '---',
    '1': '--x',
    '2': '-w-',
    '3': '-wx',
    '4': 'r--',
    '5': 'r-x',
    '6': 'rw-',
    '7': 'rwx',
  }
  return value.split('').map(part => map[part] ?? '---').join('').padEnd(9, '-').slice(0, 9)
}

function splitFlags(tokens: string[]): { flags: string; args: string[] } {
  const flags: string[] = []
  const args: string[] = []
  for (const token of tokens.slice(1)) {
    if (token.startsWith('-') && token !== '-') flags.push(token)
    else args.push(token)
  }
  return { flags: flags.join(''), args }
}

function hasFlag(flags: string, flag: string): boolean {
  return flags.includes(flag)
}

function matchesGlob(name: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`).test(name)
}

function resolveTarget(token: string): FsNode | null {
  return fsNodes.get(normalizePath(token)) ?? null
}

function getMatchingNodes(pattern: string, base = currentDir): FsNode[] {
  if (!pattern.includes('*') && !pattern.includes('?')) {
    const exact = resolveTarget(pattern)
    return exact ? [exact] : []
  }
  return listChildren(base, true).filter(node => matchesGlob(baseName(node.path), pattern))
}

function sortNodes(nodes: FsNode[], flags: string): FsNode[] {
  const sorted = [...nodes]
  if (hasFlag(flags, 'S')) {
    sorted.sort((a, b) => b.size - a.size || baseName(a.path).localeCompare(baseName(b.path)))
  } else if (hasFlag(flags, 't')) {
    sorted.sort((a, b) => b.mtime.localeCompare(a.mtime) || baseName(a.path).localeCompare(baseName(b.path)))
  } else {
    sorted.sort((a, b) => baseName(a.path).localeCompare(baseName(b.path)))
  }
  if (hasFlag(flags, 'r')) sorted.reverse()
  return sorted
}

function executeLs(tokens: string[]): SandboxResult {
  const { flags, args } = splitFlags(tokens)
  const longFormat = hasFlag(flags, 'l')
  const includeHidden = hasFlag(flags, 'a')
  const recursive = hasFlag(flags, 'R')
  const onlyDirectory = hasFlag(flags, 'd')
  const human = hasFlag(flags, 'h')
  const inode = hasFlag(flags, 'i')
  const targets = args.length ? args : ['.']

  function formatNodes(nodes: FsNode[]) {
    const sorted = sortNodes(nodes, flags)
    if (longFormat) return sorted.map(node => human ? formatLongHuman(node, inode) : formatLong(node, inode)).join('\n')
    if (inode) return sorted.map(node => `${Math.abs(hashCode(node.path)) % 900000 + 100000} ${displayName(node)}`).join('  ')
    return sorted.map(displayName).join('  ')
  }

  const sections: string[] = []

  for (const target of targets) {
    const matches = getMatchingNodes(target)
    if (!matches.length) {
      sections.push(`ls: cannot access '${target}': No such file or directory`)
      continue
    }

    for (const node of matches) {
      if (node.kind !== 'dir' || onlyDirectory) {
        sections.push(longFormat ? (human ? formatLongHuman(node, inode) : formatLong(node, inode)) : displayName(node))
        continue
      }

      if (!recursive) {
        sections.push(formatNodes(listChildren(node.path, includeHidden)))
        continue
      }

      const walk = (dir: string, label: string) => {
        sections.push(`${label}:`)
        const children = listChildren(dir, includeHidden)
        sections.push(formatNodes(children))
        for (const child of sortNodes(children.filter(item => item.kind === 'dir' && !baseName(item.path).startsWith('.')), flags)) {
          sections.push('')
          walk(child.path, `${label}/${baseName(child.path)}`.replace(/^\.\//, './'))
        }
      }
      walk(node.path, target === '.' ? '.' : node.path)
    }
  }

  return { output: sections.join('\n') }
}

function executeCd(tokens: string[]): SandboxResult {
  const rawTarget = tokens[1] ?? '~'
  if (rawTarget === '-') {
    const next = previousDir
    previousDir = currentDir
    currentDir = next
    envVars.set('PWD', currentDir)
    return { output: currentDir }
  }

  const target = normalizePath(rawTarget)
  const node = fsNodes.get(target)
  if (!node) return { output: `cd: ${rawTarget}: No such file or directory` }
  if (node.kind === 'link' && node.target && isDir(node.target)) {
    previousDir = currentDir
    currentDir = target
    envVars.set('PWD', currentDir)
    return { output: '' }
  }
  if (node.kind !== 'dir') return { output: `cd: ${rawTarget}: Not a directory` }

  previousDir = currentDir
  currentDir = target
  envVars.set('PWD', currentDir)
  return { output: '' }
}

function executeMkdir(tokens: string[]): SandboxResult {
  const { flags, args } = splitFlags(tokens)
  const recursive = hasFlag(flags, 'p')
  const verbose = hasFlag(flags, 'v')
  const modeIndex = tokens.findIndex(token => token === '-m')
  const mode = modeIndex >= 0 && tokens[modeIndex + 1] ? `d${permissionFromOctal(tokens[modeIndex + 1])}` : 'drwxr-xr-x'
  const dirs = args.filter(arg => arg !== tokens[modeIndex + 1])
  if (!dirs.length) return { output: 'mkdir: missing operand' }

  const output: string[] = []
  for (const dir of dirs) {
    const target = normalizePath(dir)
    if (fsNodes.has(target) && !recursive) {
      output.push(`mkdir: cannot create directory '${dir}': File exists`)
      continue
    }
    const parts = target.split('/').filter(Boolean)
    let cursor = ''
    for (const part of parts) {
      cursor = `${cursor}/${part}`
      if (!fsNodes.has(cursor)) {
        const parent = parentPath(cursor)
        if (!recursive && !isDir(parent)) {
          output.push(`mkdir: cannot create directory '${dir}': No such file or directory`)
          break
        }
        addDir(cursor, mode, 'user', 'user')
        if (verbose) output.push(`mkdir: created directory '${cursor}'`)
      }
    }
  }
  return { output: output.join('\n') }
}

function removeNode(path: string, recursive: boolean) {
  const node = fsNodes.get(path)
  if (!node) return
  if (node.kind === 'dir') {
    if (recursive) {
      for (const child of [...fsNodes.values()].filter(item => item.path.startsWith(`${path}/`))) {
        fsNodes.delete(child.path)
      }
    }
  }
  fsNodes.delete(path)
}

function executeRm(tokens: string[]): SandboxResult {
  const { flags, args } = splitFlags(tokens)
  const recursive = hasFlag(flags, 'r') || hasFlag(flags, 'R')
  const force = hasFlag(flags, 'f')
  const interactive = hasFlag(flags, 'i')
  const verbose = hasFlag(flags, 'v')
  if (!args.length) return { output: 'rm: missing operand' }

  const output: string[] = []
  for (const arg of args) {
    const matches = getMatchingNodes(arg)
    if (!matches.length) {
      if (!force) output.push(`rm: cannot remove '${arg}': No such file or directory`)
      continue
    }
    for (const node of matches) {
      if (node.kind === 'dir' && !recursive) {
        output.push(`rm: cannot remove '${arg}': Is a directory`)
        continue
      }
      if (interactive) output.push(`rm: remove ${node.kind === 'dir' ? 'directory' : 'regular file'} '${baseName(node.path)}'? y`)
      removeNode(node.path, recursive)
      if (verbose) output.push(`removed '${node.path}'`)
    }
  }
  return { output: output.join('\n') }
}

function executeRmdir(tokens: string[]): SandboxResult {
  const args = tokens.slice(1)
  if (!args.length) return { output: 'rmdir: missing operand' }
  const output: string[] = []
  for (const arg of args) {
    const target = normalizePath(arg)
    if (!isDir(target)) {
      output.push(`rmdir: failed to remove '${arg}': No such file or directory`)
      continue
    }
    if (listChildren(target, true).filter(item => !['.', '..'].includes(baseName(item.path))).length > 0) {
      output.push(`rmdir: failed to remove '${arg}': Directory not empty`)
      continue
    }
    fsNodes.delete(target)
  }
  return { output: output.join('\n') }
}

function cloneNode(source: FsNode, destination: string): FsNode {
  return { ...source, path: destination, mtime: 'Jul 06 10:45' }
}

function executeCp(tokens: string[]): SandboxResult {
  const { flags, args } = splitFlags(tokens)
  const recursive = hasFlag(flags, 'r') || hasFlag(flags, 'R') || hasFlag(flags, 'a')
  const verbose = hasFlag(flags, 'v')
  if (args.length < 2) return { output: 'cp: missing file operand' }
  const destinationArg = args[args.length - 1]
  const sources = args.slice(0, -1)
  const destinationBase = normalizePath(destinationArg)
  const output: string[] = []

  for (const sourceArg of sources) {
    const matches = getMatchingNodes(sourceArg)
    if (!matches.length) {
      output.push(`cp: cannot stat '${sourceArg}': No such file or directory`)
      continue
    }
    for (const source of matches) {
      if (source.kind === 'dir' && !recursive) {
        output.push(`cp: -r not specified; omitting directory '${sourceArg}'`)
        continue
      }
      const target = isDir(destinationBase) ? `${destinationBase}/${baseName(source.path)}` : destinationBase
      addNode(cloneNode(source, target))
      if (source.kind === 'dir' && recursive) {
        for (const child of [...fsNodes.values()].filter(item => item.path.startsWith(`${source.path}/`))) {
          addNode(cloneNode(child, `${target}${child.path.slice(source.path.length)}`))
        }
      }
      if (verbose) output.push(`'${source.path}' -> '${target}'`)
    }
  }
  return { output: output.join('\n') }
}

function executeMv(tokens: string[]): SandboxResult {
  const { flags, args } = splitFlags(tokens)
  const verbose = hasFlag(flags, 'v')
  if (args.length < 2) return { output: 'mv: missing file operand' }
  const destinationBase = normalizePath(args[args.length - 1])
  const output: string[] = []

  for (const sourceArg of args.slice(0, -1)) {
    const matches = getMatchingNodes(sourceArg)
    if (!matches.length) {
      output.push(`mv: cannot stat '${sourceArg}': No such file or directory`)
      continue
    }
    for (const source of matches) {
      const target = isDir(destinationBase) ? `${destinationBase}/${baseName(source.path)}` : destinationBase
      const descendants = [...fsNodes.values()].filter(item => item.path.startsWith(`${source.path}/`))
      addNode(cloneNode(source, target))
      for (const child of descendants) addNode(cloneNode(child, `${target}${child.path.slice(source.path.length)}`))
      removeNode(source.path, true)
      if (verbose) output.push(`renamed '${source.path}' -> '${target}'`)
    }
  }
  return { output: output.join('\n') }
}

function executeTouch(tokens: string[]): SandboxResult {
  const args = tokens.slice(1).filter(token => !token.startsWith('-'))
  if (!args.length) return { output: 'touch: missing file operand' }
  for (const arg of args) {
    const target = normalizePath(arg)
    const node = fsNodes.get(target)
    if (node) node.mtime = 'Jul 06 10:50'
    else addFile(target, '', 0)
  }
  return { output: '' }
}

function executeCat(tokens: string[]): SandboxResult {
  const args = tokens.slice(1).filter(token => !token.startsWith('-'))
  if (!args.length) return { output: 'cat: waiting for standard input is not simulated; try cat /etc/os-release' }
  const output: string[] = []
  for (const arg of args) {
    const node = resolveTarget(arg)
    if (!node) {
      output.push(`cat: ${arg}: No such file or directory`)
      continue
    }
    if (node.kind === 'dir') {
      output.push(`cat: ${arg}: Is a directory`)
      continue
    }
    output.push(node.content ?? '')
  }
  return { output: output.join('\n') }
}

function executeHeadTail(tokens: string[], mode: 'head' | 'tail'): SandboxResult {
  const countIndex = tokens.findIndex(token => token === '-n')
  const count = countIndex >= 0 && tokens[countIndex + 1] ? Number(tokens[countIndex + 1]) || 10 : 10
  const files = tokens.slice(1).filter((token, index, all) => token !== '-n' && all[index - 1] !== '-n' && !token.startsWith('-'))
  const target = files[0] ?? '/var/log/app.log'
  const node = resolveTarget(target)
  if (!node || node.kind === 'dir') return { output: `${mode}: cannot open '${target}' for reading: No such file or directory` }
  const lines = (node.content || '').split('\n').filter(Boolean)
  return { output: (mode === 'head' ? lines.slice(0, count) : lines.slice(-count)).join('\n') }
}

function executeFind(tokens: string[]): SandboxResult {
  const rootArg = tokens[1]?.startsWith('-') ? '.' : tokens[1] ?? '.'
  const root = normalizePath(rootArg)
  const expression = tokens.join(' ')
  let matches = [...fsNodes.values()].filter(node => node.path === root || node.path.startsWith(`${root}/`))

  const nameIndex = tokens.findIndex(token => token === '-name' || token === '-iname')
  if (nameIndex >= 0 && tokens[nameIndex + 1]) {
    const pattern = tokens[nameIndex + 1]
    matches = matches.filter(node => matchesGlob(baseName(node.path), pattern))
  }
  if (expression.includes('-type f')) matches = matches.filter(node => node.kind === 'file')
  if (expression.includes('-type d')) matches = matches.filter(node => node.kind === 'dir')
  if (expression.includes('-empty')) matches = matches.filter(node => node.kind === 'file' && (node.content ?? '').length === 0)
  if (expression.includes('-size +100M')) matches = matches.filter(node => node.size > 100 * 1024 * 1024)
  if (expression.includes('-mtime +30')) matches = matches.filter(node => node.path.includes('old.log'))

  if (expression.includes('-delete')) {
    for (const match of matches) removeNode(match.path, false)
    return { output: '' }
  }
  if (expression.includes('-exec wc -l')) {
    return { output: matches.map(node => `${(node.content ?? '').split('\n').filter(Boolean).length.toString().padStart(4)} ${node.path}`).join('\n') }
  }
  if (expression.includes('-exec rm')) {
    for (const match of matches) removeNode(match.path, false)
    return { output: '' }
  }
  return { output: matches.map(node => node.path).join('\n') }
}

function executeLocate(tokens: string[]): SandboxResult {
  const { flags, args } = splitFlags(tokens)
  const pattern = args[0] ?? ''
  const matches = [...fsNodes.values()].filter(node => {
    const path = hasFlag(flags, 'i') ? node.path.toLowerCase() : node.path
    const needle = hasFlag(flags, 'i') ? pattern.toLowerCase() : pattern
    return matchesGlob(baseName(path), needle) || path.includes(needle.split('*').join(''))
  })
  if (hasFlag(flags, 'c')) return { output: String(matches.length) }
  return { output: matches.map(node => node.path).join('\n') || `locate: no matches found for ${pattern}` }
}

function executeTree(tokens: string[]): SandboxResult {
  const { flags, args } = splitFlags(tokens)
  const root = normalizePath(args[0] ?? '.')
  const depthIndex = tokens.findIndex(token => token === '-L')
  const maxDepth = depthIndex >= 0 && tokens[depthIndex + 1] ? Number(tokens[depthIndex + 1]) : Number.POSITIVE_INFINITY
  const dirsOnly = hasFlag(flags, 'd')
  const lines = [root === currentDir ? '.' : root]

  function walk(dir: string, depth: number, prefix = '') {
    if (depth >= maxDepth) return
    const children = sortNodes(listChildren(dir).filter(node => !dirsOnly || node.kind === 'dir'), '')
    children.forEach((child, index) => {
      const last = index === children.length - 1
      lines.push(`${prefix}${last ? '`-- ' : '|-- '}${baseName(child.path)}${child.kind === 'dir' ? '/' : ''}`)
      if (child.kind === 'dir') walk(child.path, depth + 1, `${prefix}${last ? '    ' : '|   '}`)
    })
  }

  if (!isDir(root)) return { output: `tree: ${args[0] ?? '.'}: No such directory` }
  walk(root, 0)
  const count = lines.length - 1
  lines.push(`\n${count} ${count === 1 ? 'entry' : 'entries'}`)
  return { output: lines.join('\n') }
}

function executeStat(tokens: string[]): SandboxResult {
  const target = tokens[1] ?? 'app.log'
  const node = resolveTarget(target)
  if (!node) return { output: `stat: cannot statx '${target}': No such file or directory` }
  const type = node.kind === 'dir' ? 'directory' : node.kind === 'link' ? 'symbolic link' : 'regular file'
  return {
    output: [
      `  File: ${target}`,
      `  Size: ${node.size.toString().padEnd(10)} Blocks: ${Math.max(0, Math.ceil(node.size / 512)).toString().padEnd(10)} IO Block: 4096 ${type}`,
      `Device: 8,1   Inode: ${Math.abs(hashCode(node.path)) % 900000 + 100000}      Links: 1`,
      `Access: (${node.mode})  Uid: (${node.owner})   Gid: (${node.group})`,
      `Modify: 2026-07-06 10:30:00.000000000 +0800`,
    ].join('\n'),
  }
}

function executeWhich(tokens: string[]): SandboxResult {
  const command = tokens[1]
  if (!command) return { output: 'which: no command specified' }
  const known = command === 'kubectl' ? '/usr/local/bin/kubectl' : `/usr/bin/${command}`
  return { output: known }
}

function executeWhereis(tokens: string[]): SandboxResult {
  const command = tokens[1]
  if (!command) return { output: 'whereis: missing operand' }
  return { output: `${command}: /usr/bin/${command} /usr/share/man/man1/${command}.1.gz` }
}

function executeGrep(fullCmd: string): SandboxResult {
  if (fullCmd.includes('ERROR') || fullCmd.toLowerCase().includes('error')) {
    return { output: '2026-07-06 10:31:22 ERROR nginx upstream timeout\n2026-07-06 10:31:45 ERROR api 502 bad gateway' }
  }
  return { output: 'grep: simulated match line from /var/log/app.log' }
}

function executePipeline(fullCmd: string): SandboxResult {
  if (fullCmd.includes('sort') && fullCmd.includes('uniq') && fullCmd.includes('-c')) {
    return { output: '  12 10.0.0.8\n   7 10.0.0.21\n   3 10.0.0.34' }
  }
  if (fullCmd.includes('grep') && fullCmd.includes('wc -l')) return { output: '2' }
  if (fullCmd.includes('tee')) {
    const parts = fullCmd.split(/\s+/)
    const teeTarget = parts[parts.length - 1] ?? 'run.log'
    addFile(normalizePath(teeTarget), 'pipeline output\n')
    return { output: 'pipeline output' }
  }
  return { output: 'pipeline output simulated: command completed successfully' }
}

function executeSimpleSystemCommand(main: string, fullCmd: string, tokens: string[]): SandboxResult | null {
  switch (main) {
    case 'pwd':
      return { output: fullCmd.includes('-P') && fsNodes.get(currentDir)?.kind === 'link' ? fsNodes.get(currentDir)?.target ?? currentDir : currentDir }
    case 'whoami':
      return { output: 'user' }
    case 'date':
      return { output: new Date().toString() }
    case 'uname':
      return { output: 'Linux devops-server 5.15.0 x86_64 GNU/Linux' }
    case 'uptime':
      return { output: ' 10:30:00 up 7 days, 2 users, load average: 0.15, 0.10, 0.08' }
    case 'df':
      return { output: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   15G   33G  32% /\n/dev/sdb1       100G   45G   55G  45% /data' }
    case 'du':
      return { output: hasFlag(splitFlags(tokens).flags, 'h') ? '8.0K\t./logs\n4.0K\t./scripts\n16K\t.' : '8\t./logs\n4\t./scripts\n16\t.' }
    case 'free':
      return { output: '              total        used        free      shared  buff/cache   available\nMem:          7.8G        2.3G        3.1G        256M        2.4G        5.0G\nSwap:         2.0G          0B        2.0G' }
    case 'ps':
      return { output: 'PID  %CPU %MEM  COMMAND\n  1   0.0  0.1  init\n342   0.0  0.3  nginx\n567   0.1  1.2  docker\n891   0.2  0.8  node' }
    case 'top':
      return { output: 'top - 10:30:00 up 7 days, 2 users, load average: 0.15, 0.10, 0.08\nTasks: 128 total,   1 running, 127 sleeping\n%Cpu(s):  2.1 us,  0.7 sy, 97.2 id\nMiB Mem :   7980 total,   3174 free,   2355 used,   2451 buff/cache' }
    case 'kill':
      return { output: tokens[1] ? '' : 'kill: usage: kill [-s sigspec] pid | jobspec ...' }
    case 'id':
      return { output: fullCmd.includes('nginx') ? 'uid=995(nginx) gid=995(nginx) groups=995(nginx)' : 'uid=1000(user) gid=1000(user) groups=1000(user),10(wheel),998(docker)' }
    case 'useradd':
      return { output: tokens.length > 1 ? '' : 'useradd: missing user name' }
    case 'usermod':
      return { output: tokens.length > 1 ? '' : 'usermod: missing user name' }
    case 'userdel':
      return { output: tokens.length > 1 ? '' : 'userdel: missing user name' }
    case 'groupadd':
      return { output: tokens.length > 1 ? '' : 'groupadd: missing group name' }
    case 'su':
      return { output: 'Password:\nsu: Authentication simulated; switched user for this command only.' }
    case 'env':
      return { output: [...envVars.entries()].map(([key, value]) => `${key}=${value}`).join('\n') }
    case 'hostname':
      return { output: 'devops-server' }
    case 'history':
      return { output: commandHistory.slice(-20).map((cmd, index) => `${String(index + 1).padStart(4)}  ${cmd}`).join('\n') }
    case 'echo':
      return { output: tokens.slice(1).join(' ').replace(/\$([A-Z_]+)/g, (_, key: string) => envVars.get(key) ?? '') }
    case 'less':
      return executeCat(['cat', ...(tokens.slice(1).length ? tokens.slice(1) : ['/var/log/app.log'])])
    case 'head':
      return executeHeadTail(tokens, 'head')
    case 'tail':
      return executeHeadTail(tokens, 'tail')
    case 'sed':
      return { output: 'INFO service started\nERROR upstream timeout fixed\nWARN cache warmup slow' }
    case 'awk':
      return { output: '10.0.0.8\n10.0.0.21\n10.0.0.34' }
    case 'sort':
      return { output: '10.0.0.8\n10.0.0.21\n10.0.0.34\nERROR\nINFO\nWARN' }
    case 'uniq':
      return { output: fullCmd.includes('-c') ? '  12 10.0.0.8\n   7 10.0.0.21\n   3 10.0.0.34' : '10.0.0.8\n10.0.0.21\n10.0.0.34' }
    case 'cut':
      return { output: 'root\nuser\ndeploy\nnginx' }
    case 'wc':
      return { output: fullCmd.includes('-l') ? '128 app.log' : '128 640 4096 app.log' }
    case 'diff':
      return { output: '--- nginx.conf.bak\n+++ nginx.conf\n@@ -1,3 +1,3 @@\n-server_name old.example.com;\n+server_name app.example.com;' }
    case 'file': {
      const target = tokens[1] ?? 'deploy.sh'
      return { output: `${target}: Bourne-Again shell script, UTF-8 Unicode text executable` }
    }
    case 'xargs':
      return { output: 'xargs: simulated execution completed; input items were passed as command arguments' }
    case 'heredoc':
      return { output: 'Here document example:\ncat > config.yml <<EOF\nserver:\n  port: 8080\nEOF' }
    case 'jobs':
      return { output: '[1]-  Running                 nohup ./backup.sh > backup.log 2>&1 &\n[2]+  Stopped                 vim nginx.conf' }
    case 'nohup':
      return { output: 'nohup: ignoring input and redirecting stderr to stdout\n[1] 2048' }
    case 'ulimit':
      return { output: fullCmd.includes('-n') ? '1024' : 'core file size          (blocks, -c) 0\nopen files                      (-n) 1024\nmax user processes              (-u) 4096\nstack size              (kbytes, -s) 8192' }
    case 'chmod':
    case 'chown':
      return { output: tokens.length > 2 ? '' : `${main}: missing operand` }
    case 'ping':
      return { output: 'PING gateway (10.0.0.1): 56 data bytes\n64 bytes from 10.0.0.1: icmp_seq=0 ttl=64 time=0.42 ms\n64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.39 ms' }
    case 'curl':
      return { output: fullCmd.includes('-I') ? 'HTTP/1.1 200 OK\nServer: nginx\nContent-Type: text/html\nCache-Control: max-age=300' : '{"status":"ok","service":"yunzhan-demo","latency_ms":18}' }
    case 'wget':
      return { output: '--2026-07-06--  http://example.com/app.tar.gz\nSaving to: app.tar.gz\napp.tar.gz 100%[===================>]  1.2M  --.-KB/s    in 0.1s' }
    case 'make':
      return { output: fullCmd.includes('install') ? 'install -m 755 redis-server /usr/local/bin/redis-server\ninstall -m 755 redis-cli /usr/local/bin/redis-cli' : 'cc -O2 -Wall -c src/main.c\nlinking target... done' }
    case 'dpkg':
      return { output: 'Selecting previously unselected package mysql-apt-config.\nSetting up mysql-apt-config (0.8.28-1) ...' }
    case 'snap':
      return { output: 'certbot 2.11.0 from Certbot Project installed' }
    case 'unzip':
      return { output: 'Archive: app.zip\n  inflating: app/config/app.yml\n  inflating: app/logs/app.log' }
    case 'mysql_secure_installation':
      return { output: 'Securing the MySQL server deployment.\nVALIDATE PASSWORD component: configured\nRemove anonymous users? y\nReload privilege tables? y\nAll done!' }
    case 'mysql':
      return { output: fullCmd.includes('-e') ? 'Variable_name\tValue\nThreads_connected\t12' : 'mysql  Ver 8.0.36 for Linux on x86_64\nConnection id: 42\nServer version: 8.0.36 MySQL Community Server' }
    case 'python':
    case 'python3':
      if (fullCmd.includes('--version')) return { output: 'Python 3.12.4' }
      return { output: 'status=healthy\ncpu_percent=2.8\nmemory_percent=29.6\ndisk_percent=32.0' }
    case 'redis-cli':
      if (fullCmd.toUpperCase().includes('PING')) return { output: 'PONG' }
      if (fullCmd.toUpperCase().includes('DBSIZE')) return { output: '1024' }
      if (fullCmd.toUpperCase().includes('INFO')) return { output: '# Persistence\nrdb_bgsave_in_progress:0\nrdb_last_bgsave_status:ok\n# Memory\nused_memory_human:128.50M' }
      if (fullCmd.toUpperCase().includes('BGSAVE')) return { output: 'Background saving started' }
      return { output: '127.0.0.1:6379> connected to Redis 7.2.0' }
    case 'ssh':
      return { output: 'Welcome to Yunzhan Training Linux\nLast login: Mon Jul  6 10:00:00 2026 from 10.0.0.21' }
    case 'scp':
      return { output: 'app.tar.gz                                    100% 1228KB   4.2MB/s   00:00' }
    case 'tar':
      return { output: fullCmd.includes('-t') ? 'app/\napp/config/app.yml\napp/logs/app.log' : '' }
    case 'zip':
      return { output: '  adding: app/config/app.yml (deflated 42%)\n  adding: app/logs/app.log (deflated 31%)' }
    case 'alias':
      return { output: "alias ll='ls -alF'\nalias grep='grep --color=auto'\nalias k='kubectl'" }
    case 'export': {
      const assignment = tokens.find(token => token.includes('='))
      if (assignment) {
        const [key, value] = assignment.split('=')
        envVars.set(key, value)
      }
      return { output: '' }
    }
    case 'source':
    case '.':
      return { output: '' }
    case 'ln': {
      const { flags, args } = splitFlags(tokens)
      if (args.length < 2) return { output: 'ln: missing file operand' }
      const target = normalizePath(args[0])
      const link = normalizePath(args[1])
      if (hasFlag(flags, 's')) addLink(link, target)
      else {
        const source = fsNodes.get(target)
        if (!source) return { output: `ln: failed to access '${args[0]}': No such file or directory` }
        addNode(cloneNode(source, link))
      }
      return { output: '' }
    }
    case 'tee': {
      const target = tokens[tokens.length - 1]
      if (target) addFile(normalizePath(target), 'tee output\n')
      return { output: 'tee output' }
    }
    case 'vi':
    case 'vim':
    case 'nano':
      return { output: `${main}: interactive editor is simulated. File opened, no changes saved.` }
    case 'apt':
    case 'yum':
      return { output: fullCmd.includes('install') ? 'Reading package lists... Done\nPackage operation simulated successfully.' : 'Package manager command simulated successfully.' }
    case 'htpasswd':
      return { output: 'Adding password for user alice' }
    case 'openssl':
      return { output: 'CONNECTED(00000003)\ndepth=2 C = US, O = Example CA\nVerify return code: 0 (ok)' }
    case 'nginx':
      return { output: fullCmd.includes('-t') ? 'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful' : 'nginx command simulated successfully' }
    case 'sysctl':
      return { output: fullCmd.includes('-p') ? 'net.core.somaxconn = 65535\nfs.file-max = 1000000' : 'net.ipv4.ip_forward = 1' }
    case 'lsmod':
      return { output: 'Module                  Size  Used by\nkvm_intel             315392  0\nkvm                   913408  1 kvm_intel\nbr_netfilter           32768  0' }
    case 'modprobe':
      return { output: '' }
    case 'dmesg':
      return { output: '[  12.482001] Linux version 5.15.0\n[  42.118204] Out of memory: recovered by oom-killer simulation' }
    case 'mount':
      return { output: '/dev/sda1 on / type ext4 (rw,relatime)\n/dev/sdb1 on /data type ext4 (rw,relatime)' }
    case 'umount':
      return { output: '' }
    case 'lsblk':
      return { output: 'NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT\nsda      8:0    0   50G  0 disk\n`-sda1   8:1    0   50G  0 part /\nsdb      8:16   0  100G  0 disk\n`-sdb1   8:17   0  100G  0 part /data' }
    case 'blkid':
      return { output: '/dev/sda1: UUID="1111-2222" TYPE="ext4"\n/dev/sdb1: UUID="3333-4444" TYPE="ext4"' }
    case 'fdisk':
      return { output: 'Disk /dev/sda: 50 GiB\nDevice     Boot Start       End   Sectors Size Id Type\n/dev/sda1  *     2048 104857599 104855552  50G 83 Linux' }
    case 'mkfs':
    case 'mkfs.ext4':
      return { output: 'mke2fs 1.46.5\nCreating filesystem with 26214400 4k blocks and 6553600 inodes\nWriting superblocks and filesystem accounting information: done' }
    case 'dumpe2fs':
      return { output: 'Primary superblock at 0, Group descriptors at 1-6\nBackup superblock at 32768, 98304, 163840' }
    case 'ab':
      return { output: 'Requests per second:    1250.42 [#/sec] (mean)\nTime per request:       8.000 [ms] (mean)' }
    case 'wrk':
    case 'hey':
      return { output: 'Requests/sec: 1384.22\nLatency Avg: 12.4ms\nTransfer/sec: 1.84MB' }
    case 'goaccess':
      return { output: 'GoAccess report generated: report.html' }
    default:
      return null
  }
}

function executePlatformCommand(main: string, fullCmd: string): SandboxResult | null {
  switch (main) {
    case 'ss':
    case 'netstat':
      return { output: 'State   Local Address:Port   Peer Address:Port   Process\nLISTEN  0.0.0.0:80           0.0.0.0:*           nginx\nLISTEN  0.0.0.0:22           0.0.0.0:*           sshd\nESTAB   10.0.0.8:443         10.0.0.21:51844     nginx' }
    case 'docker':
      if (fullCmd.includes('ps')) return { output: 'CONTAINER ID   IMAGE          STATUS          PORTS                  NAMES\nabc123def456   nginx:alpine   Up 2 hours      0.0.0.0:80->80/tcp     nginx-demo\nf0e1d2c3b4a5   redis:7        Up 15 minutes   6379/tcp               redis-cache' }
      if (fullCmd.includes('images')) return { output: 'REPOSITORY      TAG       IMAGE ID       SIZE\nnginx           alpine    8f34d1a2c9b7   48MB\nredis           7         eca1379fe8b5   117MB\nnode            20        3f19c2a15a9b   352MB' }
      if (fullCmd.includes('logs')) return { output: 'nginx-demo | 10.0.0.21 - - "GET / HTTP/1.1" 200 612\nnginx-demo | upstream response time 0.018' }
      return { output: 'Docker sandbox ready. Try: docker ps, docker images, docker logs nginx-demo' }
    case 'git':
      if (fullCmd.includes('status')) return { output: 'On branch main\nYour branch is up to date with origin/main.\n\nChanges not staged for commit:\n  modified: src/App.vue\n\nno changes added to commit' }
      if (fullCmd.includes('log')) return { output: 'a1b2c3d feat: add lab workflow\nf6e5d4c fix: improve course navigation\nc9b8a7d docs: update deployment notes' }
      return { output: 'main\nfeature/lab-sandbox\nrelease/2026-q2' }
    case 'kubectl':
      if (fullCmd.includes('nodes')) return { output: 'NAME       STATUS   ROLES           VERSION\nmaster-1   Ready    control-plane   v1.30.0\nworker-1   Ready    worker          v1.30.0' }
      if (fullCmd.includes('svc') || fullCmd.includes('services')) return { output: 'NAME         TYPE        CLUSTER-IP      PORT(S)\nkubernetes   ClusterIP   10.96.0.1       443/TCP\nweb          ClusterIP   10.96.12.34     80/TCP' }
      return { output: 'NAME                         READY   STATUS    RESTARTS   AGE\nweb-6f8c7c9d8c-n4z7q       1/1     Running   0          2h\nredis-7b9d6b9f7f-vm2qd     1/1     Running   0          45m' }
    case 'systemctl':
      if (fullCmd.includes('status')) return { output: 'nginx.service - Nginx Web Server\n   Loaded: loaded (/usr/lib/systemd/system/nginx.service)\n   Active: active (running) since Mon 2026-07-06 09:00:00 CST' }
      return { output: 'UNIT              LOAD   ACTIVE SUB     DESCRIPTION\nnginx.service     loaded active running Nginx Web Server\ndocker.service    loaded active running Docker Engine\nssh.service       loaded active running OpenSSH Server' }
    case 'journalctl':
      return { output: 'Jul 06 10:30:01 devops-server nginx[342]: request completed status=200\nJul 06 10:31:22 devops-server nginx[342]: upstream timeout recovered' }
    case 'lsof':
      return { output: 'COMMAND PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nnginx   342 root    6u  IPv4  22441      0t0  TCP *:80 (LISTEN)\nsshd    128 root    3u  IPv4  11993      0t0  TCP *:22 (LISTEN)' }
    case 'iostat':
      return { output: 'Device            r/s     w/s     rkB/s     wkB/s   %util\nsda              1.2     3.4      48.0     128.0    2.10\nsdb              0.1     1.1       4.0      64.0    0.80' }
    case 'vmstat':
      return { output: 'procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----\n r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st\n 1  0      0 3174M  220M 2231M    0    0     4    16  120  310  2  1 97  0  0' }
    case 'crontab':
      return { output: fullCmd.includes('-l') ? '*/5 * * * * /usr/local/bin/health-check.sh\n0 2 * * * /usr/local/bin/backup.sh' : 'crontab: installing new crontab (simulated)' }
    case 'rsync':
      return { output: 'sending incremental file list\napp/config/app.yml\napp/logs/app.log\n\nsent 2,048 bytes  received 92 bytes  4,280.00 bytes/sec' }
    case 'dig':
      return { output: 'app.example.com.  300 IN A 10.0.0.8\n;; Query time: 18 msec\n;; SERVER: 223.5.5.5#53(223.5.5.5)' }
    case 'nslookup':
      return { output: 'Server:  223.5.5.5\nAddress: 223.5.5.5#53\n\nName: app.example.com\nAddress: 10.0.0.8' }
    case 'traceroute':
    case 'mtr':
      return { output: '1  gateway (10.0.0.1)  0.421 ms\n2  edge-router (10.0.1.1)  1.832 ms\n3  app.example.com (10.0.0.8)  2.104 ms' }
    case 'ip':
      return { output: '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n    inet 10.0.0.8/24 brd 10.0.0.255 scope global eth0\n    default via 10.0.0.1 dev eth0' }
    case 'strace':
      return { output: 'execve("/usr/bin/curl", ["curl", "-I", "http://localhost"], 0x7ffd...) = 0\nsocket(AF_INET, SOCK_STREAM, IPPROTO_TCP) = 3\nconnect(3, {sin_port=htons(80)}, 16) = 0\n+++ exited with 0 +++' }
    case 'tcpdump':
      return { output: 'listening on eth0, link-type EN10MB\n10:31:22.123456 IP 10.0.0.21.51844 > 10.0.0.8.80: Flags [S], seq 1001\n10:31:22.123789 IP 10.0.0.8.80 > 10.0.0.21.51844: Flags [S.], ack 1002' }
    case 'iptables':
      return { output: 'Chain INPUT (policy ACCEPT)\ntarget     prot opt source               destination\nACCEPT     tcp  --  0.0.0.0/0            0.0.0.0/0 tcp dpt:80\nACCEPT     tcp  --  0.0.0.0/0            0.0.0.0/0 tcp dpt:443' }
    case 'ufw':
      return { output: 'Status: active\n80/tcp                     ALLOW       Anywhere\n443/tcp                    ALLOW       Anywhere' }
    case 'firewall-cmd':
      return { output: fullCmd.includes('--list-all') ? 'public\n  services: ssh http https\n  ports: 8080/tcp' : 'success' }
    case 'certbot':
      return { output: 'Successfully received certificate.\nCertificate is saved at: /etc/letsencrypt/live/example.com/fullchain.pem\nDeploying certificate to nginx: done' }
    case 'terraform':
      if (fullCmd.includes('plan')) return { output: 'Terraform will perform the following actions:\n  + create aws_instance.web\nPlan: 1 to add, 0 to change, 0 to destroy.' }
      if (fullCmd.includes('apply')) return { output: 'Apply complete! Resources: 1 added, 0 changed, 0 destroyed.' }
      if (fullCmd.includes('init')) return { output: 'Terraform has been successfully initialized!' }
      return { output: 'Terraform v1.8.0\nUsage: terraform [global options] <subcommand> [args]' }
    case 'ansible':
      return { output: 'web1 | SUCCESS => {"changed": false, "ping": "pong"}\nweb2 | SUCCESS => {"changed": false, "ping": "pong"}' }
    case 'ansible-playbook':
      return { output: 'PLAY [web] ****************************************************************\nTASK [Gathering Facts] ****************************************************\nok: [web1]\nPLAY RECAP ****************************************************************\nweb1 : ok=3 changed=1 unreachable=0 failed=0' }
    case 'ansible-galaxy':
      return { output: 'Found installed collection community.general:7.5.0\nRole install/search simulated successfully.' }
    case 'virsh':
      return { output: ' Id   Name        State\n 1    ubuntu-vm   running\n 2    centos-vm   shut off' }
    case 'virt-install':
      return { output: 'Starting install...\nDomain installation still in progress. You can reconnect to the console to complete the installation process.' }
    default:
      return null
  }
}

export function executeSandboxCommand(command: string): SandboxResult {
  const fullCmd = stripInlineComment(command)
  if (!fullCmd) return { output: '' }

  commandHistory.push(fullCmd)
  if (commandHistory.length > 100) commandHistory.shift()

  if (fullCmd.includes('|')) return executePipeline(fullCmd)
  if (fullCmd.includes('<<EOF')) return { output: '' }

  const tokens = tokenize(fullCmd)
  const [rawMain = ''] = tokens
  const main = rawMain.toLowerCase()

  if (main === 'help') {
    return {
      output: [
        `${CYAN}可用命令：${RESET}`,
        '  ls cd pwd mkdir rmdir rm cp mv touch cat less head tail find locate tree stat',
        '  grep sed awk sort uniq cut wc diff chmod chown whoami id sudo su useradd usermod',
        '  userdel groupadd env export alias',
        '  which whereis history echo tee ln source heredoc jobs nohup ulimit ps top kill',
        '  ping curl wget ssh scp df du free uname hostname ss netstat lsof iostat vmstat',
        '  tar zip unzip apt yum dpkg snap systemctl journalctl docker git kubectl crontab rsync',
        '  dig nslookup traceroute mtr ip strace tcpdump iptables ufw firewall-cmd certbot',
        '  terraform ansible ansible-playbook ansible-galaxy redis-cli mysql nginx python clear',
        '',
        '\x1b[2m这是浏览器内的训练沙盒，不会改动你的真实电脑文件。\x1b[0m',
      ].join('\n'),
    }
  }

  if (main === 'clear') return { output: '', clear: true }
  if (main === 'sudo') return executeSandboxCommand(tokens.slice(1).join(' '))
  if (main === 'ls') return executeLs(tokens)
  if (main === 'cd') return executeCd(tokens)
  if (main === 'mkdir') return executeMkdir(tokens)
  if (main === 'rm') return executeRm(tokens)
  if (main === 'rmdir') return executeRmdir(tokens)
  if (main === 'cp') return executeCp(tokens)
  if (main === 'mv') return executeMv(tokens)
  if (main === 'touch') return executeTouch(tokens)
  if (main === 'cat') return executeCat(tokens)
  if (main === 'find') return executeFind(tokens)
  if (main === 'locate') return executeLocate(tokens)
  if (main === 'tree') return executeTree(tokens)
  if (main === 'stat') return executeStat(tokens)
  if (main === 'which') return executeWhich(tokens)
  if (main === 'whereis') return executeWhereis(tokens)
  if (main === 'grep') return executeGrep(fullCmd)

  const simpleResult = executeSimpleSystemCommand(main, fullCmd, tokens)
  if (simpleResult) return simpleResult

  const platformResult = executePlatformCommand(main, fullCmd)
  if (platformResult) return platformResult

  return { output: `${YELLOW}未找到命令：${main || '(空命令)'}${RESET}\n输入 ${CYAN}help${RESET} 查看可用模拟命令。`, exitCode: 127 }
}
