import type { Course } from '@/types'

export const course: Course = {
  id: 'virtualization',
  title: '虚拟化基础',
  description: '理解虚拟化原理、KVM/VMware 实践、容器对比与虚拟网络基础',
  icon: 'Layers',
  difficulty: 'beginner',
  category: 'infrastructure',
  chapters: [
    {
      index: 0,
      title: '第1章：虚拟化概述',
      contentFile: 'virtualization/chapter-0.md',
      content: '',
      keyConcepts: ['虚拟化', '全虚拟化', '半虚拟化', '硬件辅助虚拟化', '容器虚拟化', 'Hypervisor', 'Type 1/Type 2', 'VT-x', 'vCPU', '快照']
    },
    {
      index: 1,
      title: '第2章：KVM 虚拟化',
      contentFile: 'virtualization/chapter-1.md',
      content: '',
      keyConcepts: ['KVM', 'QEMU', 'libvirt', 'virt-install', 'virsh', 'qcow2', '快照', '热迁移', '冷迁移', 'virt-manager']
    },
    {
      index: 2,
      title: '第3章：VMware 虚拟化基础',
      contentFile: 'virtualization/chapter-2.md',
      content: '',
      keyConcepts: ['ESXi', 'vCenter', 'vSphere', 'vMotion', 'DRS', 'HA', '资源池', '快照', 'Thin/Thick', 'PowerCLI', 'VMXNET3']
    },
    {
      index: 3,
      title: '第4章：容器 vs 虚拟机',
      contentFile: 'virtualization/chapter-3.md',
      content: '',
      keyConcepts: ['容器 vs 虚拟机', 'Namespace', 'Cgroups', 'UnionFS', '隔离级别', '启动时间', '性能对比', '安全隔离', '适用场景', '混合架构']
    },
    {
      index: 4,
      title: '第5章：虚拟网络基础',
      contentFile: 'virtualization/chapter-4.md',
      content: '',
      keyConcepts: ['Bridge', 'NAT', 'VLAN', 'VXLAN', 'SDN', 'vSwitch', 'OpenFlow', 'Open vSwitch', '虚拟网卡', 'iptables']
    },
    {
      index: 5,
      title: '第6章：虚拟化在运维中的应用',
      contentFile: 'virtualization/chapter-5.md',
      content: '',
      keyConcepts: ['Vagrant', '开发环境', '测试环境', '资源隔离', '多租户', '资源配额', 'Overcommit', '备份策略', '监控告警', '故障排查']
    }
  ],
  prerequisites: [],
  estimatedHours: 10,
}