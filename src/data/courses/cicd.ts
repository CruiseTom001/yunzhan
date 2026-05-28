import type { Course } from '@/types'

export const course: Course = {
  id: 'cicd',
  title: 'CI/CD 流水线',
  description: 'Jenkins/GitLab CI/GitHub Actions 自动化构建、测试与部署流程',
  icon: 'GitBranch',
  difficulty: 'intermediate',
  category: 'devops',
  prerequisites: ['docker'],
  estimatedHours: 14,
  chapters: [
    {
      index: 0,
      title: 'CI/CD 概念与流程',
      contentFile: 'cicd/chapter-0.md',
      content: '',
      keyConcepts: ['持续集成', '持续交付', '持续部署', 'Pipeline', '构建自动化', '测试自动化', '部署策略']
    },
    {
      index: 1,
      title: 'GitLab CI 实战',
      contentFile: 'cicd/chapter-1.md',
      content: '',
      keyConcepts: ['gitlab-ci.yml', 'stages', 'jobs', 'artifacts', 'environment', 'Runner', 'Pipeline', 'Matrix Build']
    },
    {
      index: 2,
      title: 'GitHub Actions',
      contentFile: 'cicd/chapter-2.md',
      content: '',
      keyConcepts: ['Workflow', 'Job', 'Step', 'Actions', 'Matrix', 'Secrets', 'Cache', 'Artifacts', 'Composite Action']
    },
    {
      index: 3,
      title: 'Jenkins Pipeline',
      contentFile: 'cicd/chapter-3.md',
      content: '',
      keyConcepts: ['Jenkinsfile', 'Declarative Pipeline', 'Scripted Pipeline', 'Shared Library', 'Blue Ocean', 'Agent', 'JCasC']
    },
    {
      index: 4,
      title: '代码质量与安全扫描',
      contentFile: 'cicd/chapter-4.md',
      content: '',
      keyConcepts: ['SonarQube', 'Trivy', 'SAST', 'SCA', 'GitLeaks', 'ESLint', 'Quality Gate', 'DevSecOps']
    },
    {
      index: 5,
      title: '自动部署策略',
      contentFile: 'cicd/chapter-5.md',
      content: '',
      keyConcepts: ['滚动部署', '蓝绿部署', '金丝雀发布', 'ArgoCD', 'GitOps', '冒烟测试', '自动回滚', '数据库迁移']
    }
  ]
}
