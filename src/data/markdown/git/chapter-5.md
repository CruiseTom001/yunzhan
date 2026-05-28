## 6.1 配置管理

Git 是基础设施配置管理的核心工具，所有配置文件都应纳入版本控制。

### 配置文件版本控制

\`\`\`bash
# 初始化配置仓库
mkdir /etc/myapp-config && cd /etc/myapp-config
git init
git add .
git commit -m "init: initial config files"

# 日常配置变更
vim nginx.conf
git diff                     # 检查变更
git add nginx.conf
git commit -m "fix: increase worker_connections"

# 查看配置变更历史
git log --oneline nginx.conf
git diff HEAD~1 nginx.conf   # 与上次版本对比

# 回滚配置
git checkout HEAD~1 -- nginx.conf   # 恢复到上一个版本
systemctl reload nginx              # 重载服务
\`\`\`

### /etc 目录版本控制（etckeeper）

\`\`\`bash
# etckeeper 自动将 /etc 纳入 Git 管理
sudo apt install etckeeper    # Debian/Ubuntu
sudo yum install etckeeper    # RHEL/CentOS

# 初始化
sudo etckeeper init

# 自动提交（每次包管理器操作后）
# etckeeper 会在 apt/yum 操作前后自动 commit

# 手动提交
cd /etc
sudo git commit -m "manual: update sshd config"

# 查看变更
sudo git log --oneline
sudo git diff HEAD~1
\`\`\`

## 6.2 Infrastructure as Code（IaC）

IaC 将基础设施的定义和配置用代码描述，并通过 Git 管理。

### IaC 工具与 Git 的结合

| 工具 | 用途 | Git 作用 |
|------|------|----------|
| Ansible | 配置管理 | Playbook 版本控制 |
| Terraform | 基础设施编排 | State 文件和代码版本控制 |
| Docker | 容器化 | Dockerfile 版本控制 |
| Kubernetes | 容器编排 | YAML 清单版本控制 |
| Helm | K8s 包管理 | Chart 版本控制 |

### Terraform + Git 示例

\`\`\`bash
# Terraform 项目结构
terraform/
├── .gitignore               # 忽略 .terraform/ 和 *.tfstate
├── main.tf                  # 主配置
├── variables.tf             # 变量定义
├── outputs.tf               # 输出定义
├── environments/
│   ├── dev.tfvars           # 开发环境变量
│   ├── staging.tfvars       # 预发布环境变量
│   └── prod.tfvars          # 生产环境变量
└── modules/                 # 可复用模块
    ├── vpc/
    └── ec2/

# .gitignore 关键内容
.terraform/
*.tfstate
*.tfstate.backup
*.tfvars   # 如果包含敏感信息
\`\`\`

### Ansible + Git 示例

\`\`\`bash
# Ansible 项目结构
ansible/
├── inventory/
│   ├── hosts.yml            # 主机清单
│   ├── group_vars/
│   │   └── webservers.yml   # 组变量
│   └── host_vars/
│       └── web01.yml        # 主机变量
├── playbooks/
│   ├── site.yml             # 主 Playbook
│   ├── webserver.yml
│   └── database.yml
├── roles/
│   ├── nginx/
│   └── mysql/
└── ansible.cfg
\`\`\`

## 6.3 CI/CD 集成

Git 是 CI/CD 流水线的触发器和代码来源。

### Git 触发 CI/CD 的方式

\`\`\`
代码推送 → Webhook → CI/CD 系统触发 → 构建 → 测试 → 部署
\`\`\`

### GitLab CI 示例

\`\`\`yaml
# .gitlab-ci.yml
stages:
  - lint
  - test
  - deploy

lint:
  stage: lint
  script:
    - ansible-playbook --syntax-check playbooks/site.yml
  only:
    - merge_requests

test:
  stage: test
  script:
    - ansible-playbook playbooks/site.yml --check
  only:
    - main

deploy:
  stage: deploy
  script:
    - ansible-playbook playbooks/site.yml
  only:
    - main
  when: manual
\`\`\`

### GitHub Actions 示例

\`\`\`yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to server
        run: |
          ssh user@server "cd /app && git pull && docker-compose up -d"
\`\`\`

## 6.4 Git 钩子（Hooks）

Git 钩子是在特定事件发生时自动执行的脚本。

### 常用钩子

| 钩子 | 触发时机 | 用途 |
|------|----------|------|
| pre-commit | git commit 前 | 代码格式检查、lint |
| commit-msg | 编辑提交信息后 | 提交信息格式校验 |
| pre-push | git push 前 | 运行测试 |
| post-merge | git merge 后 | 自动安装依赖 |
| post-receive | 远程收到推送后 | 自动部署 |

### pre-commit 钩子示例

\`\`\`bash
#!/bin/bash
# .git/hooks/pre-commit

# 检查 YAML 语法
for file in $(git diff --cached --name-only | grep '\\.ya?ml$'); do
    python -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo "YAML syntax error in $file"
        exit 1
    fi
done

# 检查是否有调试代码
if git diff --cached | grep -q "debugger\\|console.log\\|pdb.set_trace"; then
    echo "Found debug code, please remove before commit"
    exit 1
fi

exit 0
\`\`\`

### 使用 pre-commit 框架

\`\`\`bash
# 安装 pre-commit 框架
pip install pre-commit

# 创建配置文件 .pre-commit-config.yaml
# repos:
#   - repo: https://github.com/ansible/ansible-lint
#     rev: v6.20.0
#     hooks:
#       - id: ansible-lint

# 安装钩子
pre-commit install

# 手动运行所有钩子
pre-commit run --all-files
\`\`\`

## 6.5 Git 在运维中的最佳实践

### 仓库组织

\`\`\`bash
# 推荐的仓库组织方式
# 方式1：按项目/应用分仓库
app-frontend/      # 前端代码
app-backend/       # 后端代码
infra-terraform/   # 基础设施代码
infra-ansible/     # 配置管理代码

# 方式2：Mono-repo（适合小团队）
infra/
├── terraform/
├── ansible/
├── docker/
└── scripts/
\`\`\`

### 运维场景的 Git 工作流

\`\`\`bash
# 1. 修改配置前先创建分支
git checkout -b config/update-nginx-timeout

# 2. 修改并测试
vim playbooks/roles/nginx/defaults/main.yml
ansible-playbook playbooks/site.yml --check

# 3. 提交并推送
git add .
git commit -m "config: increase nginx proxy_read_timeout to 300s"
git push -u origin config/update-nginx-timeout

# 4. 创建 PR，团队 Review
# 5. Review 通过后合并
# 6. 自动部署或手动执行
\`\`\`

### 敏感信息管理

\`\`\`bash
# 绝对不要提交到 Git 的文件
# - 密码、API Key、Token
# - SSL 私钥
# - 数据库连接字符串
# - .env 文件

# 使用 .gitignore 排除
echo "*.key" >> .gitignore
echo "*.pem" >> .gitignore
echo ".env" >> .gitignore
echo "secrets/" >> .gitignore

# 使用加密工具管理敏感配置
# Ansible Vault
ansible-vault encrypt secrets.yml
ansible-vault edit secrets.yml

# HashiCorp Vault
# SOPS (Secrets OPerationS)
\`\`\`

### Git 审计与合规

\`\`\`bash
# 查看谁在什么时候修改了什么
git log --format="%H %an %ad %s" --date=short

# 查看某个文件的完整修改历史
git log --follow -p -- path/to/config

# 查看某次部署对应的提交
git tag -l "deploy-*"
git log --oneline deploy-2024-01-15..deploy-2024-01-16

# 生成变更报告
git diff v1.0.0..v1.1.0 --stat
\`\`\`