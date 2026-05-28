## 告警规则配置

Alertmanager 负责接收告警、去重、分组、路由到正确的接收者。

### Alertmanager 功能

- Inhibit（抑制）：高级别告警抑制低级别告警
- Silence（静默）：已知维护时静默告警
- Grouping（分组）：同类告警合并
- Routing（路由）：不同告警发不同渠道

### 告警最佳实践

1. 告警分级：P0（Critical）→ P1（High）→ P2（Medium）→ P3（Low）
2. 合理设置告警阈值，避免告警疲劳
3. 告警信息完整性：summary + description + runbook_url
4. 告警生命周期管理：每个告警必须有负责人