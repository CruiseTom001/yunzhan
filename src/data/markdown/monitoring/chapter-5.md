## 黑盒监控（Blackbox Exporter）

Blackbox Exporter 通过 HTTP、HTTPS、DNS、TCP、ICMP 等协议从外部探测服务的可用性和性能。

### 核心探测模块

- http_2xx: HTTP 探测（期望 2xx 响应）
- tcp_connect: TCP 端口连通性
- icmp: ICMP Ping 探测
- dns_soa: DNS 解析探测

### 核心 Blackbox 指标

- probe_success: 探测是否成功
- probe_duration_seconds: 探测耗时
- probe_ssl_earliest_cert_expiry: SSL 证书到期时间