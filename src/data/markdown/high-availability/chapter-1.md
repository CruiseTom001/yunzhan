## 负载均衡深度实践

### L4 vs L7 负载均衡

| 特性 | L4 | L7 |
|------|-----|-----|
| 工作层级 | TCP/UDP | HTTP/HTTPS |
| 路由依据 | IP + Port | URL、Header、Cookie |
| 性能 | 高 | 中 |
| 典型产品 | LVS, HAProxy(tcp) | Nginx, HAProxy(http) |

### HAProxy 配置

前端配置 → ACL 路由 → 后端配置 + 健康检查

### Keepalived + VIP 高可用

通过 VRRP 协议实现 VIP 漂移，配合 HAProxy 实现负载均衡器自身的高可用。

### 会话保持

- IP Hash
- Sticky Cookie
- Redis 共享 Session（推荐）