## Service 与网络

Service 是 Kubernetes 中将一组 Pod 暴露为网络服务的抽象方式。

### Service 类型

| 类型 | 访问范围 | 说明 |
|------|----------|------|
| ClusterIP | 集群内部 | 默认类型，仅集群内可访问 |
| NodePort | 集群外部 | 在每个节点上开放端口 |
| LoadBalancer | 集群外部 | 云服务商负载均衡器 |
| ExternalName | DNS 映射 | 将服务映射到外部 DNS |
| Headless | 无 ClusterIP | 直接返回 Pod IP 列表 |

### Ingress

Ingress 提供 HTTP/HTTPS 路由规则，将外部流量导入集群内的 Service。

### NetworkPolicy

NetworkPolicy 定义 Pod 之间的网络访问规则，实现微服务间的网络隔离。

### 网络调试技巧

- kubectl run -it --rm debug --image=nicolaka/netshoot -- bash
- kubectl port-forward svc/my-service 8080:80
- kubectl -n kube-system logs -l k8s-app=kube-dns

### CoreDNS 配置

CoreDNS 是 Kubernetes 集群的默认 DNS 服务。