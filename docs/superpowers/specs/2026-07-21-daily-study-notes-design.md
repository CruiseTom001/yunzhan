# 每日学习记录与 AI 润色设计

> 日期：2026-07-21
> 范围：Web/桌面共用前端、账号服务 API、PostgreSQL 迁移、桌面端本机 AI IPC

## 目标

- 登录用户可以按日期记录当天学了什么。
- 用户可以保存原始记录，并可保存 AI 润色后的版本。
- 提供自定义 AI 供应商配置入口，支持 Anthropic Messages、Chat Completions、Responses 三种接口格式。
- API Key 只保存在用户本机 IndexedDB，不上传云栈服务器、不落库、不进入日志。

## 非目标

- 不做团队共享、评论、公开发布。
- 不把 AI 供应商密钥保存到云栈服务器。
- 不新增生产依赖。

## 用户流程

1. 用户从顶部导航进入“记录”。
2. 页面默认选中今天，用户填写“今天学了什么”。
3. 用户点击保存后，内容按账号保存到云端。
4. 用户打开 AI 配置，填写供应商名称、Base URL、API Key、接口格式和模型，配置保存到本机 IndexedDB。
5. 用户可以先点击“测试连接”验证供应商配置。
6. 用户点击“AI 润色”：网页端由浏览器直连 AI 供应商；桌面端通过本机 Electron IPC 请求供应商，避开浏览器 CORS。
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
没有云栈服务端 AI 润色 API。AI 润色由前端本地模块直接调用供应商。

桌面端新增 IPC：

- `ai:testProvider`：本机测试供应商配置。
- `ai:polishStudyNote`：本机请求 AI 润色学习记录。

两个通道只在 Electron 主进程内使用本次入参发起外部 HTTPS 请求，不写入文件、不写入日志、不上传云栈服务器。

本地 AI 配置结构：

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
- AI Key 保存在用户本机 IndexedDB，不写云栈数据库、服务端文件、服务端日志、URL 或 localStorage。
- AI 请求由前端或桌面端本机主进程请求供应商，云栈服务器不接收 API Key。
- AI Base URL 仅允许 `https:`，且不能包含账号、查询参数或片段。
- 网页端直连供应商依赖供应商允许浏览器跨域请求；不支持 CORS 的供应商会被浏览器拦截。
- 桌面端使用白名单 IPC 通道请求供应商，参数必须验证类型、长度和接口格式。
- AI 请求体和响应体均限制长度，AI 返回必须运行时校验。
- 服务端错误返回稳定中文，不回显 API Key。

## 兼容性

- 新表追加迁移，不改变现有进度结构。
- Web 与桌面复用同一 hash 路由和账号 API。
- 旧桌面端不会有新增 IPC 通道，需升级桌面端后才能使用无 CORS 的本机 AI 测试和润色。

## 测试

- 前端 API 类型守卫测试：列表、保存、删除、AI 润色响应校验。
- 本地 AI 配置校验与直连响应解析测试。
- 服务端语法检查覆盖新 API 代码。
- 全量质量门禁按 `AGENTS.md` 执行。

## 回滚

- 前端可移除路由和导航入口。
- 服务端可移除新增路由。
- 前端可删除 IndexedDB 中的本地 AI 配置。
- 数据库可保留 `study_notes` 表，不影响旧功能；如需彻底回滚，先备份后删除表。
