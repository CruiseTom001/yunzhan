## 6.1 交换机（Switch）

### 工作原理

交换机工作在 OSI 第二层（数据链路层），根据 **MAC 地址**转发数据帧。

\`\`\`
交换机通过自学习建立 MAC 地址表：
┌─────────────┐
│  MAC 地址表  │
├─────────────┤
│ MAC → Port  │
│ AA:BB → 1   │
│ CC:DD → 2   │
│ EE:FF → 3   │
└─────────────┘

收到帧时：
1. 查询目标 MAC 在哪个端口
2. 如果知道 → 单播转发到对应端口
3. 如果不知道 → 泛洪到所有端口（除接收端口）
\`\`\`

### 交换机类型

| 类型 | 工作层级 | 功能 | 适用场景 |
|------|---------|------|----------|
| 二层交换机 | L2 (数据链路层) | 基于 MAC 转发 | 小型局域网 |
| 三层交换机 | L3 (网络层) | 支持路由功能，VLAN 间路由 | 企业核心网络 |
| 网管型交换机 | L2/L3 | 支持 VLAN、STP、SNMP、ACL | 生产环境 |
| 非网管型交换机 | L2 | 即插即用，无管理功能 | 测试环境 |

### VLAN（虚拟局域网）

VLAN 将一个物理交换机划分为多个逻辑隔离的广播域。

\`\`\`
物理交换机 ──→ VLAN 10 (开发)
           ├──→ VLAN 20 (测试)
           └──→ VLAN 30 (生产)

配合 Trunk 端口（802.1Q）实现跨交换机的 VLAN 通信。
\`\`\`

## 6.2 路由器（Router）

### 工作原理

路由器工作在 OSI 第三层（网络层），根据 **IP 地址**转发数据包。

\`\`\`
路由表示例：
Destination     Gateway         Genmask         Iface
0.0.0.0         192.168.1.1     0.0.0.0         eth0    ← 默认路由
192.168.1.0     0.0.0.0         255.255.255.0   eth0    ← 直连网络
10.0.0.0        192.168.1.254   255.0.0.0       eth0    ← 静态路由
\`\`\`

### 路由类型

| 类型 | 说明 | 配置方式 |
|------|------|---------|
| 直连路由 | 路由器接口直连的网段 | 自动生成 |
| 静态路由 | 管理员手动配置 | ip route add |
| 默认路由 | 匹配所有目标地址（0.0.0.0/0） | ip route add default via |
| 动态路由 | 路由协议自动学习和更新 | OSPF, BGP, RIP |

### Linux 作为路由器

\`\`\`bash
# 启用 IP 转发
echo 1 > /proc/sys/net/ipv4/ip_forward
# 永久生效
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sysctl -p

# 配置 NAT（MASQUERADE）
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# 查看路由表
ip route show
route -n
\`\`\`

## 6.3 防火墙（Firewall）

### 防火墙类型

| 类型 | 工作层级 | 特点 | 代表 |
|------|---------|------|------|
| 包过滤防火墙 | L3/L4 | 基于 IP/端口/协议过滤 | iptables, nftables |
| 状态检测防火墙 | L3/L4 | 跟踪连接状态，智能过滤 | iptables (stateful) |
| 应用层防火墙 | L7 | 深度包检测，应用协议识别 | ModSecurity, WAF |
| 下一代防火墙 | L3-L7 | 集成 IPS、AV、应用识别 | Palo Alto, FortiGate |

### iptables 基础

\`\`\`bash
# 查看规则
iptables -L -n -v

# 允许特定端口
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# 允许特定 IP
iptables -A INPUT -s 192.168.1.100 -j ACCEPT

# 拒绝特定 IP
iptables -A INPUT -s 10.0.0.5 -j DROP

# 允许已建立的连接
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 默认策略
iptables -P INPUT DROP       # 默认拒绝所有入站
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT    # 默认允许所有出站

# 保存规则
iptables-save > /etc/iptables/rules.v4   # Debian/Ubuntu
iptables-save > /etc/sysconfig/iptables  # CentOS/RHEL
\`\`\`

### iptables 五链三表

| 表 | 用途 | 链 |
|----|------|-----|
| filter | 数据包过滤（默认表） | INPUT, OUTPUT, FORWARD |
| nat | 网络地址转换 | PREROUTING, POSTROUTING, OUTPUT |
| mangle | 修改数据包 | 全部五链 |

## 6.4 负载均衡器（Load Balancer）

### 负载均衡层级

| 层级 | 说明 | 代表 |
|------|------|------|
| L4 (传输层) | 基于 IP + 端口分发 | LVS, HAProxy (TCP mode), Nginx Stream |
| L7 (应用层) | 基于 HTTP Header/URL/Cookie 分发 | Nginx, HAProxy (HTTP mode), Traefik |

### 负载均衡算法

| 算法 | 说明 | 适用场景 |
|------|------|----------|
| Round Robin | 依次轮询 | 后端服务器性能相近 |
| Least Connections | 发给连接最少的服务器 | 长连接服务 |
| IP Hash | 根据客户端 IP 哈希分配 | 需要会话保持 |
| Weighted | 按权重比例分配 | 后端性能不均衡 |
| Least Time | 发给响应最快的服务器 | 对延迟敏感的场景 |

### Nginx 负载均衡配置示例

\`\`\`nginx
upstream backend {
    least_conn;                    # 最少连接算法
    server 10.0.0.1:8080 weight=3; # 权重 3
    server 10.0.0.2:8080 weight=1; # 权重 1
    server 10.0.0.3:8080 backup;   # 备用节点
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
\`\`\`

## 6.5 网络架构模式

### 典型三层架构

\`\`\`
                         ┌──────────┐
      Internet ──────────│  路由器   │────────── WAN
                         └────┬─────┘
                              │
                         ┌────┴─────┐
                         │  防火墙   │
                         └────┬─────┘
                              │
                    ┌─────────┴─────────┐
                    │   核心交换机(L3)    │
                    └───┬──────┬──────┬─┘
                        │      │      │
              ┌─────────┤      │      ├─────────┐
              │         │      │      │         │
         ┌────┴────┐ ┌──┴──┐┌──┴──┐ ┌┴──────────┐
         │ 接入交换 │ │ Web ││ App │ │  Database  │
         │ (Access) │ │ 层  ││ 层  │ │    层      │
         └─────────┘ └─────┘└─────┘ └────────────┘
\`\`\`

### 运维关注点

- **单点故障**：关键设备和链路需冗余
- **带宽瓶颈**：监控核心链路利用率
- **安全边界**：明确信任域和非信任域
- **可扩展性**：预留横向扩展能力