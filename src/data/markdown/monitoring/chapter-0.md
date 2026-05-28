## 监控体系概述

现代运维监控体系通常由三大支柱构成：指标监控（Metrics）、日志监控（Logging）和链路追踪（Tracing）。

### 三大监控支柱

- Metrics：回答"出问题了？"（CPU/内存/磁盘）
- Logging：回答"哪里出问题？"（错误日志/堆栈）
- Tracing：回答"为什么出问题？"（调用链/耗时分析）

### 常见指标类型

| 类型 | 示例 | 用途 |
|------|------|------|
| Counter | HTTP 请求总数 | 只增不减的累计值 |
| Gauge | 内存使用量 | 可增可减的瞬时值 |
| Histogram | 请求延迟分布 | 数据分布统计 |
| Summary | P99 延迟 | 分位数统计 |

### 四个黄金信号（Google SRE）

1. 延迟（Latency）：请求响应时间
2. 流量（Traffic）：请求速率（QPS）
3. 错误（Errors）：失败请求比例
4. 饱和度（Saturation）：资源使用程度

### 监控系统选型对比

| 工具 | 类型 | 存储 | 查询语言 | 适用规模 |
|------|------|------|----------|----------|
| Prometheus | Metrics | 本地 TSDB | PromQL | 中小规模 |
| Thanos | Metrics | 对象存储 | PromQL | 大规模 |
| ELK Stack | Logging | Elasticsearch | KQL/Lucene | 全规模 |
| Loki | Logging | 对象存储 | LogQL | 云原生 |
| Jaeger | Tracing | Cassandra/ES | Jaeger UI | 全规模 |
| Grafana | 可视化 | 多数据源 | 各数据源 DSL | 通用 |