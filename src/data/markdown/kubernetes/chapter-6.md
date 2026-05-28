## Helm 包管理

Helm 是 Kubernetes 的包管理器，类似于 apt/yum/npm。

### 核心概念

| 概念 | 说明 | 类比 |
|------|------|------|
| Chart | 打包的 K8s 资源集合 | npm 包 |
| Repository | Chart 仓库 | npm registry |
| Release | Chart 在集群中的运行实例 | 安装的软件包 |
| Values | Chart 的配置参数 | 配置项 |
| Template | Go Template 语法的 K8s 清单模板 | 模板文件 |

### 常用 Helm 命令

\`\`\`bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install my-release bitnami/nginx
helm upgrade my-release bitnami/nginx -f values-prod.yaml
helm rollback my-release
helm uninstall my-release
helm list
\`\`\`

### 多环境部署

通过不同的 values 文件实现多环境配置管理。