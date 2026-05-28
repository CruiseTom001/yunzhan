## 2.1 SRE 概述

SRE（Site Reliability Engineering）是由 Google 提出的运维方法论。

### SLI / SLO / SLA

| 概念 | 含义 | 示例 |
|------|------|------|
| SLI | 服务水平量化指标 | P99 延迟 200ms |
| SLO | 服务水平内部目标 | 99.95% 成功率 |
| SLA | 对客户的服务水平承诺 | 99.9% 可用性 |

### Error Budget（错误预算）

Error Budget = 1 - SLO
预算耗尽时暂停新功能发布，专注提升稳定性。

### SRE 关键实践

1. 减少重复劳动（Toil）
2. 监控与告警
3. 容量规划
4. 变更管理
5. 紧急响应