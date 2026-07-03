## 6.1 Worker 进程优化

\`\`\`nginx
# worker 进程数（通常设为 CPU 核心数）
worker_processes auto;

# CPU 亲和性绑定（减少 CPU 切换开销）
worker_cpu_affinity auto;

# worker 进程最大打开文件数
worker_rlimit_nofile 65535;

events {
    # 每个 worker 的最大连接数
    worker_connections 10240;

    # 事件模型（Linux 推荐 epoll）
    use epoll;

    # 同时接受多个新连接
    multi_accept on;
}
\`\`\`

### 最大并发连接数计算

\`\`\`
最大并发 = worker_processes × worker_connections

作为反向代理时，每个客户端需要 2 个连接（客户端←→Nginx + Nginx←→后端）
因此实际能力 = worker_processes × worker_connections / 2
\`\`\`

## 6.2 Gzip 压缩配置

\`\`\`nginx
http {
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;

    # 压缩的 MIME 类型
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/json
        application/xml
        application/rss+xml
        image/svg+xml;

    # 禁用 IE6 的 gzip
    gzip_disable "msie6";
}
\`\`\`

### Gzip 参数说明

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| gzip_comp_level | 3-6 | 压缩级别（1-9），越高压缩率越高但 CPU 消耗大 |
| gzip_min_length | 256-1000 | 小于此值不压缩（压缩小文件不划算） |
| gzip_types | 见上 | 只压缩文本类型，图片/视频不要压缩 |
| gzip_vary | on | 添加 Vary: Accept-Encoding 响应头 |
| gzip_proxied | any | 对代理请求也进行压缩 |

## 6.3 缓存配置

### 浏览器缓存（响应头）

\`\`\`nginx
# 版本化静态资源（长期缓存）
location ~* \\.[a-f0-9]{8,}\\.(css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# 一般静态资源
location ~* \\.(jpg|jpeg|png|gif|ico|svg|webp|woff2?)$ {
    expires 30d;
    add_header Cache-Control "public";
}
\`\`\`

### Nginx 代理缓存

\`\`\`nginx
http {
    # 定义缓存路径
    # levels: 两级目录哈希
    # keys_zone: 缓存名称:内存大小
    # max_size: 磁盘最大缓存
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=10g inactive=60m use_temp_path=off;

    server {
        location /api/ {
            proxy_cache my_cache;
            proxy_cache_key "$scheme$request_method$host$request_uri";
            proxy_cache_valid 200 302 10m;
            proxy_cache_valid 404      1m;
            proxy_cache_use_stale error timeout http_500 http_502 http_503;
            proxy_cache_lock on;
            proxy_cache_bypass $http_cache_control;

            add_header X-Cache-Status $upstream_cache_status;  # 调试用

            proxy_pass http://backend;
        }
    }
}
\`\`\`

### 缓存策略对照

| 场景 | 缓存层级 | 缓存时长 |
|------|---------|---------|
| 版本化静态文件 (app.abc123.js) | 浏览器 | 1年 |
| 图片/字体 | 浏览器 | 30天 |
| API 查询结果 | Nginx 代理缓存 | 1-10分钟 |
| HTML 页面 | 不缓存或短缓存 | 0-5分钟 |
| 用户个性化内容 | 不缓存 | 0 |

## 6.4 连接优化

\`\`\`nginx
http {
    # TCP 优化
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    # 长连接
    keepalive_timeout 65;
    keepalive_requests 100;

    # 与后端的长连接
    upstream backend {
        server 10.0.0.1:8080;
        keepalive 32;
    }

    # 客户端请求体大小限制
    client_max_body_size 100m;
    client_body_buffer_size 128k;

    # 客户端 Header 大小限制
    client_header_buffer_size 1k;
    large_client_header_buffers 4 8k;
}
\`\`\`

## 6.5 系统层面优化

\`\`\`bash
# /etc/sysctl.conf 或 /etc/sysctl.d/99-nginx.conf

# 增加系统文件描述符限制
fs.file-max = 65535

# TCP 连接队列
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192

# TIME_WAIT 优化
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30

# TCP Keepalive
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 3

# 应用配置
# sudo sysctl -p
\`\`\`

### 系统限制检查

\`\`\`bash
# 查看当前连接数
ss -s

# 查看 Nginx 进程限制
cat /proc/$(cat /var/run/nginx.pid)/limits | grep "Max open files"

# 查看系统限制
ulimit -n
cat /proc/sys/fs/file-max
\`\`\`

## 6.6 性能压测工具

\`\`\`bash
# Apache Benchmark (ab)
ab -n 10000 -c 100 https://example.com/

# wrk（更强大）
wrk -t 4 -c 100 -d 30s https://example.com/

# 参数说明
# -n: 总请求数
# -c: 并发连接数
# -t: 线程数
# -d: 持续时间
\`\`\`

### 性能基线参考（单台 4 核 8G 服务器）

| 场景 | 预期 QPS |
|------|----------|
| 静态小文件 (几 KB) | 50,000+ |
| 静态图片 (几百 KB) | 10,000+ |
| 反向代理（后端耗时 10ms） | 5,000-10,000 |
| HTTPS (TLSv1.3) | 约为 HTTP 的 80-90% |
| WebSocket | 受限于连接数（数十万级别） |