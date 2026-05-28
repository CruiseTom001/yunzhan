## Dockerfile 编写指南

Dockerfile 是一个文本文件，包含了一系列指令，用于构建 Docker 镜像。每一条指令在镜像中创建一个新的层。

### Dockerfile 基础指令

\`\`\`dockerfile
# FROM - 指定基础镜像（必须是第一条非注释指令）
FROM node:18-alpine

# LABEL - 添加元数据
LABEL maintainer="dev@example.com"
LABEL version="1.0"
LABEL description="Node.js application"

# RUN - 在镜像构建时执行命令
RUN apk add --no-cache python3 make g++
RUN mkdir -p /app && chown node:node /app

# COPY - 从构建上下文复制文件到镜像
COPY package.json package-lock.json ./
COPY --chown=node:node . /app

# ADD - 增强版 COPY，支持 URL 和自动解压 tar
ADD https://example.com/config.tar.gz /etc/config/
ADD app.tar.gz /app/

# USER - 切换运行用户
USER node

# WORKDIR - 设置工作目录
WORKDIR /app

# ENV - 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# ARG - 构建参数（仅在构建时可用）
ARG APP_VERSION=1.0.0

# EXPOSE - 声明容器监听的端口（信息性，不实际发布端口）
EXPOSE 3000

# VOLUME - 创建匿名数据卷挂载点
VOLUME ["/data", "/logs"]

# CMD - 容器启动时的默认命令（可被 docker run 覆盖）
CMD ["node", "server.js"]

# ENTRYPOINT - 容器启动时的入口程序
ENTRYPOINT ["docker-entrypoint.sh"]
\`\`\`

### CMD vs ENTRYPOINT 详解

这是最容易被混淆的两个指令，理解它们的区别非常重要：

| 特性 | CMD | ENTRYPOINT |
|------|-----|------------|
| 可被覆盖 | docker run 参数完全覆盖 | docker run 参数作为追加 |
| 主要用途 | 提供默认命令 | 定义容器的主程序 |
| 组合使用 | CMD 为 ENTRYPOINT 提供默认参数 | ENTRYPOINT 定义可执行程序 |

**三种形式对比：**

\`\`\`dockerfile
# Shell 形式（通过 /bin/sh -c 执行）
CMD echo "Hello World"
ENTRYPOINT /entrypoint.sh

# Exec 形式（推荐，不会启动 shell 进程）
CMD ["echo", "Hello World"]
ENTRYPOINT ["/entrypoint.sh"]

# ENTRYPOINT + CMD 组合
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
# 等价于执行: nginx -g "daemon off;"
\`\`\`

### 多阶段构建示例

\`\`\`dockerfile
# 完整的 Node.js 应用 Dockerfile

# ===== 第一阶段：构建阶段 =====
FROM node:18-alpine AS builder

WORKDIR /app

# 利用 Docker 的层缓存：先复制依赖文件
COPY package.json package-lock.json ./
RUN npm ci --only=production && \\
    cp -R node_modules /prod_node_modules

# 安装全部依赖用于构建
RUN npm ci

COPY . .
RUN npm run build

# ===== 第二阶段：生产运行阶段 =====
FROM node:18-alpine AS runner

RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

WORKDIR /app

# 只复制必要的文件
COPY --from=builder /prod_node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER nodejs

EXPOSE 3000

CMD ["node", "dist/server.js"]
\`\`\`

### 最佳实践

**1. 使用 .dockerignore 减小构建上下文**

\`\`\`
# .dockerignore
node_modules
.git
.gitignore
*.md
.env
.env.*
dist
coverage
Dockerfile
docker-compose.yml
.vscode
.idea
\`\`\`

**2. 优化层缓存**

\`\`\`dockerfile
# 不好：每次代码变更都导致 npm install 重新执行
COPY . .
RUN npm install

# 好：package.json 不变时，npm install 使用缓存
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
\`\`\`

**3. 减少镜像层数**

\`\`\`dockerfile
# 不好：多个 RUN 产生多层
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y wget
RUN rm -rf /var/lib/apt/lists/*

# 好：合并 RUN 并清理
RUN apt-get update && \\
    apt-get install -y curl wget && \\
    rm -rf /var/lib/apt/lists/*
\`\`\`

**4. 使用特定版本的基础镜像**

\`\`\`dockerfile
# 不好：latest 标签可能在不同时间指向不同版本
FROM node:latest

# 好：明确指定版本
FROM node:18.17.0-alpine3.18
\`\`\`

**5. 使用非 root 用户运行**

\`\`\`dockerfile
RUN groupadd -r appuser && useradd -r -g appuser appuser
USER appuser
CMD ["node", "server.js"]
\`\`\`

**6. 健康检查**

\`\`\`dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1
\`\`\`

### 构建命令

\`\`\`bash
# 基本构建
docker build -t myapp:latest .

# 指定 Dockerfile 路径
docker build -f Dockerfile.prod -t myapp:prod .

# 传递构建参数
docker build --build-arg APP_VERSION=2.0.0 -t myapp:v2 .

# 不使用缓存构建
docker build --no-cache -t myapp:latest .
\`\`