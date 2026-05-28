## Docker 安装与基础命令

### 在 Ubuntu/Debian 上安装 Docker

\`\`\`bash
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install -y \\
    apt-transport-https \\
    ca-certificates \\
    curl \\
    gnupg \\
    lsb-release

# 添加 Docker 官方 GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \\
    sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 设置稳定版仓库
echo \\
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \\
  https://download.docker.com/linux/ubuntu \\
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# 验证安装
sudo docker run hello-world
\`\`\`

### 在 CentOS/RHEL 上安装 Docker

\`\`\`bash
# 卸载旧版本
sudo yum remove docker docker-client docker-client-latest \\
    docker-common docker-latest docker-latest-logrotate \\
    docker-logrotate docker-engine

# 安装依赖
sudo yum install -y yum-utils

# 添加 Docker 仓库
sudo yum-config-manager \\
    --add-repo \\
    https://download.docker.com/linux/centos/docker-ce.repo

# 安装 Docker Engine
sudo yum install -y docker-ce docker-ce-cli containerd.io

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker
\`\`\`

### 将用户添加到 docker 组

\`\`\`bash
# 创建 docker 组（通常已存在）
sudo groupadd docker

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER

# 重新登录或执行以下命令使组生效
newgrp docker
\`\`\`

### 镜像管理命令

\`\`\`bash
# 搜索镜像
docker search nginx

# 拉取镜像（指定版本）
docker pull nginx:1.21
docker pull nginx:alpine    # 基于 Alpine Linux 的精简版本

# 查看本地镜像
docker images
docker images -a            # 包括中间层

# 查看镜像详细信息
docker inspect nginx:latest
docker inspect --format='{{.Architecture}}' nginx:latest

# 删除镜像
docker rmi nginx:latest
docker rmi -f nginx:latest  # 强制删除

# 清理无用镜像
docker image prune           # 清理悬挂镜像
docker image prune -a        # 清理所有未使用的镜像
\`\`\`

### 容器生命周期命令

\`\`\`bash
# 创建并启动容器（前台运行）
docker run -it ubuntu:20.04 /bin/bash

# 创建并启动容器（后台运行）
docker run -d --name web \\
    -p 8080:80 \\
    -v /host/path:/container/path \\
    -e MYSQL_ROOT_PASSWORD=secret \\
    --restart always \\
    nginx:latest

# run 命令常用参数说明：
# -d, --detach              后台运行
# -i, --interactive         保持标准输入打开
# -t, --tty                 分配伪终端
# -p, --publish             端口映射 主机端口:容器端口
# -v, --volume              挂载数据卷
# -e, --env                 设置环境变量
# --name                    为容器命名
# --restart                 重启策略
# --rm                      容器停止后自动删除
# --network                 指定网络

# 查看运行中的容器
docker ps
docker ps -a                # 所有容器
docker ps -q                # 只显示容器 ID

# 停止/启动/重启容器
docker stop web
docker start web
docker restart web

# 暂停/恢复容器
docker pause web
docker unpause web

# 删除容器
docker rm web
docker rm -f web            # 强制删除运行中的容器

# 批量删除已停止的容器
docker container prune

# 重命名容器
docker rename web nginx-web
\`\`\`

### 容器交互命令

\`\`\`bash
# 查看容器日志
docker logs web
docker logs -f web           # 持续输出（类似 tail -f）
docker logs --tail 50 web    # 最近 50 行
docker logs --since 1h web   # 最近 1 小时的日志

# 进入运行中的容器
docker exec -it web /bin/bash
docker exec web ls /usr/share/nginx/html

# 与容器的标准输入交互
docker attach web

# 查看容器内进程
docker top web

# 查看容器资源使用统计
docker stats web
docker stats --no-stream     # 仅输出一次

# 从容器复制文件到宿主机
docker cp web:/etc/nginx/nginx.conf ./nginx.conf

# 从宿主机复制文件到容器
docker cp ./index.html web:/usr/share/nginx/html/
\`\`\`

### 容器资源限制

\`\`\`bash
# 限制 CPU
docker run -d --cpus="1.5" nginx        # 最多使用 1.5 个 CPU
docker run -d --cpuset-cpus="0-2" nginx  # 使用 CPU 0, 1, 2

# 限制内存
docker run -d --memory="512m" nginx      # 最大 512MB
docker run -d --memory-swap="1g" nginx   # 内存 + 交换空间限制
\`\`\`

### 容器生命周期图示

\`\`\`
docker create  →  docker start  →  docker stop  →  docker rm
                                    ↓
                               docker pause
                                    ↓
                              docker unpause
\`\`\`