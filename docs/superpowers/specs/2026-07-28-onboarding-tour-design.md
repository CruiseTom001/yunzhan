# 新手教程 / 首次登录引导

## 目标

- 新注册用户首次登录后自动进入 9 步功能导览
- 老用户迁移为 `completed`，不强制弹出
- 后端持久化 + 前端本地缓存兜底
- 账号设置与首页可手动重放

## 关键文件

- `server/migrations/011_user_onboarding.sql`
- `server/onboarding.mjs`
- `src/stores/onboarding.ts`
- `src/components/onboarding/OnboardingTour.vue`
- `src/utils/onboardingSteps.ts`

## API

- `GET /api/me/onboarding`
- `PATCH /api/me/onboarding`

## 不变量

- 不改 Electron、本地 AI Key、IPC
- 导览运行期间抑制公告弹窗
- `pending` 用户优先进入首页，不恢复 `lastRoute`
