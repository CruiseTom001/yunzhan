## 代码质量与安全扫描

在 CI/CD 流程中集成代码质量检查和安全扫描是 DevSecOps 的核心实践。

### SonarQube 集成

SonarQube 是一个开源的代码质量和安全分析平台。

### Trivy 容器镜像扫描

扫描 Docker 镜像中的安全漏洞。

### GitLeaks 敏感信息检测

检测代码仓库中意外提交的密钥和凭证。

### ESLint / Prettier 代码规范

在 CI 中强制执行代码格式规范。

### 安全扫描工具对比

| 工具 | 类型 | 扫描对象 |
|------|------|----------|
| SonarQube | SAST | 源代码 |
| Trivy | 容器扫描 | 镜像、文件系统 |
| Snyk | SCA | 依赖、镜像 |
| GitLeaks | 密钥检测 | Git 历史 |
| OWASP ZAP | DAST | 运行中的应用 |