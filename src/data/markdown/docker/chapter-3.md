## 多阶段构建与镜像优化

### 为什么需要多阶段构建

在构建应用时，通常需要编译工具和开发依赖，但这些在生产环境中是不需要的。如果不进行优化，会导致镜像体积过大，包含不必要的工具和依赖。

**传统方式的问题：**

\`\`\`dockerfile
FROM golang:1.20
WORKDIR /app
COPY . .
RUN go build -o myapp .
CMD ["./myapp"]
# 最终镜像 ~900MB（包含整个 Go 工具链）
\`\`\`

**使用多阶段构建：**

\`\`\`dockerfile
# 构建阶段
FROM golang:1.20 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o myapp .

# 运行阶段
FROM alpine:3.18
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/myapp /usr/local/bin/
CMD ["myapp"]
# 最终镜像 ~15MB
\`\`\`

### Go 应用多阶段构建完整示例

\`\`\`dockerfile
FROM golang:1.20-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \\
    go build \\
    -ldflags="-w -s" \\
    -o /app/bin/server \\
    ./cmd/server

FROM scratch

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/bin/server /server

EXPOSE 8080

USER 1001

ENTRYPOINT ["/server"]
\`\`\`

### 前端应用多阶段构建

\`\`\`dockerfile
# 构建阶段
FROM node:18-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# 运行阶段 - 使用 Nginx
FROM nginx:1.25-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
\`\`\`

### 镜像优化策略

**1. 选择合适的基础镜像**

| 基础镜像 | 大小 | 适用场景 |
|----------|------|----------|
| ubuntu:22.04 | ~77MB | 需要完整 Ubuntu 环境 |
| debian:bookworm-slim | ~74MB | Debian 精简版 |
| alpine:3.18 | ~7MB | 极致精简 |
| scratch | ~0B | 静态编译的应用 |
| distroless | ~2-12MB | 安全性高的生产环境 |

\`\`\`dockerfile
# Alpine 版本 - 最小化镜像
FROM python:3.11-alpine

# Slim 版本 - 平衡大小和兼容性
FROM python:3.11-slim

# Distroless - 最安全的运行环境
FROM gcr.io/distroless/python3
\`\`\`

**2. 清理包管理器缓存**

\`\`\`dockerfile
# Alpine
RUN apk add --no-cache curl

# Debian/Ubuntu
RUN apt-get update && \\
    apt-get install -y --no-install-recommends curl && \\
    rm -rf /var/lib/apt/lists/*

# CentOS
RUN yum install -y curl && \\
    yum clean all && \\
    rm -rf /var/cache/yum
\`\`\`

**3. 使用 dive 分析镜像**

\`\`\`bash
# 安装 dive
wget https://github.com/wagoodman/dive/releases/download/v0.11.0/dive_0.11.0_linux_amd64.deb
sudo apt install ./dive_0.11.0_linux_amd64.deb

# 分析镜像
dive myapp:latest

# CI 模式（返回非 0 表示效率评分低于阈值）
CI=true dive myapp:latest --lowestEfficiency 0.9
\`\`\`

**4. Docker Squash 压缩层**

\`\`\`dockerfile
# 构建时使用 --squash 参数
docker build --squash -t myapp:squashed .
\`\`\`

### Java 应用多阶段构建

\`\`\`dockerfile
# 构建阶段
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

# 运行阶段 - JRE 足够
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
\`\`\`

### 镜像标签策略

\`\`\`bash
# 多标签策略
docker build -t myapp:latest .
docker build -t myapp:1.0.0 .
docker build -t myapp:1.0.0-abc1234 .  # 包含 commit hash

# 使用 Git 信息生成标签
VERSION=$(git describe --tags --always)
docker build -t myapp:$VERSION .

# 自动化脚本示例
#!/bin/bash
COMMIT_SHA=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
VERSION=$(cat VERSION)

docker build \\
    -t myapp:$VERSION \\
    -t myapp:$VERSION-$COMMIT_SHA \\
    -t myapp:$BRANCH \\
    .
\`\`\`

### 安全扫描

\`\`\`bash
# Trivy 扫描
trivy image myapp:latest

# Docker Scout
docker scout quickview myapp:latest
docker scout recommendations myapp:latest

# Snyk
snyk container test myapp:latest
\`\`