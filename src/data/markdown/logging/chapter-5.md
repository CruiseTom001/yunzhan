## 结构化日志最佳实践

### 必选字段

- timestamp: ISO 8601 格式
- level: DEBUG | INFO | WARN | ERROR | FATAL
- service: 服务名称
- traceId: 分布式追踪 ID
- message: 人类可读的日志描述

### 各语言的日志库配置

- Java: Logback + JSON Encoder
- Python: structlog
- Node.js: pino

### 日志安全红线

| 禁止记录 | 替代方案 |
|----------|----------|
| 密码 | 记录 "password_changed" |
| Token / API Key | 记录 token 前 8 位 |
| 身份证号 | 脱敏为 320****1234 |
| 手机号 | 脱敏为 138****5678 |

### 日志即数据（Logs as Data）

结构化日志使得日志从"运维工具"升级为"数据资产"，可用于用户行为分析、业务指标统计等。