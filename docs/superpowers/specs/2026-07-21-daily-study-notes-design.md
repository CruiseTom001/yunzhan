# 每日学习记录与 AI 润色设计

> 日期：2026-07-21
> 范围：Web/桌面共用前端、账号服务 API、PostgreSQL 迁移、网页端服务端 AI 代理、桌面端本机 AI IPC

## 目标

- 登录用户可以按日期记录当天学了什么。
- 用户可以保存原始记录，并可保存 AI 润色后的版本。
- 网页端通过云栈后端代理调用 AI 供应商，避免浏览器 CORS，API Key 只配置在服务端环境变量。
- 桌面端保留自定义 AI 供应商配置入口，支持 Anthropic Messages、Chat Completions、Responses 三种接口格式。
- 桌面端自定义 API Key 只保存在用户本机 IndexedDB，不落库、不进入日志。

## 非目标

- 不做团队共享、评论、公开发布。
- 不把 AI 供应商密钥写入源码、Git、数据库、URL 或日志。
- 不新增生产依赖。

## 用户流程

1. 用户从顶部导航进入“记录”。
2. 页面默认选中今天，用户填写“今天学了什么”。
3. 用户点击保存后，内容按账号保存到云端。
4. 网页端用户打开 AI 配置时看到服务端 AI 说明，可点击“测试连接”验证后端供应商配置。
5. 桌面端用户打开 AI 配置，填写供应商名称、Base URL、API Key、接口格式和模型，配置保存到本机 IndexedDB。
6. 用户点击“AI 润色”：网页端请求云栈后端，由后端请求 AI 供应商后返回；桌面端通过本机 Electron IPC 请求供应商。
7. 用户可以把润色结果应用到记录并保存。

## 数据结构

新增表 `study_notes`：

- `id BIGSERIAL PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `note_date DATE NOT NULL`
- `content TEXT NOT NULL`
- `polished_content TEXT NOT NULL DEFAULT ''`
- `ai_provider_name VARCHAR(80)`
- `ai_model VARCHAR(128)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `UNIQUE(user_id, note_date)`

约束：

- `content` 最大 20000 字符。
- `polished_content` 最大 30000 字符。
- 只允许用户访问自己的记录。

## API

- `GET /api/study-notes?limit=&offset=`：列出当前用户记录。
- `PUT /api/study-notes/:date`：按日期创建或更新当前用户记录。
- `DELETE /api/study-notes/:date`：删除当前用户指定日期记录。
- `POST /api/study-notes/ai/test`：登录用户测试服务端 AI 供应商配置。
- `POST /api/study-notes/ai/polish`：登录用户提交学习记录内容，服务端代理 AI 润色并返回结果。

服务端 AI 环境变量：

- `AI_PROVIDER_NAME`：供应商展示名，可选。
- `AI_BASE_URL`：供应商 HTTPS Base URL。
- `AI_API_KEY`：供应商密钥，只存在服务端环境变量。
- `AI_API_FORMAT`：`anthropic_messages` / `chat_completions` / `responses`，默认 `chat_completions`。
- `AI_MODEL`：模型名。

桌面端新增 IPC：

- `ai:testProvider`：本机测试供应商配置。
- `ai:polishStudyNote`：本机请求 AI 润色学习记录。

两个通道只在 Electron 主进程内使用本次入参发起外部 HTTPS 请求，不写入文件、不写入日志、不上传云栈服务器。

桌面端本地 AI 配置结构：

```json
{
  "name": "智谱 GLM",
  "baseUrl": "https://api.example.com/v1",
  "apiKey": "用户本机保存",
  "format": "chat_completions",
  "model": "glm-4"
}
```

## 安全边界

- 所有接口必须登录。
- 网页端 AI Key 保存在服务端环境变量，不写云栈数据库、源码、Git、日志、URL 或 localStorage。
- 网页端前端只发送学习记录内容，不发送 API Key、Base URL 或模型配置。
- 桌面端自定义 AI Key 保存在用户本机 IndexedDB，不写云栈数据库、服务端文件、服务端日志、URL 或 localStorage。
- 网页端 AI 请求由云栈后端请求供应商；桌面端 AI 请求由本机主进程请求供应商。
- AI Base URL 仅允许 `https:`，且不能包含账号、查询参数或片段。
- 服务端 AI 请求体和响应体均限制长度，AI 返回必须运行时校验。
- 服务端 AI 未配置时返回稳定中文 503，不泄漏环境变量。
- 桌面端使用白名单 IPC 通道请求供应商，参数必须验证类型、长度和接口格式。
- AI 请求体和响应体均限制长度，AI 返回必须运行时校验。
- 服务端错误返回稳定中文，不回显 API Key。

## 兼容性

- 新表追加迁移，不改变现有进度结构。
- Web 与桌面复用同一 hash 路由和账号 API；网页端 AI 依赖服务端环境变量。
- 旧桌面端不会有新增 IPC 通道，需升级桌面端后才能使用无 CORS 的本机 AI 测试和润色。

## 测试

- 前端 API 类型守卫测试：列表、保存、删除、服务端 AI 测试与润色响应校验。
- 本地 AI 配置校验与直连响应解析测试。
- 服务端 AI 代理配置、HTTPS 限制和响应解析测试。
- 服务端语法检查覆盖新 API 代码。
- 全量质量门禁按 `AGENTS.md` 执行。

## 回滚

- 前端可移除路由和导航入口。
- 服务端可移除新增路由。
- 前端可删除 IndexedDB 中的本地 AI 配置。
- 服务端删除 AI 环境变量后，网页端 AI 入口返回未配置，不影响学习记录 CRUD。
- 数据库可保留 `study_notes` 表，不影响旧功能；如需彻底回滚，先备份后删除表。
