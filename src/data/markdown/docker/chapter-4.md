## Docker Compose 编排

Docker Compose 是一个用于定义和运行多容器 Docker 应用的工具。通过一个 YAML 文件（通常命名为 \`docker-compose.yml\`），你可以配置应用的所有服务，然后通过一条命令创建并启动所有服务。

### Compose 文件结构

\`\`\`yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - .:/app
    environment:
      - NODE_ENV=development

networks:
  app-network:
    driver: bridge

volumes:
  db-data:

configs:
  nginx-config:
    file: ./nginx.conf

secrets:
  db-password:
    file: ./db_password.txt
\`\`\`

### 完整的 Web 应用示例

\`\`\`yaml
version: '3.8'

services:
  # Nginx 反向代理
  nginx:
    image: nginx:1.25-alpine
    container_name: app-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - static-data:/usr/share/nginx/html/static
    depends_on:
      - backend
    networks:
      - frontend
    restart: unless-stopped

  # 后端应用
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        - NODE_ENV=production
    container_name: app-backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://user:pass@db:5432/appdb
      - REDIS_URL=redis://redis:6379
    env_file:
      - ./backend/.env.production
    volumes:
      - static-data:/app/static
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - frontend
      - backend
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 512M

  # 数据库
  db:
    image: postgres:15-alpine
    container_name: app-db
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=appdb
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d appdb"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: app-redis
    command: redis-server --appendonly yes --requirepass redispass
    volumes:
      - redis-data:/data
    networks:
      - backend
    restart: unless-stopped

  # 定时任务
  worker:
    build: ./backend
    container_name: app-worker
    command: node worker.js
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://user:pass@db:5432/appdb
      - REDIS_URL=redis://:redispass@redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - backend
    restart: unless-stopped

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge

volumes:
  postgres-data:
    driver: local
  redis-data:
    driver: local
  static-data:
    driver: local
\`\`\`

### 常用 Compose 命令

\`\`\`bash
# 启动所有服务（前台）
docker compose up

# 启动所有服务（后台）
docker compose up -d

# 重新构建并启动
docker compose up --build -d

# 指定项目名称
docker compose -p myproject up -d

# 纵向扩展服务
docker compose up -d --scale backend=3

# 查看服务状态
docker compose ps

# 查看服务日志
docker compose logs
docker compose logs -f backend
docker compose logs --tail 100 nginx

# 停止服务
docker compose stop

# 停止并删除容器和网络
docker compose down

# 停止并删除容器、网络和数据卷
docker compose down -v

# 删除所有（包括镜像）
docker compose down -v --rmi all

# 重启单个服务
docker compose restart backend

# 执行命令
docker compose exec backend bash
docker compose exec db psql -U user -d appdb

# 查看资源使用
docker compose top

# 拉取最新镜像
docker compose pull

# 构建或重新构建服务
docker compose build
docker compose build --no-cache backend
\`\`\`

### 环境变量管理

\`\`\`yaml
# docker-compose.yml
services:
  app:
    image: myapp:latest
    environment:
      - NODE_ENV=production
      - API_KEY=\${API_KEY}
    env_file:
      - .env
      - .env.production
\`\`\`

\`\`\`
# .env 文件
API_KEY=your-secret-key
DB_PASSWORD=SecurePass123

# .env.production 文件
API_URL=https://api.example.com
LOG_LEVEL=info
\`\`\`

### depends_on 与健康检查

\`\`\`yaml
services:
  app:
    depends_on:
      db:
        condition: service_healthy    # 等待 DB 健康检查通过
      redis:
        condition: service_started    # 等待 Redis 启动（默认）
      cache:
        condition: service_completed_successfully  # 等待启动脚本执行成功

  db:
    image: postgres:15
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s
\`\`\`

### Compose Profiles（按场景启动）

\`\`\`yaml
services:
  app:
    image: myapp
    profiles: ["core", "all"]

  redis:
    image: redis:7-alpine
    profiles: ["cache", "all"]

  worker:
    image: myapp-worker
    profiles: ["worker", "all"]

  debug-tools:
    image: busybox
    profiles: ["debug"]
\`\`\`

\`\`\`bash
# 只启动核心服务
docker compose --profile core up -d

# 启动所有服务
docker compose --profile all up -d

# 启动多个 profile
docker compose --profile core --profile debug up -d
\`\`\`

### 配置 Secrets

\`\`\`yaml
version: '3.8'

services:
  db:
    image: postgres:15
    secrets:
      - db-password
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/db-password

secrets:
  db-password:
    file: ./secrets/db_password.txt
\`\`\`

\`\`\`bash
# 创建 secret 文件
mkdir -p secrets
echo "SuperSecretPassword" > secrets/db_password.txt
chmod 600 secrets/db_password.txt
\`\`\`

### 常见问题排查

\`\`\`bash
# 验证 Compose 文件语法
docker compose config

# 仅验证，不输出配置
docker compose config --quiet

# 查看完整配置（含变量替换）
docker compose config --environment
\`\`