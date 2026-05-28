## 5.1 数据库自动备份脚本

创建 `scripts/backup.sh`：

```bash
#!/bin/bash
# 数据库自动备份脚本
# 配合 crontab: 0 2 * * * /opt/scripts/backup.sh

set -e

BACKUP_DIR="/opt/backups/mysql"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="mysql"
DB_NAME="wordpress"
DB_USER="wpuser"
DB_PASS="WpP@ssw0rd2024!"

mkdir -p "$BACKUP_DIR"

# 备份数据库
docker exec $CONTAINER mysqldump \
  -u$DB_USER -p$DB_PASS \
  --single-transaction --routines --triggers \
  $DB_NAME | gzip > "$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"

# 清理旧备份
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup completed: ${DB_NAME}_${DATE}.sql.gz" >> /var/log/backup.log
```

授予执行权限：`chmod +x scripts/backup.sh`

## 5.2 健康检查脚本

创建 `scripts/healthcheck.sh`：

```bash
#!/bin/bash
# 服务健康检查脚本

check_url() {
    local url=$1
    local name=$2
    local code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url")
    if [ "$code" = "200" ]; then
        echo "✅ $name: OK ($code)"
        return 0
    else
        echo "❌ $name: FAILED ($code)"
        return 1
    fi
}

# 检查各服务
check_url "http://localhost" "WordPress"
check_url "http://localhost:3000" "Grafana"
check_url "http://localhost:9090" "Prometheus"
check_url "http://localhost:9100/metrics" "Node Exporter"

# Docker 容器状态
echo ""
echo "=== Container Status ==="
docker compose ps
```

## 5.3 一键部署脚本

创建 `deploy.sh`：

```bash
#!/bin/bash
# 一键部署 DevOps 平台

set -e

echo "=== DevOps 平台部署开始 ==="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 请先安装 Docker"
    exit 1
fi

# 创建必要的目录
mkdir -p nginx/{conf.d,ssl}
mkdir -p prometheus/alerts
mkdir -p grafana/dashboards
mkdir -p scripts
mkdir -p www

# 生成默认首页
cat > www/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>DevOps Platform</title></head>
<body>
<h1>🚀 DevOps Platform Running</h1>
<ul>
<li><a href="/">WordPress Blog</a></li>
<li><a href="http://localhost:3000">Grafana Monitor</a></li>
<li><a href="http://localhost:9090">Prometheus Metrics</a></li>
</ul>
</body>
</html>
EOF

# 设置脚本权限
chmod +x scripts/*.sh

# 启动所有服务
docker compose up -d

# 等待服务就绪
echo "Waiting for services..."
sleep 15

# 运行健康检查
./scripts/healthcheck.sh

echo ""
echo "=== 部署完成 ==="
echo "WordPress: http://localhost"
echo "Grafana:   http://localhost:3000"
echo "Prometheus: http://localhost:9090"
```

## 5.4 配置定时任务

```bash
# 编辑 crontab
crontab -e

# 添加以下任务
# 每天凌晨 2:00 自动备份数据库
0 2 * * * /opt/scripts/backup.sh >> /var/log/cron_backup.log 2>&1

# 每 30 分钟执行健康检查
*/30 * * * * /opt/scripts/healthcheck.sh >> /var/log/healthcheck.log 2>&1

# 每周日凌晨 3:00 清理 Docker 日志
0 3 * * 0 docker system prune -af --volumes >> /var/log/docker_cleanup.log 2>&1
```

## 5.5 日志收集方案

```bash
# 查看所有容器日志
docker compose logs -f --tail=50

# 查看特定服务
docker compose logs -f nginx
docker compose logs -f mysql

# 日志轮转配置 (/etc/logrotate.d/nginx)
cat > /etc/logrotate.d/nginx << EOF
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 nginx adm
    sharedscripts
    postrotate
        docker exec nginx nginx -s reopen > /dev/null 2>&1
    endscript
}
EOF
```
