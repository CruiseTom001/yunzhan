import type { Course } from '@/types'

export const course: Course = {
  id: 'security',
  title: '安全运维',
  description: '系统加固、防火墙策略、SSL/TLS 配置、漏洞扫描与修复',
  icon: 'Shield',
  difficulty: 'intermediate',
  category: 'security',
  chapters: [
    {
      index: 0,
      title: 'Linux 系统安全加固',
      contentFile: 'security/chapter-0.md',
      content: '',
      keyConcepts: ['SSH 安全加固', '密码策略', '内核安全参数', '服务最小化', 'SUID 审计']
    },
    {
      index: 1,
      title: '防火墙策略管理',
      contentFile: 'security/chapter-1.md',
      content: '',
      keyConcepts: ['四表五链', 'filter/nat 表', 'SYN Flood 防御', 'Firewalld Zone', '富规则 Rich Rules']
    },
    {
      index: 2,
      title: 'SSL/TLS 证书管理',
      contentFile: 'security/chapter-2.md',
      content: '',
      keyConcepts: ['TLS 握手', '自签证书', 'CA 证书链', "Let's Encrypt", 'OCSP Stapling', '证书监控']
    },
    {
      index: 3,
      title: '常见攻击类型与防御',
      contentFile: 'security/chapter-3.md',
      content: '',
      keyConcepts: ['DDoS 类型与防御', 'SQL 注入', 'XSS 跨站脚本', 'CSRF 防护', '纵深防御']
    },
    {
      index: 4,
      title: '安全审计与合规',
      contentFile: 'security/chapter-4.md',
      content: '',
      keyConcepts: ['Auditd 审计规则', 'ausearch/aureport', 'CIS Benchmarks', '基线检查', 'Lynis']
    },
    {
      index: 5,
      title: '漏洞扫描与修复',
      contentFile: 'security/chapter-5.md',
      content: '',
      keyConcepts: ['Nmap 扫描', 'OpenVAS', 'CVSS 评分', '漏洞修复流程', 'Trivy 镜像扫描']
    }
  ],
  prerequisites: ['linux-basics', 'networking'],
  estimatedHours: 16,
}
