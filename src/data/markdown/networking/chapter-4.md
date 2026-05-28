## 5.1 ping —— 连通性测试

\`ping\` 是基于 ICMP 协议的网络诊断工具。

\`\`\`bash
ping -c 4 google.com
ping -c 10 -i 0.2 192.168.1.1    # 0.2 秒间隔，快速 ping
ping -s 1472 -M do 192.168.1.1   # 测试 MTU（禁止分片）
ping -f 192.168.1.1              # 洪水 ping（压力测试，需 root）
\`\`\`

### ping 诊断思路

| 情况 | 分析 |
|------|------|
| ping 127.0.0.1 通则本地 TCP/IP 栈正常 | |
| ping 本地 IP 通则网卡驱动正常 | |
| ping 网关通则本地网络正常 | |
| ping 外网 IP 通则互联网连接正常 | |
| ping 外网 IP 通但域名不通则 DNS 问题 | |
| 丢包率高 | 检查网络拥塞、网线、WiFi 信号 | |

## 5.2 traceroute / mtr —— 路由追踪

### traceroute

\`\`\`bash
# Linux 默认使用 UDP
traceroute google.com

# 使用 ICMP（类似 Windows tracert）
traceroute -I google.com

# 使用 TCP（穿透防火墙）
traceroute -T -p 443 google.com

# 不解析域名，更快
traceroute -n google.com

# 指定最大跳数
traceroute -m 30 google.com
\`\`\`

### mtr —— 结合 ping + traceroute

\`mtr\` 实时显示每一跳的丢包率和延迟，是运维必备工具。

\`\`\`bash
# 实时模式
mtr google.com

# 报告模式（发送 100 个包后输出报告）
mtr -r -c 100 google.com

# 不解析域名
mtr -n google.com

# 按丢包率排序
mtr -o "LSDR NBAW JMXI" google.com
\`\`\`

### mtr 输出解读

\`\`\`
HOST                Loss%   Snt   Avg  Best  Wrst  StDev
1. 192.168.1.1       0.0%    10   1.2   0.8   2.1   0.4
2. 10.0.0.1          0.0%    10   5.3   4.1  12.3   2.5
3. ???              100.0%   10   0.0   0.0   0.0   0.0   ← 中间设备不响应 ICMP
4. 72.14.238.1       0.0%    10  15.2  14.1  18.2   1.2
\`\`\`

> 注意：中间节点丢包率 100% 不代表网络有问题，可能只是路由器不响应 ICMP。如果最后一跳丢包为 0%，则网络正常。

## 5.3 tcpdump —— 网络抓包

### 基础用法

\`\`\`bash
# 列出可用的网络接口
tcpdump -D

# 抓取所有流量
tcpdump -i eth0

# 不解析域名和端口名，更快
tcpdump -i eth0 -nn

# 显示 ASCII 内容
tcpdump -i eth0 -A

# 保存到文件
tcpdump -i eth0 -w capture.pcap

# 限制抓包数量
tcpdump -i eth0 -c 100 -w capture.pcap
\`\`\`

### BPF 过滤表达式

\`\`\`bash
# 按主机过滤
tcpdump host 192.168.1.100
tcpdump dst host 192.168.1.100      # 目标地址
tcpdump src host 192.168.1.100      # 源地址

# 按端口过滤
tcpdump port 80
tcpdump port 443
tcpdump portrange 8000-8100

# 按协议过滤
tcpdump tcp
tcpdump udp
tcpdump icmp

# 组合过滤
tcpdump 'host 192.168.1.100 and port 443'
tcpdump 'tcp port 80 and (((ip[2:2] - ((ip[0]&0xf)<<2)) - ((tcp[12]&0xf0)>>2)) != 0)'

# 按 TCP 标志位过滤
tcpdump 'tcp[tcpflags] & tcp-syn != 0'    # SYN 包
tcpdump 'tcp[tcpflags] & tcp-rst != 0'    # RST 包
\`\`\`

### 实战场景

\`\`\`bash
# 抓取 HTTP 请求和响应
tcpdump -i eth0 -A -s 0 'tcp port 80'

# 抓取 DNS 查询
tcpdump -i eth0 -n port 53

# 抓取特定 IP 间的流量并保存
tcpdump -i eth0 -w /tmp/trouble.pcap host 10.0.0.1 and host 10.0.0.2

# 抓取 MySQL 数据库连接
tcpdump -i eth0 -nn 'tcp port 3306' -w mysql.pcap
\`\`\`

## 5.4 netstat / ss —— 连接状态分析

\`\`\`bash
# 查看所有监听端口
ss -tlnp

# 查看 ESTABLISHED 连接数
ss -tan state established | wc -l

# 统计各状态的连接数
ss -tan | awk '{print $1}' | sort | uniq -c

# 查看 TIME_WAIT 连接数（过大说明短连接过多）
ss -tan state time-wait | wc -l

# 查看哪个进程占用了某端口
ss -tlnp | grep :8080
lsof -i :8080
\`\`\`

## 5.5 nc（netcat）—— 网络瑞士军刀

\`\`\`bash
# 端口连通性测试
nc -zv 192.168.1.100 80
nc -zv 192.168.1.100 20-30          # 扫描端口范围

# 简单的 TCP 服务器
nc -l 8080

# 简单的 HTTP 测试
echo -e "GET / HTTP/1.1\\r\\nHost: example.com\\r\\n\\r\\n" | nc example.com 80

# 文件传输
# 接收端：nc -l 8080 > received_file
# 发送端：nc 192.168.1.100 8080 < file_to_send
\`\`\`

## 5.6 网络问题排查流程

### 标准排查五步法

\`\`\`bash
# 1. 本地网络栈是否正常
ping 127.0.0.1

# 2. 本机 IP 配置是否正确
ip addr show
ip route show

# 3. 能否到达网关
ping <网关IP>
ip neigh show    # 检查 ARP 表

# 4. DNS 是否正常
dig google.com +short
cat /etc/resolv.conf

# 5. 目标服务是否可达
curl -v http://target:port
nc -zv target port
\`\`\`

### 常见问题速查

| 问题现象 | 可能原因 | 排查命令 |
|----------|---------|----------|
| Connection Refused | 端口未监听 | ss -tlnp, systemctl status <服务> |
| Connection Timeout | 防火墙/路由问题 | traceroute, iptables -L |
| No Route to Host | 路由表错误 | ip route show |
| Name Resolution Failed | DNS 问题 | dig, nslookup, /etc/resolv.conf |
| TLS Handshake Failed | 证书或协议版本问题 | openssl s_client -connect |
| TIME_WAIT 过多 | 短连接过多 | sysctl net.ipv4.tcp_tw_reuse |