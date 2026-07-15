# 桌面端版本更新提示机制 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地阶段一:服务端记录桌面端版本信息 + 前端启动时检查并分级提示 + 版本对账脚本 + Changelog 流程,不引入 electron-updater、不动 IPC 白名单。

**Architecture:** 后端新增 `desktop_releases` 表与 5 个端点(1 公开 + 4 超管 CRUD,带审计);前端新增 `desktopVersionApi.ts` + `UpdateBanner.vue`(L2 横幅 + L3 阻塞弹窗),仅 `window.electronAPI` 存在时启动检查;新增 `scripts/check-version-sync.cjs` 接入 `prebuild`;新增 `CHANGELOG.md`;扩展 `RELEASE.md`。

**Tech Stack:** Vue 3 + TypeScript + Vite + Pinia;Express(ESM,`server/index.mjs`);PostgreSQL(TIMESTAMPTZ/BIGSERIAL);vitest;Tailwind;Electron(沙箱,不动 IPC)。

**Spec:** `docs/superpowers/specs/2026-07-15-desktop-update-notice-design.md`

---

## 任务总表

- Task 1: migration `007_desktop_releases.sql`
- Task 2: `compareVersions` 工具 + 测试
- Task 3: 后端 `GET /api/desktop/latest-version`
- Task 4: 后端超管 CRUD 端点
- Task 5: 前端 `desktopVersionApi.ts` + 测试
- Task 6: 前端 `UpdateBanner.vue` + 测试
- Task 7: `App.vue` 挂载 + 路由 + 后台页面
- Task 8: `scripts/check-version-sync.cjs` + 接入 `prebuild`
- Task 9: `CHANGELOG.md` + `RELEASE.md` 扩展
- Task 10: 质量门禁全跑

---

## Task 1: migration `007_desktop_releases.sql`

**Files:**
- Create: `server/migrations/007_desktop_releases.sql`

- [ ] **Step 1: 写 migration 文件**

```sql
-- 007_desktop_releases.sql
-- 桌面端版本发布记录,供前端启动时检查并分级提示升级。
-- 配套文档:docs/superpowers/specs/2026-07-15-desktop-update-notice-design.md

CREATE TABLE IF NOT EXISTS desktop_releases (
  id            BIGSERIAL PRIMARY KEY,
  version       TEXT NOT NULL UNIQUE,
  min_supported TEXT NOT NULL,
  download_url  TEXT NOT NULL,
  release_notes TEXT NOT NULL DEFAULT '',
  enabled       INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desktop_releases_enabled ON desktop_releases (enabled);
```

- [ ] **Step 2: 确认文件已创建**

Run: `ls server/migrations/007_desktop_releases.sql`
Expected: 文件路径回显,无报错。

- [ ] **Step 3: 提交**

```bash
git add server/migrations/007_desktop_releases.sql
git commit -m "feat(db): add desktop_releases migration"
```

---

## Task 2: `compareVersions` 工具 + 测试

**Files:**
- Create: `src/utils/semver.ts`
- Create: `src/utils/semver.test.ts`

- [ ] **Step 1: 先写失败测试**

```ts
// src/utils/semver.test.ts
import { describe, expect, it } from 'vitest'
import { compareVersions, isSemver } from './semver'

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0)
  })
  it('returns -1 when left lower (patch)', () => {
    expect(compareVersions('1.2.0', '1.2.1')).toBe(-1)
  })
  it('returns 1 when left higher (minor)', () => {
    expect(compareVersions('1.10.0', '1.2.5')).toBe(1)
  })
  it('compares major first', () => {
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1)
    expect(compareVersions('1.99.99', '2.0.0')).toBe(-1)
  })
  it('throws on malformed version', () => {
    expect(() => compareVersions('1.2', '1.2.0')).toThrow()
    expect(() => compareVersions('1.2.0', 'v1.2.0')).toThrow()
  })
})

describe('isSemver', () => {
  it('accepts x.y.z digits only', () => {
    expect(isSemver('1.2.0')).toBe(true)
    expect(isSemver('0.0.0')).toBe(true)
    expect(isSemver('12.345.6')).toBe(true)
  })
  it('rejects malformed', () => {
    expect(isSemver('1.2')).toBe(false)
    expect(isSemver('v1.2.0')).toBe(false)
    expect(isSemver('1.2.0-beta')).toBe(false)
    expect(isSemver('')).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npx vitest run src/utils/semver.test.ts`
Expected: FAIL,提示 `semver.ts` 不存在或导出缺失。

- [ ] **Step 3: 写最小实现**

```ts
// src/utils/semver.ts
const SEMVER_RE = /^\d+\.\d+\.\d+$/

/** 判断是否为 x.y.z 形式纯数字语义版本号 */
export function isSemver(value: string): boolean {
  return SEMVER_RE.test(value)
}

function parseParts(version: string): [number, number, number] {
  if (!isSemver(version)) throw new Error(`无效语义版本号:${version}`)
  const [major, minor, patch] = version.split('.')
  return [Number(major), Number(minor), Number(patch)]
}

/**
 * 比较两个语义版本号。
 * @returns -1 / 0 / 1,左小于/等于/大于右
 */
export function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseParts(a)
  const [bMajor, bMinor, bPatch] = parseParts(b)
  if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1
  if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1
  return 0
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npx vitest run src/utils/semver.test.ts`
Expected: PASS 9 个用例。

- [ ] **Step 5: 提交**

```bash
git add src/utils/semver.ts src/utils/semver.test.ts
git commit -m "feat(utils): add semver compareVersions with tests"
```

---

## Task 3: 后端 `GET /api/desktop/latest-version`(公开)

**Files:**
- Modify: `server/index.mjs`(在 `app.use(errorHandler)` 之前追加新端点;最新版本判定在 JS 侧用 `compareVersions`)

**重要事实**:`server/index.mjs` 由 `node server/index.mjs` 直接运行(无 tsx/ts-node),且只 import `server/*.mjs` 同目录模块。**不能跨目录 import `../src/semver.js`**——Node 不会编译 `.ts`。因此服务端与前端各维护一份语义版本比较实现。后端用内联的 `compareVersionsServer`,前端用 `src/utils/semver.ts`(Task 2)。

- [ ] **Step 1: 在 `server/index.mjs` 顶部追加内联 semver 工具**

在 `import { pool, withTransaction } from './db.mjs'` 之下、其它 import 之间追加(或集中放在文件靠上工具区):

```js
// ---------- 语义版本比较(后端内联,与 src/utils/semver.ts 同义) ----------
const SEMVER_RE_SERVER = /^\d+\.\d+\.\d+$/

/**
 * 比较两个 x.y.z 版本号。返回 -1 / 0 / 1。
 * 非法返回 0(视为相等,避免 reduce 误判),调用方应在入参已校验场景使用。
 */
function compareVersionsServer(a, b) {
  if (!SEMVER_RE_SERVER.test(a) || !SEMVER_RE_SERVER.test(b)) return 0
  const [aM, am, ap] = a.split('.').map(Number)
  const [bM, bm, bp] = b.split('.').map(Number)
  if (aM !== bM) return aM < bM ? -1 : 1
  if (am !== bm) return am < bm ? -1 : 1
  if (ap !== bp) return ap < bp ? -1 : 1
  return 0
}
```

> `SEMVER_RE_SERVER` 也在 Task 4 用于 POST/PATCH 参数校验,因此放在通用区供后续端点复用。前端 `src/utils/semver.ts` 与此后端实现是同名同义的**两份独立实现**(因运行环境隔离),非 DRY 违反——Node 不编译 `.ts`,共享不可行。

- [ ] **Step 2: 在 `app.use(errorHandler)` 之前追加公开端点**

`server/index.mjs` 文件中以 `app.use((error, _request, response, _next) =>` 那一段为标志(errorHandler),在其前插入:

```js
// ---------- 桌面端版本发布 ----------

app.get('/api/desktop/latest-version', asyncRoute(async (_request, response) => {
  // 公开端点:桌面端启动时拉取,可能用户未登录,因此不加 requireAuth
  const result = await pool.query(
    `SELECT version, min_supported AS "minSupported", download_url AS "downloadUrl",
            release_notes AS "releaseNotes"
       FROM desktop_releases
      WHERE enabled = 1`,
  )
  if (result.rowCount === 0) {
    response.json({ version: null, minSupported: null, downloadUrl: null, releaseNotes: null })
    return
  }
  // 在 JS 侧做语义版本比较,避免 SQLite 字符串排序把 1.10.0 排在 1.2.0 之前
  const latest = result.rows.reduce((acc, row) => {
    if (!acc) return row
    return compareVersionsServer(row.version, acc.version) > 0 ? row : acc
  }, null)
  response.json(latest)
}))
```

- [ ] **Step 3: 启动后端手测**

Run: 启动后端(参照项目惯例,如 `npm run server:dev`)+ `curl http://127.0.0.1:3001/api/desktop/latest-version`
Expected: 返回 `{ "version": null, ... }`(表空)或 200 JSON。

- [ ] **Step 4: 提交**

```bash
git add server/index.mjs src/utils/semver.ts
git commit -m "feat(server): add public /api/desktop/latest-version endpoint"
```

---

## Task 4: 后端超管 CRUD 端点

**Files:**
- Modify: `server/index.mjs`(紧邻 Task 3 端点之后追加)

> 参照现有模式:公告 `/api/admin/announcements`(1530-1710 行)的 `requireAuth` + `requireSuperAdmin` + `hasOnlyKeys` + `withTransaction` + `writeAudit`;`validateUuid` 不适用,本端点 ID 是数字(参考公告 `:id` 处理 `Number.parseInt`)。

- [ ] **Step 1: 追加超管列表端点**

在 Task 3 端点之后插入:

```js
app.get('/api/admin/desktop-releases', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const { limit, offset } = parsePagination(request.query)
  const [releasesResult, countResult] = await Promise.all([
    pool.query(
      `SELECT id, version, min_supported AS "minSupported", download_url AS "downloadUrl",
              release_notes AS "releaseNotes", enabled, created_at, updated_at
         FROM desktop_releases
        ORDER BY created_at DESC, id DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query('SELECT COUNT(*)::INTEGER AS count FROM desktop_releases'),
  ])
  response.json({
    releases: releasesResult.rows.map(row => ({
      id: Number(row.id),
      version: row.version,
      minSupported: row.minSupported,
      downloadUrl: row.downloadUrl,
      releaseNotes: row.releaseNotes,
      enabled: row.enabled === 1,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    })),
    total: countResult.rows[0].count,
    limit,
    offset,
  })
}))
```

- [ ] **Step 2: 追加超管新建端点**

```js

app.post('/api/admin/desktop-releases', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const allowedKeys = new Set(['version', 'minSupported', 'downloadUrl', 'releaseNotes', 'enabled'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '桌面端版本参数无效。' })
    return
  }
  if (typeof request.body.version !== 'string' || !SEMVER_RE_SERVER.test(request.body.version)) {
    response.status(400).json({ error: '版本号需为 x.y.z 形式纯数字。' })
    return
  }
  const version = request.body.version
  if (typeof request.body.minSupported !== 'string' || !SEMVER_RE_SERVER.test(request.body.minSupported)) {
    response.status(400).json({ error: '最低兼容版本需为 x.y.z 形式纯数字。' })
    return
  }
  const minSupported = request.body.minSupported
  if (typeof request.body.downloadUrl !== 'string' || !/^https?:\/\//.test(request.body.downloadUrl) || request.body.downloadUrl.length > 500) {
    response.status(400).json({ error: '下载地址需为 http(s):// 开头且不超过 500 字符。' })
    return
  }
  const downloadUrl = request.body.downloadUrl
  const releaseNotesRaw = typeof request.body.releaseNotes === 'string' ? request.body.releaseNotes : ''
  if (releaseNotesRaw.length > 2000) {
    response.status(400).json({ error: '发布说明不超过 2000 字符。' })
    return
  }
  const releaseNotes = releaseNotesRaw
  const enabled = request.body.enabled === undefined ? true : Boolean(request.body.enabled)

  try {
    const result = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO desktop_releases (version, min_supported, download_url, release_notes, enabled)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, version, min_supported, download_url, release_notes, enabled, created_at, updated_at`,
        [version, minSupported, downloadUrl, releaseNotes, enabled ? 1 : 0],
      )
      await writeAudit(client, request.auth.id, 'desktop_release.create', request.auth.id, { version })
      return inserted.rows[0]
    })
    response.json({
      release: {
        id: Number(result.id),
        version: result.version,
        minSupported: result.min_supported,
        downloadUrl: result.download_url,
        releaseNotes: result.release_notes,
        enabled: result.enabled === 1,
        createdAt: new Date(result.created_at).getTime(),
        updatedAt: new Date(result.updated_at).getTime(),
      },
    })
  } catch (error) {
    // version 唯一约束冲突
    if (error?.code === '23505') {
      response.status(400).json({ error: '该版本号已存在。' })
      return
    }
    throw error
  }
}))
```


- [ ] **Step 3: 追加超管更新端点**

```js
app.patch('/api/admin/desktop-releases/:id', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const releaseId = Number.parseInt(request.params.id ?? '', 10)
  if (!Number.isInteger(releaseId) || releaseId < 1) {
    response.status(400).json({ error: '版本记录 ID 无效。' })
    return
  }
  // version 不可改:版本号是身份(UNIQUE),需要换版本应新建一条再停用旧的
  const allowedKeys = new Set(['minSupported', 'downloadUrl', 'releaseNotes', 'enabled'])
  if (!hasOnlyKeys(request.body, allowedKeys)) {
    response.status(400).json({ error: '桌面端版本更新参数无效。' })
    return
  }

  const fields = []
  const values = []
  if (request.body.minSupported !== undefined) {
    if (typeof request.body.minSupported !== 'string' || !SEMVER_RE_SERVER.test(request.body.minSupported)) {
      response.status(400).json({ error: '最低兼容版本需为 x.y.z 形式纯数字。' })
      return
    }
    values.push(request.body.minSupported)
    fields.push(`min_supported = $${values.length}`)
  }
  if (request.body.downloadUrl !== undefined) {
    if (typeof request.body.downloadUrl !== 'string' || !/^https?:\/\//.test(request.body.downloadUrl) || request.body.downloadUrl.length > 500) {
      response.status(400).json({ error: '下载地址需为 http(s):// 开头且不超过 500 字符。' })
      return
    }
    values.push(request.body.downloadUrl)
    fields.push(`download_url = $${values.length}`)
  }
  if (request.body.releaseNotes !== undefined) {
    if (typeof request.body.releaseNotes !== 'string' || request.body.releaseNotes.length > 2000) {
      response.status(400).json({ error: '发布说明不超过 2000 字符。' })
      return
    }
    values.push(request.body.releaseNotes)
    fields.push(`release_notes = $${values.length}`)
  }
  if (request.body.enabled !== undefined) {
    values.push(Boolean(request.body.enabled) ? 1 : 0)
    fields.push(`enabled = $${values.length}`)
  }
  if (fields.length === 0) {
    response.status(400).json({ error: '没有需要更新的字段。' })
    return
  }
  values.push('NOW()')
  fields.push(`updated_at = $${values.length}`)
  values.push(releaseId)

  const result = await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE desktop_releases
          SET ${fields.join(', ')}
        WHERE id = $${values.length}
        RETURNING id, version, min_supported, download_url, release_notes, enabled, created_at, updated_at`,
      values,
    )
    if (updated.rowCount === 0) return null
    await writeAudit(client, request.auth.id, 'desktop_release.update', request.auth.id, { releaseId })
    return updated.rows[0]
  })
  if (!result) {
    response.status(404).json({ error: '版本记录不存在。' })
    return
  }
  response.json({
    release: {
      id: Number(result.id),
      version: result.version,
      minSupported: result.min_supported,
      downloadUrl: result.download_url,
      releaseNotes: result.release_notes,
      enabled: result.enabled === 1,
      createdAt: new Date(result.created_at).getTime(),
      updatedAt: new Date(result.updated_at).getTime(),
    },
  })
}))
```

- [ ] **Step 4: 追加超管删除端点**

```js
app.delete('/api/admin/desktop-releases/:id', requireAuth, requireSuperAdmin, asyncRoute(async (request, response) => {
  const releaseId = Number.parseInt(request.params.id ?? '', 10)
  if (!Number.isInteger(releaseId) || releaseId < 1) {
    response.status(400).json({ error: '版本记录 ID 无效。' })
    return
  }
  const result = await withTransaction(async (client) => {
    const found = await client.query('SELECT version FROM desktop_releases WHERE id = $1', [releaseId])
    if (found.rowCount === 0) return null
    await writeAudit(client, request.auth.id, 'desktop_release.delete', request.auth.id, { version: found.rows[0].version })
    await client.query('DELETE FROM desktop_releases WHERE id = $1', [releaseId])
    return true
  })
  if (!result) {
    response.status(404).json({ error: '版本记录不存在。' })
    return
  }
  response.json({ ok: true })
}))
```

- [ ] **Step 5: 类型检查 + server 语法检查**

Run:
```bash
npm run server:check
npm run check
```
Expected: 均通过无错误。

- [ ] **Step 6: 提交**

```bash
git add server/index.mjs
git commit -m "feat(server): add admin CRUD for desktop_releases"
```

---

## Task 5: 前端 `desktopVersionApi.ts` + 测试

**Files:**
- Create: `src/utils/desktopVersionApi.ts`
- Create: `src/utils/desktopVersionApi.test.ts`

> 完全参照 `src/utils/announcementApi.ts` / `src/utils/announcementApi.test.ts` 的类型守卫与 vi.mock 模式。

- [ ] **Step 1: 先写测试**

```ts
// src/utils/desktopVersionApi.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/apiClient', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, public readonly status: number, public readonly payload: unknown) {
      super(message)
    }
  },
  apiRequest: vi.fn(),
}))

import { apiRequest } from '@/utils/apiClient'
import {
  getDesktopLatestVersion,
  listAdminDesktopReleases,
  createAdminDesktopRelease,
  updateAdminDesktopRelease,
  deleteAdminDesktopRelease,
} from './desktopVersionApi'

const mockedApiRequest = vi.mocked(apiRequest)

const VALID_LATEST = { version: '1.2.0', minSupported: '1.1.0', downloadUrl: 'https://x/setup.exe', releaseNotes: 'n' }
const VALID_RECORD = {
  id: 1,
  version: '1.2.0',
  minSupported: '1.1.0',
  downloadUrl: 'https://x/setup.exe',
  releaseNotes: 'n',
  enabled: true,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
}

function mockResponse(payload: unknown): ReturnType<typeof apiRequest> {
  return Promise.resolve(payload)
}

beforeEach(() => {
  mockedApiRequest.mockReset()
})

describe('desktopVersionApi', () => {
  it('returns null fields when latest version payload reports null', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ version: null, minSupported: null, downloadUrl: null, releaseNotes: null }))
    const result = await getDesktopLatestVersion()
    expect(result.version).toBeNull()
  })
  it('parses latest version fields', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse(VALID_LATEST))
    const result = await getDesktopLatestVersion()
    expect(result.version).toBe('1.2.0')
    expect(result.minSupported).toBe('1.1.0')
  })
  it('rejects latest with bad version shape', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ version: 1, minSupported: 'x', downloadUrl: null, releaseNotes: null }))
    await expect(getDesktopLatestVersion()).rejects.toThrow('无效')
  })
  it('parses admin list', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ releases: [VALID_RECORD], total: 1, limit: 50, offset: 0 }))
    const result = await listAdminDesktopReleases({ limit: 50, offset: 0 })
    expect(result.total).toBe(1)
    expect(result.releases[0].enabled).toBe(true)
  })
  it('rejects admin list with missing releases', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ total: 0, limit: 50, offset: 0 }))
    await expect(listAdminDesktopReleases()).rejects.toThrow('无效')
  })
  it('creates release from valid response', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ release: VALID_RECORD }))
    const result = await createAdminDesktopRelease({
      version: '1.2.0', minSupported: '1.1.0', downloadUrl: 'https://x/setup.exe', releaseNotes: 'n', enabled: true,
    })
    expect(result.version).toBe('1.2.0')
  })
  it('rejects create with bad response', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ release: null }))
    await expect(createAdminDesktopRelease({ version: '1.2.0', minSupported: '1.1.0', downloadUrl: 'https://x' })).rejects.toThrow('无效')
  })
  it('updates via patch', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ release: { ...VALID_RECORD, releaseNotes: 'new' } }))
    const result = await updateAdminDesktopRelease(1, { releaseNotes: 'new' })
    expect(result.releaseNotes).toBe('new')
    const opts = mockedApiRequest.mock.calls[0]?.[1] as RequestInit
    expect(opts.method).toBe('PATCH')
  })
  it('deletes release', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(deleteAdminDesktopRelease(1)).resolves.toBeUndefined()
    const opts = mockedApiRequest.mock.calls[0]?.[1] as RequestInit
    expect(opts.method).toBe('DELETE')
  })
  it('rejects delete when ok missing', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: false }))
    await expect(deleteAdminDesktopRelease(1)).rejects.toThrow('无效')
  })
})
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npx vitest run src/utils/desktopVersionApi.test.ts`
Expected: FAIL,模块不存在。

- [ ] **Step 3: 写实现**

```ts
// src/utils/desktopVersionApi.ts
import { apiRequest } from '@/utils/apiClient'

export interface DesktopLatestVersion {
  version: string | null
  minSupported: string | null
  downloadUrl: string | null
  releaseNotes: string | null
}

export interface DesktopReleaseRecord {
  id: number
  version: string
  minSupported: string
  downloadUrl: string
  releaseNotes: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface DesktopReleaseInput {
  version: string
  minSupported: string
  downloadUrl: string
  releaseNotes?: string
  enabled?: boolean
}

export type DesktopReleaseUpdate = Partial<Omit<DesktopReleaseInput, 'version'>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function readLatest(value: unknown): DesktopLatestVersion | null {
  if (
    !isRecord(value)
    || !isNullableString(value.version)
    || !isNullableString(value.minSupported)
    || !isNullableString(value.downloadUrl)
    || !isNullableString(value.releaseNotes)
  ) return null
  return {
    version: value.version,
    minSupported: value.minSupported,
    downloadUrl: value.downloadUrl,
    releaseNotes: value.releaseNotes,
  }
}

function readRecord(value: unknown): DesktopReleaseRecord | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'number'
    || typeof value.version !== 'string'
    || typeof value.minSupported !== 'string'
    || typeof value.downloadUrl !== 'string'
    || typeof value.releaseNotes !== 'string'
    || typeof value.enabled !== 'boolean'
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
  ) return null
  return {
    id: value.id,
    version: value.version,
    minSupported: value.minSupported,
    downloadUrl: value.downloadUrl,
    releaseNotes: value.releaseNotes,
    enabled: value.enabled,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function readOk(value: unknown) {
  return isRecord(value) && value.ok === true
}

export async function getDesktopLatestVersion(): Promise<DesktopLatestVersion> {
  const payload = await apiRequest('/desktop/latest-version')
  const result = readLatest(payload)
  if (!result) throw new Error('账号服务返回了无效版本数据。')
  return result
}

export async function listAdminDesktopReleases(input: { limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams({
    limit: String(input.limit ?? 50),
    offset: String(input.offset ?? 0),
  })
  const payload = await apiRequest(`/admin/desktop-releases?${params.toString()}`)
  if (!isRecord(payload) || !Array.isArray(payload.releases) || !Number.isInteger(payload.total)) {
    throw new Error('账号服务返回了无效版本列表。')
  }
  const releases = payload.releases.map(readRecord)
  if (releases.some(item => item === null)) throw new Error('版本列表包含无效数据。')
  return {
    releases: releases.filter((item): item is DesktopReleaseRecord => item !== null),
    total: payload.total as number,
  }
}

export async function createAdminDesktopRelease(input: DesktopReleaseInput): Promise<DesktopReleaseRecord> {
  const payload = await apiRequest('/admin/desktop-releases', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!isRecord(payload)) throw new Error('账号服务返回了无效版本数据。')
  const release = readRecord(payload.release)
  if (!release) throw new Error('账号服务返回了无效版本数据。')
  return release
}

export async function updateAdminDesktopRelease(id: number, input: DesktopReleaseUpdate): Promise<DesktopReleaseRecord> {
  const payload = await apiRequest(`/admin/desktop-releases/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  if (!isRecord(payload)) throw new Error('账号服务返回了无效版本数据。')
  const release = readRecord(payload.release)
  if (!release) throw new Error('账号服务返回了无效版本数据。')
  return release
}

export async function deleteAdminDesktopRelease(id: number): Promise<void> {
  const payload = await apiRequest(`/admin/desktop-releases/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!readOk(payload)) throw new Error('账号服务返回了无效结果。')
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npx vitest run src/utils/desktopVersionApi.test.ts`
Expected: PASS 11 个用例。

- [ ] **Step 5: 提交**

```bash
git add src/utils/desktopVersionApi.ts src/utils/desktopVersionApi.test.ts
git commit -m "feat(api): add desktopVersionApi client with tests"
```

---

## Task 6: 前端 `UpdateBanner.vue` + 测试

**Files:**
- Create: `src/components/common/UpdateBanner.vue`
- Create: `src/components/common/UpdateBanner.test.ts`

> 提示层级:local>=remote 静默;local<remote 且 local>=minSupported 显示 L2 横幅;local<minSupported 显示 L3 阻塞。L2 关闭后写 `localStorage["yunzhan:ignoredUpdateVersion"] = remote.version`,同一 remote 版本不再显示;L3 每天至多一次,`localStorage["yunzhan:lastBlockedPromptDate"]` 记录日期(ISO `YYYY-MM-DD`)。

- [ ] **Step 1: 先写组件测试**

```ts
// src/components/common/UpdateBanner.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import UpdateBanner from './UpdateBanner.vue'

// 桩全局 electronAPI 与 __APP_VERSION__
const originalElectronAPI = (window as unknown as { electronAPI?: unknown }).electronAPI
const originalVersion = (globalThis as unknown as { __APP_VERSION__?: string }).__APP_VERSION__

vi.mock('@/utils/desktopVersionApi', () => ({
  getDesktopLatestVersion: vi.fn(),
}))

import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'
const mockedGet = vi.mocked(getDesktopLatestVersion)

function setElectronAPI(has: boolean) {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: has ? { platform: 'win32', version: '1.1.0', invoke: vi.fn() } : undefined,
  })
}

beforeEach(() => {
  localStorage.clear()
  mockedGet.mockReset()
  Object.defineProperty(globalThis, '__APP_VERSION__', { configurable: true, value: '1.1.0' })
})

afterEach(() => {
  if (originalElectronAPI === undefined) {
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: undefined })
  }
  if (originalVersion !== undefined) {
    Object.defineProperty(globalThis, '__APP_VERSION__', { configurable: true, value: originalVersion })
  }
})

describe('UpdateBanner', () => {
  it('hides when not desktop (no electronAPI)', async () => {
    setElectronAPI(false)
    mockedGet.mockResolvedValueOnce({ version: '1.2.0', minSupported: '1.1.0', downloadUrl: 'https://x', releaseNotes: '' })
    const wrapper = mount(UpdateBanner)
    await flushPromises()
    expect(wrapper.find('[data-testid="update-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="update-modal"]').exists()).toBe(false)
  })

  it('hides when local >= remote', async () => {
    setElectronAPI(true)
    mockedGet.mockResolvedValueOnce({ version: '1.1.0', minSupported: '1.1.0', downloadUrl: 'https://x', releaseNotes: '' })
    const wrapper = mount(UpdateBanner)
    await flushPromises()
    expect(wrapper.find('[data-testid="update-banner"]').exists()).toBe(false)
  })

  it('shows L2 banner when local < remote and local >= minSupported', async () => {
    setElectronAPI(true)
    mockedGet.mockResolvedValueOnce({ version: '1.2.0', minSupported: '1.1.0', downloadUrl: 'https://x', releaseNotes: 'changes' })
    const wrapper = mount(UpdateBanner)
    await flushPromises()
    expect(wrapper.find('[data-testid="update-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="update-modal"]').exists()).toBe(false)
  })

  it('shows L3 modal when local < minSupported', async () => {
    setElectronAPI(true)
    mockedGet.mockResolvedValueOnce({ version: '1.2.0', minSupported: '1.2.0', downloadUrl: 'https://x', releaseNotes: '' })
    const wrapper = mount(UpdateBanner)
    await flushPromises()
    expect(wrapper.find('[data-testid="update-modal"]').exists()).toBe(true)
  })

  it('L2 close persists ignored remote version to localStorage', async () => {
    setElectronAPI(true)
    mockedGet.mockResolvedValueOnce({ version: '1.2.0', minSupported: '1.1.0', downloadUrl: 'https://x', releaseNotes: '' })
    const wrapper = mount(UpdateBanner)
    await flushPromises()
    await wrapper.find('[data-testid="update-banner-close"]').trigger('click')
    expect(localStorage.getItem('yunzhan:ignoredUpdateVersion')).toBe('1.2.0')
  })

  it('L2 does not re-render on second mount when ignored version matches', async () => {
    setElectronAPI(true)
    localStorage.setItem('yunzhan:ignoredUpdateVersion', '1.2.0')
    mockedGet.mockResolvedValue({ version: '1.2.0', minSupported: '1.1.0', downloadUrl: 'https://x', releaseNotes: '' })
    const wrapper = mount(UpdateBanner)
    await flushPromises()
    expect(wrapper.find('[data-testid="update-banner"]').exists()).toBe(false)
  })

  it('L3 does not re-show same day once dismissed', async () => {
    setElectronAPI(true)
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem('yunzhan:lastBlockedPromptDate', today)
    mockedGet.mockResolvedValueOnce({ version: '1.2.0', minSupported: '1.2.0', downloadUrl: 'https://x', releaseNotes: '' })
    const wrapper = mount(UpdateBanner)
    await flushPromises()
    expect(wrapper.find('[data-testid="update-modal"]').exists()).toBe(false)
  })

  it('silent on fetch failure', async () => {
    setElectronAPI(true)
    mockedGet.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(UpdateBanner)
    await flushPromises()
    expect(wrapper.find('[data-testid="update-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="update-modal"]').exists()).toBe(false)
  })

  it('silent when remote version is null', async () => {
    setElectronAPI(true)
    mockedGet.mockResolvedValueOnce({ version: null, minSupported: null, downloadUrl: null, releaseNotes: null })
    const wrapper = mount(UpdateBanner)
    await flushPromises()
    expect(wrapper.find('[data-testid="update-banner"]').exists()).toBe(false)
  })
})
```

> 测试假设 `@vue/test-utils` 与 `flushPromises` 可用;若项目无此依赖,验证现存测试惯例的 mount 方式并据此调整(参考仓库现有的组件测试)。

- [ ] **Step 2: 运行测试,确认失败**

Run: `npx vitest run src/components/common/UpdateBanner.test.ts`
Expected: FAIL,组件不存在。

- [ ] **Step 3: 写组件**

```vue
// src/components/common/UpdateBanner.vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { AlertCircle, Download, ExternalLink, X } from 'lucide-vue-next'
import { compareVersions, isSemver } from '@/utils/semver'
import { getDesktopLatestVersion, type DesktopLatestVersion } from '@/utils/desktopVersionApi'

interface UpdateState {
  mode: 'banner' | 'modal'
  remoteVersion: string
  minSupported: string
  downloadUrl: string
  releaseNotes: string
}

const state = ref<UpdateState | null>(null)
const notesExpanded = ref(false)

const IGNORED_KEY = 'yunzhan:ignoredUpdateVersion'
const BLOCKED_DATE_KEY = 'yunzhan:lastBlockedPromptDate'
declare const __APP_VERSION__: string

function localVersion(): string {
  return typeof __APP_VERSION__ === 'string' && isSemver(__APP_VERSION__) ? __APP_VERSION__ : '0.0.0'
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function decide(remote: DesktopLatestVersion): UpdateState | null {
  if (!remote.version || !remote.minSupported || !remote.downloadUrl) return null
  if (!isSemver(remote.version) || !isSemver(remote.minSupported)) return null
  const local = localVersion()
  if (compareVersions(local, remote.version) >= 0) return null
  if (compareVersions(local, remote.minSupported) < 0) {
    return {
      mode: 'modal',
      remoteVersion: remote.version,
      minSupported: remote.minSupported,
      downloadUrl: remote.downloadUrl,
      releaseNotes: remote.releaseNotes ?? '',
    }
  }
  return {
    mode: 'banner',
    remoteVersion: remote.version,
    minSupported: remote.minSupported,
    downloadUrl: remote.downloadUrl,
    releaseNotes: remote.releaseNotes ?? '',
  }
}

async function checkUpdate() {
  // 仅桌面端启动,纯网页端由 Vercel 自动部署无需提示
  if (!window.electronAPI) return
  try {
    const remote = await getDesktopLatestVersion()
    const next = decide(remote)
    if (!next || next.mode === 'modal') {
      state.value = next
      if (next && next.mode === 'modal') {
        const today = todayIsoDate()
        if (localStorage.getItem(BLOCKED_DATE_KEY) === today) {
          state.value = null
        } else {
          localStorage.setItem(BLOCKED_DATE_KEY, today)
        }
      }
      return
    }
    // banner:被忽略的版本不再显示
    if (localStorage.getItem(IGNORED_KEY) === next.remoteVersion) return
    state.value = next
  } catch {
    // 静默:版本检查失败不阻塞用户使用
  }
}

function closeBanner() {
  if (!state.value) return
  localStorage.setItem(IGNORED_KEY, state.value.remoteVersion)
  state.value = null
}

function closeModal() {
  state.value = null
}

function openDownload(url: string) {
  window.open(url, '_blank', 'noopener')
}

onMounted(() => {
  void checkUpdate()
})
</script>

<template>
  <Teleport to="body">
    <!-- L2 横幅 -->
    <div
      v-if="state?.mode === 'banner'"
      data-testid="update-banner"
      class="update-banner"
    >
      <AlertCircle class="w-4 h-4 flex-shrink-0" />
      <span class="text-sm">发现新版本 v{{ state.remoteVersion }},请前往下载更新</span>
      <button
        v-if="state.releaseNotes"
        type="button"
        class="banner-link"
        title="查看变更"
        @click="notesExpanded = !notesExpanded"
      >
        查看详情
      </button>
      <button
        type="button"
        class="banner-link"
        title="立即下载"
        @click="openDownload(state.downloadUrl)"
      >
        <Download class="w-4 h-4 inline" /> 下载
      </button>
      <div v-if="notesExpanded" class="banner-notes">{{ state.releaseNotes }}</div>
      <button
        type="button"
        class="banner-close"
        data-testid="update-banner-close"
        title="关闭"
        @click="closeBanner"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- L3 阻塞弹窗 -->
    <div
      v-if="state?.mode === 'modal'"
      data-testid="update-modal"
      class="modal-backdrop"
      role="presentation"
      @click.self="closeModal"
    >
      <section class="modal-panel max-w-md" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <AlertCircle class="w-5 h-5 text-amber-400" />
            <div>
              <div class="text-xs text-amber-400 font-mono">UPDATE REQUIRED</div>
              <h2 class="text-lg font-semibold text-white mt-0.5">版本已过旧</h2>
            </div>
          </div>
          <button type="button" class="icon-action" title="稍后继续" @click="closeModal">
            <X class="w-4 h-4" />
          </button>
        </div>
        <div class="p-5 space-y-4">
          <p class="text-sm text-gray-300 leading-7">
            您的版本 v{{ __APP_VERSION__ }} 已低于最低兼容版本 v{{ state.minSupported }}。
            请升级至 v{{ state.remoteVersion }} 后继续。
          </p>
          <div v-if="state.releaseNotes" class="text-sm text-gray-300 leading-7 whitespace-pre-wrap">
            {{ state.releaseNotes }}
          </div>
          <div class="flex justify-between gap-2 pt-2">
            <button type="button" class="ghost-button" @click="closeModal">稍后继续</button>
            <button
              type="button"
              class="primary-button"
              @click="openDownload(state.downloadUrl)"
            >
              <ExternalLink class="w-4 h-4 inline" /> 立即下载
            </button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.update-banner {
  @apply fixed top-0 inset-x-0 z-[90] flex items-center gap-3 px-4 h-12
    bg-amber-50 dark:bg-amber-900/40
    text-amber-900 dark:text-amber-100
    border-b border-amber-300 dark:border-amber-700
    text-sm;
}
.banner-link {
  @apply inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-80;
}
.banner-notes {
  @apply absolute top-12 left-0 right-0 px-4 py-2 bg-white dark:bg-[#0c0f18]
    dark:text-gray-200 text-amber-900 text-sm whitespace-pre-wrap border-b;
}
.banner-close {
  @apply ml-auto inline-flex w-8 h-8 items-center justify-center rounded-md
    hover:bg-black/10 dark:hover:bg-white/10;
}

.modal-backdrop {
  @apply fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4;
}
.modal-panel {
  @apply w-full max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg
    border border-white/[0.08] bg-[#0c0f18] shadow-2xl;
}
.modal-header {
  @apply flex items-start justify-between gap-4 px-5 py-4 border-b border-white/[0.06];
}
.icon-action {
  @apply inline-flex w-9 h-9 items-center justify-center rounded-md
    text-gray-500 hover:text-white hover:bg-white/[0.04];
}
.primary-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium
    bg-amber-400 text-gray-950 hover:bg-amber-300;
}
.ghost-button {
  @apply inline-flex h-10 items-center justify-center rounded-md px-5 text-sm
    text-gray-300 hover:bg-white/[0.05];
}
</style>
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npx vitest run src/components/common/UpdateBanner.test.ts`
Expected: PASS 10 个用例。

- [ ] **Step 5: 提交**

```bash
git add src/components/common/UpdateBanner.vue src/components/common/UpdateBanner.test.ts
git commit -m "feat(ui): add UpdateBanner with L2 banner and L3 modal"
```

---

## Task 7: `App.vue` 挂载 + 路由 + 后台页面

**Files:**
- Modify: `src/App.vue`(在 `<AnnouncementModal />` 后挂载)
- Modify: `src/router/index.ts`(新增超管路由)
- Create: `src/pages/AdminDesktopReleasesPage.vue`

- [ ] **Step 1: 修改 `src/App.vue` 挂载 `UpdateBanner`**

在 `src/App.vue:5`(现有 `import AnnouncementModal` 一行)下方追加 import:

```ts
import UpdateBanner from '@/components/common/UpdateBanner.vue'
```

在 `<AnnouncementModal />`(96 行)之后追加(仍在 `v-if="!route.meta.hideChrome"` 模板内):

```vue
<AnnouncementModal />
<UpdateBanner />
```

更新 L3 阻塞不限制在 hideChrome,而是与 AnnouncementModal 同显隐。

- [ ] **Step 2: 路由新增超管页**

在 `src/router/index.ts` 中(在 `adminAnnouncements` 路由之后)追加:

```ts
{
  path: '/admin/desktop-releases',
  name: 'adminDesktopReleases',
  component: () => import('@/pages/AdminDesktopReleasesPage.vue'),
  meta: { requiresSuperAdmin: true },
},
```

- [ ] **Step 3: 写 `AdminDesktopReleasesPage.vue`**

> 完全参照 `src/pages/AdminAnnouncementsPage.vue` 的结构(列表分页 + 编辑器抽屉 + CRUD),仅字段名替换为本端点:`version`/`minSupported`/`downloadUrl`/`releaseNotes`/`enabled`。删除按钮调用 `deleteAdminDesktopRelease`。因内容长,沿用 AdminAnnouncementsPage 的结构与样式,字段与按钮 label 改为本功能。

完整的页面 Vue SFC 写出来(参照 AdminAnnouncementsPage.vue 的 script + template 结构)——实施时打开 `src/pages/AdminAnnouncementsPage.vue` 直接复改:
- 将 `Megaphone` 图标改为 `MonitorCog`(lucide)
- import 列表换为本 utils:`listAdminDesktopReleases` / `createAdminDesktopRelease` / `updateAdminDesktopRelease` / `deleteAdminDesktopRelease` / `type DesktopReleaseRecord`、`type DesktopReleaseInput`
- 编辑器字段:`version`(disabled when edit)、`minSupported`、`downloadUrl`、`releaseNotes`(textarea)、`enabled`(toggle)
- 表格列:版本、最低兼容、下载地址(截断)、启用、创建时间、操作
- 删除按钮在每行,确认后 `deleteAdminDesktopRelease(id)` 并重载
- `editorSubmitting` / `pageError` / 分页变量保持同名

```vue
<!-- src/pages/AdminDesktopReleasesPage.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ChevronLeft, ChevronRight, LoaderCircle, MonitorCog, Pencil, Plus,
  RefreshCw, Trash2, X,
} from 'lucide-vue-next'
import {
  createAdminDesktopRelease,
  deleteAdminDesktopRelease,
  listAdminDesktopReleases,
  updateAdminDesktopRelease,
  type DesktopReleaseInput,
  type DesktopReleaseRecord,
} from '@/utils/desktopVersionApi'

const PAGE_SIZE = 50
const releases = ref<DesktopReleaseRecord[]>([])
const total = ref(0)
const offset = ref(0)
const loading = ref(false)
const pageError = ref('')

const editorOpen = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const editor = ref<DesktopReleaseInput>({
  version: '', minSupported: '1.1.0', downloadUrl: '', releaseNotes: '', enabled: true,
})
const editorError = ref('')
const editorSubmitting = ref(false)
const deleteTarget = ref<DesktopReleaseRecord | null>(null)
const deleting = ref(false)

const displayStart = computed(() => (total.value === 0 ? 0 : offset.value + 1))
const displayEnd = computed(() => Math.min(offset.value + releases.value.length, total.value))
const canPrev = computed(() => !loading.value && offset.value > 0)
const canNext = computed(() => !loading.value && offset.value + releases.value.length < total.value)

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(timestamp)
}

async function loadReleases() {
  loading.value = true
  pageError.value = ''
  try {
    const result = await listAdminDesktopReleases({ limit: PAGE_SIZE, offset: offset.value })
    releases.value = result.releases
    total.value = result.total
  } catch (error: unknown) {
    pageError.value = errorMessage(error, '版本记录加载失败。')
  } finally {
    loading.value = false
  }
}

function openCreateEditor() {
  editor.value = { version: '', minSupported: '1.1.0', downloadUrl: '', releaseNotes: '', enabled: true }
  editorMode.value = 'create'
  editingId.value = null
  editorError.value = ''
  editorOpen.value = true
}

function openEditEditor(entry: DesktopReleaseRecord) {
  editor.value = {
    version: entry.version,
    minSupported: entry.minSupported,
    downloadUrl: entry.downloadUrl,
    releaseNotes: entry.releaseNotes,
    enabled: entry.enabled,
  }
  editorMode.value = 'edit'
  editingId.value = entry.id
  editorError.value = ''
  editorOpen.value = true
}

async function submitEditor() {
  editorError.value = ''
  if (editorMode.value === 'create') {
    if (!editor.value.version || !editor.value.minSupported || !editor.value.downloadUrl) {
      editorError.value = '版本号、最低兼容版本、下载地址不可为空。'
      return
    }
  }
  editorSubmitting.value = true
  try {
    if (editorMode.value === 'create') {
      await createAdminDesktopRelease(editor.value)
    } else if (editingId.value !== null) {
      const { version: _version, ...patch } = editor.value
      void _version
      await updateAdminDesktopRelease(editingId.value, patch)
    }
    editorOpen.value = false
    await loadReleases()
  } catch (error: unknown) {
    editorError.value = errorMessage(error, '保存失败。')
  } finally {
    editorSubmitting.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value || deleting.value) return
  deleting.value = true
  try {
    await deleteAdminDesktopRelease(deleteTarget.value.id)
    deleteTarget.value = null
    await loadReleases()
  } catch (error: unknown) {
    pageError.value = errorMessage(error, '删除失败。')
  } finally {
    deleting.value = false
  }
}

function gotoPrev() {
  if (!canPrev.value) return
  offset.value = Math.max(0, offset.value - PAGE_SIZE)
  void loadReleases()
}
function gotoNext() {
  if (!canNext.value) return
  offset.value = offset.value + PAGE_SIZE
  void loadReleases()
}

onMounted(() => {
  void loadReleases()
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 text-white">
    <div class="flex items-center gap-3 mb-6">
      <MonitorCog class="w-7 h-7 text-cyan-400" />
      <h1 class="text-2xl font-semibold">桌面端版本管理</h1>
      <button type="button" class="ml-auto primary-button" @click="openCreateEditor">
        <Plus class="w-4 h-4 inline" /> 新建版本
      </button>
      <button type="button" class="ghost-button" title="刷新" :disabled="loading" @click="loadReleases">
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <p v-if="pageError" class="text-red-400 text-sm mb-4">{{ pageError }}</p>

    <div v-if="loading && releases.length === 0" class="text-gray-500 flex items-center gap-2">
      <LoaderCircle class="w-4 h-4 animate-spin" /> 加载中...
    </div>

    <table v-else class="w-full text-sm">
      <thead class="text-gray-400 border-b border-white/[0.06]">
        <tr>
          <th class="px-3 py-2 text-left">版本</th>
          <th class="px-3 py-2 text-left">最低兼容</th>
          <th class="px-3 py-2 text-left">下载地址</th>
          <th class="px-3 py-2 text-left">启用</th>
          <th class="px-3 py-2 text-left">创建时间</th>
          <th class="px-3 py-2 text-right">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in releases" :key="entry.id" class="border-b border-white/[0.04]">
          <td class="px-3 py-2 font-mono">{{ entry.version }}</td>
          <td class="px-3 py-2 font-mono">{{ entry.minSupported }}</td>
          <td class="px-3 py-2 max-w-[16rem] truncate" :title="entry.downloadUrl">{{ entry.downloadUrl }}</td>
          <td class="px-3 py-2">
            <span :class="entry.enabled ? 'text-green-400' : 'text-gray-500'">
              {{ entry.enabled ? '启用' : '停用' }}
            </span>
          </td>
          <td class="px-3 py-2 text-gray-500">{{ formatDate(entry.createdAt) }}</td>
          <td class="px-3 py-2 text-right space-x-2">
            <button type="button" class="icon-action" title="编辑" @click="openEditEditor(entry)">
              <Pencil class="w-4 h-4" />
            </button>
            <button type="button" class="icon-action" title="删除" @click="deleteTarget = entry">
              <Trash2 class="w-4 h-4" />
            </button>
          </td>
        </tr>
        <tr v-if="releases.length === 0">
          <td colspan="6" class="px-3 py-8 text-center text-gray-500">暂无桌面端版本记录。</td>
        </tr>
      </tbody>
    </table>

    <div v-if="total > PAGE_SIZE" class="flex items-center justify-between mt-4 text-sm text-gray-400">
      <span>{{ displayStart }}-{{ displayEnd }} / {{ total }}</span>
      <div class="flex gap-2">
        <button type="button" class="ghost-button" :disabled="!canPrev" @click="gotoPrev">
          <ChevronLeft class="w-4 h-4" />
        </button>
        <button type="button" class="ghost-button" :disabled="!canNext" @click="gotoNext">
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- 编辑器抽屉 -->
    <Teleport to="body">
      <div v-if="editorOpen" class="modal-backdrop" role="presentation" @click.self="editorOpen = false">
        <section class="modal-panel max-w-lg" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h2 class="text-lg font-semibold">{{ editorMode === 'create' ? '新建版本' : '编辑版本' }}</h2>
            <button type="button" class="icon-action" title="关闭" @click="editorOpen = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="p-5 space-y-4">
            <label class="block">
              <span class="text-sm text-gray-300">版本号 (x.y.z)</span>
              <input
                v-model="editor.version"
                type="text"
                class="text-input"
                :disabled="editorMode === 'edit'"
                placeholder="1.2.0"
              />
            </label>
            <label class="block">
              <span class="text-sm text-gray-300">最低兼容版本 (x.y.z)</span>
              <input v-model="editor.minSupported" type="text" class="text-input" placeholder="1.1.0" />
            </label>
            <label class="block">
              <span class="text-sm text-gray-300">下载地址 (http(s)://)</span>
              <input v-model="editor.downloadUrl" type="text" class="text-input" placeholder="https://..." />
            </label>
            <label class="block">
              <span class="text-sm text-gray-300">发布说明</span>
              <textarea v-model="editor.releaseNotes" rows="5" class="text-input" maxlength="2000"></textarea>
            </label>
            <label class="flex items-center gap-2">
              <input v-model="editor.enabled" type="checkbox" />
              <span class="text-sm text-gray-300">启用</span>
            </label>
            <p v-if="editorError" class="text-red-400 text-sm">{{ editorError }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" class="ghost-button" :disabled="editorSubmitting" @click="editorOpen = false">取消</button>
              <button type="button" class="primary-button" :disabled="editorSubmitting" @click="submitEditor">
                <LoaderCircle v-if="editorSubmitting" class="w-4 h-4 animate-spin" /> 保存
              </button>
            </div>
          </div>
        </section>
      </div>
    </Teleport>

    <!-- 删除确认 -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal-backdrop" role="presentation" @click.self="deleteTarget = null">
        <section class="modal-panel max-w-sm" role="dialog" aria-modal="true">
          <div class="p-5 space-y-4">
            <h3 class="text-base font-semibold">确认删除版本 v{{ deleteTarget.version }}?</h3>
            <p class="text-sm text-gray-400">删除后无法恢复,且桌面端将不再提示此版本。</p>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" class="ghost-button" :disabled="deleting" @click="deleteTarget = null">取消</button>
              <button type="button" class="danger-button" :disabled="deleting" @click="confirmDelete">
                <LoaderCircle v-if="deleting" class="w-4 h-4 animate-spin" /> 删除
              </button>
            </div>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-backdrop {
  @apply fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4;
}
.modal-panel {
  @apply w-full max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg
    border border-white/[0.08] bg-[#0c0f18] shadow-2xl;
}
.modal-header {
  @apply flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.06];
}
.icon-action {
  @apply inline-flex w-9 h-9 items-center justify-center rounded-md
    text-gray-500 hover:text-white hover:bg-white/[0.04];
}
.primary-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium
    bg-cyan-400 text-gray-950 hover:bg-cyan-300 disabled:opacity-50;
}
.ghost-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm
    text-gray-300 hover:bg-white/[0.05] disabled:opacity-50;
}
.danger-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium
    bg-red-500 text-white hover:bg-red-400 disabled:opacity-50;
}
.text-input {
  @apply mt-1 w-full rounded-md bg-white/[0.04] border border-white/[0.08]
    px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none
    focus:border-cyan-400 disabled:opacity-60;
}
</style>
```

- [ ] **Step 4: 导航添加超管入口**

若现有超管侧栏在 `src/components/common/` 下(参照 AdminAnnouncementsPage 在管理面板中的入口),在对应超管菜单组件中(实施时 grep `adminAnnouncements` 路由用法定位菜单文件)追加一项 `<RouterLink :to="{ name: 'adminDesktopReleases' }">桌面端版本</RouterLink>`。

- [ ] **Step 5: 运行类型 + lint**

Run:
```bash
npm run check
npm run lint
```
Expected: 通过。

- [ ] **Step 6: 提交**

```bash
git add src/App.vue src/router/index.ts src/pages/AdminDesktopReleasesPage.vue
git commit -m "feat(admin): add desktop releases management page and banner mount"
```

---

## Task 8: `scripts/check-version-sync.cjs` + 接入 `prebuild`

**Files:**
- Create: `scripts/check-version-sync.cjs`
- Modify: `package.json`(更新 `prebuild` 与 `prebuild:fast`)

- [ ] **Step 1: 写对账脚本**

```js
// scripts/check-version-sync.cjs
/**
 * 构建前校验:package.json / CHANGELOG / release/latest.yml 三处版本号一致
 *
 * 设计动机:
 * - 版本号散落在多处(package.json、CHANGELOG、electron-builder 产物清单),
 *   手工维护易脱节,曾导致发版时 Changelog 顶部版本与代码版本对不上。
 * - 运行时手工维护,构建期自动校验,不一致则 fail-fast。
 *
 * 运行: node scripts/check-version-sync.cjs
 * 退出码: 0 = 一致; 1 = 不一致(构建应中止)
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PACKAGE_JSON = path.join(ROOT, 'package.json')
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md')
const LATEST_YML = path.join(ROOT, 'release', 'latest.yml')

const SEMVER_RE = /^\d+\.\d+\.\d+$/

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'))
  if (typeof pkg.version !== 'string' || !SEMVER_RE.test(pkg.version)) {
    throw new Error(`check-version-sync: package.json version 非法: ${String(pkg.version)}`)
  }
  return pkg.version
}

function readChangelogVersion() {
  if (!fs.existsSync(CHANGELOG)) {
    throw new Error('check-version-sync: CHANGELOG.md 不存在,请在发版前维护。')
  }
  const src = fs.readFileSync(CHANGELOG, 'utf8')
  // 顶部 "## [x.y.z] -" 形式
  const match = src.match(/^##\s*\[([0-9.]+)\]/m)
  if (!match) {
    throw new Error('check-version-sync: CHANGELOG.md 顶部未找到版本条目。')
  }
  return match[1]
}

function readLatestYmlVersion() {
  if (!fs.existsSync(LATEST_YML)) return null
  const src = fs.readFileSync(LATEST_YML, 'utf8')
  const match = src.match(/^version:\s*([0-9.]+)/m)
  return match ? match[1] : null
}

function main() {
  const a = readPackageVersion()
  const b = readChangelogVersion()
  const c = readLatestYmlVersion()

  const mismatches = []
  if (a !== b) mismatches.push(`  package.json=${a} / CHANGELOG.md=${b}`)
  if (c !== null && a !== c) mismatches.push(`  package.json=${a} / release/latest.yml=${c}`)

  if (mismatches.length === 0) {
    console.log(`[check-version-sync] OK: 版本号一致 (${a})`)
    return
  }
  console.error('[check-version-sync] 版本号不一致,请先同步再构建:')
  for (const line of mismatches) console.error(line)
  process.exit(1)
}

main()
```

- [ ] **Step 2: 接入 `package.json` 的 `prebuild`**

改 `package.json` 第 15 行附近:

```json
"prebuild": "node scripts/check-chapter-counts.cjs && node scripts/check-version-sync.cjs",
"prebuild:fast": "node scripts/check-chapter-counts.cjs && node scripts/check-version-sync.cjs",
```

> 实施时打开 `package.json` 按现成格式精确替换;保留缩进与原引号风格。

- [ ] **Step 3: 临时跑一次对账(此时 CHANGELOG 还没写,会失败 → 由 Task 9 补 CHANGELOG)**

Run: `node scripts/check-version-sync.cjs`
Expected: 报"CHANGELOG.md 不存在"。

- [ ] **Step 4: 提交**

```bash
git add scripts/check-version-sync.cjs package.json
git commit -m "feat(scripts): add version sync check and wire into prebuild"
```

---

## Task 9: `CHANGELOG.md` + `RELEASE.md` 扩展

**Files:**
- Create: `CHANGELOG.md`
- Modify: `RELEASE.md`(末尾追加"版本管理与发布流程"一节)

- [ ] **Step 1: 写 `CHANGELOG.md`**

```markdown
# 变更日志

本文件遵循 [Keep a Changelog](https://keepachangelog.com/) 简化版,每条变更在括号内标注功能象限:
A = 必须同步(进度/实验/IPC/Schema) · B = 推荐同步(UI/内容) · C = 桌面专属 · D = 桌面跳过。

## [1.1.0] - 2026-07-10

### 新增
- 账号中心与审计控制台 (桌面端: B 象限同步)
- 公告、反馈与公开落地页 (桌面端: B 象限同步)
- 密码找回与 SMTP 验证邮件 (桌面端: A 象限同步,需关注进度兼容)

### 修复
- 实验卡片浅色对比度 (桌面端: B 象限同步)
- prose-content 与代码工具栏浅色对比度 (桌面端: B 象限同步)
```

> `1.1.0` 之前的版本不追溯,避免臆造。

- [ ] **Step 2: 写 `RELEASE.md` 末尾追加一节**

在 `RELEASE.md` 末尾追加:

```markdown

## 版本管理与发布流程

每次发布新桌面端版本,按以下顺序操作:

1. 修改 `package.json` 与 `package-lock.json` 中的版本号。
2. 在 `CHANGELOG.md` 顶部新增条目,标注功能象限(A/B/C/D)。
3. 运行 `npm run release:windows`。该命令会通过 `prebuild` 自动调用 `scripts/check-version-sync.cjs`,校验 `package.json` / `CHANGELOG.md` / `release/latest.yml` 三处版本号是否一致;不一致构建中止。
4. 在超管后台"桌面端版本管理"页面(`/admin/desktop-releases`)新建一条记录,填写 `version` / `minSupported` / `downloadUrl` / `releaseNotes`。桌面端用户启动后会自动拉取最新启用版本并分级提示。
5. 将新的 `云栈-Setup-<version>.exe` 手动分发给用户覆盖安装。

约束:

- 三处版本号一致性由 `check-version-sync.cjs` 对账,发版前必须通过。
- `desktop_releases` 记录由超管维护,前端启动时自动读取;该表为空时桌面端不提示。
- 应用标识 `com.yunzhan.app` 与产品名保持不变,学习进度位于 Electron `userData` 目录,覆盖安装不清空(同上文"更新规则"第 3 条)。
- 新增依赖时额外运行 `npm audit --omit=dev`。
```

- [ ] **Step 3: 验证对账脚本通过**

Run: `node scripts/check-version-sync.cjs`
Expected: `[check-version-sync] OK: 版本号一致 (1.1.0)`

- [ ] **Step 4: 提交**

```bash
git add CHANGELOG.md RELEASE.md
git commit -m "docs: add CHANGELOG and release version sync flow"
```

---

## Task 10: 质量门禁全跑

**Files:** 无新增,仅校验。

- [ ] **Step 1: policy:check**

Run: `npm run policy:check`
Expected: `[policy] OK: 已检查 N 个源码文件`,退出码 0。

- [ ] **Step 2: check**

Run: `npm run check`
Expected: vue-tsc 通过,无错误。

- [ ] **Step 3: lint**

Run: `npm run lint`
Expected: ESLint 通过,`--max-warnings 0` 下无 warning。

- [ ] **Step 4: test**

Run: `npm test`
Expected: 所有 vitest 用例通过,包括新增 `semver.test.ts` / `desktopVersionApi.test.ts` / `UpdateBanner.test.ts`。

- [ ] **Step 5: build**

Run: `npm run build`
Expected: 通过,包括 `prebuild` 中的 `check-version-sync.cjs`。

- [ ] **Step 6: git diff --check**

Run: `git diff --check`
Expected: 无空白错误。

- [ ] **Step 7: 总结提交(若有零散小修改)**

如前面任务有遗漏的格式调整,在这一步统一处理并提交;否则跳过。

```bash
git status -sb
```

---

## 后续(阶段二,不在本期)

- 引入 `electron-updater`(新生产依赖,需先做安全边界评审)
- 新增 IPC 通道 `update:check` / `update:download` / `update:install` / `update:onStatus`
- Electron CSP `connect-src` 放行更新源域名
- 代码签名 + GitHub Actions tag 触发 release 流水线
- 自动托管 `latest.yml` 与 `Setup.exe`
