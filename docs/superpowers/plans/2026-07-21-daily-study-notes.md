# 每日学习记录与 AI 润色实施计划

> 日期：2026-07-21
> 设计文档：`docs/superpowers/specs/2026-07-21-daily-study-notes-design.md`

## 执行项

1. 新增 `008_study_notes.sql` 迁移，创建用户每日记录表。
2. 在账号服务中新增学习记录 CRUD API。
3. 新增前端 `studyNotesApi.ts` 与类型守卫测试。
4. 新增本地 AI 配置与直连调用模块，API Key 保存到 IndexedDB，不上传云栈服务器。
5. 新增 `DailyStudyNotesPage.vue`，包含日期列表、编辑器、润色结果、AI 供应商配置弹层。
6. 新增 `/study-notes` 路由和顶部导航入口。
7. 运行强制质量门禁。

## 状态

- 计划创建：完成
- 实现：完成
- 验证：完成
