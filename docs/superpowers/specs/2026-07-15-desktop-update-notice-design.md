# 桌面端版本更新提示机制 设计文档

- 日期:2026-07-15
- 分支:`feat/desktop-update-notice`
- 范围:阶段一(低成本,不引入自动下载)
- 状态:待评审

## 1. 背景与目标

桌面端(Electron)目前没有任何自动更新机制:无 `electron-updater`、无 `publish` 配置、无 release CI,靠人工分发 `release/云栈-Setup-x.y.z.exe` 覆盖安装(`RELEASE.md`)。版本号统一在 `package.json`(`1.1.0`),通过 `vite.config.ts` 注入前端常量 `__APP_VERSION__`。

移动端已上线一批功能,桌面端需要:

1. 判断是否同步移动端功能(以功能象限为标准)。
2. 让桌面端用户在启动时**程序化、轻量**地获知"有新版"。
3. 不破坏现有架构(不动 IPC 白名单、不改 Electron 沙箱/CSP、不引入自动下载)。

**本期目标**:落地"版本发布信息记录 + 启动时检查 + 分级提示 + 版本对账 + Changelog 流程"五件套,作为后续阶段二(`electron-updater` 自动下载)的前置基础。

## 2. 范围与非目标

### 本期做

- 后端新增 `desktop_releases` 表 + migration
- 后端新增 `/api/desktop/latest-version`(公开,无需 auth)和 `/api/admin/desktop-releases` 系列(超管 CRUD + 审计)
- 前端新增 `desktopVersionApi.ts` + `UpdateBanner.vue`(L2 横幅) + L3 阻塞弹窗逻辑
- 新增 `scripts/check-version-sync.cjs` 版本对账脚本,接入 `prebuild`
- 新增 `CHANGELOG.md`,从 `1.1.0` 起维护
- 新增 `AdminDesktopReleasesPage.vue` 超管后台
- `RELEASE.md` 补充"版本管理与发布流程"一节

### 本期不做(留作阶段二,单独评审)

- `electron-updater` 自动下载安装
- 新增任何 IPC 通道(不动 `electron/preload.cjs` 白名单与 `electron/main.cjs` CSP)
- 代码签名、CI 自动发布流水线
- 独立的 `docs/FEATURE_MATRIX.md`(由 Changelog 象限标注替代)

### 不动

- `appId`(`com.yunzhan.app`,AGENTS.md 第 4 条要求)
- Electron `sandbox: true` / `contextIsolation: true` / `nodeIntegration: false`
- `progress:load/save` 逻辑
- 现有公告系统(`AnnouncementModal`、`announcements` 表)

## 3. 功能同步判定标准(四象限)

每次移动端功能上线时,按象限判定桌面端是否同步,并在 Changelog 顶部条目标注象限:

| 象限 | 判定标准 | 处理 |
|---|---|---|
| A 必须同步 | 影响 `server/migrations/*.sql`、`user_progress` 字段、实验命令判定、IPC 通道变更 | 立即纳入下个桌面版本,发版前必须跑旧 `progress.json` 兼容回归 |
| B 推荐同步 | 纯前端 UI、课程内容、无 schema 变更的后端逻辑 | 跟随下个版本一起打包 |
| C 桌面专属 | 依赖 `window.electronAPI`、本地文件、IPC | 桌面端独有,移动端不涉及 |
| D 桌面跳过 | 移动端专属(PWA 安装、移动手势、分享 SDK) | 桌面端显式跳过,代码里以 `!window.electronAPI` 等守卫隔离 |

**红线**:涉及 A 象限的版本,发版前必须在本地用旧 `progress.json` 跑一次 `progress:load`,验证升级不清空数据(NSIS 已配 `deleteAppDataOnUninstall: false`)。

## 4. 后端设计

### 4.1 数据表

新增 migration `server/migrations/007_desktop_releases.sql`(紧跟最新 `006_feedback_and_announcements.sql`,编号 `007`)。

```sql
CREATE TABLE IF NOT EXISTS desktop_releases (
  id            BIGSERIAL PRIMARY KEY,
  version       TEXT NOT NULL UNIQUE,
  min_supported TEXT NOT NULL,
  download_url  TEXT NOT NULL,
  release_notes TEXT NOT NULL DEFAULT '',
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 查询启用中的最新版本频繁,在 enabled 上加索引
CREATE INDEX IF NOT EXISTS idx_desktop_releases_enabled ON desktop_releases (enabled);
```

> DDL 风格对齐 `server/migrations/006_feedback_and_announcements.sql`(`BIGSERIAL` + `TIMESTAMPTZ` + `NOW()`)。最终字段类型以实施时参考 `006` 的现有时区/序列惯例为准。

字段说明:

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER PK | 主键 |
| `version` | TEXT, UNIQUE | 形如 `1.2.0`,唯一约束防重复 |
| `min_supported` | TEXT | 低于此版本触发 L3 阻塞弹窗;初始可设为 `1.1.0` |
| `download_url` | TEXT | Setup.exe 下载地址(网盘/对象存储) |
| `release_notes` | TEXT | 纯文本发布说明,**禁止富文本**(后台用 textarea,渲染用文本节点,不用 `v-html`) |
| `enabled` | INTEGER(0/1) | 停用后该版本不参与"最新版"判定 |
| `created_at` / `updated_at` | TEXT | 审计辅助 |

### 4.2 "最新版本"判定逻辑

在所有 `enabled=1` 的记录里,取 `version` 语义版本号最大的一条。**语义比较在 JS 侧进行**(`major.minor.patch` 数值逐段比,实现为 `compareVersions(a, b)` 工具函数),不依赖 SQLite 字符串排序(避免 `1.10.0 < 1.2.0`)。

无启用记录时,公开端点返回各字段为 `null`,前端按"无版本信息"静默处理。

### 4.3 端点

**公开端点(无需 auth)**

- `GET /api/desktop/latest-version`
  - 200 返回 `{ version, minSupported, downloadUrl, releaseNotes }`(单条最新启用记录)
  - 无启用记录时返回 `{ version: null, minSupported: null, downloadUrl: null, releaseNotes: null }`
  - 不返回 `id`、`enabled` 等内部字段

> **与现有公告端点的差异**:`/api/announcements/latest`(server/index.mjs 约 1520 行)用 `requireAuth`,因为公告是已读状态绑定到用户的。而 `/api/desktop/latest-version` 是版本元数据,与用户身份无关,桌面端用户**可能未登录时就应能检查升级**,因此**不加 auth**。这是有意的设计差异。

**超管端点(沿用 `requireAuth` + `requireSuperAdmin` + `writeAudit`,参照 `/api/admin/announcements` 在 1563-1704 行的风格)**

- `GET /api/admin/desktop-releases` → 列表(全部字段含 `enabled`,按版本倒序)
- `POST /api/admin/desktop-releases` → 新建
  - 校验:`version` match `/^\d+\.\d+\.\d+$/` 且 DB 唯一
  - `min_supported` match `/^\d+\.\d+\.\d+$/`
  - `download_url` match `/^https?:\/\//`,长度 ≤ 500
  - `release_notes` 长度 ≤ 2000,可空
  - 审计 action:`desktop_release.create`,metadata 含 `{ version }`
- `PATCH /api/admin/desktop-releases/:id` → 更新
  - 可改字段:`min_supported`、`download_url`、`release_notes`、`enabled`
  - **`version` 不可改**:版本号是身份(UNIQUE),如需改版本应新建一条再停用旧的
  - 审计 action:`desktop_release.update`,metadata 含 `{ targetId, fields }`
- `DELETE /api/admin/desktop-releases/:id` → 删除
  - 审计 action:`desktop_release.delete`,metadata 含 `{ version }`

**校验规则总览**(对照 AGENTS.md 第 4 条,防止 `javascript:` URL 等注入):

- `version` / `min_supported`:`/^\d+\.\d+\.\d+$/`
- `download_url`:`/^https?:\/\//`,允许 http 兼容内网/未加密对象存储
- `download_url` ≤ 500 字符,`release_notes` ≤ 2000 字符
- 不通过 → 400 + 错误信息(参照现有公告 POST 的 `response.status(400).json(...)` 模式)

### 4.4 前端 API 客户端

新增 `src/utils/desktopVersionApi.ts`,参照现有 `src/utils/announcementApi.ts` 结构:

- `getDesktopLatestVersion()` → `GET /api/desktop/latest-version`(公开,任何客户端角色可调)
- `listAdminDesktopReleases()` → `GET /api/admin/desktop-releases`(超管)
- `createAdminDesktopRelease(payload)` → `POST`(超管)
- `updateAdminDesktopRelease(id, payload)` → `PATCH`(超管)
- `deleteAdminDesktopRelease(id)` → `DELETE`(超管)

返回类型用 TypeScript interface,与 AGENTS.md 第 3 条一致(no `any`,外部数据用 `unknown` 接收 + 类型守卫):

```ts
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
  createdAt: string
  updatedAt: string
}
```

## 5. 前端提示设计

### 5.1 检查流程(全在 renderer,不动 IPC)

入口:在 `src/App.vue` 全局挂载 `UpdateBanner.vue`(与现有 `AnnouncementModal` 并列,都在非 `hideChrome` 路由下显示)。

启动序列(在 `UpdateBanner.vue` 的 `onMounted` 里):

1. 仅当 `window.electronAPI` 存在时触发(纯网页端跳过,网页由 Vercel 自动部署无需此提示)
2. `getDesktopLatestVersion()` 走现有 `src/utils/apiClient.ts`,自动带 `X-Yunzhan-Client: desktop` 头
3. 加载/网络失败 → 静默不提示(沿用 `AnnouncementModal` 失败不阻塞策略)
4. 返回 `version === null` → 无版本信息,静默
5. 比对 `local = __APP_VERSION__` vs `remote.version`,`minSupported = remote.minSupported`

比对结果:

- `semver(local) >= semver(remote)` → 静默
- `semver(local) < semver(remote) && semver(local) >= semver(minSupported)` → **L2 横幅**
- `semver(local) < semver(minSupported)` → **L3 阻塞弹窗**

**为什么不新增 IPC `app:getVersion` 调用**:`__APP_VERSION__` 是构建期注入(`vite.config.ts:10-12`,与 `package.json` version 同源),版本一致性由本期对账脚本 `check-version-sync.cjs` 保证;渲染进程用常量更快、零 IPC 开销,完全满足提示场景需求。

### 5.2 L2 横幅组件 `UpdateBanner.vue`

形态:应用顶部一条横向条,样式参照现有公告/反馈组件 Tailwind 风格,深/浅色主题兼容(沿用 `fix: light theme contrast` 那批 commit 的对比度规则)。

内容:

- 左侧图标 + 文案 `发现新版本 vX.Y.Z,请前往下载更新`(AGENTS.md 第 3 条简洁中文)
- 右侧动作:`查看详情`(展开 `releaseNotes` 文本预览,用普通文本节点渲染,**禁止 v-html**)、`关闭 ✕`
- 颜色用次要强调色 + 图标 + 文字,**颜色不作为唯一状态信号**(AGENTS.md 第 6 条)

**关闭持久化**:

- 关闭时写 `localStorage["yunzhan:ignoredUpdateVersion"] = remoteVersion`
- 下次启动若 `remote.version` === 已忽略版本 → 不显示 L2
- 若已是更新版本的 `remote.version` → 重新显示
- 仅影响 L2,不影响 L3

> localStorage 键名不含 `api/token/secret/key`,符合 `check-source-policy.mjs:16` 的 forbidden pattern 规则。

**下载 URL 安全**:

- `UpdateBanner` 仅渲染 `https://` 或 `http://` 开头的 `download_url` 为链接
- 点击用 `window.open(downloadUrl, '_blank', 'noopener')`
- 禁止 `v-html` 渲染 `releaseNotes`(policy 仅允许 `MarkdownRenderer.vue`/`AIChatPanel.vue` 用 v-html,见 `check-source-policy.mjs:45-50`)

### 5.3 L3 阻塞弹窗

形态:复用 `Teleport` 到 body 的全屏遮罩弹窗(参照 `AnnouncementModal` 的 Modal 样式)。文案 `您的版本 vX.Y.Z 已过旧,新版 vX.Y.Z 可用,请升级后继续`。

内容:

- `releaseNotes` 纯文本预览
- 下载按钮 `立即下载`(打开 `download_url`,同 L2 安全规则)
- 关闭按钮 `稍后继续`(可点击继续使用)

**为什么不真"死锁"**:桌面端不能强制断网/锁定课程,且用户可能离线无法下载——硬阻塞会卡死学习流程。通过"每天最多一次 + 可稍后继续 + 顶部永久横幅弱提醒"三组合,让用户知情但不被锁死。AGENTS.md 第 6 条要求"浮层必须可关闭"。

**L3 防抖**:用 `localStorage["yunzhan:lastBlockedPromptDate"]` 记录上次弹窗日期,同一天内不重复弹。避免 `App.vue` 切路由时 mounted 重新触发导致跳弹窗。

### 5.4 `semver` 比较

在 `src/utils/desktopVersionApi.ts` 或独立 `src/utils/semver.ts`(`isDesktop` 客户端判定 + 比较函数),实现:

```ts
export function compareVersions(a: string, b: string): number
// 返回 -1 / 0 / 1;逐段数值比较 major.minor.patch
// 输入必须 match /^\d+\.\d+\.\d+$/,否则抛错(类型守卫收窄)
```

## 6. 版本对账脚本

### 6.1 `scripts/check-version-sync.cjs`

参照 `scripts/check-chapter-counts.cjs` 模式(读文件、比对、非零退出码)。

校验三处版本号一致:

1. `package.json` 的 `version` 字段(`a`)
2. `CHANGELOG.md` 顶部一行 `## [x.y.z] -` 里的版本号(`b`)
3. `release/latest.yml` 的 `version:` 字段(`c`,若文件存在)

规则:

- `a` match `/^\d+\.\d+\.\d+$/`,否则失败
- `a === b`(Changelog 顶部条目必须对应即将发布的版本)
- `a === c`(若 `latest.yml` 存在,版本必须一致;不存在时跳过,允许首次发版前无产物)
- 不一致 → stderr 输出三处值 + 退出码 1
- 一致 → stdout `版本对账通过: x.y.z`,退出码 0

> `scripts/` 不在 `check-source-policy.mjs` 的扫描范围(`sourceRoots = ['src', 'electron', 'server']`),所以对账脚本放 `scripts/` 不受 policy 约束。

### 6.2 接入 `package.json`

在 `prebuild` 与 `prebuild:fast` 中,在 `check-chapter-counts.cjs` 之后追加对账调用:

```json
"prebuild": "node scripts/check-chapter-counts.cjs && node scripts/check-version-sync.cjs",
"prebuild:fast": "node scripts/check-chapter-counts.cjs && node scripts/check-version-sync.cjs",
```

(最终具体写法以现有 `prebuild` 字面为准;接入点位于 `package.json` 的 `prebuild`/`prebuild:fast`,见 `package.json:15,17`。)

## 7. CHANGELOG.md

从 `1.1.0`(当前版本)起维护,格式遵循 [Keep a Changelog](https://keepachangelog.com/) 简化版:

```markdown
# 变更日志

## [1.1.0] - 2026-07-10

### 新增
- 账号中心与审计控制台 (桌面端: B 象限同步)
- 公告、反馈与公开落地页 (桌面端: B 象限同步)
- 密码找回与 SMTP 验证邮件 (桌面端: A 象限同步,需关注进度兼容)

### 修复
- 实验卡片浅色对比度
- prose-content 与代码工具栏浅色对比度
```

规则:

- 每条变更在括号内标注 `A/B/C/D 象限同步` / `桌面端专属` / `桌面端跳过`
- `1.1.0` 之前不追溯(避免臆造,符合 AGENTS.md "不得伪装真实执行"原则),用户有需要再补
- 升级 `package.json` 版本号前**必须**先在 Changelog 顶部新增条目;`check-version-sync.cjs` 会验证版本一致,不一致发版被阻断

## 8. RELEASE.md 补充

在 `RELEASE.md` 末尾新增"版本管理与发布流程"一节:

1. 改 `package.json` version
2. 更新 `CHANGELOG.md` 顶部条目(标注象限)
3. 跑 `npm run release:windows`(含 `release:check` → `quality` → 含 `prebuild` 对账)
4. 在超管后台 `AdminDesktopReleasesPage` 新建一条记录(填 version / min_supported / download_url / release_notes)
5. 手动分发 `云栈-Setup-x.y.z.exe`

强调三项约束(对照 AGENTS.md):

- 三处版本号由 `check-version-sync.cjs` 对账,不一致即阻断
- `desktop_releases` 记录由超管维护,前端启动时自动读取
- `appId` 不得变更

## 9. 测试

### 9.1 后端单元/集成

参照 `server/` 现有测试惯例(若有 vitest + supertest),至少覆盖:

- `GET /api/desktop/latest-version` 无启用记录 → 各字段为 null
- `GET /api/desktop/latest-version` 多启用版本 → 返回最大版本
- `GET /api/desktop/latest-version` 停用某版本 → 不返回该版本
- `POST /api/admin/desktop-releases` 非超管 → 403
- `POST /api/admin/desktop-releases` version 格式非法 → 400
- `POST /api/admin/desktop-releases` download_url 非 http(s) → 400
- `POST /api/admin/desktop-releases` version 重复 → 400
- `PATCH` 改 version → 400
- `compareVersions` 工具:`1.10.0 > 1.2.0`、`1.1.0 < 1.2.0`、相等

### 9.2 前端单元

- `UpdateBanner.vue`:本地 >= 远端 → 不渲染横幅
- `UpdateBanner.vue`:本地 < 远端但 >= minSupported → 渲染 L2
- `UpdateBanner.vue`:本地 < minSupported → 渲染 L3
- 关闭 L2 后,localStorage 记录被忽略版本,下次同远端版本不再显示
- L3 防抖:同一天内重复触发只弹一次
- `compareVersions` 工具函数边界用例

### 9.3 质量门禁

按 AGENTS.md 第 7 条,完成代码后必须依次跑通:

1. `npm run policy:check`
2. `npm run check`
3. `npm run lint`
4. `npm test`
5. `npm run build`(会触发 `prebuild`,含 `check-version-sync.cjs`)
6. `git diff --check`

## 10. 兼容性与风险

### 兼容性影响

- 新增表,不改任何现有表 → 无破坏性 schema 变更
- 新增端点,不改现有端点 → 无破坏性 API 变更
- 前端新增组件 `App.vue`,不改 `AnnouncementModal` → 现有公告流程不受影响
- 不动 IPC 白名单、不动 Electron 沙箱/CSP → 桌面端运行时行为零变化
- `desktop_releases` 表初始为空 → 桌面端首次启动查到 null,静默不提示,**向后兼容**

### 遗留风险

- 人工分发模式下,超管若忘记在 `desktop_releases` 录入新版本 → 桌面端不会提示。缓解:发版流程已写入 `RELEASE.md`,`desktop_releases` 录入作为第 4 步。
- `download_url` 指向的外部对象存储/网盘若失效 → 用户点击下载失败。缓解:超管后台可在 `PATCH` 中更新 URL。
- 未做代码签名,Windows SmartScreen 仍会拦截新 Setup.exe。这是已知问题,留待阶段二签名解决。
- L3 防抖用 localStorage,用户清除 localStorage 会导致同一天再次弹窗——属可接受行为。

### 未执行检查(若阶段二落地)

- `npm audit --omit=dev`(阶段二引入 electron-updater 等新依赖时需跑)
- 代码签名验证(阶段二)

## 11. 交付清单

| 类型 | 路径 | 说明 |
|---|---|---|
| migration | `server/migrations/007_desktop_releases.sql` | 新表 |
| 后端路由 | `server/index.mjs`(追加) | 1 公开 + 4 超管端点 |
| 前端 API | `src/utils/desktopVersionApi.ts` | 客户端 |
| 工具 | `src/utils/semver.ts`(或合入 desktopVersionApi) | `compareVersions` |
| 组件 | `src/components/common/UpdateBanner.vue` | L2 横幅 + L3 弹窗 |
| 后台 | `src/pages/AdminDesktopReleasesPage.vue` | CRUD |
| App.vue | `src/App.vue`(追加挂载) | `<UpdateBanner />` |
| 对账脚本 | `scripts/check-version-sync.cjs` | 三处版本一致校验 |
| package.json | `package.json`(改 prebuild) | 接入对账 |
| Changelog | `CHANGELOG.md` | 新建,从 1.1.0 起 |
| 文档 | `RELEASE.md`(追加) | 发版流程补充 |
| 文档 | `docs/superpowers/specs/2026-07-15-desktop-update-notice-design.md` | 本 spec |

## 12. 设计决策回顾(用户已确认)

- ✅ 版本数据源:新建 `desktop_releases` 表(而非复用 announcements 或静态 JSON)
- ✅ 检查时机:Renderer 启动时 fetch(而非主进程 + 新 IPC)
- ✅ 提示门槛:L2 横幅 + L3 阻塞(min_supported 判定)
- ✅ 横幅关闭:本地记住忽略版本
- ✅ 后台范围:完整 CRUD 后台页面(带审计)
