## Kibana 可视化

Kibana 是 Elastic Stack 的数据可视化平台。

### KQL（Kibana Query Language）

- level: "ERROR"（精确匹配）
- message: *timeout*（模糊匹配）
- response_time > 3000 and status_code: 500（范围+组合查询）

### 常用图表类型

| 图表类型 | 适用场景 |
|----------|----------|
| Bar Chart | 错误日志按服务分组 |
| Line Chart | 请求量/错误率趋势 |
| Pie Chart | 状态码分布 |
| Data Table | Top N 慢请求 |

### Kibana 告警配置

基于 Elasticsearch 查询创建告警规则，支持 Webhook、Email、Slack 等通知渠道。