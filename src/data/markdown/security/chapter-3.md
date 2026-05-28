## 常见攻击类型与防御

### DDoS 攻击与防御

1. 流量型攻击（UDP Flood、DNS Amplification）
2. 协议型攻击（SYN Flood）
3. 应用层攻击（HTTP Flood、Slowloris）

### SQL 注入防御

- WAF 规则
- 最小权限原则
- 参数化查询

### XSS（跨站脚本）防御

- CSP（Content Security Policy）
- X-XSS-Protection
- X-Content-Type-Options

### CSRF（跨站请求伪造）防御

- SameSite Cookie 属性

### 纵深防御体系

CDN/Anti-DDoS → WAF → 反向代理/网关 → 应用服务器 → 数据库