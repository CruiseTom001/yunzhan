## Deployment 与滚动更新

Deployment 是 Kubernetes 中最常用的工作负载资源。

### 更新策略详解

#### RollingUpdate（滚动更新）

关键参数：
- maxSurge: 超出期望副本数的最大 Pod 数
- maxUnavailable: 更新期间不可用的最大 Pod 数
- minReadySeconds: Pod 就绪后的最小等待时间

#### Recreate（重新创建）

⚠️ Recreate 方式会导致服务中断，仅适用于不支持多版本共存的应用。

### 常用 Deployment 命令

\`\`\`bash
kubectl apply -f deployment.yaml
kubectl rollout status deployment/myapp-deployment
kubectl rollout history deployment/myapp-deployment
kubectl rollout undo deployment/myapp-deployment
kubectl rollout restart deployment/myapp-deployment
kubectl scale deployment/myapp-deployment --replicas=5
\`\`\`

### 金丝雀发布与蓝绿部署

通过多个 Deployment + Service 选择器实现流量分配。

### HPA（水平自动扩缩）

基于 CPU/内存或其他自定义指标自动调整 Pod 副本数。