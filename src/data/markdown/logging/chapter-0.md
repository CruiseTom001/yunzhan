## 日志系统架构设计

日志系统是现代运维体系的核心基础设施之一。一个完善的日志系统通常分为五个关键环节：采集 → 传输 → 存储 → 分析 → 可视化。

### 架构分层

| 层级 | 职责 | 常用技术 |
|------|------|----------|
| 采集层 | 从各种数据源获取日志 | Filebeat, Fluentd, Log4j Appender, Syslog |
| 传输层 | 缓冲、过滤、路由日志流 | Kafka, Redis, Logstash |
| 存储层 | 持久化存储并建立索引 | Elasticsearch, ClickHouse, Loki |
| 分析层 | 聚合、搜索、告警 | Elasticsearch Query, Grafana Explore |
| 可视化层 | 图表、仪表盘、报表 | Kibana, Grafana |

### 典型架构一：ELK Stack（中小规模）

应用服务器 → Filebeat → Logstash → Elasticsearch → Kibana

### 典型架构二：Kafka 缓冲架构（大规模）

应用服务器 → Filebeat → Kafka → Logstash → Elasticsearch → Kibana

### 典型架构三：Loki 轻量架构（Kubernetes 环境）

Pod → Promtail → Loki → Grafana

### 日志分级标准

- DEBUG：调试信息
- INFO：关键业务流程节点
- WARN：潜在问题
- ERROR：需要人工介入的异常
- FATAL：系统级致命错误

### 日志容量规划

日日志量(GB) = QPS × 86400 × 平均日志大小(KB) / 1024 / 1024 × 采样率