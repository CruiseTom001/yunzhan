## SSL/TLS 证书管理

### 自签证书生成

openssl req -x509 -nodes -days 365 -newkey rsa:2048

### 自建 CA 并签发证书（企业内网）

1. 创建 CA 私钥和证书
2. 创建服务器私钥和 CSR
3. 使用 CA 签发服务器证书

### Nginx HTTPS 配置

- ssl_protocols TLSv1.2 TLSv1.3
- ssl_ciphers：推荐 ECDHE 前向安全性
- OCSP Stapling
- HSTS

### 证书自动化：Certbot + Let's Encrypt

certbot --nginx -d example.com -d www.example.com

### 证书监控与到期检查