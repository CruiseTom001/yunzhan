## 2.1 Docker 环境准备

### 安装 Docker
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# CentOS/RHEL
sudo yum install -y docker-ce docker-ce-cli containerd.io

# 启动并设置开机自启
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
docker compose version
```

### 项目目录创建
```bash
mkdir -p ~/devops-platform/{nginx/{conf.d,ssl},prometheus,grafana/dashboards,scripts,www}
cd ~/devops-platform
```

## 2.2 Docker Compose 编排文件

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  # ===== Nginx 反向代理 =====
  nginx:
    image: nginx:alpine
    container_name: nginx-proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./www:/var/www/html:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - wordpress
      - grafana
    networks:
      - frontend

  # ===== WordPress + MySQL =====
  wordpress:
    image: wordpress:php8.2-fpm-alpine
    container_name: wordpress
    restart: always
    environment:
      WORDPRESS_DB_HOST: mysql
      WORDPRESS_DB_USER: ${DB_USER}
      WORDPRESS_DB_PASSWORD: ${DB_PASSWORD}
      WORDPRESS_DB_NAME: ${DB_NAME}
    volumes:
      - wordpress_data:/var/www/html
    depends_on:
      - mysql
    networks:
      - frontend
      - backend

  mysql:
    image: mysql:8.0
    container_name: mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    command: --default-authentication-plugin=mysql_native_password
    networks:
      - backend

  # ===== Redis 缓存 =====
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - backend

  # ===== Prometheus 监控 =====
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: always
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    ports:
      - "9090:9090"
    networks:
      - backend

  # ===== Grafana 可视化 =====
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: always
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_USER}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    networks:
      - backend

  # ===== Node Exporter 主机监控 =====
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: always
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
    networks:
      - backend

  # ===== MySQL Exporter 数据库监控 =====
  mysql-exporter:
    image: prom/mysqld-exporter:latest
    container_name: mysql-exporter
    restart: always
    environment:
      DATA_SOURCE_NAME: "${DB_USER}:${DB_PASSWORD}@(mysql:3306)/${DB_NAME}"
    depends_on:
      - mysql
    networks:
      - backend

volumes:
  nginx_logs:
  wordpress_data:
  mysql_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
```

### 环境变量 `.env`

```bash
# MySQL
MYSQL_ROOT_PASSWORD=RootP@ssw0rd2024!
DB_NAME=wordpress
DB_USER=wpuser
DB_PASSWORD=WpP@ssw0rd2024!

# Redis 
REDIS_PASSWORD=RedisP@ss2024!

# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=GrafanaP@ss2024!
```
