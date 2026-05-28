## ConfigMap 与 Secret 管理

ConfigMap 和 Secret 是 Kubernetes 中用于管理配置数据的资源对象。

### ConfigMap

支持三种使用方式：环境变量、envFrom 批量导入、作为卷挂载。

ConfigMap 热更新：作为卷挂载时，Kubernetes 会自动更新文件（约 1 分钟延迟）。

### Secret 类型

| 类型 | 用途 |
|------|------|
| Opaque | 通用 Secret（默认） |
| kubernetes.io/tls | TLS 证书 |
| kubernetes.io/dockerconfigjson | Docker Registry 认证 |
| kubernetes.io/basic-auth | 基本认证 |
| kubernetes.io/ssh-auth | SSH 认证 |

### 安全管理最佳实践

- Sealed Secrets：加密存储
- External Secrets Operator：从外部密钥管理系统同步
- RBAC 权限控制
- 审计与扫描