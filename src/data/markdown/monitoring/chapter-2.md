## Grafana 可视化

Grafana 是一个开源的数据可视化和监控平台，支持多种数据源。

### 核心概念

| 概念 | 说明 |
|------|------|
| Data Source | 数据源（Prometheus、Loki 等） |
| Dashboard | 仪表盘（一组 Panel 的集合） |
| Panel | 面板（单个图表） |
| Variable | 变量（动态筛选器） |

### Panel 类型

| 类型 | 用途 |
|------|------|
| Time Series | 时序折线图（最常用） |
| Stat | 单个数值展示 |
| Gauge | 仪表盘 |
| Table | 数据表格 |
| Heatmap | 热力图 |

### Variables（变量）

变量使 Dashboard 动态化，用户可以交互式筛选数据。

### 推荐 Dashboard

| Dashboard ID | 名称 | 用途 |
|--------------|------|------|
| 1860 | Node Exporter Full | 主机详细指标 |
| 315 | Kubernetes Cluster | K8s 集群监控 |
| 6417 | K8s Cluster (Prometheus) | K8s 集群概览 |