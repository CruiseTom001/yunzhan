import type { Course } from '@/types'

export const course: Course = {
  id: 'kubernetes',
  title: 'Kubernetes',
  description: 'K8s 架构深入理解、Pod/Service/Deployment 管理、Gateway API、Helm 与集群运维',
  icon: 'Ship',
  difficulty: 'advanced',
  category: 'container',
  prerequisites: ['docker'],
  estimatedHours: 27,
  chapters: [
    {
      index: 0,
      title: 'K8s 架构详解',
            contentFile: 'kubernetes/chapter-0.md',
      content: '',
      keyConcepts: ['API Server', 'etcd', 'Scheduler', 'Controller Manager', 'kubelet', 'kube-proxy', 'CRI', 'Control Plane', 'Worker Node']
    },
    {
      index: 1,
      title: 'Pod 与容器设计模式',
            contentFile: 'kubernetes/chapter-1.md',
      content: '',
      keyConcepts: ['Pod', 'Init Container', 'Sidecar', 'Ambassador', 'Probes', 'Lifecycle Hooks', 'QoS', '资源管理']
    },
    {
      index: 2,
      title: 'Service 与网络',
            contentFile: 'kubernetes/chapter-2.md',
      content: '',
      keyConcepts: ['ClusterIP', 'NodePort', 'LoadBalancer', 'Ingress', 'Headless Service', 'NetworkPolicy', 'CoreDNS', 'Endpoints']
    },
    {
      index: 3,
      title: 'Deployment 与滚动更新',
            contentFile: 'kubernetes/chapter-3.md',
      content: '',
      keyConcepts: ['Deployment', 'RollingUpdate', 'Recreate', '回滚', '金丝雀发布', '蓝绿部署', 'HPA', 'PodDisruptionBudget']
    },
    {
      index: 4,
      title: 'ConfigMap 与 Secret 管理',
            contentFile: 'kubernetes/chapter-4.md',
      content: '',
      keyConcepts: ['ConfigMap', 'Secret', 'Opaque', 'TLS Secret', 'Docker Registry Secret', 'Sealed Secrets', 'External Secrets', 'RBAC']
    },
    {
      index: 5,
      title: '存储管理（PV/PVC/StorageClass）',
            contentFile: 'kubernetes/chapter-5.md',
      content: '',
      keyConcepts: ['PV', 'PVC', 'StorageClass', 'CSI', 'RWO', 'RWX', 'StatefulSet', 'VolumeSnapshot', 'ReclaimPolicy']
    },
    {
      index: 6,
      title: 'Helm 包管理',
            contentFile: 'kubernetes/chapter-6.md',
      content: '',
      keyConcepts: ['Chart', 'Repository', 'Release', 'Values', 'Template', 'Rollback', 'Dependencies', 'OCI']
    },
    {
      index: 7,
      title: '集群监控与日志',
            contentFile: 'kubernetes/chapter-7.md',
      content: '',
      keyConcepts: ['Metrics Server', 'Prometheus Operator', 'ServiceMonitor', 'PromQL', 'Grafana', 'Alertmanager', 'EFK', 'Loki']
    },
    {
      index: 8,
      title: 'Gateway API 与现代流量入口',
      contentFile: 'kubernetes/chapter-8.md',
      content: '',
      keyConcepts: ['Gateway API', 'GatewayClass', 'Gateway', 'HTTPRoute', 'Listener', 'parentRefs', '流量分割', '跨命名空间路由']
    }
  ]
}
