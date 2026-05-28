/**
 * 学习路径系统 — 技能树 + 岗位路线图
 */

export interface LearningPath {
  id: string
  title: string
  description: string
  role: string
  courses: string[]
  estimatedMonths: number
  icon: string
}

// 岗位学习路线
export const learningPaths: LearningPath[] = [
  {
    id: 'linux-ops',
    title: 'Linux 运维工程师',
    description: '从零基础到独立管理 Linux 服务器，掌握文件系统、权限、进程、网络、Shell 脚本等核心技能',
    role: '初级 Linux 运维工程师 / 系统管理员',
    courses: [
      'computer-basics',
      'linux-basics',
      'networking',
      'web-server',
      'security',
    ],
    estimatedMonths: 3,
    icon: 'Terminal',
  },
  {
    id: 'devops',
    title: 'DevOps 工程师',
    description: '掌握 CI/CD、容器化、自动化运维、监控体系，具备企业级 DevOps 全栈能力',
    role: 'DevOps 工程师 / SRE',
    courses: [
      'linux-basics',
      'git',
      'docker',
      'cicd',
      'automation',
      'monitoring',
      'logging',
      'devops-sre',
      'devops-project',
    ],
    estimatedMonths: 4,
    icon: 'RefreshCw',
  },
  {
    id: 'cloud-native',
    title: '云原生工程师',
    description: '深入 Kubernetes、微服务、服务网格，掌握云原生架构设计和部署',
    role: '云原生开发工程师 / 平台工程师',
    courses: [
      'linux-basics',
      'docker',
      'kubernetes',
      'database',
      'cache-queue',
      'high-availability',
      'cloud-ops',
      'devops-project',
    ],
    estimatedMonths: 4,
    icon: 'Cloud',
  },
  {
    id: 'data-ops',
    title: '数据运维工程师',
    description: '专注数据库管理、缓存优化、数据备份与恢复，保障数据高可用',
    role: 'DBA / 数据运维工程师',
    courses: [
      'linux-basics',
      'database',
      'cache-queue',
      'networking',
      'security',
      'high-availability',
    ],
    estimatedMonths: 3,
    icon: 'Database',
  },
  {
    id: 'full-stack-ops',
    title: '全栈运维架构师',
    description: '完整覆盖全部 20 门课程，从基础到架构，适合想要全面掌握的学员',
    role: '资深运维架构师 / 技术负责人',
    courses: [
      'computer-basics',
      'git',
      'python-ops',
      'virtualization',
      'linux-basics',
      'networking',
      'web-server',
      'database',
      'cache-queue',
      'docker',
      'kubernetes',
      'cicd',
      'monitoring',
      'automation',
      'logging',
      'security',
      'high-availability',
      'cloud-ops',
      'devops-sre',
      'devops-project',
    ],
    estimatedMonths: 6,
    icon: 'Star',
  },
]

// 技能依赖树
export const skillTree = {
  '计算机基础': ['operating-system', 'network-basics', 'data-structure'],
  'Linux 系统': ['linux-basics', 'shell-scripting', 'system-admin'],
  '容器与编排': ['docker', 'kubernetes', 'helm'],
  'Web 服务': ['nginx', 'apache', 'ssl'],
  '数据库': ['mysql', 'redis', 'postgresql'],
  '自动化': ['ansible', 'terraform', 'cicd'],
  '监控': ['prometheus', 'grafana', 'elk'],
  '云原生': ['aws', 'azure', 'alicloud'],
}

// 章节到技能映射
export const chapterSkills: Record<string, string[]> = {
  'linux-basics:0': ['文件系统', 'ls', 'cd'],
  'linux-basics:1': ['文件查看', 'cat', 'less', 'tail', 'head', 'grep'],
  'linux-basics:2': ['权限', 'chmod', 'chown', 'ugo'],
  'linux-basics:3': ['进程', 'ps', 'top', 'kill'],
  'docker:0': ['容器概念', '镜像', 'registry'],
  'docker:1': ['docker run', 'Dockerfile'],
  'docker:2': ['docker compose', '多服务编排'],
  'kubernetes:0': ['pod', 'deployment', 'service'],
  'monitoring:0': ['prometheus', 'metric', 'alert'],
  'monitoring:1': ['grafana', 'dashboard', 'visualization'],
}
