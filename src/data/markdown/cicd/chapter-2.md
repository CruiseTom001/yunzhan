## GitHub Actions

GitHub Actions 是 GitHub 内置的 CI/CD 平台，通过 workflow 文件定义自动化流程。

### Workflow 基础结构

在 .github/workflows/ 目录下定义 YAML 文件，配置触发条件、jobs、steps 等。

### 完整的 CI/CD Workflow

从测试、安全扫描、构建镜像到部署的完整流程。

### 使用 Secrets 和 Variables

通过 GitHub Secrets 和 Variables 管理敏感信息和配置。

### 缓存与 Artifacts

使用 actions/cache 和 upload/download-artifact 优化流水线效率。

### 自定义 Action

创建 Composite Action 复用流水线步骤。