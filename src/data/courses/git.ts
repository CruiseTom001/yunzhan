import type { Course } from '@/types'

export const course: Course = {
  id: 'git',
  title: 'Git 版本控制',
  description: '掌握 Git 核心概念、常用命令、分支管理、远程协作与运维中的应用',
  icon: 'GitBranch',
  difficulty: 'beginner',
  category: 'devops',
  chapters: [
    {
      index: 0,
      title: '第1章：Git 基础概念',
      contentFile: 'git/chapter-0.md',
      content: '',
      keyConcepts: ['版本控制', '分布式', '工作区', '暂存区', '仓库', 'Blob/Tree/Commit', '提交', '分支', 'HEAD', '.gitignore', 'SHA-1']
    },
    {
      index: 1,
      title: '第2章：Git 常用命令',
      contentFile: 'git/chapter-1.md',
      content: '',
      keyConcepts: ['git init', 'git clone', 'git add', 'git commit', 'git status', 'git diff', 'git log', 'git push', 'git pull', 'git fetch', 'git merge', '合并冲突']
    },
    {
      index: 2,
      title: '第3章：分支管理',
      contentFile: 'git/chapter-2.md',
      content: '',
      keyConcepts: ['branch', 'switch', 'restore', 'Git Flow', 'GitHub Flow', 'rebase', 'merge vs rebase', '冲突解决', '交互式rebase', '分支策略']
    },
    {
      index: 3,
      title: '第4章：远程协作',
      contentFile: 'git/chapter-3.md',
      content: '',
      keyConcepts: ['remote', 'origin', 'upstream', '远程分支', 'Pull Request', 'Code Review', 'LGTM', '分支保护', '协作规范', 'git blame']
    },
    {
      index: 4,
      title: '第5章：Git 进阶',
      contentFile: 'git/chapter-4.md',
      content: '',
      keyConcepts: ['stash', 'cherry-pick', 'reset', 'revert', 'bisect', 'tag', 'reflog', '语义化版本', 'soft/mixed/hard']
    },
    {
      index: 5,
      title: '第6章：Git 在运维中的应用',
      contentFile: 'git/chapter-5.md',
      content: '',
      keyConcepts: ['配置管理', 'etckeeper', 'Infrastructure as Code', 'Terraform', 'Ansible', 'CI/CD', 'Git Hooks', 'pre-commit', '敏感信息', 'Git Vault', '审计合规']
    }
  ],
  prerequisites: [],
  estimatedHours: 8,
}