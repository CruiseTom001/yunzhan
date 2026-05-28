## Terraform 基础

Terraform 是 HashiCorp 开发的开源基础设施即代码（IaC）工具，使用声明式语言 HCL 定义和管理云资源。

### 核心概念

| 概念 | 说明 |
|------|------|
| Provider | 云服务提供商插件 |
| Resource | 基础设施资源 |
| Data Source | 只读数据查询 |
| Module | 可复用的资源配置集合 |
| State | 基础设施状态文件 |
| Backend | 状态文件的存储位置 |

### Terraform 工作流

terraform init → terraform plan → terraform apply
terraform destroy / fmt / validate

### HCL 语法基础

支持 string、number、bool、list、map、object 等数据类型，以及 locals 局部变量。