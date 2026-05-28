import type { Course } from '@/types'

export const course: Course = {
  id: 'logging',
  title: '日志管理',
  description: '日志收集架构设计、ELK 部署实战、日志分析最佳实践',
  icon: 'FileText',
  difficulty: 'intermediate',
  category: 'monitoring',
  chapters: [
    {
      index: 0,
      title: '日志系统架构设计',
      contentFile: 'logging/chapter-0.md',
      content: '',
      keyConcepts: ['采集→传输→存储→分析→可视化', 'ELK Stack', 'Kafka 缓冲', '日志分级标准', '容量规划']
    },
    {
      index: 1,
      title: 'Filebeat 配置与使用',
      contentFile: 'logging/chapter-1.md',
      content: '',
      keyConcepts: ['Harvester', 'Registry 文件', '多行日志合并', 'output 配置', 'processors']
    },
    {
      index: 2,
      title: 'Logstash 管道配置',
      contentFile: 'logging/chapter-2.md',
      content: '',
      keyConcepts: ['Input → Filter → Output', 'Grok 模式', '多管道隔离', 'Pipeline 优化', '死信队列']
    },
    {
      index: 3,
      title: 'Elasticsearch 集群基础',
      contentFile: 'logging/chapter-3.md',
      content: '',
      keyConcepts: ['Shard 和 Replica', 'ILM 生命周期', '索引模板', '节点角色', 'JVM 堆内存']
    },
    {
      index: 4,
      title: 'Kibana 可视化',
      contentFile: 'logging/chapter-4.md',
      content: '',
      keyConcepts: ['KQL 查询语言', 'Dashboard 仪表盘', 'Lens 拖拽分析', '告警规则', 'Saved Search']
    },
    {
      index: 5,
      title: '结构化日志最佳实践',
      contentFile: 'logging/chapter-5.md',
      content: '',
      keyConcepts: ['JSON 结构化', 'traceId 分布式追踪', '字段设计规范', '日志脱敏', '采样策略']
    }
  ],
  prerequisites: ['linux-basics'],
  estimatedHours: 12,
}
