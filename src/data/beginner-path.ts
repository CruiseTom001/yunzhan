/**
 * 初学者推荐路线 — HomePage 与 CourseListPage 共用唯一数据源。
 */
export interface BeginnerPathStep {
  title: string
  description: string
  courses: readonly string[]
}

export const beginnerPathSteps: BeginnerPathStep[] = [
  {
    title: '第 1 阶段：先打底',
    description: '计算机基础、Linux 与网络，打好后面所有方向的地基。',
    courses: ['computer-basics', 'linux-basics', 'networking'],
  },
  {
    title: '第 2 阶段：会部署服务',
    description: '先把 Web 服务、数据库与缓存消息队列跑起来。',
    courses: ['web-server', 'database', 'cache-queue'],
  },
  {
    title: '第 3 阶段：进入交付流程',
    description: '掌握版本控制、容器化与 CI/CD，形成从修改到上线的闭环。',
    courses: ['git', 'docker', 'cicd'],
  },
  {
    title: '第 4 阶段：补齐运维能力',
    description: '监控、日志、安全、自动化与脚本编程，形成日常运维能力。',
    courses: ['monitoring', 'logging', 'security', 'automation', 'python-ops'],
  },
  {
    title: '第 5 阶段：进阶与架构',
    description: '虚拟化与高可用打底，再深入 Kubernetes、云原生与综合实战。',
    courses: ['virtualization', 'high-availability', 'kubernetes', 'cloud-ops', 'devops-sre', 'devops-project'],
  },
]

/** 按学习顺序排列的全部主线课程 id */
export const beginnerPathCourseIds: readonly string[] = beginnerPathSteps.flatMap(step => step.courses)
