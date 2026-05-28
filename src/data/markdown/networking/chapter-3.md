## 4.1 HTTP 协议基础

HTTP（HyperText Transfer Protocol）是万维网的基础协议，基于 TCP 的请求-响应模型。

### HTTP 请求结构

\`\`\`
POST /api/users HTTP/1.1              ← 请求行（方法 + 路径 + 版本）
Host: api.example.com                  ← 请求头
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1...
Content-Length: 45

{"name": "Alice", "email": "a@b.com"}  ← 请求体
\`\`\`

### HTTP 响应结构

\`\`\`
HTTP/1.1 200 OK                        ← 状态行（版本 + 状态码 + 描述）
Content-Type: application/json         ← 响应头
Content-Length: 27
Set-Cookie: session=abc123; HttpOnly

{"id": 1, "name": "Alice"}            ← 响应体
\`\`\`

## 4.2 HTTP 请求方法

| 方法 | 含义 | 幂等性 | 安全性 | 常见用途 |
|------|------|--------|--------|----------|
| GET | 获取资源 | ✓ | ✓ | 查询数据 |
| POST | 创建资源 | ✗ | ✗ | 提交表单、创建记录 |
| PUT | 完整更新 | ✓ | ✗ | 替换整个资源 |
| PATCH | 部分更新 | ✗ | ✗ | 修改部分字段 |
| DELETE | 删除资源 | ✓ | ✗ | 删除记录 |
| HEAD | 获取响应头 | ✓ | ✓ | 检查资源是否存在 |
| OPTIONS | 获取支持的方法 | ✓ | ✓ | CORS 预检请求 |

## 4.3 HTTP 状态码

### 分类速记

| 范围 | 类别 | 含义 |
|------|------|------|
| 1xx | 信息 | 请求已接收，继续处理 |
| 2xx | 成功 | 请求已成功处理 |
| 3xx | 重定向 | 需要进一步操作 |
| 4xx | 客户端错误 | 请求有误 |
| 5xx | 服务端错误 | 服务器处理失败 |

### 常见状态码

\`\`\`
200 OK              — 请求成功
201 Created         — 资源创建成功
204 No Content      — 成功但无返回内容
301 Moved Permanently — 永久重定向（SEO 权重转移）
302 Found           — 临时重定向
304 Not Modified    — 资源未修改（缓存可用）
400 Bad Request     — 请求格式错误
401 Unauthorized    — 未认证
403 Forbidden       — 无权限
404 Not Found       — 资源不存在
405 Method Not Allowed — 方法不允许
429 Too Many Requests — 请求过多（限流）
500 Internal Server Error — 服务器内部错误
502 Bad Gateway     — 网关错误（上游服务异常）
503 Service Unavailable — 服务暂时不可用
504 Gateway Timeout — 网关超时
\`\`\`

## 4.4 HTTP Headers 详解

### 常用请求头

| Header | 示例 | 说明 |
|--------|------|------|
| Host | api.example.com | 目标主机（HTTP/1.1 必须） |
| User-Agent | Mozilla/5.0... | 客户端标识 |
| Accept | application/json | 接受的响应类型 |
| Content-Type | application/json | 请求体类型 |
| Authorization | Bearer token123 | 认证凭证 |
| Cookie | session=abc | 发送 Cookie |
| Cache-Control | no-cache | 缓存策略 |
| X-Forwarded-For | 10.0.0.1 | 原始客户端 IP（代理时） |

### 常用响应头

| Header | 示例 | 说明 |
|--------|------|------|
| Content-Type | text/html; charset=utf-8 | 响应体类型 |
| Set-Cookie | session=abc; HttpOnly | 设置 Cookie |
| Cache-Control | max-age=3600 | 缓存控制 |
| Location | /new-url | 重定向目标 |
| Access-Control-Allow-Origin | * | CORS 允许的源 |
| Content-Encoding | gzip | 内容压缩方式 |
| Strict-Transport-Security | max-age=31536000 | HSTS 策略 |

## 4.5 HTTPS 与 TLS

### HTTP vs HTTPS

| 特性 | HTTP | HTTPS |
|------|------|-------|
| 端口 | 80 | 443 |
| 加密 | 无（明文） | TLS 加密 |
| 证书 | 不需要 | 需要 SSL/TLS 证书 |
| SEO | 排名劣势 | 排名优先 |
| 安全性 | 数据可被窃听/篡改 | 端到端加密 |

### TLS 握手过程（简化版）

\`\`\`
客户端                              服务器
  │                                    │
  │──── ClientHello ──────────────────→│ (支持的 TLS 版本、加密套件、随机数)
  │                                    │
  │←─── ServerHello + 证书 ───────────│ (选定加密套件、随机数、证书)
  │                                    │
  │──── Pre-Master Secret ────────────→│ (用服务器公钥加密发送)
  │                                    │
  │←─── Finished ────────────────────→│ (双方验证完成)
  │                                    │
  │←══════ 加密通信 ════════════→│
\`\`\`

### 使用 curl 分析 TLS

\`\`\`bash
# 查看 TLS 握手详情
curl -v https://example.com

# 查看证书信息
curl -vI https://example.com 2>&1 | grep -E "SSL|subject|issuer|expire"

# 使用 openssl 查看证书
openssl s_client -connect example.com:443 -servername example.com < /dev/null 2>/dev/null | openssl x509 -noout -dates -subject -issuer

# 测试 TLS 版本支持
nmap --script ssl-enum-ciphers -p 443 example.com
\`\`\`

## 4.6 HTTP 版本演进

| 版本 | 发布年份 | 关键特性 |
|------|---------|---------|
| HTTP/0.9 | 1991 | 仅 GET，无 Header |
| HTTP/1.0 | 1996 | 引入 Header、状态码、POST |
| HTTP/1.1 | 1997 | 持久连接、管道化、Host 头、分块传输 |
| HTTP/2 | 2015 | 二进制帧、多路复用、头部压缩、服务器推送 |
| HTTP/3 | 2022 | 基于 QUIC(UDP)，减少握手延迟 |

## 4.7 常见运维场景

### 查看 Nginx 日志中的 HTTP 状态码分布

\`\`\`bash
# 统计各状态码出现次数
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# 找出 5xx 错误的请求
awk '$9 ~ /^5/' /var/log/nginx/access.log

# 统计 4xx 错误最多的 URL
awk '$9 ~ /^4/ {print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10
\`\`\`

### 使用 curl 调试 API

\`\`\`bash
# 显示完整请求和响应
curl -v https://api.example.com/health

# 显示耗时分析
curl -w "@curl-format.txt" -o /dev/null -s https://example.com

# curl-format.txt 内容：
#     time_namelookup:  %{time_namelookup}\\n
#        time_connect:  %{time_connect}\\n
#     time_appconnect:  %{time_appconnect}\\n
#    time_pretransfer:  %{time_pretransfer}\\n
#       time_redirect:  %{time_redirect}\\n
#  time_starttransfer:  %{time_starttransfer}\\n
#                     ----------\\n
#          time_total:  %{time_total}\\n
\`\`\`