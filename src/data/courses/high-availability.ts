import type { Course } from '@/types'

export const course: Course = {
  id: 'high-availability',
  title: '高可用与灾备',
  description: '高可用架构设计、负载均衡策略、数据备份与灾难恢复方案',
  icon: 'Cloud',
  difficulty: 'advanced',
  category: 'architecture',
  chapters: [
    {
      index: 0,
      title: '高可用架构设计原则',
      contentFile: 'high-availability/chapter-0.md',
      content: '',
      keyConcepts: ['可用性等级', 'CAP 理论', 'N+1 冗余', '故障域隔离', 'Chaos Engineering']
    },
    {
      index: 1,
      title: '负载均衡深度实践',
      contentFile: 'high-availability/chapter-1.md',
      content: '',
      keyConcepts: ['L4 vs L7', 'HAProxy 配置', 'Keepalived VIP', '负载均衡算法', '健康检查']
    },
    {
      index: 2,
      title: '数据库高可用',
      contentFile: 'high-availability/chapter-2.md',
      content: '',
      keyConcepts: ['MHA 故障切换', 'Patroni 自动切换', '读写分离', '脑裂避免', '切换 CheckList']
    },
    {
      index: 3,
      title: '灾备策略',
      contentFile: 'high-availability/chapter-3.md',
      content: '',
      keyConcepts: ['RPO/RTO', '冷备/热备/温备', '两地三中心', 'xtrabackup', '恢复演练']
    },
    {
      index: 4,
      title: '应急响应流程',
      contentFile: 'high-availability/chapter-4.md',
      content: '',
      keyConcepts: ['故障等级 P0-P3', '故障检测→止损→恢复→复盘', '无指责文化', '5 Why 分析', 'SOP 模板']
    },
    {
      index: 5,
      title: '压测与容量规划',
      contentFile: 'high-availability/chapter-5.md',
      content: '',
      keyConcepts: ['压测策略', 'JMeter/wrk', '容量水位', 'HPA 自动扩容', '容量规划公式']
    }
  ],
  prerequisites: ['linux-basics', 'web-server'],
  estimatedHours: 16,
}
