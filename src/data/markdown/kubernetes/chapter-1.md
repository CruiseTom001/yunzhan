## Pod 与容器设计模式

Pod 是 Kubernetes 中最小的调度单元，是一个或多个容器的组合。这些容器共享网络命名空间、IPC 命名空间和存储卷。

### Pod 生命周期

\`\`\`
Pending → Running → Succeeded/Failed
              ↓
          Unknown
\`\`\`

**Pod 状态详解：**
- **Pending**：Pod 已被创建，但一个或多个容器还未运行
- **Running**：Pod 已绑定到节点，所有容器已创建
- **Succeeded**：所有容器已成功终止，不会重启
- **Failed**：所有容器已终止，至少一个容器以失败终止
- **Unknown**：无法获取 Pod 状态

### 探针（Probes）详解

| 参数 | 说明 | 默认值 |
|------|------|--------|
| initialDelaySeconds | 容器启动后等待时间 | 0 |
| periodSeconds | 探测频率 | 10 |
| timeoutSeconds | 探测超时 | 1 |
| successThreshold | 连续成功次数 | 1 |
| failureThreshold | 连续失败次数 | 3 |

- **livenessProbe**：存活探针，容器是否存活
- **readinessProbe**：就绪探针，容器是否可以接收流量
- **startupProbe**：启动探针，容器是否已启动

### Init Container（初始化容器）

Init Container 在应用容器启动之前运行，必须成功完成后才能启动应用容器。

### Sidecar 模式

Sidecar 是一种将辅助功能部署在独立容器中的模式，与主应用容器共享 Pod。

### Ambassador 模式

Ambassador 容器代理主容器的网络通信，常用于服务发现、连接池管理等。

### Lifecycle Hooks

postStart（容器启动后）和 preStop（容器终止前）。

### 资源管理

QoS 等级（由 requests 和 limits 决定）：
- Guaranteed: requests == limits
- Burstable: requests < limits
- BestEffort: 没有设置任何 requests 和 limits