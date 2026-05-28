## Node Exporter 与系统指标监控

Node Exporter 暴露 Linux/Unix 系统的硬件和操作系统指标。

### CPU 指标

- node_cpu_seconds_total: CPU 各模式时间统计
- CPU 使用率 = 100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

### 内存指标

- node_memory_MemTotal_bytes: 内存总量
- node_memory_MemAvailable_bytes: 可用内存
- 内存使用率 = (1 - MemAvailable/MemTotal) * 100

### 磁盘指标

- node_filesystem_size_bytes / node_filesystem_free_bytes
- node_disk_read_bytes_total / node_disk_written_bytes_total
- 预测磁盘满载: predict_linear(node_filesystem_free_bytes[6h], 7*24*3600) < 0

### 网络指标

- node_network_receive_bytes_total / node_network_transmit_bytes_total
- node_netstat_Tcp_CurrEstab: TCP 连接数

### 配置告警规则

定义 NodeDown、HighCPUUsage、HighMemoryUsage、DiskFull 等告警规则。