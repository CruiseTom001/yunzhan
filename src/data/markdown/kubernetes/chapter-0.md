## K8s 架构详解

Kubernetes（K8s）是一个开源的容器编排平台，用于自动化部署、扩展和管理容器化应用。它由 Google 基于 Borg 系统的经验设计，现在是 CNCF 的毕业项目。

### 集群架构总览

\`\`\`
                     ┌──────────────────────────┐
                     │       Cloud Provider      │
                     └──────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
    ┌─────────▼─────────┐   ┌─────────▼─────────┐   ┌─────────▼─────────┐
    │    Control Plane  │   │      Node 1       │   │      Node 2       │
    │                   │   │                   │   │                   │
    │  ┌─────────────┐  │   │  ┌─────────────┐  │   │  ┌─────────────┐  │
    │  │  API Server │  │   │  │   kubelet   │  │   │  │   kubelet   │  │
    │  └──────┬──────┘  │   │  └──────┬──────┘  │   │  └──────┬──────┘  │
    │         │         │   │         │         │   │         │         │
    │  ┌──────▼──────┐  │   │  ┌──────▼──────┐  │   │  ┌──────▼──────┐  │
    │  │    etcd     │  │   │  │ Container   │  │   │  │ Container   │  │
    │  └─────────────┘  │   │  │  Runtime    │  │   │  │  Runtime    │  │
    │                   │   │  └─────────────┘  │   │  └─────────────┘  │
    │  ┌─────────────┐  │   │                   │   │                   │
    │  │  Scheduler  │  │   │  ┌─────────────┐  │   │  ┌─────────────┐  │
    │  └─────────────┘  │   │  │  kube-proxy │  │   │  │  kube-proxy │  │
    │                   │   │  └─────────────┘  │   │  └─────────────┘  │
    │  ┌─────────────┐  │   │                   │   │                   │
    │  │  Controller │  │   │  Pod  Pod  Pod    │   │  Pod  Pod  Pod    │
    │  │   Manager   │  │   │                   │   │                   │
    │  └─────────────┘  │   └───────────────────┘   └───────────────────┘
    └───────────────────┘
\`\`\`

### Control Plane 组件详解

#### kube-apiserver

API Server 是整个集群的**唯一入口**，所有组件都通过它通信。它是 Kubernetes 的前端控制面。

**核心职责：**
- 提供 RESTful API (kubectl、dashboard 等都通过它操作)
- 认证、授权和准入控制
- 数据校验和变更

#### etcd

etcd 是 Kubernetes 的**持久化后端存储**，保存了集群的所有状态数据。

#### kube-scheduler

Scheduler 负责将新创建的 Pod **分配到合适的 Node** 上。

**调度流程：**
1. **过滤（Filtering）**：排除不满足条件的节点
2. **打分（Scoring）**：对剩余节点进行评分
3. **绑定（Binding）**：选择得分最高的节点并绑定

#### kube-controller-manager

Controller Manager 运行多个控制器，每个控制器都是独立的控制循环。

| 控制器 | 职责 |
|--------|------|
| Node Controller | 监控节点状态，处理节点不可达 |
| Replication Controller | 维护 Pod 副本数 |
| Endpoints Controller | 填充 Endpoints 对象 |
| Service Account Controller | 为命名空间创建默认 ServiceAccount |
| Namespace Controller | 管理命名空间生命周期 |
| Deployment Controller | 管理 Deployment 的滚动更新 |

### Node 组件详解

#### kubelet

kubelet 是每个 Node 上的**主要代理**，负责维护 Pod 的生命周期。

#### kube-proxy

kube-proxy 在每个 Node 上运行，实现 Kubernetes Service 的网络代理。

#### Container Runtime

| 运行时 | 描述 |
|--------|------|
| containerd | 最常用，Docker 的底层运行时 |
| CRI-O | 专为 Kubernetes 设计 |
| Docker Engine | 通过 cri-dockerd 适配器支持 |

### 集群通信流程

当创建 Pod 时，完整的通信流程：

\`\`\`
kubectl → API Server → etcd（存储）→ Scheduler（调度）
    → kubelet（创建容器）→ Container Runtime（运行容器）
    → kubelet（上报状态）→ API Server → etcd（更新状态）
\`\`\`

### 推荐的集群搭建方式

\`\`\`bash
# 使用 kubeadm 搭建（学习/测试环境）
sudo kubeadm init --pod-network-cidr=10.244.0.0/16

mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

kubeadm join 192.168.1.10:6443 --token <token> \\
    --discovery-token-ca-cert-hash sha256:<hash>

kubectl get nodes
kubectl get pods -A
\`\`