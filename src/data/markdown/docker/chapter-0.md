## Docker 核心概念

Docker 是一个开源的容器化平台，它允许开发者将应用及其依赖打包到一个可移植的容器中，然后发布到任何 Linux 或 Windows 机器上运行。容器是轻量级的、独立的、可执行的软件包，包含运行应用所需的一切：代码、运行时、系统工具、系统库和设置。

### Docker 架构概览

Docker 采用 **客户端-服务器（C/S）架构**，核心组件包括：

- **Docker Client**：用户与 Docker 交互的命令行工具（docker CLI）
- **Docker Daemon（dockerd）**：后台守护进程，负责构建、运行和管理容器
- **Docker Registry**：镜像仓库，用于存储和分发 Docker 镜像

### 镜像（Image）

镜像是容器的基石，它是一个**只读模板**，包含了运行容器所需的文件系统、依赖和配置。

\`\`\`bash
# 查看本地镜像列表
docker images

# 查看镜像详细信息
docker inspect nginx:latest

# 查看镜像构建历史
docker history nginx:latest
\`\`\`

**分层存储原理**：Docker 镜像采用联合文件系统（UnionFS），由多个只读层（Layer）叠加组成。每一层代表 Dockerfile 中的一条指令。这种设计带来的好处：

- **复用性**：多个镜像可以共享相同的底层
- **传输效率**：只需传输本地不存在的层
- **存储效率**：相同的层只存储一次

\`\`\`bash
# 分层结构示例
镜像: myapp:latest
├── Layer 6: CMD ["node", "app.js"]        (5B)
├── Layer 5: COPY . /app                    (2MB)
├── Layer 4: RUN npm install                (50MB)
├── Layer 3: COPY package.json /app         (2KB)
├── Layer 2: RUN apt-get install nodejs     (100MB)
└── Layer 1: FROM ubuntu:20.04              (72MB)
\`\`\`

### 容器（Container）

容器是镜像的**可运行实例**。你可以创建、启动、停止、移动或删除容器。容器在启动时会在镜像层之上创建一个**可写层（Container Layer）**。

容器的生命周期：

\`\`\`
created → running → paused → stopped → deleted
\`\`\`

\`\`\`bash
# 从镜像创建并启动一个容器
docker run -d --name my-nginx -p 8080:80 nginx:latest

# 查看运行中的容器
docker ps

# 查看所有容器（包括已停止的）
docker ps -a
\`\`\`

### 仓库（Registry）

仓库是存储和分发镜像的服务。Docker Hub 是默认的公共仓库。

\`\`\`bash
# 登录 Docker Hub
docker login

# 给镜像打标签
docker tag myapp:latest username/myapp:v1.0

# 推送镜像到仓库
docker push username/myapp:v1.0

# 从仓库拉取镜像
docker pull username/myapp:v1.0
\`\`\`

### 容器 vs 虚拟机

| 特性 | 容器 | 虚拟机 |
|------|------|--------|
| 启动速度 | 秒级 | 分钟级 |
| 资源占用 | MB 级别 | GB 级别 |
| 隔离级别 | 进程级隔离 | 操作系统级隔离 |
| 操作系统 | 共享宿主机内核 | 每个 VM 独立操作系统 |
| 迁移性 | 优秀 | 一般 |

### 关键概念总结

1. **镜像**是构建阶段的产物，**容器**是运行阶段的实例
2. 镜像采用**分层存储**，不可变的基础层 + 可写的容器层
3. **仓库**集中管理镜像的分发和版本控制
4. 容器相比虚拟机更**轻量、快速、高效**