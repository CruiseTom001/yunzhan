## 5.1 ping —— 测试网络连通性

\`ping\` 发送 ICMP Echo Request 数据包检测目标主机是否可达。

\`\`\`bash
ping google.com                 # 持续 ping（Ctrl+C 停止）
ping -c 4 google.com            # 发送 4 个包后停止
ping -i 2 google.com            # 每 2 秒发送一个包
ping -s 1024 google.com         # 发送 1024 字节的数据包
ping -W 3 google.com            # 超时时间 3 秒
\`\`\`

### 输出解读

\`\`\`
64 bytes from 142.250.80.46: icmp_seq=1 ttl=118 time=15.2 ms
\`\`\`

- \`icmp_seq\`：序列号
- \`ttl\`：生存时间（经过的路由器数量）
- \`time\`：往返时间 (RTT)

## 5.2 curl —— 网络请求工具

\`curl\` 支持 HTTP/HTTPS、FTP、SMTP 等多种协议，是 API 调试的必备工具。

\`\`\`bash
# GET 请求
curl https://api.example.com/users

# 显示响应头
curl -I https://example.com
curl -i https://example.com      # 同时显示响应头和体

# POST 请求
curl -X POST https://api.example.com/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"alice","password":"secret"}'

# 下载文件
curl -O https://example.com/file.tar.gz   # 保持原文件名
curl -o myfile.tar.gz https://example.com/file.tar.gz  # 指定文件名

# 跟随重定向
curl -L https://short.link

# 显示连接时间详情
curl -w "\\nDNS: %{time_namelookup}s, Connect: %{time_connect}s, TTFB: %{time_starttransfer}s, Total: %{time_total}s\\n" -o /dev/null -s https://example.com

# 上传文件
curl -F "file=@/path/to/file.pdf" https://upload.example.com

# 发送 Header
curl -H "Authorization: Bearer token123" https://api.example.com/me
\`\`\`

## 5.3 wget —— 文件下载

\`\`\`bash
wget https://example.com/file.tar.gz          # 下载文件
wget -c https://example.com/file.tar.gz        # 断点续传
wget -r -l 2 https://example.com/docs/         # 递归下载（深度 2）
wget --limit-rate=1m https://example.com/big.iso  # 限速下载
\`\`\`

## 5.4 netstat / ss —— 查看网络连接

\`ss\` 是 \`netstat\` 的现代替代品，速度更快。

\`\`\`bash
# ss（推荐）
ss -tlnp           # 查看所有监听的 TCP 端口
ss -tlnp | grep 80  # 查看 80 端口是否监听
ss -an             # 所有连接（包括监听）
ss -s              # 连接统计摘要

# netstat（传统）
netstat -tlnp
netstat -an | grep ESTABLISHED | wc -l   # 统计已建立的连接数
netstat -i         # 网络接口统计
\`\`\`

### ss 常用参数

| 参数 | 含义 |
|------|------|
| -t | 仅 TCP |
| -u | 仅 UDP |
| -l | 仅监听状态的端口 |
| -n | 数字格式显示（不解析域名） |
| -p | 显示进程信息 |

### TCP 连接状态

- **LISTEN**：正在监听
- **ESTABLISHED**：已建立连接
- **TIME_WAIT**：等待足够时间确保远程收到确认
- **CLOSE_WAIT**：远程已关闭，等待本地关闭

## 5.5 ip —— 网络配置

\`ip\` 命令取代了传统的 \`ifconfig\`。

\`\`\`bash
ip addr show                      # 查看所有网络接口和 IP 地址
ip link show                      # 查看链路层信息
ip route show                     # 查看路由表
ip neigh show                     # 查看 ARP 表

# 配置 IP（临时）
ip addr add 192.168.1.100/24 dev eth0
ip addr del 192.168.1.100/24 dev eth0
\`\`\`

## 5.6 dig —— DNS 查询

\`dig\` 比 \`nslookup\` 提供更详细的 DNS 信息。

\`\`\`bash
dig google.com                    # 查询 A 记录
dig google.com MX                 # 查询邮件记录
dig google.com NS                 # 查询域名服务器
dig google.com ANY                # 查询所有记录
dig @8.8.8.8 google.com           # 指定 DNS 服务器查询
dig -x 8.8.8.8                    # 反向 DNS 查询
dig google.com +short             # 简洁输出
dig google.com +trace             # 跟踪 DNS 解析过程
\`\`\`

## 5.7 traceroute / mtr —— 路由追踪

\`\`\`bash
traceroute google.com             # 追踪到达目标的路由路径
traceroute -n google.com          # 不解析域名，速度更快
mtr google.com                    # 实时路由追踪（结合 ping + traceroute）
\`\`\`

## 5.8 tcpdump —— 网络抓包

\`\`\`bash
# 抓取 eth0 接口所有流量
tcpdump -i eth0

# 抓取指定端口的流量
tcpdump -i eth0 port 80

# 抓取指定主机的流量
tcpdump -i eth0 host 192.168.1.100

# 抓取并保存到文件
tcpdump -i eth0 -w capture.pcap

# 读取 pcap 文件
tcpdump -r capture.pcap

# 常用组合：抓取 HTTP 请求
tcpdump -i eth0 -A -s 0 'tcp port 80 and (((ip[2:2] - ((ip[0]&0xf)<<2)) - ((tcp[12]&0xf0)>>2)) != 0)'

# 抓取与特定 IP 的通信
tcpdump -i eth0 -nn host 10.0.0.1 and port 443
\`\`\`

## 5.9 其他实用网络工具

\`\`\`bash
# telnet：测试 TCP 端口是否可达
telnet 192.168.1.100 3306

# nc (netcat)：网络调试瑞士军刀
nc -zv 192.168.1.100 80              # 扫描端口
nc -l 8080                           # 监听端口
echo "test" | nc server.com 8080     # 发送数据

# nmap：端口扫描
nmap -sS 192.168.1.0/24              # SYN 扫描整个网段
nmap -p 1-1000 192.168.1.100         # 扫描指定端口范围
\`\`\`