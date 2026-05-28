## 4.1 负载均衡算法

Nginx 支持多种负载均衡算法，通过 \`upstream\` 模块配置。

### Round Robin（轮询，默认）

\`\`\`nginx
upstream backend {
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
    server 10.0.0.3:8080;
}
\`\`\`

### Weight（加权轮询）

\`\`\`nginx
upstream backend {
    server 10.0.0.1:8080 weight=5;    # 处理 50% 请求
    server 10.0.0.2:8080 weight=3;    # 处理 30% 请求
    server 10.0.0.3:8080 weight=2;    # 处理 20% 请求
}
\`\`\`

### Least Connections（最少连接）

\`\`\`nginx
upstream backend {
    least_conn;
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
    server 10.0.0.3:8080;
}
# 将请求发送到活动连接数最少的服务器（适合长连接场景）
\`\`\`

### IP Hash（IP 哈希）

\`\`\`nginx
upstream backend {
    ip_hash;
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
    server 10.0.0.3:8080;
}
# 同一客户端 IP 总是路由到同一台服务器（会话保持）
# 注意：服务器增减时会导致重新分配
\`\`\`

### Generic Hash（通用哈希）

\`\`\`nginx
upstream backend {
    hash $request_uri consistent;    # consistent 表示一致性哈希
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
    server 10.0.0.3:8080;
}
# 基于请求 URI 哈希，适合缓存场景
\`\`\`

### Least Time（最短响应时间，Nginx Plus 功能）

\`\`\`nginx
upstream backend {
    least_time header;    # 响应头返回最快
    # least_time last_byte;  # 完整响应最快
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
}
\`\`\`

## 4.2 会话保持（Session Persistence）

### 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| ip_hash | 配置简单，无需额外开发 | 动态 IP 失效，NAT 环境失效 |
| sticky cookie (Nginx Plus) | 精确控制，不受 IP 变化影响 | 商业版功能 |
| Cookie + 自定义路由 | 灵活可控 | 需要后端配合 |
| Redis 共享 Session | 无状态，最推荐 | 需要额外中间件 |

### 使用 Redis 共享 Session（推荐方案）

\`\`\`nginx
# Nginx 侧不需要配置 Session 保持
upstream backend {
    least_conn;
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
    server 10.0.0.3:8080;
}
# 后端应用使用 Redis 存储 Session，实现无状态
\`\`\`

## 4.3 动态负载均衡

### 方案：Nginx + Consul/Etcd 动态更新 upstream

\`\`\`bash
# 方案 1：使用 nginx-upsync-module 从 Consul/Etcd 拉取后端列表
# 方案 2：通过模板渲染 + reload 实现
# 方案 3：使用 Kubernetes Ingress Controller

# 简单脚本示例：自动发现并更新 Nginx upstream
#!/bin/bash
# 通过 consul-template 或自定义脚本
# consul-template -template "/etc/nginx/upstream.ctmpl:/etc/nginx/conf.d/upstream.conf:nginx -s reload"
\`\`\`

## 4.4 故障转移与容错

\`\`\`nginx
upstream backend {
    server 10.0.0.1:8080 max_fails=2 fail_timeout=30s;
    server 10.0.0.2:8080 max_fails=2 fail_timeout=30s;
    server 10.0.0.3:8080 backup;    # 备用，主节点全挂才启用

    # 重试机制
    # proxy_next_upstream 在 location 中配置
}

server {
    location / {
        proxy_pass http://backend;

        # 在哪些错误情况下尝试下一台服务器
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;

        # 最多重试次数
        proxy_next_upstream_tries 3;

        # 重试超时
        proxy_next_upstream_timeout 30s;
    }
}
\`\`\`

## 4.5 限流配置

\`\`\`nginx
# 请求频率限制 - 基于客户端 IP
limit_req_zone $binary_remote_addr zone=mylimit:10m rate=10r/s;

# 连接数限制
limit_conn_zone $binary_remote_addr zone=addr:10m;

server {
    location /api/ {
        # 突发允许 20 个请求，超出返回 503
        limit_req zone=mylimit burst=20 nodelay;
        limit_conn addr 10;

        proxy_pass http://backend;
    }

    # 下载限速
    location /downloads/ {
        limit_rate 500k;              # 每个连接限速 500KB/s
        limit_rate_after 100m;        # 前 100MB 不限速
        alias /var/www/downloads/;
    }
}
\`\`\`