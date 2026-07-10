# 云栈桌面版发布流程

## 生成 Windows 安装包

```powershell
npm ci
npm run release:windows
```

安装包会生成到 `release/云栈-Setup-<version>.exe`。
Windows 图标由发布命令根据 `public/favicon.svg` 自动生成。

## 更新规则

1. 修改 `package.json` 与 `package-lock.json` 中的版本号。
2. 运行 `npm run release:windows`，确保类型检查、ESLint 和生产构建全部通过。
3. 将新的 Setup 文件发给用户，直接覆盖安装即可。

应用标识 `com.yunzhan.app` 与产品名保持不变，学习进度位于 Electron `userData` 目录。NSIS 配置设置了 `deleteAppDataOnUninstall: false`，因此覆盖安装不会清空进度。发布前仍建议在“学习进度”页面导出一份 JSON 备份。
