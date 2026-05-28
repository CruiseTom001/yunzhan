import type { Course } from '@/types'

export const course: Course = {
  id: 'devops-sre',
  title: 'DevOps 与 SRE',
  description: 'DevOps 文化与实践、SRE 方法论、故障响应与复盘机制',
  icon: 'RefreshCw',
  difficulty: 'advanced',
  category: 'devops',
  chapters: [
    {
      index: 0,
      title: '第1章：DevOps 文化与实践',
      contentFile: 'devops-sre/chapter-0.md',
      content: '',
      keyConcepts: ['DevOps', 'CALMS 模型', 'CI/CD', '持续交付']
    },
    {
      index: 1,
      title: '第2章：SRE 方法论',
      contentFile: 'devops-sre/chapter-1.md',
      content: '',
      keyConcepts: ['SRE', 'SLI', 'SLO', 'SLA', 'Error Budget', 'Toil']
    },
    {
      index: 2,
      title: '第3章：故障管理与复盘',
      contentFile: 'devops-sre/chapter-2.md',
      content: '',
      keyConcepts: ['故障管理', 'Blameless Postmortem', '复盘', 'Runbook']
    },
    {
      index: 3,
      title: '第4章：变更管理与渐进式交付',
      contentFile: 'devops-sre/chapter-3.md',
      content: '',
      keyConcepts: ['渐进式交付', '蓝绿部署', '金丝雀发布', '功能开关']
    },
    {
      index: 4,
      title: '第5章：值班与 On-Call 管理',
      contentFile: 'devops-sre/chapter-4.md',
      content: '',
      keyConcepts: ['On-Call', '告警管理', 'Runbook', 'ChatOps']
    },
    {
      index: 5,
      title: '第6章：DORA 指标与持续改进',
      contentFile: 'devops-sre/chapter-5.md',
      content: '',
      keyConcepts: ['DORA 指标', 'GitOps', 'DevSecOps', 'AIOps', 'Platform Engineering']
    }
  ],
  prerequisites: ['cicd', 'monitoring'],
  estimatedHours: 14,
}
