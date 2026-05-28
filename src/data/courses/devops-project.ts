import type { Course } from '@/types'

export const course: Course = {
  id: 'devops-project',
  title: '🚀 实战：企业级 DevOps 平台部署',
  description: '综合实战项目：Docker Compose 编排、Nginx 反向代理、MySQL+Redis、Prometheus+Grafana 监控、自动备份与健康检查',
  icon: 'Rocket',
  difficulty: 'advanced',
  category: 'devops',
  prerequisites: ['linux-basics', 'docker', 'web-server', 'database', 'monitoring'],
  estimatedHours: 12,
  chapters: [
    {
      index: 0,
      title: '项目概述与架构设计',
      contentFile: 'devops-project/chapter-0.md',
      content: '',
      keyConcepts: ['Docker Compose', 'Nginx 反向代理', '微服务架构', '高可用设计', 'MySQL', 'Redis', 'Prometheus', 'Grafana']
    },
    {
      index: 1,
      title: 'Docker Compose 编排部署',
      contentFile: 'devops-project/chapter-1.md',
      content: '',
      keyConcepts: ['docker compose', 'YAML 编排', '环境变量', 'volume 持久化', 'network', 'WordPress', 'Node Exporter', 'MySQL Exporter']
    },
    {
      index: 2,
      title: 'Nginx 配置与反向代理',
      contentFile: 'devops-project/chapter-2.md',
      content: '',
      keyConcepts: ['nginx.conf', '反向代理', 'FastCGI', 'Gzip 压缩', '限流', '安全头', 'SSL', '静态资源缓存']
    },
    {
      index: 3,
      title: '监控体系搭建',
      contentFile: 'devops-project/chapter-3.md',
      content: '',
      keyConcepts: ['Prometheus', 'Grafana', 'Node Exporter', 'MySQL Exporter', '告警规则', '仪表板', 'scrape_configs']
    },
    {
      index: 4,
      title: '自动化运维脚本',
      contentFile: 'devops-project/chapter-4.md',
      content: '',
      keyConcepts: ['Shell 脚本', '数据库备份', 'crontab 定时任务', '日志轮转', '健康检查', 'mysqldump', 'logrotate']
    },
    {
      index: 5,
      title: '项目总结与简历亮点',
      contentFile: 'devops-project/chapter-5.md',
      content: '',
      keyConcepts: ['简历项目描述', '架构图', '技术栈总结', '面试要点', '生产化改进', 'CI/CD 集成', '高可用架构']
    },
  ],
}
