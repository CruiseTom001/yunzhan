## OpenTelemetry 统一可观测性

传统监控经常是三套系统各管一摊：

- Metrics 用 Prometheus。
- Logs 用 ELK/Loki。
- Traces 用 Jaeger/Tempo。

问题是：一次故障往往跨越三类信号。如果没有统一的上下文，你会在多个系统里反复搜索同一个请求、用户、实例、版本号。

OpenTelemetry 的价值是提供统一的采集、传播、语义约定和导出方式，让 Trace、Metric、Log 能围绕同一套上下文协作。

### 三类信号

| 信号 | 关注点 | 典型问题 |
| --- | --- | --- |
| Trace | 单次请求经过了哪些服务、每一步耗时多少 | 慢请求卡在哪个下游 |
| Metric | 一段时间内系统整体状态 | 错误率、延迟、吞吐量是否异常 |
| Log | 某个事件的详细上下文 | 具体错误栈、业务参数、异常原因 |

成熟的排查路径通常是：

1. 告警由 Metric 触发。
2. 从 Dashboard 找到异常服务和时间段。
3. 打开 Trace 看慢在哪一段。
4. 跳到关联 Log 看具体错误。

### Collector 架构

OpenTelemetry Collector 通常部署在两种位置：

- Agent 模式：每台节点或每个 Pod Sidecar 旁边收集本地数据。
- Gateway 模式：集中接收各应用上报，统一处理后写入后端。

典型链路：

```text
应用 SDK / Agent
        │ OTLP
        ▼
OpenTelemetry Collector
        │
        ├── Prometheus / Mimir / VictoriaMetrics
        ├── Tempo / Jaeger
        └── Loki / Elasticsearch
```

### Collector 最小配置

```yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:

processors:
  batch:
  resource:
    attributes:
      - key: deployment.environment
        value: production
        action: upsert

exporters:
  logging:
    verbosity: normal
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [resource, batch]
      exporters: [otlp/tempo, logging]
```

### 语义约定为什么重要

语义约定就是“大家都用同样的字段名描述同样的事”。

例如 HTTP 服务建议围绕这些字段组织：

| 字段 | 含义 |
| --- | --- |
| `service.name` | 服务名 |
| `deployment.environment` | 环境，如 production/staging |
| `http.request.method` | 请求方法 |
| `url.path` | 请求路径 |
| `http.response.status_code` | 响应状态码 |

如果每个团队都自己造字段，比如 `app`、`svc`、`serviceName` 混用，后期做统一 Dashboard、告警、链路搜索会非常痛苦。

### 在应用中接入的思路

以 Node.js 为例，常见接入方式：

```bash
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

启动时通过环境变量配置：

```bash
OTEL_SERVICE_NAME=yunzhan-api \
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318 \
node --require ./otel-bootstrap.js server.js
```

运维要关注的不是某个语言 SDK 的细节，而是统一约定：

- 服务名必须稳定。
- 环境、版本、集群、命名空间等资源属性必须完整。
- Trace ID 要能进入日志。
- Collector 配置要受版本控制。

### 告警与 Trace 联动

Prometheus 告警可以先发现问题：

```promql
histogram_quantile(
  0.95,
  sum(rate(http_server_duration_bucket[5m])) by (le, service_name)
) > 0.8
```

然后在 Trace 后端按 `service.name`、`http.response.status_code`、时间范围继续定位。

### 常见坑

| 问题 | 原因 | 处理 |
| --- | --- | --- |
| Trace 很多但查不到服务 | `service.name` 缺失或不稳定 | 强制在启动参数中设置 |
| 日志无法跳到 Trace | 日志没有注入 trace_id/span_id | 配置日志框架注入上下文 |
| Collector CPU 飙高 | 未做 batch 或采样，数据量过大 | 增加 batch、tail sampling、限流 |
| 不同系统字段不一致 | 没遵循语义约定 | 统一资源属性和命名规范 |
| 开发环境污染生产数据 | environment 标签缺失 | 强制写入 `deployment.environment` |

### 实战任务

1. 为一个 HTTP 服务接入 OpenTelemetry SDK。
2. 部署一个 Collector。
3. 通过 OTLP 接收 Trace。
4. 在日志中打印 `trace_id`。
5. 让慢请求告警能跳转到对应 Trace。

完成后，你应该能把“服务慢了”从一个模糊现象拆成：

- 哪个服务慢。
- 哪个接口慢。
- 哪个下游调用慢。
- 哪条日志解释了失败原因。
