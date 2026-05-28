import type { Course } from '@/types'

export const course: Course = {
  id: 'automation',
  title: '自动化运维',
  description: 'Ansible/Terraform 基础设施即代码、配置管理与自动化部署',
  icon: 'Cog',
  difficulty: 'advanced',
  category: 'automation',
  prerequisites: ['linux-basics'],
  estimatedHours: 18,
  chapters: [
    {
      index: 0,
      title: 'Ansible 基础',
      contentFile: 'automation/chapter-0.md',
      content: '',
      keyConcepts: ['Inventory', 'Playbook', 'Module', 'Task', 'Handler', 'Role', 'Facts', 'ansible.cfg', 'Ansible Vault']
    },
    {
      index: 1,
      title: 'Ansible 常用模块',
      contentFile: 'automation/chapter-1.md',
      content: '',
      keyConcepts: ['command', 'shell', 'copy', 'template', 'file', 'apt', 'yum', 'service', 'systemd', 'user', 'uri', 'register', 'when']
    },
    {
      index: 2,
      title: 'Playbook 编写实战',
      contentFile: 'automation/chapter-2.md',
      content: '',
      keyConcepts: ['变量', '条件判断', '循环', 'Handlers', 'register', 'set_fact', 'notify', 'pre_tasks', 'post_tasks']
    },
    {
      index: 3,
      title: 'Ansible Galaxy 与 Role 组织',
      contentFile: 'automation/chapter-3.md',
      content: '',
      keyConcepts: ['Role', 'Galaxy', 'defaults', 'vars', 'tasks', 'handlers', 'templates', 'meta', 'include_tasks', 'import_tasks', 'Collections']
    },
    {
      index: 4,
      title: 'Terraform 基础',
      contentFile: 'automation/chapter-4.md',
      content: '',
      keyConcepts: ['HCL', 'Provider', 'Resource', 'Data Source', 'Variable', 'Output', 'Module', 'Provisioner', 'terraform init', 'terraform plan', 'terraform apply']
    },
    {
      index: 5,
      title: 'Terraform 状态管理',
      contentFile: 'automation/chapter-5.md',
      content: '',
      keyConcepts: ['State', 'Backend', 'Remote State', 'State Lock', 'DynamoDB', 'Workspace', 'S3 Backend', 'State Import']
    },
    {
      index: 6,
      title: '基础设施即代码实战案例',
      contentFile: 'automation/chapter-6.md',
      content: '',
      keyConcepts: ['IAM', 'VPC', 'RDS', 'ALB', 'ASG', 'Security Group', 'Secrets Manager', 'CI/CD', 'Infracost', '成本优化']
    }
  ]
}
