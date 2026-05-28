## Terraform 状态管理

Terraform 状态文件（terraform.tfstate）是基础设施的真实记录。

### 本地状态 vs 远程状态

| 特性 | 本地状态 | 远程状态 |
|------|----------|----------|
| 团队协作 | 不支持 | 支持 |
| 状态锁 | 不支持 | 支持 |
| 安全性 | 低 | 高 |
| 版本控制 | 不支持 | 支持 |

### 远程 Backend 配置

- S3 + DynamoDB（AWS）
- Azure Storage
- GCS（Google Cloud）
- Terraform Cloud

### 多环境状态管理

- 方式1：Workspace（工作空间）
- 方式2：目录结构（推荐）

### 状态管理最佳实践

1. 永远使用远程 Backend
2. 启用状态锁
3. 加密状态文件
4. 启用版本控制