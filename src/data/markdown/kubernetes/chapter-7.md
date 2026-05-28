## 集群监控与日志

### Metrics Server

为 HPA 和 kubectl top 提供资源指标数据。

### Prometheus Operator（kube-prometheus-stack）

一键部署 Prometheus + Grafana + Alertmanager + Node Exporter。

### ServiceMonitor 和 PodMonitor CRD

声明式管理 Prometheus 采集目标。

### PromQL 常用查询

CPU、内存、磁盘、网络、应用层指标查询。

### EFK/ELK 与 Loki 日志收集

轻量级 Loki 方案适合 Kubernetes 环境。

### 监控体系最佳实践

1. 分层监控：基础设施 → 平台 → 应用
2. 四个黄金信号：延迟、流量、错误、饱和度
3. 告警分级：P0 → P1 → P2 → P3
4. 结构化日志：JSON 格式，包含 trace_id