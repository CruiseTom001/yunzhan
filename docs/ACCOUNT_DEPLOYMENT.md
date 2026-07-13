# 云栈账号服务部署

## 架构与数据边界

- Web/Electron 客户端只保存账号隔离的本地缓存，不保存密码、Token 或 API Key。
- 登录会话使用随机不透明 Token；浏览器只接收 `HttpOnly` Cookie，数据库仅保存 Token 的 SHA-256 摘要。
- PostgreSQL 保存账号、云端学习进度、操作审计、删除用户备份和最近 20 个进度历史版本。
- Resend API 负责发送邮箱注册验证码；API Key 只存在于服务端环境变量。
- 超管可以创建、查询、编辑、停用和删除用户，并查看用户课程进度；不能删除自己，也不能停用或降级最后一个可用超管。

GitHub Pages 只能托管静态文件，不能独立运行账号 API 和 PostgreSQL。账号版应部署到支持 Node.js 与 PostgreSQL 的服务器，或将静态前端与 API 分开部署。

## 首次本地启动

1. 在项目根目录根据 `.env.example` 创建 `.env`。`.env` 已被 Git 忽略，不要提交。
2. 至少修改以下配置：

```dotenv
POSTGRES_PASSWORD=仅供-docker-compose-读取的强密码
DATABASE_URL=postgresql://yunzhan:同一强密码@127.0.0.1:5432/yunzhan
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_DISPLAY_NAME=云栈管理员
BOOTSTRAP_ADMIN_PASSWORD=至少10位且包含字母和数字
EMAIL_CODE_SECRET=至少32字符的随机密钥
RESEND_API_KEY=re_开头的发送专用密钥
RESEND_FROM_EMAIL=云栈 <verify@mail.example.com>
```

3. 启动数据库并初始化：

```powershell
docker compose up -d postgres
npm run server:migrate
npm run server:create-admin
```

4. 创建成功后，从 `.env` 删除 `BOOTSTRAP_ADMIN_PASSWORD`。创建脚本不会覆盖同名账号。
5. 配置 Resend：在 Resend 控制台验证自有域名或发信子域名，创建仅有 `Sending access` 权限且限制到该域名的 API Key，并保证 `RESEND_FROM_EMAIL` 与已验证域名一致。API Key 只显示一次，不得提交到 Git 或添加 `VITE_` 前缀。
6. 使用下面的命令生成验证码 HMAC 密钥，并把输出写入本机 `.env` 的 `EMAIL_CODE_SECRET`：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

7. 启动 API 与前端：

```powershell
# 终端 1
npm run server:dev

# 终端 2
npm run dev
```

Vite 会把 `/api` 代理到 `http://127.0.0.1:8787`。需要改端口时设置 `YUNZHAN_API_PROXY_TARGET`。

邮箱验证码有效期为 10 分钟，同一邮箱 60 秒内不能重发、每小时最多发送 5 次，同一 IP 每小时最多发送 20 次，每个验证码最多尝试 5 次。验证码只以 HMAC 摘要保存，不会写入数据库明文或日志。

Resend 要求使用自有并已验证的域名发送邮件，推荐使用 `mail.example.com` 一类独立子域名隔离发信信誉。官方配置说明见 [Resend Domains](https://resend.com/docs/dashboard/domains/introduction) 和 [Resend API Keys](https://resend.com/docs/dashboard/api-keys/introduction)。

## 生产 Web 部署

推荐由同一个 HTTPS 域名提供静态页面和 `/api`：

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://用户名:密码@数据库地址:5432/yunzhan
PORT=8787
APP_ORIGINS=https://learn.example.com
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
TRUST_PROXY=true
SERVE_STATIC=true
VITE_API_BASE_URL=/api
```

部署顺序：

```powershell
npm ci
npm run quality
npm run server:migrate
npm run build
npm run server:start
```

在 Node 服务前配置 Nginx/Caddy HTTPS 反向代理。生产环境不要暴露 PostgreSQL 端口，不要使用 `.env.example` 中的占位密码，并定期备份数据库。

若前端和 API 使用不同域名，必须同时配置精确的 `APP_ORIGINS`、`COOKIE_SECURE=true`、`COOKIE_SAME_SITE=none` 和构建时的绝对 `VITE_API_BASE_URL`。不要使用 `*` CORS。

## Electron 桌面端

桌面安装包仍使用同一个云端账号服务。生成正式安装包前，在 `electron/api-config.json` 中写入 API 的 HTTPS 源地址，只填写协议、域名和可选端口，不要带 `/api`：

```json
{
  "apiOrigin": "https://learn.example.com"
}
```

服务端需配置：

```dotenv
ALLOW_ELECTRON_FILE_ORIGIN=true
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
```

然后执行 `npm run release:windows`。Electron 保持 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`，并通过 CSP 仅放行配置的 API 域名。

## 更新与兼容性

- 不得修改 Electron `appId`，也不得启用卸载时删除 `userData`，因此升级安装包不会清空本地账号缓存。
- 每次服务端更新先备份 PostgreSQL，再执行 `npm run server:migrate`，最后替换应用代码。
- 云端进度使用乐观版本号处理多设备并发；发生冲突时客户端合并已完成章节、学习日、实验和最新答题记录后重试。
- 首次登录账号版时，如果账号云端和账号本地缓存都为空，会把旧版未分账号的本机进度迁移到第一个登录账号，且只迁移一次。
