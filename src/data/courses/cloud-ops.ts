import type { Course } from '@/types'

export const course: Course = {
  id: 'cloud-ops',
  title: '云服务运维',
  description: '云原生架构实践、混合云管理、成本优化与多云策略',
  icon: 'CloudLightning',
  difficulty: 'advanced',
  category: 'cloud',
  prerequisites: ['linux-basics', 'networking'],
  estimatedHours: 20,
  chapters: [
    {
      index: 0,
      title: '云原生架构',
      contentFile: 'cloud-ops/chapter-0.md',
      content: '',
      keyConcepts: ['12-Factor App', 'ConfigMap/Secret', 'Graceful Shutdown', 'Service Mesh', 'Sidecar']
    },
    {
      index: 1,
      title: '云服务管理',
      contentFile: 'cloud-ops/chapter-1.md',
      content: '',
      keyConcepts: ['VPC 网络规划', 'Terraform IaC', 'SLB 配置', '安全组', '资源Tag管理']
    },
    {
      index: 2,
      title: '混合云与多云策略',
      contentFile: 'cloud-ops/chapter-2.md',
      content: '',
      keyConcepts: ['混合云架构', '多云策略', 'Karmada 多集群', '跨云网络', 'VPN vs 专线']
    },
    {
      index: 3,
      title: '云成本优化',
      contentFile: 'cloud-ops/chapter-3.md',
      content: '',
      keyConcepts: ['FinOps 三大支柱', '预留实例/Spot', '资源标签管理', '成本可视化', '自动化清理']
    },
    {
      index: 4,
      title: '云上安全最佳实践',
      contentFile: 'cloud-ops/chapter-4.md',
      content: '',
      keyConcepts: ['责任共担模型', 'RAM 权限管理', '安全组与分层隔离', 'WAF 防护', '数据加密与 KMS']
    }
  ]
}
