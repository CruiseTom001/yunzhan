## Logstash 管道配置

Logstash 采用 input → filter → output 三段式管道架构。

### Grok 调试技巧

Grok 是 Logstash 最强大的解析工具。

### 常用 Grok 模式

| 模式 | 匹配内容 |
|------|----------|
| %{IP} | IPv4/IPv6 地址 |
| %{TIMESTAMP_ISO8601} | ISO 格式时间 |
| %{NUMBER:field} | 数字 |
| %{WORD:field} | 单词 |
| %{GREEDYDATA:field} | 任意字符 |

### Pipeline 性能优化

- pipeline.workers: 工作线程数
- pipeline.batch.size: 批量大小
- queue.type: persisted（持久化队列）
- dead_letter_queue: 死信队列