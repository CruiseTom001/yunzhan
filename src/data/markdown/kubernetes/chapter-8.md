## Gateway API 与现代流量入口

Ingress 解决了“把 HTTP/HTTPS 流量引入集群”的问题，但在生产中经常遇到边界：

- 不同 Ingress Controller 的注解差异很大。
- 网关能力、路由规则、TLS、流量治理都挤在一个资源里。
- 平台团队和应用团队很难分清职责。

Gateway API 是 Kubernetes 生态对流量入口的一次重新设计。它把“网关基础设施”和“应用路由规则”拆开，让平台团队负责 Gateway，应用团队负责 Route。

### 核心资源

| 资源 | 责任人 | 作用 |
| --- | --- | --- |
| `GatewayClass` | 平台/集群管理员 | 声明由哪个控制器实现网关能力 |
| `Gateway` | 平台团队 | 定义监听端口、协议、证书、允许哪些命名空间挂路由 |
| `HTTPRoute` | 应用团队 | 定义域名、路径、后端服务、权重、Header 匹配等 |
| `ReferenceGrant` | 平台/服务拥有者 | 允许跨命名空间引用资源 |

### GatewayClass

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: nginx
spec:
  controllerName: gateway.nginx.org/nginx-gateway-controller
```

`GatewayClass` 类似 StorageClass：它不直接接流量，而是告诉集群“这一类网关由哪个控制器负责”。

### Gateway

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: public-gateway
  namespace: platform
spec:
  gatewayClassName: nginx
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Selector
          selector:
            matchLabels:
              expose: public
```

这里平台团队只开放了带有 `expose=public` 标签的命名空间挂载路由，避免所有团队都能随意把服务暴露到公网。

### HTTPRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web-route
  namespace: app
spec:
  parentRefs:
    - name: public-gateway
      namespace: platform
  hostnames:
    - "www.example.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: web
          port: 80
```

应用团队只需要关心自己的域名、路径和后端 Service，不需要知道网关底层是 Nginx、Envoy 还是云厂商负载均衡。

### 金丝雀流量分割

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
  namespace: app
spec:
  parentRefs:
    - name: public-gateway
      namespace: platform
  hostnames:
    - "api.example.com"
  rules:
    - backendRefs:
        - name: api-stable
          port: 80
          weight: 90
        - name: api-canary
          port: 80
          weight: 10
```

这种写法比用 Ingress 注解更可读，也更利于跨控制器迁移。

### 与 Ingress 的关系

| 对比项 | Ingress | Gateway API |
| --- | --- | --- |
| 资源模型 | 单资源为主 | Gateway 与 Route 分离 |
| 扩展方式 | 大量 Controller 注解 | 标准化字段 + 扩展点 |
| 团队分工 | 容易混在一起 | 平台团队和应用团队边界清晰 |
| 流量治理 | 依赖具体实现 | 原生支持更丰富的路由模型 |

如果现有项目已经稳定使用 Ingress，不需要立刻迁移。但新平台、新多租户集群、需要统一入口治理的环境，建议优先学习 Gateway API。

### 运维排查命令

```bash
kubectl get gatewayclass
kubectl get gateway -A
kubectl get httproute -A
kubectl describe gateway -n platform public-gateway
kubectl describe httproute -n app web-route
```

重点看：

- Gateway 是否 Accepted。
- Listener 是否 Programmed。
- HTTPRoute 是否成功绑定到 Gateway。
- `parentRefs` 的 namespace/name 是否正确。
- 目标 Service 名称和端口是否存在。

### 实战任务

1. 创建一个 `platform` 命名空间放 Gateway。
2. 创建一个 `app` 命名空间放业务 Service。
3. 用 `HTTPRoute` 把 `app` 服务挂到 `platform/public-gateway`。
4. 再加一个 canary Service，用 `weight` 做 90/10 流量分割。

完成后你应该能解释：

- 为什么 Gateway API 更适合平台工程。
- `Gateway` 和 `HTTPRoute` 的职责边界。
- 如何用权重发布新版本。
- 如何排查路由没有生效的问题。
