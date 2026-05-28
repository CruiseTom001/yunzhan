## 私有镜像仓库搭建（Harbor）

Harbor 是一个企业级的 Docker Registry 管理项目，由 VMware 开源。它提供了镜像存储、签名、扫描、复制等功能。

### Harbor 架构

\`\`\`
                    ┌─────────────┐
                    │   用户/CI   │
                    └──────┬──────┘
                           │ HTTPS / 443
                    ┌──────▼──────┐
                    │  Nginx (反向代理) │
                    └──────┬──────┘
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
   │    Core     │  │  Registry   │  │ Job Service │
   │  (API/UI)   │  │    (镜像存储) │  │  (扫描/复制) │
   └──────┬──────┘  └─────────────┘  └─────────────┘
          │
   ┌──────▼──────┐
   │  PostgreSQL │
   └─────────────┘
\`\`\`

### Harbor 安装

**环境要求：**
- Docker Engine 20.10+
- Docker Compose v2.0+
- 内存 ≥ 4GB
- 磁盘 ≥ 40GB

\`\`\`bash
# 下载 Harbor 离线安装包
HARBOR_VERSION=2.9.0
wget https://github.com/goharbor/harbor/releases/download/v\${HARBOR_VERSION}/harbor-offline-installer-v\${HARBOR_VERSION}.tgz

# 解压
tar xzf harbor-offline-installer-v\${HARBOR_VERSION}.tgz
cd harbor

# 复制并编辑配置文件
cp harbor.yml.tmpl harbor.yml
vim harbor.yml
\`\`\`

**harbor.yml 配置文件：**

\`\`\`yaml
hostname: harbor.example.com

# HTTP 配置
http:
  port: 80

# HTTPS 配置（生产环境必须）
https:
  port: 443
  certificate: /etc/ssl/certs/harbor.crt
  private_key: /etc/ssl/keys/harbor.key

# Harbor 管理员密码
harbor_admin_password: Harbor12345

# 数据库密码
database:
  password: root123
  max_idle_conns: 100
  max_open_conns: 900

# 数据存储路径
data_volume: /data/harbor

# 日志配置
log:
  level: info
  local:
    rotate_count: 50
    rotate_size: 200M
    location: /var/log/harbor

# 镜像垃圾回收
trivy:
  ignore_unfixed: false
  skip_update: false
  offline_scan: false
  insecure: false
\`\`\`

\`\`\`bash
# 准备安装脚本
sudo ./prepare

# 安装并启动 Harbor
sudo ./install.sh

# 带安全扫描器的安装
sudo ./install.sh --with-trivy

# 带镜像复制的安装
sudo ./install.sh --with-trivy --with-chartmuseum
\`\`\`

### Harbor 常用管理命令

\`\`\`bash
# 启动 Harbor
cd /opt/harbor
docker compose up -d

# 停止 Harbor
docker compose stop

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f

# 重启 Harbor
docker compose restart

# 升级 Harbor
# 1. 停止旧版本
docker compose down
# 2. 备份数据
cp -r /data/harbor /data/harbor-backup
# 3. 下载新版本并解压
# 4. 复制原有 harbor.yml
cp /opt/harbor/harbor.yml /tmp/new-harbor/
# 5. 执行升级
./prepare
docker compose up -d
\`\`\`

### Harbor 项目使用

\`\`\`bash
# Docker 登录 Harbor
docker login harbor.example.com -u admin -p Harbor12345

# 创建项目
# 方法1：Web UI 上创建
# 方法2：API 创建
curl -u "admin:Harbor12345" \\
  -X POST "https://harbor.example.com/api/v2.0/projects" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_name": "my-project",
    "public": false
  }'

# 给镜像打标签
docker tag myapp:1.0 harbor.example.com/my-project/myapp:1.0

# 推送镜像
docker push harbor.example.com/my-project/myapp:1.0

# 拉取镜像
docker pull harbor.example.com/my-project/myapp:1.0
\`\`\`

### 配置 Docker 信任 Harbor

\`\`\`bash
# 方式1：配置 daemon.json（推荐）
sudo tee /etc/docker/daemon.json <<EOF
{
  "insecure-registries": ["harbor.example.com"],
  "registry-mirrors": ["https://harbor.example.com"]
}
EOF

sudo systemctl restart docker

# 方式2：使用可信证书
# 将 Harbor 的 CA 证书复制到 Docker 信任目录
sudo mkdir -p /etc/docker/certs.d/harbor.example.com
sudo cp ca.crt /etc/docker/certs.d/harbor.example.com/
sudo systemctl restart docker
\`\`\`

### Harbor 垃圾回收

\`\`\`bash
# 手动触发垃圾回收
# 1. 通过 UI：Administration > Garbage Collection
# 2. 通过 API：
curl -u "admin:Harbor12345" \\
  -X POST "https://harbor.example.com/api/v2.0/system/gc/schedule" \\
  -H "Content-Type: application/json" \\
  -d '{
    "schedule": {
      "type": "Weekly",
      "cron": "0 0 0 * * 0"
    }
  }'

# 设置 GC 保留策略
curl -u "admin:Harbor12345" \\
  -X PUT "https://harbor.example.com/api/v2.0/retentions/1" \\
  -H "Content-Type: application/json" \\
  -d '{
    "algorithm": "or",
    "rules": [
      {
        "disabled": false,
        "action": "retain",
        "template": "always",
        "params": {}
      },
      {
        "disabled": false,
        "action": "retain",
        "template": "latestPushedK",
        "params": {"latestPushedK": 10}
      }
    ],
    "scope": {
      "level": "project",
      "ref": 1
    }
  }'
\`\`\`

### Harbor 安全策略

\`\`\`bash
# 配置镜像代理缓存
# 在 Harbor 中创建代理缓存项目，加速公共镜像拉取

# 配置内容信任（Content Trust）
export DOCKER_CONTENT_TRUST=1
export DOCKER_CONTENT_TRUST_SERVER=https://harbor.example.com:4443

# 推送签名镜像
docker trust sign harbor.example.com/my-project/myapp:1.0

# 拉取签名镜像（自动验证）
docker pull harbor.example.com/my-project/myapp:1.0
\`\`\`

### CI/CD 集成

\`\`\`yaml
# GitLab CI 集成示例
docker-build:
  stage: build
  script:
    - docker login -u $HARBOR_USER -p $HARBOR_PASSWORD harbor.example.com
    - docker build -t harbor.example.com/$CI_PROJECT_NAME:$CI_COMMIT_SHORT_SHA .
    - docker push harbor.example.com/$CI_PROJECT_NAME:$CI_COMMIT_SHORT_SHA
    - docker tag harbor.example.com/$CI_PROJECT_NAME:$CI_COMMIT_SHORT_SHA harbor.example.com/$CI_PROJECT_NAME:latest
    - docker push harbor.example.com/$CI_PROJECT_NAME:latest
\`\`\`

### 最佳实践总结

1. **开启 HTTPS**：生产环境务必配置 TLS 证书
2. **定期备份**：备份配置文件和数据库（PostgreSQL）
3. **配置垃圾回收**：定期清理未使用的镜像层
4. **访问控制**：使用项目和角色进行精细的权限管理
5. **镜像扫描**：启用 Trivy 自动扫描上传的镜像
6. **复制策略**：多数据中心场景下使用镜像复制功能
7. **监控**：集成 Prometheus 监控 Harbor 运行状态