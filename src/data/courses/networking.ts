import type { Course } from '@/types'

export const course: Course = {
  id: 'networking',
  title: '网络基础',
  description: '深入理解 TCP/IP 协议栈、DNS、HTTP/HTTPS 及网络排查工具',
  icon: 'Network',
  difficulty: 'beginner',
  category: 'networking',
  chapters: [
    {
      index: 0,
      title: '第1章：OSI 七层模型与 TCP/IP 协议栈',
      contentFile: 'networking/chapter-0.md',
      content: '',
      keyConcepts: ['OSI 七层模型', 'TCP/IP 四层模型', '封装与解封装', '数据包结构', 'MAC地址', 'IP地址', '端口号', '路由器', '交换机']
    },
    {
      index: 1,
      title: '第2章：IP 地址与子网划分',
      contentFile: 'networking/chapter-1.md',
      content: '',
      keyConcepts: ['IPv4', 'IPv6', 'CIDR', '子网掩码', '子网划分', '私有地址', '广播地址', '网关', 'NAT']
    },
    {
      index: 2,
      title: '第3章：DNS 域名系统',
      contentFile: 'networking/chapter-2.md',
      content: '',
      keyConcepts: ['DNS', 'A/AAAA/CNAME/MX/NS/TXT记录', '递归查询', '迭代查询', 'dig', 'nslookup', 'hosts文件', 'TTL', '权威DNS', '根域名服务器']
    },
    {
      index: 3,
      title: '第4章：HTTP/HTTPS 协议',
      contentFile: 'networking/chapter-3.md',
      content: '',
      keyConcepts: ['HTTP', 'HTTPS', 'TLS握手', '状态码', '请求方法', 'Headers', 'Cookie', 'HSTS', 'HTTP/2', 'HTTP/3', 'REST API']
    },
    {
      index: 4,
      title: '第5章：网络排查工具',
      contentFile: 'networking/chapter-4.md',
      content: '',
      keyConcepts: ['ping', 'traceroute', 'mtr', 'tcpdump', 'BPF过滤器', 'ss', 'nc', 'netcat', '网络排查流程', 'MTU', '丢包']
    },
    {
      index: 5,
      title: '第6章：网络设备基础',
      contentFile: 'networking/chapter-5.md',
      content: '',
      keyConcepts: ['交换机', '路由器', '防火墙', 'VLAN', 'iptables', 'NAT', '负载均衡', 'L4/L7负载均衡', '路由表', 'OSPF', 'BGP']
    }
  ],
  prerequisites: [],
  estimatedHours: 15,
}
