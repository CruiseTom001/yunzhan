## 灾备策略

### RPO 与 RTO

- RPO（Recovery Point Objective）：能容忍的最大数据丢失量
- RTO（Recovery Time Objective）：能容忍的最大恢复时间

### 备份策略类型

- 冷备（Cold Standby）：成本最低，RTO 最长
- 温备（Warm Standby）：定期同步数据
- 热备（Hot Standby）：实时同步，自动切换

### 两地三中心

同城（低延迟，双活/主备）+ 异地（防城市级灾难）

### 灾难恢复演练计划

Q1: 单服务故障恢复演练 → Q2: 数据库主备切换演练 → Q3: 同城数据中心切换演练 → Q4: 异地灾备全链路压测