## 5.1 HTTPS 与 SSL/TLS 基础

HTTPS = HTTP + TLS（Transport Layer Security），SSL 是 TLS 的前身，已废弃。

### 为什么需要 HTTPS

- **加密传输**：防止中间人窃听
- **身份认证**：验证服务器身份，防止 DNS 劫持
- **数据完整性**：防止数据在传输中被篡改
- **SEO 优势**：Google 优先索引 HTTPS 站点
- **HTTP/2 要求**：浏览器只支持 HTTPS 下的 HTTP/2

## 5.2 Let's Encrypt + Certbot

Let's Encrypt 提供**免费**、**自动化**的 TLS 证书。

### 安装 Certbot

\`\`\`bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx

# 或使用 snap（推荐，跨发行版）
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
\`\`\`

### 获取并安装证书

\`\`\`bash
# 自动获取并配置 Nginx（推荐）
sudo certbot --nginx -d example.com -d www.example.com

# 仅获取证书，手动配置 Nginx
sudo certbot certonly --nginx -d example.com -d www.example.com

# 使用 webroot 验证（不需要停止 Nginx）
sudo certbot certonly --webroot -w /var/www/html -d example.com
\`\`\`

### 自动续期

\`\`\`bash
# 测试续期（模拟执行）
sudo certbot renew --dry-run

# 实际续期
sudo certbot renew

# 自动续期已内置（systemd timer 或 cron）
# 查看自动续期任务
systemctl list-timers | grep certbot
# 或
ls /etc/cron.d/certbot
\`\`\`

## 5.3 Nginx HTTPS 配置

### 基础 HTTPS 配置

\`\`\`nginx
server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    # Let's Encrypt 生成的证书路径
    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # 或使用自定义证书
    # ssl_certificate     /etc/nginx/ssl/example.com.crt;
    # ssl_certificate_key /etc/nginx/ssl/example.com.key;

    root /var/www/html;
    index index.html;
}
\`\`\`

### HTTP 强制跳转 HTTPS

\`\`\`nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$server_name$request_uri;
}

# 或者 Let's Encrypt 方式（保留 ACME 验证路径）
server {
    listen 80;
    server_name example.com www.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
\`\`\`

## 5.4 SSL 参数优化

### 生产级 SSL 配置

\`\`\`nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # 协议版本（禁用旧版）
    ssl_protocols TLSv1.2 TLSv1.3;

    # 加密套件（推荐配置）
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;

    # DH 参数
    ssl_dhparam /etc/nginx/ssl/dhparam.pem;

    # 启用 OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/example.com/chain.pem;
    resolver 8.8.8.8 1.1.1.1 valid=300s;
    resolver_timeout 5s;

    # 会话缓存
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS（强制 HTTPS，谨慎启用）
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
}
\`\`\`

### 生成 DH 参数

\`\`\`bash
# 生成 2048 位 DH 参数（推荐）
openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048
# 注意：此命令耗时较长（几分钟到十几分钟不等）
\`\`\`

### SSL 配置参数说明

| 参数 | 说明 |
|------|------|
| ssl_protocols | 允许的 TLS 版本，禁用 TLSv1 和 TLSv1.1 |
| ssl_ciphers | 加密套件优先级列表，优先 ECDHE 前向安全性 |
| ssl_dhparam | DH 密钥交换参数，增强安全性 |
| ssl_stapling | OCSP 装订，减少客户端验证延迟 |
| ssl_session_cache | SSL 会话缓存，加速重复连接 |
| HSTS | 告知浏览器始终使用 HTTPS 访问 |

## 5.5 SSL/TLS 诊断工具

\`\`\`bash
# 测试 SSL 配置分数（推荐）
# 访问 https://www.ssllabs.com/ssltest/

# 命令行测试
openssl s_client -connect example.com:443 -servername example.com

# 查看证书详情
openssl s_client -connect example.com:443 -servername example.com < /dev/null 2>/dev/null | openssl x509 -noout -text

# 查看证书到期时间
echo | openssl s_client -servername example.com -connect example.com:443 2>/dev/null | openssl x509 -noout -dates

# 测试支持的协议和加密套件
nmap --script ssl-enum-ciphers -p 443 example.com
testssl.sh https://example.com
\`\`\`

## 5.6 自签名证书（仅开发/测试环境）

\`\`\`bash
# 生成自签名证书（仅用于测试！）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
    -keyout /etc/nginx/ssl/selfsigned.key \\
    -out /etc/nginx/ssl/selfsigned.crt \\
    -subj "/C=CN/ST=Beijing/L=Beijing/O=Test/CN=localhost"
\`\`\`