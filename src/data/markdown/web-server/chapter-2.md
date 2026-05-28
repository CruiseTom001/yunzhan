## 3.1 反向代理概念

**反向代理**指代理服务器接收客户端请求后，将其转发给内部服务器，并将结果返回给客户端。客户端不知道后端服务器的存在。

\`\`\`
客户端 ──→ Nginx (反向代理) ──→ 后端应用服务器 (10.0.0.1:8080)
                                  ├── 后端应用服务器 (10.0.0.2:8080)
                                  └── 后端应用服务器 (10.0.0.3:8080)
\`\`\`

### 反向代理 vs 正向代理

| | 正向代理 | 反向代理 |
|---|---|---|
| 代理对象 | 客户端 | 服务端 |
| 客户端感知 | 知道自己使用代理 | 不知道后端服务器 |
| 典型场景 | 科学上网、公司内网代理 | 负载均衡、SSL 终结、缓存 |

## 3.2 proxy_pass 核心配置

\`\`\`nginx
location /api/ {
    proxy_pass http://backend-server:8080/;

    # 传递客户端信息
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # 超时设置
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # 缓冲设置
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 16k;
    proxy_busy_buffers_size 32k;

    # 不缓冲大文件（如文件下载）
    # proxy_buffering off;

    # 传递真实状态码
    proxy_intercept_errors off;
}
\`\`\`

### proxy_pass 的 URI 处理规则

\`\`\`nginx
# 情况 1：proxy_pass 带 URI（/api/）
location /api/ {
    proxy_pass http://backend:8080/api/;
    # /api/users → http://backend:8080/api/users  (location 部分被替换)
}

# 情况 2：proxy_pass 不带 URI
location /api/ {
    proxy_pass http://backend:8080;
    # /api/users → http://backend:8080/api/users  (location 部分保留)
}

# 情况 3：正则 location 不能带 URI
location ~ ^/api/(.*)$ {
    proxy_pass http://backend:8080/$1$is_args$args;
}
\`\`\`

## 3.3 proxy_set_header 详解

\`\`\`nginx
# 必要 Header 传递
proxy_set_header Host $host;
# 传递原始请求的 Host 头，后端可根据此区分不同站点

proxy_set_header X-Real-IP $remote_addr;
# 传递客户端真实 IP

proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
# 追加代理链中的 IP 地址（逗号分隔）
# 格式：client_ip, proxy1_ip, proxy2_ip

proxy_set_header X-Forwarded-Proto $scheme;
# 告诉后端原始请求的协议（http/https）
# 后端用于生成正确的重定向 URL

proxy_set_header X-Forwarded-Host $host;
# 传递 Host 信息

proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
# WebSocket 代理所需
\`\`\`

## 3.4 WebSocket 反向代理

\`\`\`nginx
location /ws/ {
    proxy_pass http://backend:8080;

    # WebSocket 核心设置
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # 超时设置（WebSocket 是长连接）
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
\`\`\`

## 3.5 上游后端健康检查

\`\`\`nginx
upstream backend {
    server 10.0.0.1:8080 max_fails=3 fail_timeout=30s;
    server 10.0.0.2:8080 max_fails=3 fail_timeout=30s;
    server 10.0.0.3:8080 max_fails=3 fail_timeout=30s backup;  # 备用

    keepalive 32;   # 保持到后端的空闲连接数
}

server {
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
\`\`\`

### 健康检查参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| max_fails | 1 | 最大失败次数，超过后端标记为不可用 |
| fail_timeout | 10s | 失败超时和不可用恢复超时 |
| down | - | 永久标记为不可用 |
| backup | - | 备用服务器，其他都不可用时才启用 |
| weight | 1 | 权重 |

### 主动健康检查（nginx-plus 功能，开源版需第三方模块）

\`\`\`bash
# 使用第三方模块 nginx_upstream_check_module 或商业版
# 开源替代：在 upstream 中配置备用 + 监控脚本
# 通过 curl 自定义健康检查脚本
\`\`\`

## 3.6 反向代理实战：前后端分离部署

\`\`\`nginx
server {
    listen 80;
    server_name app.example.com;

    # 前端静态文件
    location / {
        root /var/www/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理到后端
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 允许跨域（或者在后端处理）
        add_header Access-Control-Allow-Origin *;
    }

    # 后端静态资源（上传文件等）
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
    }
}
\`\`\`