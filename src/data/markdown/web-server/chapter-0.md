## 1.1 Nginx 简介

Nginx（发音 "Engine-X"）是一个高性能的 HTTP 和反向代理服务器，以**事件驱动**和**异步非阻塞**架构著称。

### Nginx vs Apache

| 特性 | Nginx | Apache |
|------|-------|--------|
| 架构模型 | 事件驱动，异步非阻塞 | 进程/线程驱动的阻塞模型 |
| 并发处理 | 数万并发连接（C10K/C100K） | 受限于进程/线程数 |
| 内存消耗 | 低，固定 | 随连接数增长 |
| 静态文件 | 极快 | 较快 |
| 动态内容 | 需配合 FastCGI/反向代理 | 内置模块（mod_php 等） |
| 配置灵活性 | .conf 文件，简洁 | .htaccess 分布式配置，灵活 |
| 模块加载 | 编译时静态链接 | 可动态加载（DSO） |

### Nginx 的应用场景

- **静态文件服务**：HTML、CSS、JS、图片、视频
- **反向代理**：将请求转发到后端应用（Node.js、Python、Java 等）
- **负载均衡**：分发流量到多个后端服务器
- **SSL 终端**：处理 HTTPS 加密/解密
- **HTTP 缓存**：缓存后端响应，加速访问
- **WebSocket 代理**：支持 WebSocket 连接

## 1.2 安装 Nginx

### Ubuntu/Debian

\`\`\`bash
# 官方仓库安装
sudo apt update
sudo apt install nginx

# 或者安装最新稳定版（官方仓库）
sudo apt install curl gnupg2 ca-certificates lsb-release
echo "deb http://nginx.org/packages/ubuntu $(lsb_release -cs) nginx" | sudo tee /etc/apt/sources.list.d/nginx.list
curl -fsSL https://nginx.org/keys/nginx_signing.key | sudo apt-key add -
sudo apt update
sudo apt install nginx
\`\`\`

### CentOS/RHEL

\`\`\`bash
sudo yum install epel-release
sudo yum install nginx
\`\`\`

### 编译安装（用于自定义模块）

\`\`\`bash
# 安装编译依赖
sudo apt install build-essential libpcre3 libpcre3-dev zlib1g zlib1g-dev libssl-dev

# 下载源码
wget http://nginx.org/download/nginx-1.24.0.tar.gz
tar -xzf nginx-1.24.0.tar.gz
cd nginx-1.24.0

# 配置编译选项
./configure \\
    --prefix=/etc/nginx \\
    --sbin-path=/usr/sbin/nginx \\
    --conf-path=/etc/nginx/nginx.conf \\
    --with-http_ssl_module \\
    --with-http_v2_module \\
    --with-http_realip_module \\
    --with-http_gzip_static_module \\
    --with-stream \\
    --with-stream_ssl_module

make && sudo make install
\`\`\`

### 启动与管理

\`\`\`bash
# 启动
sudo systemctl start nginx

# 开机自启
sudo systemctl enable nginx

# 检查状态
sudo systemctl status nginx

# 重载配置（不中断服务）
sudo systemctl reload nginx
sudo nginx -s reload

# 测试配置语法
sudo nginx -t

# 查看版本和编译参数
nginx -V
\`\`\`

## 1.3 Nginx 配置文件结构

### 主配置文件 /etc/nginx/nginx.conf

\`\`\`nginx
# 全局模块
user  nginx;
worker_processes  auto;
error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

# events 模块
events {
    worker_connections  1024;
    use epoll;
}

# http 模块
http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # 日志格式
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;
    keepalive_timeout  65;

    # 引入子配置文件
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
\`\`\`

### 配置层级关系

\`\`\`
main              # 全局配置
├── events       # 连接处理配置
├── http         # HTTP 服务配置
│   ├── server   # 虚拟主机配置（可多个）
│   │   ├── location  # URL 匹配规则
│   │   └── location
│   └── server
├── stream       # TCP/UDP 代理配置（四层）
│   └── server
└── mail         # 邮件代理配置
\`\`\`