## Prometheus 架构

Prometheus 是一个开源的系统监控和告警工具包，采用 Pull 模式采集指标。

### 整体架构

Prometheus Server 包含 Retrieval（采集）、TSDB（存储）、HTTP Server（查询）三个核心组件。

### TSDB（时序数据库）

数据模型：指标名称{标签} 值 @时间戳

### PromQL 查询语言

- rate() - 计算每秒增长率（适合 Counter）
- irate() - 瞬时增长率
- increase() - 时间范围内的增量
- histogram_quantile() - 分位数计算

### Exporters（数据采集器）

| Exporter | 端口 | 采集对象 |
|----------|------|----------|
| node_exporter | 9100 | Linux/Unix 主机 |
| blackbox_exporter | 9115 | 网络探测 |
| mysqld_exporter | 9104 | MySQL |
| redis_exporter | 9121 | Redis |

### Prometheus 配置文件

定义 scrape_configs、rule_files、alerting 等。