## 防火墙策略管理

### Iptables 核心概念

四表五链：filter/nat/mangle/raw 和 INPUT/OUTPUT/FORWARD/PREROUTING/POSTROUTING

### 防御规则

- SYN Flood 防御：限制新连接速率
- 端口扫描防御：connlimit
- ICMP Flood 防御：limit

### Firewalld 管理

基于 Zone 和 Service 的动态防火墙，支持 Rich Rules 和 Direct Rules。