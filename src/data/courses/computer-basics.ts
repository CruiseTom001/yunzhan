import type { Course } from '@/types'

export const course: Course = {
  id: 'computer-basics',
  title: '计算机基础与操作系统原理',
  description: '理解计算机体系结构、操作系统核心概念、进程管理、内存管理、文件系统与系统启动流程',
  icon: 'Monitor',
  difficulty: 'beginner',
  category: 'fundamentals',
  chapters: [
    {
      index: 0,
      title: '第1章：计算机体系结构',
      contentFile: 'computer-basics/chapter-0.md',
      content: '',
      keyConcepts: ['冯·诺依曼体系', 'CPU', '内存层次', 'RAM', 'SSD/HDD', 'IOPS', '虚拟内存', 'Swap', '网卡', '性能瓶颈']
    },
    {
      index: 1,
      title: '第2章：操作系统概述',
      contentFile: 'computer-basics/chapter-1.md',
      content: '',
      keyConcepts: ['操作系统', '内核', '宏内核', '用户态', '内核态', 'Ring 0/3', '系统调用', '中断', '异常', '缺页异常', 'strace', 'Linux 发行版']
    },
    {
      index: 2,
      title: '第3章：进程与线程',
      contentFile: 'computer-basics/chapter-2.md',
      content: '',
      keyConcepts: ['进程', 'PCB', '进程状态', 'fork', 'exec', 'CFS调度', '信号', 'SIGTERM', 'SIGKILL', '僵尸进程', '孤儿进程', '线程', 'IPC']
    },
    {
      index: 3,
      title: '第4章：内存管理',
      contentFile: 'computer-basics/chapter-3.md',
      content: '',
      keyConcepts: ['虚拟内存', '分页', '页表', 'TLB', '页框', 'Swap', 'swappiness', 'mmap', 'OOM Killer', '缺页异常', '写时复制']
    },
    {
      index: 4,
      title: '第5章：文件系统原理',
      contentFile: 'computer-basics/chapter-4.md',
      content: '',
      keyConcepts: ['文件系统', 'ext4', 'xfs', 'inode', '超级块', '挂载', 'fstab', '硬链接', '软链接', 'UUID', 'fsck']
    },
    {
      index: 5,
      title: '第6章：系统启动流程',
      contentFile: 'computer-basics/chapter-5.md',
      content: '',
      keyConcepts: ['BIOS', 'UEFI', 'MBR', 'GPT', 'GRUB2', '内核初始化', 'initramfs', 'systemd', '运行级别', 'target', '启动流程', 'dmesg']
    }
  ],
  prerequisites: [],
  estimatedHours: 12,
}
