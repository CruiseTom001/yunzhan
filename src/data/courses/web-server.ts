import type { Course } from '@/types'

export const course: Course = {
  id: 'web-server',
  title: 'Web 服务器',
  description: '精通 Nginx/Apache 配置、反向代理、负载均衡与 HTTPS 部署',
  icon: 'Server',
  difficulty: 'beginner',
  category: 'web',
  chapters: [
    {
      index: 0,
      title: '第1章：Nginx 安装与基础配置',
      contentFile: 'web-server/chapter-0.md',
      content: '',
      keyConcepts: ['Nginx 架构', '事件驱动', 'nginx.conf', 'server块', 'location块', 'nginx -t', 'nginx -s reload', 'worker_processes']
    },
    {
      index: 1,
      title: '第2章：虚拟主机与静态文件服务',
      contentFile: 'web-server/chapter-1.md',
      content: '',
      keyConcepts: ['虚拟主机', 'server_name', 'root', 'alias', 'try_files', 'autoindex', 'access control', '静态文件缓存', 'sendfile', 'SPA']
    },
    {
      index: 2,
      title: '第3章：反向代理配置',
      contentFile: 'web-server/chapter-2.md',
      content: '',
      keyConcepts: ['反向代理', 'proxy_pass', 'proxy_set_header', 'X-Real-IP', 'X-Forwarded-For', 'WebSocket代理', '健康检查', 'max_fails', 'fail_timeout', 'keepalive']
    },
    {
      index: 3,
      title: '第4章：负载均衡策略',
      contentFile: 'web-server/chapter-3.md',
      content: '',
      keyConcepts: ['Round Robin', 'Least Connections', 'IP Hash', '一致性哈希', '会话保持', 'Session共享', '故障转移', 'backup', 'proxy_next_upstream', '限流', 'limit_req_zone']
    },
    {
      index: 5,
      title: '第5章：HTTPS 证书配置',
      contentFile: 'web-server/chapter-5.md',
      content: '',
      keyConcepts: ['HTTPS', 'TLS', 'Let\'s Encrypt', 'Certbot', 'SSL证书', 'HSTS', 'OCSP Stapling', 'DH参数', 'ssl_ciphers', 'HTTP强制跳转', '自签名证书']
    },
    {
      index: 6,
      title: '第6章：Nginx 性能调优',
      contentFile: 'web-server/chapter-6.md',
      content: '',
      keyConcepts: ['worker_processes', 'worker_connections', 'epoll', 'Gzip压缩', '代理缓存', '浏览器缓存', 'sendfile', 'keepalive', 'sysctl', '压力测试']
    },
    {
      index: 7,
      title: '第7章：日志配置与分析',
      contentFile: 'web-server/chapter-7.md',
      content: '',
      keyConcepts: ['access_log', 'error_log', 'log_format', 'JSON日志', '条件日志', 'logrotate', 'ELK', 'Filebeat', 'GoAccess', '日志分析']
    }
  ],
  prerequisites: ['linux-basics', 'networking'],
  estimatedHours: 12,
}
