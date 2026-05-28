## 基础设施即代码实战案例

### 高可用 Web 应用架构

使用 Terraform + Ansible 构建包含 VPC、EC2、RDS、ALB 的完整基础设施。

### 项目结构

terraform/
├── modules/（vpc, ec2, rds, alb）
├── ansible/（site.yml, roles/）
└── environments/（staging, production）

### CI/CD 集成

使用 GitLab CI 或 GitHub Actions 自动化执行 Terraform Plan/Apply。

### 关键检查清单

- 状态文件存储在加密的远程 Backend
- 启用了状态锁定
- 敏感变量标记为 sensitive
- 数据库启用 deletion_protection
- 安全组遵循最小权限原则