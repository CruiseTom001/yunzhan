# 云栈

云栈是基于 Vue 3、TypeScript、Pinia、Vite 和 Electron 的运维学习应用。账号版使用 PostgreSQL 保存用户、会话与学习进度，支持 Resend 邮箱验证码注册，网页端和桌面端共用同一套云端账号。

## 本地开发

1. 安装依赖：`npm install`
2. 根据 `.env.example` 创建本机 `.env`，设置强数据库密码和 `DATABASE_URL`。
3. 启动 PostgreSQL：`docker compose up -d postgres`
4. 初始化数据库：`npm run server:migrate`
5. 通过临时环境变量设置首个超管密码，然后运行 `npm run server:create-admin`。
6. 在两个终端分别运行 `npm run server:dev` 和 `npm run dev`。
7. 访问 `http://127.0.0.1:5173`，使用刚创建的超管账号登录。

完整的安全配置、生产部署和桌面端接入方法见 [账号部署文档](docs/ACCOUNT_DEPLOYMENT.md)。

## 质量门禁

```powershell
npm run policy:check
npm run check
npm run lint
npm run server:check
npm test
npm run build
git diff --check
```

修改依赖后还需要运行 `npm audit --omit=dev`。
