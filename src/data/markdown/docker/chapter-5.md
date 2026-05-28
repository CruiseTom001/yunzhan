## 数据卷与网络

### Docker 数据管理

Docker 提供三种数据持久化方式：

| 方式 | 管理位置 | 适用场景 |
|------|----------|----------|
| Volume | Docker 管理 | 持久化数据、数据库存储 |
| Bind Mount | 宿主机路径 | 开发环境、配置文件 |
| tmpfs | 内存 | 临时数据、敏感信息 |

### Volume（数据卷）

Volume 是 Docker 推荐的持久化方式，由 Docker 完全管理。

\`\`\`bash
# 创建数据卷
docker volume create my-volume

# 查看所有数据卷
docker volume ls

# 查看数据卷详情
docker volume inspect my-volume

# 使用数据卷运行容器
docker run -d \\
    --name mysql \\
    -v mysql-data:/var/lib/mysql \\
    -e MYSQL_ROOT_PASSWORD=secret \\
    mysql:8.0

# 只读数据卷
docker run -d \\
    --name web \\
    -v config:/etc/nginx/conf.d:ro \\
    nginx:latest

# 删除数据卷
docker volume rm my-volume

# 清理未使用的数据卷
docker volume prune
\`\`\`

**Volume 备份与恢复：**

\`\`\`bash
# 备份数据卷
docker run --rm \\
    -v mysql-data:/source \\
    -v $(pwd):/backup \\
    alpine \\
    tar czf /backup/mysql-backup.tar.gz -C /source .

# 恢复数据卷
docker run --rm \\
    -v mysql-data:/target \\
    -v $(pwd):/backup \\
    alpine \\
    tar xzf /backup/mysql-backup.tar.gz -C /target
\`\`\`

### Bind Mount（绑定挂载）

将宿主机的文件或目录直接挂载到容器中。

\`\`\`bash
# 挂载目录
docker run -d \\
    --name dev-web \\
    -v /home/user/project:/app \\
    -v /home/user/config/app.conf:/etc/app/config.conf:ro \\
    node:18

# 开发环境典型用法
docker run -d \\
    --name dev-app \\
    -v $(pwd):/app \\
    -v /app/node_modules \\
    -p 3000:3000 \\
    node:18 npm run dev
\`\`\`

### tmpfs 挂载

数据存储在内存中，容器停止后数据消失。

\`\`\`bash
# 挂载 tmpfs
docker run -d \\
    --tmpfs /tmp:rw,noexec,nosuid,size=64m \\
    nginx

# Compose 中的 tmpfs
services:
  app:
    image: nginx
    tmpfs:
      - /tmp
      - /run:size=64M,noexec
\`\`\`

### Docker 网络

#### 网络驱动类型

| 驱动 | 描述 |
|------|------|
| bridge | 默认网络驱动，单机容器通信 |
| host | 直接使用宿主机网络栈 |
| overlay | 跨主机容器通信（Swarm） |
| macvlan | 为容器分配 MAC 地址 |
| none | 禁用网络 |
| ipvlan | IPvlan 网络 |

\`\`\`bash
# 查看网络列表
docker network ls

# 查看网络详情
docker network inspect bridge
\`\`\`

#### Bridge 网络（默认）

\`\`\`bash
# 创建自定义 bridge 网络
docker network create --driver bridge my-network

# 创建网络并指定子网
docker network create \\
    --driver bridge \\
    --subnet=172.20.0.0/16 \\
    --ip-range=172.20.5.0/24 \\
    --gateway=172.20.5.254 \\
    my-subnet

# 将容器连接到网络
docker run -d --name app1 --network my-network nginx
docker run -d --name app2 --network my-network nginx

# 在同网络中，容器可以通过名称互相访问
docker exec app1 ping app2

# 将运行中的容器连接到网络
docker network connect my-network existing-container

# 断开连接
docker network disconnect my-network existing-container
\`\`\`

#### Host 网络

\`\`\`bash
# 使用宿主机网络
docker run --network host nginx

# 此时容器直接使用宿主机端口
# Nginx 的 80 端口就是宿主机的 80 端口
# 不需要 -p 端口映射
\`\`\`

#### None 网络

\`\`\`bash
# 完全隔离的网络
docker run --network none busybox

# 容器只有一个 lo 回环接口
docker exec isolated ip addr
# 1: lo: <LOOPBACK,UP,LOWER_UP> ...
\`\`\`

### 网络实战：LAMP 架构

\`\`\`yaml
version: '3.8'

services:
  frontend:
    image: nginx:alpine
    networks:
      - public
      - internal
    ports:
      - "80:80"
    volumes:
      - ./html:/usr/share/nginx/html

  backend:
    build: ./api
    networks:
      - internal
    environment:
      - DB_HOST=database
      - DB_NAME=appdb

  database:
    image: mysql:8.0
    networks:
      - internal
    environment:
      - MYSQL_ROOT_PASSWORD=secret
      - MYSQL_DATABASE=appdb
    volumes:
      - db-data:/var/lib/mysql

  adminer:
    image: adminer:latest
    networks:
      - public
      - internal
    ports:
      - "8080:8080"

networks:
  public:
    driver: bridge
  internal:
    driver: bridge
    internal: true  # 禁止外部访问此网络

volumes:
  db-data:
\`\`\`

### DNS 配置

\`\`\`bash
# 自定义 DNS
docker run --dns 8.8.8.8 --dns 1.1.1.1 nginx

# 在 Compose 中配置
services:
  app:
    dns:
      - 8.8.8.8
      - 1.1.1.1
    dns_search:
      - example.com
\`\`