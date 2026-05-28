## 2.1 虚拟主机（Virtual Host）

Nginx 通过 \`server\` 块定义虚拟主机，根据请求的域名或 IP 区分不同网站。

### 基于域名的虚拟主机（最常用）

\`\`\`nginx
server {
    listen 80;
    server_name example.com www.example.com;
    root /var/www/example;
    index index.html index.htm;
}

server {
    listen 80;
    server_name blog.example.com;
    root /var/www/blog;
    index index.html;
}
\`\`\`

### 基于端口的虚拟主机

\`\`\`nginx
server {
    listen 8080;
    server_name _;
    root /var/www/app1;
}

server {
    listen 9090;
    server_name _;
    root /var/www/app2;
}
\`\`\`

### server_name 匹配规则

| 写法 | 含义 |
|------|------|
| example.com | 精确匹配 |
| *.example.com | 通配符匹配（只能用在开头或结尾） |
| example.* | 通配符后缀 |
| ~^www\\\\.\\\\d+\\\\.example\\\\.com$ | 正则匹配（以 ~ 开头） |
| _ | 无效占位符，匹配所有（默认 server） |

匹配优先级：精确匹配 > 以 * 开头的最长通配符 > 以 * 结尾的最长通配符 > 正则匹配

## 2.2 静态文件服务配置

### 基础静态文件服务

\`\`\`nginx
server {
    listen 80;
    server_name static.example.com;
    root /var/www/static;

    location / {
        try_files $uri $uri/ =404;
    }

    # 图片缓存
    location ~* \\.(jpg|jpeg|png|gif|ico|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # CSS/JS 缓存
    location ~* \\.(css|js|woff2?|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
\`\`\`

### root 与 alias 的区别

\`\`\`nginx
# root：路径拼接到 root 后面
location /images/ {
    root /var/www/static;     # 访问 /images/logo.png → /var/www/static/images/logo.png
}

# alias：路径替换 location 部分
location /static/ {
    alias /var/www/assets/;   # 访问 /static/logo.png → /var/www/assets/logo.png
}
\`\`\`

### try_files —— 文件查找策略

\`\`\`nginx
location / {
    try_files $uri $uri/ /index.html;    # SPA 应用常用配置
}

# 查找顺序：
# 1. $uri (精确文件)
# 2. $uri/ (目录 + index)
# 3. /index.html (回退，常用于 Vue/React 前端路由)
\`\`\`

## 2.3 目录列表与访问控制

\`\`\`nginx
# 开启目录浏览（类似 Apache 的 Indexes）
location /downloads/ {
    alias /var/www/downloads/;
    autoindex on;
    autoindex_exact_size off;    # 显示人类可读的文件大小
    autoindex_localtime on;      # 使用本地时间
}

# 限制 IP 访问
location /admin/ {
    allow 192.168.1.0/24;
    allow 10.0.0.0/8;
    deny all;
}

# 密码保护
location /private/ {
    auth_basic "Restricted Area";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
\`\`\`

### 生成密码文件

\`\`\`bash
# 安装 htpasswd 工具
sudo apt install apache2-utils    # Ubuntu/Debian
sudo yum install httpd-tools      # CentOS/RHEL

# 创建用户
sudo htpasswd -c /etc/nginx/.htpasswd alice    # -c 创建新文件
sudo htpasswd /etc/nginx/.htpasswd bob          # 追加用户
\`\`\`

## 2.4 自定义错误页面

\`\`\`nginx
# 统一错误页面
error_page 404 /404.html;
error_page 500 502 503 504 /50x.html;

location = /404.html {
    root /var/www/errors;
    internal;    # 只允许内部重定向访问
}
\`\`\`

## 2.5 静态文件优化的最佳实践

\`\`\`nginx
server {
    listen 80;
    root /var/www/html;

    # 开启 sendfile 优化文件传输
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    # 长连接超时
    keepalive_timeout 65;
    keepalive_requests 100;

    # 静态资源缓存
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        add_header Vary "Accept-Encoding";
        access_log off;    # 减少 I/O
    }

    # SPA 回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
\`\`\`