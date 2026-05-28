import type { Course } from '@/types'

export const course: Course = {
  id: 'monitoring',
  title: '监控与告警',
  description: 'Prometheus + Grafana 监控体系、ELK Stack 日志分析与告警配置',
  icon: 'Eye',
  difficulty: 'intermediate',
  category: 'monitoring',
  prerequisites: ['linux-basics', 'networking'],
  estimatedHours: 16,
  chapters: [
    {
      index: 0,
      title: '监控体系概述',
      contentFile: 'monitoring/chapter-0.md',
      content: '',
      keyConcepts: ['Metrics', 'Logging', 'Tracing', '可观测性', '四个黄金信号', 'Counter', 'Gauge', 'Histogram', 'TSDB']
    },
    {
      index: 1,
      title: 'Prometheus 架构',
      contentFile: 'monitoring/chapter-1.md',
      content: '',
      keyConcepts: ['TSDB', 'PromQL', 'rate', 'irate', 'histogram_quantile', 'Exporter', 'Pushgateway', 'Service Discovery']
    },
    {
      index: 2,
      title: 'Grafana 可视化',
      contentFile: 'monitoring/chapter-2.md',
      content: '',
      keyConcepts: ['Dashboard', 'Panel', 'Data Source', 'Variables', 'Transformations', 'Provisioning']
    },
    {
      index: 3,
      title: 'Node Exporter 与系统指标监控',
      contentFile: 'monitoring/chapter-3.md',
      content: '',
      keyConcepts: ['Node Exporter', 'CPU 指标', '内存指标', '磁盘指标', '网络指标', '系统负载', 'textfile collector', '告警规则']
    },
    {
      index: 4,
      title: '告警规则配置',
      contentFile: 'monitoring/chapter-4.md',
      content: '',
      keyConcepts: ['Alertmanager', '告警分组', '告警抑制', '告警静默', '路由规则', 'Receiver', '告警分级', 'PrometheusRule']
    },
    {
      index: 5,
      title: '黑盒监控（Blackbox Exporter）',
      contentFile: 'monitoring/chapter-5.md',
      content: '',
      keyConcepts: ['Blackbox Exporter', 'HTTP 探测', 'TCP 探测', 'ICMP 探测', 'DNS 探测', 'SSL 证书监控', 'probe_success']
    }
  ]
}
