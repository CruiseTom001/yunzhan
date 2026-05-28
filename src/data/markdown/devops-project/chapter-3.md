## 4.1 Prometheus 配置

创建 `prometheus/prometheus.yml`：

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# 告警规则
rule_files:
  - "alerts/*.yml"

scrape_configs:
  # Prometheus 自身监控
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # 宿主机系统监控
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
        labels:
          instance: 'server-01'

  # MySQL 数据库监控
  - job_name: 'mysql-exporter'
    static_configs:
      - targets: ['mysql-exporter:9104']
        labels:
          instance: 'mysql-db'

  # Nginx 监控（需安装 nginx-module-vts）
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:8080']
        labels:
          instance: 'nginx-proxy'
```

## 4.2 告警规则

创建 `prometheus/alerts/memory.yml`：

```yaml
groups:
  - name: system_alerts
    interval: 30s
    rules:
      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "内存使用率超过 80%"
          description: "服务器 {{ $labels.instance }} 内存使用率 {{ $value }}%"

      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CPU 使用率超过 80%"
          description: "服务器 {{ $labels.instance }} CPU 使用率 {{ $value }}%"

      - alert: DiskAlmostFull
        expr: (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"}) * 100 < 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "磁盘空间不足 10%"
          description: "服务器 {{ $labels.instance }} 挂载点 {{ $labels.mountpoint }} 仅剩 {{ $value }}%"

      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "服务 {{ $labels.job }} 已宕机"
          description: "服务 {{ $labels.instance }} ({{ $labels.job }}) 已停止响应超过 1 分钟"
```

## 4.3 Grafana 仪表板

登录 Grafana（默认 admin/GrafanaP@ss2024!），导入以下仪表板 ID：

| 仪表板 | ID | 用途 |
|--------|-----|------|
| Node Exporter Full | 1860 | 完整主机监控 |
| MySQL Overview | 7362 | 数据库监控 |
| NGINX Overview | 11199 | Nginx 监控 |
| Docker Monitoring | 193 | 容器监控 |

### 访问地址

- **WordPress**: http://localhost
- **Grafana**: http://localhost:3000 （默认 admin/GrafanaP@ss2024!）
- **Prometheus**: http://localhost:9090
- **Node Exporter Metrics**: http://localhost:9100/metrics
