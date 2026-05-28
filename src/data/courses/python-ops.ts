import type { Course } from '@/types'

export const course: Course = {
  id: 'python-ops',
  title: 'Python 运维编程',
  description: '掌握 Python 基础语法、系统管理模块、网络编程与运维脚本实战',
  icon: 'Code',
  difficulty: 'beginner',
  category: 'programming',
  chapters: [
    {
      index: 0,
      title: '第1章：Python 基础语法',
      contentFile: 'python-ops/chapter-0.md',
      content: '',
      keyConcepts: ['Python安装', 'pip', '虚拟环境', '数据类型', '字符串', '列表', '字典', '条件判断', '循环', '函数', '模块', '异常处理']
    },
    {
      index: 1,
      title: '第2章：文件与目录操作',
      contentFile: 'python-ops/chapter-1.md',
      content: '',
      keyConcepts: ['os模块', 'pathlib', 'shutil', 'glob', '路径操作', '文件复制', '目录遍历', '文件监控']
    },
    {
      index: 2,
      title: '第3章：系统管理模块',
      contentFile: 'python-ops/chapter-2.md',
      content: '',
      keyConcepts: ['subprocess', 'sys', 'argparse', 'platform', '信号处理', 'SIGINT', 'SIGTERM', '优雅退出', '定时任务', '命令行参数']
    },
    {
      index: 3,
      title: '第4章：网络编程',
      contentFile: 'python-ops/chapter-3.md',
      content: '',
      keyConcepts: ['socket', 'TCP/UDP', 'requests', 'HTTP', 'paramiko', 'SSH', 'SFTP', '端口扫描', '健康检查', '批量执行']
    },
    {
      index: 4,
      title: '第5章：日志与配置管理',
      contentFile: 'python-ops/chapter-4.md',
      content: '',
      keyConcepts: ['logging', '日志轮转', 'configparser', 'YAML', 'JSON', '配置管理', '环境变量', 'pyyaml']
    },
    {
      index: 5,
      title: '第6章：常用运维库',
      contentFile: 'python-ops/chapter-5.md',
      content: '',
      keyConcepts: ['psutil', 'CPU监控', '内存监控', '磁盘监控', '网络监控', '进程管理', 'APScheduler', '邮件告警', '系统监控']
    },
    {
      index: 6,
      title: '第7章：Python 脚本实战',
      contentFile: 'python-ops/chapter-6.md',
      content: '',
      keyConcepts: ['批量部署', 'paramiko', '并行执行', '日志分析', '正则解析', '巡检脚本', 'psutil', '报告生成', '脚本模板']
    }
  ],
  prerequisites: [],
  estimatedHours: 16,
}