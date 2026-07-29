# 桌面端应用内自动更新（阶段三）实施计划

> Spec: `docs/superpowers/specs/2026-07-29-desktop-auto-update-phase3-design.md`

## 任务

- [x] Task 0: 更新阶段三 design/plan 文档
- [x] Task 1: 安装 electron-updater，配置 package.json publish/artifactName
- [x] Task 2: electron/desktop-updater.cjs + 状态/错误模块 + IPC
- [x] Task 3: preload + TypeScript 类型
- [x] Task 4: 重构 desktopUpdate store + Dialog + AccountPage
- [x] Task 5: LandingPage 隐藏桌面端下载按钮
- [x] Task 6: 移除 app:openExternal 与 download-url-validation
- [x] Task 7: release-desktop.mjs + latest.yml 校验
- [ ] Task 8: 测试与质量门禁（release:windows / 双版本人工验证待完成）

## 质量门禁

```bash
npm audit --omit=dev
npm run policy:check
npm run check
npm run lint
npm run server:check
npm test
npm run build
git diff --check
npm run release:windows
```

**不要提交、推送、创建 Release、部署。**
