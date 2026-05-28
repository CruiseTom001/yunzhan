## 云服务管理

### 核心服务速览（阿里云/AWS）

| 服务 | 阿里云 | AWS |
|------|--------|-----|
| 虚拟机 | ECS | EC2 |
| 托管数据库 | RDS | RDS |
| 负载均衡 | SLB | ELB/ALB |
| 虚拟网络 | VPC | VPC |
| 对象存储 | OSS | S3 |
| 容器服务 | ACK | EKS |

### VPC 网络规划

公网流量 → SLB → ECS（Private Subnet）→ NAT Gateway → 公网

### Terraform 基础设施即代码

使用 Terraform 管理阿里云/AWS 资源。

### 云资源 Tag 管理规范

强制标签：Environment, Service, Owner, CostCenter