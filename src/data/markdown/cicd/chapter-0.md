## CI/CD 概念与流程

### 什么是 CI/CD

CI/CD 是持续集成（Continuous Integration）、持续交付（Continuous Delivery）和持续部署（Continuous Deployment）的缩写，是现代软件开发的核心实践。

### 持续集成（CI）

持续集成强调频繁地将代码变更合并到主干分支，每次合并自动触发构建和测试。

- 每天多次提交代码到共享仓库
- 每次提交触发自动化构建
- 自动化测试套件（单元测试、集成测试）
- 构建失败立即通知开发者

### 持续交付（CD）

持续交付在 CI 的基础上，确保代码始终处于可部署状态，但部署到生产环境需要手动触发。

### 持续部署（CD）

持续部署是持续交付的延伸，通过 CI 的变更会自动部署到生产环境。

### CI/CD 工具对比

| 工具 | 类型 | 特点 |
|------|------|------|
| GitHub Actions | SaaS | 深度集成 GitHub |
| GitLab CI | 自托管/SaaS | 一体化 DevOps |
| Jenkins | 自托管 | 高度灵活、插件丰富 |
| ArgoCD | GitOps | K8s 原生部署 |
| Tekton | K8s 原生 | 云原生 CI/CD |