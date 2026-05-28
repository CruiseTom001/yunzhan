## 3.1 DNS 是什么

DNS（Domain Name System）将人类可读的域名转换为机器可读的 IP 地址，是互联网的"电话簿"。

### 为什么要 DNS

- **可记忆性**：记住 \`google.com\` 比记住 \`142.250.80.46\` 容易
- **灵活性**：更换服务器只需修改 DNS 记录，域名不变
- **负载均衡**：同一域名可解析到多个 IP 实现流量分发

## 3.2 DNS 解析过程

### 完整解析流程

\`\`\`
用户输入 www.example.com
    │
    ▼
1. 浏览器缓存 → 如果有，直接返回
    │ (未命中)
    ▼
2. 操作系统缓存 (hosts 文件) → 如果有，直接返回
    │ (未命中)
    ▼
3. 本地 DNS 解析器 (ISP 提供或 8.8.8.8)
    │
    ▼
4. 根域名服务器 (root) → 返回 .com 的顶级域名服务器地址
    │
    ▼
5. .com 顶级域名服务器 (TLD) → 返回 example.com 的权威服务器地址
    │
    ▼
6. example.com 权威 DNS 服务器 → 返回 www.example.com 的 IP
    │
    ▼
7. 结果缓存并返回给客户端
\`\`\`

### 两种查询方式

| 方式 | 说明 |
|------|------|
| 递归查询 | 客户端要求 DNS 服务器必须返回最终结果（客户端→本地 DNS） |
| 迭代查询 | DNS 服务器返回"下一步去问谁"的指引（本地 DNS→各级服务器） |

## 3.3 DNS 记录类型

| 类型 | 全称 | 用途 | 示例 |
|------|------|------|------|
| A | Address | 域名→IPv4 | example.com → 93.184.216.34 |
| AAAA | Quad-A | 域名→IPv6 | example.com → 2606:2800:220:1:248:1893:25c8:1946 |
| CNAME | Canonical Name | 别名 | www.example.com → example.com |
| MX | Mail Exchange | 邮件服务器 | example.com → mail.example.com (优先级 10) |
| NS | Name Server | 权威 DNS 服务器 | example.com → ns1.example.com |
| TXT | Text | 文本信息（SPF、DKIM 验证等） | "v=spf1 include:_spf.google.com ~all" |
| SRV | Service | 服务定位 | _sip._tcp.example.com |
| SOA | Start of Authority | 域的管理信息 | 主 DNS、管理员邮箱、序列号等 |
| PTR | Pointer | 反向解析（IP→域名） | 1.1.168.192.in-addr.arpa → host.example.com |
| CAA | Certification Authority Authorization | 指定可信 CA | example.com → "letsencrypt.org" |

## 3.4 dig 命令实战

\`dig\` 是最强大的 DNS 诊断工具。

\`\`\`bash
# 基本 A 记录查询
dig example.com

# 指定记录类型
dig example.com MX
dig example.com NS
dig example.com TXT
dig example.com ANY

# 简洁输出
dig example.com +short

# 指定 DNS 服务器
dig @8.8.8.8 example.com
dig @1.1.1.1 example.com

# 反向查询
dig -x 8.8.8.8

# 跟踪完整解析过程
dig example.com +trace

# 只看答案部分
dig example.com +noall +answer

# 查询特定字段
dig example.com +short A
\`\`\`

### dig 输出解读

\`\`\`
;; ANSWER SECTION:
example.com.    3600    IN    A    93.184.216.34
   │             │      │    │        │
  域名          TTL   类型   记录类型  值
\`\`\`

重点关注的字段：
- **TTL（Time To Live）**：记录缓存时间（秒），决定缓存多久后失效
- **status: NOERROR**：查询成功；NXDOMAIN 表示域名不存在；SERVFAIL 服务端失败

## 3.5 nslookup 命令

\`\`\`bash
# 基本查询
nslookup example.com

# 指定 DNS 服务器
nslookup example.com 8.8.8.8

# 进入交互模式
nslookup
> set type=MX
> example.com
> exit
\`\`\`

## 3.6 hosts 文件

\`/etc/hosts\` 是本地 DNS 解析文件，优先级高于 DNS 服务器。

\`\`\`bash
# /etc/hosts 格式
127.0.0.1       localhost
192.168.1.100   app.internal db.internal
::1             localhost ip6-localhost

# 查看 hosts 文件
cat /etc/hosts

# 确认 hosts 解析
getent hosts app.internal
\`\`\`

> 注意：修改 hosts 文件后立即生效，但 nscd/systemd-resolved 等缓存服务可能需要刷新。

## 3.7 DNS 故障排查流程

\`\`\`bash
# 1. 检查本地 DNS 缓存
# systemd-resolved
resolvectl status
resolvectl flush-caches

# nscd
sudo systemctl restart nscd

# 2. 测试 DNS 服务器连通性
ping 8.8.8.8
dig @8.8.8.8 google.com +short

# 3. 检查 DNS 配置
cat /etc/resolv.conf

# 4. 检查 53 端口是否可达
nc -zv 8.8.8.8 53
\`\`\`

### 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| dig 超时 | DNS 服务器不可达 | 检查网络、防火墙规则 |
| NXDOMAIN | 域名不存在 | 确认域名拼写和注册状态 |
| SERVFAIL | 权威服务器无法处理 | 检查权威 DNS 配置 |
| 解析结果与预期不符 | 缓存未过期 | 等待 TTL 过期或刷新缓存 |
| 解析速度慢 | DNS 服务器响应慢 | 更换更快的 DNS（如 1.1.1.1） |