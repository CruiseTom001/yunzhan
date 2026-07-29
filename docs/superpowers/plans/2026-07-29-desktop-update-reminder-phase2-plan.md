# 桌面端版本更新提醒（阶段二）实施计划

> Spec: `docs/superpowers/specs/2026-07-29-desktop-update-reminder-phase2-design.md`

## 任务

- [x] Task 1: 更新阶段二设计文档
- [x] Task 2: `desktopDownloadUrl.ts` + `desktopUpdateCheck.ts` 暂缓/错误映射
- [x] Task 3: `src/stores/desktopUpdate.ts` + 测试
- [x] Task 4: `DesktopUpdateDialog.vue` + 重构 `UpdateBanner.vue`
- [x] Task 5: `AccountPage.vue` 桌面端与更新卡片
- [x] Task 6: `app:openExternal` IPC + `electron/download-url-validation.cjs`
- [x] Task 7: 测试与质量门禁
- [x] Task 8: 审查修复（落地页初始化、新手教程互斥、调度漂移、IPC 下载、定时器与弹窗测试）

## Task 2 文件

- `src/utils/desktopDownloadUrl.ts`
- `src/utils/desktopDownloadUrl.test.ts`
- `src/utils/desktopUpdateSchedule.ts` + test
- `src/utils/desktopUpdateDialogBehavior.ts` + test
- Modify `src/utils/desktopUpdateCheck.ts` + test

## Task 3 文件

- `src/stores/desktopUpdate.ts`
- `src/stores/desktopUpdate.test.ts`
- Modify `src/stores/onboarding.ts`（`blocksDesktopUpdateDialog`）

## Task 4 文件

- `src/components/common/DesktopUpdateDialog.vue`
- `src/components/common/UpdateBanner.vue`
- Modify `src/App.vue`（`UpdateBanner` 移出 `hideChrome` 条件）

## Task 6 文件

- `electron/download-url-validation.cjs`
- `electron/download-url-validation.test.mjs`
- Modify `electron/main.cjs`, `electron/preload.cjs`, `src/vite-env.d.ts`

## 质量门禁

```bash
npm run policy:check
npm run check
npm run lint
npm run server:check
npm test
npm run build
git diff --check
```
