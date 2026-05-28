import type { Course } from '@/types'

export const course: Course = {
  id: 'linux-basics',
  title: 'Linux 系统基础',
  description: '掌握 Linux 核心命令、文件系统、权限管理、Shell 脚本等基础技能',
  icon: 'Terminal',
  difficulty: 'beginner',
  category: 'linux',
  chapters: [
    {
      index: 0,
      title: '第1章：Linux 文件与目录操作命令',
      contentFile: 'linux-basics/chapter-0.md',
      content: '',
      keyConcepts: ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'find', 'locate', 'tree', 'stat', '文件权限', 'inode', 'atime/mtime/ctime']
    },
    {
      index: 1,
      title: '第2章：文件查看与编辑',
      contentFile: 'linux-basics/chapter-1.md',
      content: '',
      keyConcepts: ['cat', 'less', 'tail -f', 'grep', 'sed', 'awk', 'cut', 'sort', 'uniq', 'wc', 'diff', 'vim 模式', '正则表达式', '管道']
    },
    {
      index: 2,
      title: '第3章：权限与用户管理',
      contentFile: 'linux-basics/chapter-2.md',
      content: '',
      keyConcepts: ['rwx权限', 'chmod', 'chown', 'chgrp', 'umask', 'su', 'sudo', 'useradd', 'passwd', 'SUID', 'SGID', 'Sticky Bit', '/etc/sudoers']
    },
    {
      index: 3,
      title: '第4章：进程管理',
      contentFile: 'linux-basics/chapter-3.md',
      content: '',
      keyConcepts: ['ps', 'top', 'kill', 'systemctl', 'journalctl', 'nohup', 'jobs', 'fg/bg', 'SIGTERM/SIGKILL', '僵尸进程', 'load average']
    },
    {
      index: 4,
      title: '第5章：网络命令',
      contentFile: 'linux-basics/chapter-4.md',
      content: '',
      keyConcepts: ['ping', 'curl', 'wget', 'ss', 'netstat', 'ip', 'dig', 'traceroute', 'tcpdump', 'nc', 'ICMP', 'DNS', 'TCP连接状态']
    },
    {
      index: 5,
      title: '第6章：磁盘与存储',
      contentFile: 'linux-basics/chapter-5.md',
      content: '',
      keyConcepts: ['df', 'du', 'mount', 'tar', 'gzip', 'rsync', 'scp', 'LVM', 'PV', 'VG', 'LV', 'fstab', 'inode']
    },
    {
      index: 6,
      title: '第7章：Shell 脚本编程',
      contentFile: 'linux-basics/chapter-6.md',
      content: '',
      keyConcepts: ['变量', '条件判断', 'if/elif/else', 'for/while 循环', '函数', '重定向', '管道', '正则表达式', 'trap', 'set -e', '脚本调试']
    },
    {
      index: 7,
      title: '第8章：定时任务与日志',
      contentFile: 'linux-basics/chapter-7.md',
      content: '',
      keyConcepts: ['crontab', '定时任务', 'journalctl', 'logrotate', '日志轮转', 'Systemd', 'cron 表达式']
    }
  ],
  prerequisites: [],
  estimatedHours: 20,
}
