/**
 * 知识讲解库 — 涵盖所有课程的核心概念
 * 支持按关键词匹配，显示知识卡片
 *
 * core: true = ⭐ 必修知识点（云计算入门到精通必须掌握）
 */

export interface KnowledgeEntry {
  /** 术语名称 */
  term: string
  /** 匹配关键词（同义词、相关词） */
  keywords: string[]
  /** 一句话概述 */
  summary: string
  /** 详细讲解 */
  description: string
  /** 所属领域 */
  category: string
  /** 难度等级 */
  level?: 'beginner' | 'intermediate' | 'advanced'
  /** ⭐ 必修标记（入门到精通路径上的核心知识点） */
  core?: boolean
  /** 相关概念（知识点关联） */
  related?: string[]
  /** 实操提示 */
  tips?: string
  /** 参考链接 */
  refUrl?: string
  /** 代码示例（如果有） */
  example?: string
}

// 按领域分组的知识库
const knowledgeDB: KnowledgeEntry[] = [
  {
    term: 'AMD',
    keywords: ['amd'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: 'AMD  — Linux 运维概念',
    description: `AMD 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'CPU',
    keywords: ['cpu'],
    category: '计算机基础',
    level: 'beginner',
    core: true,
    summary: 'CPU ⭐ 必修 — Linux 运维概念',
    description: `CPU 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'CRT',
    keywords: ['crt'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: 'CRT  — Linux 运维概念',
    description: `CRT 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'GNU',
    keywords: ['gnu'],
    category: '云计算基础',
    level: 'beginner',
    core: true,
    summary: 'GNU ⭐ 必修 — Linux 运维概念',
    description: `GNU 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'GPL',
    keywords: ['gpl'],
    category: '云计算基础',
    level: 'beginner',
    core: true,
    summary: 'GPL ⭐ 必修 — Linux 运维概念',
    description: `GPL 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'GPT',
    keywords: ['gpt'],
    category: '存储',
    level: 'beginner',
    core: true,
    summary: 'GPT ⭐ 必修 — Linux 运维概念',
    description: `GPT 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'LED',
    keywords: ['led'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: 'LED  — Linux 运维概念',
    description: `LED 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'MBR',
    keywords: ['mbr'],
    category: '存储',
    level: 'beginner',
    core: true,
    summary: 'MBR ⭐ 必修 — Linux 运维概念',
    description: `MBR 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'QQ512050951',
    keywords: ['qq512050951'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: 'QQ512050951  — Linux 运维概念',
    description: `QQ512050951 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'RHCA',
    keywords: ['rhca'],
    category: '云计算基础',
    level: 'beginner',
    core: true,
    summary: 'RHCA ⭐ 必修 — Linux 运维概念',
    description: `RHCA 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'RHCE',
    keywords: ['rhce'],
    category: '云计算基础',
    level: 'beginner',
    core: true,
    summary: 'RHCE ⭐ 必修 — Linux 运维概念',
    description: `RHCE 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'RHCSA',
    keywords: ['rhcsa'],
    category: '云计算基础',
    level: 'beginner',
    core: true,
    summary: 'RHCSA ⭐ 必修 — Linux 运维概念',
    description: `RHCSA 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'alice',
    keywords: ['alice'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: 'alice  — Linux 运维概念',
    description: `alice 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'background',
    keywords: ['background'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: 'background  — Linux 运维概念',
    description: `background 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'foreground',
    keywords: ['foreground'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: 'foreground  — Linux 运维概念',
    description: `foreground 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'mail',
    keywords: ['mail'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: 'mail  — Linux 运维概念',
    description: `mail 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'sgid',
    keywords: ['sgid'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: 'sgid  — Linux 运维概念',
    description: `sgid 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'ssssssss',
    keywords: ['ssssssss'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: 'ssssssss  — Linux 运维概念',
    description: `ssssssss 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'stick',
    keywords: ['stick'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: 'stick  — Linux 运维概念',
    description: `stick 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '一个进程为例',
    keywords: ['一个进程为例'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '一个进程为例  — Linux 运维概念',
    description: `一个进程为例 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '上一级',
    keywords: ['上一级'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '上一级  — Linux 运维概念',
    description: `上一级 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '上半部分',
    keywords: ['上半部分'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '上半部分  — Linux 运维概念',
    description: `上半部分 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '下半部分',
    keywords: ['下半部分'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '下半部分  — Linux 运维概念',
    description: `下半部分 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '不要影响文件原先的内容',
    keywords: ['不要影响文件原先的内容'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '不要影响文件原先的内容  — Linux 运维概念',
    description: `不要影响文件原先的内容 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '不输入任何路径',
    keywords: ['不输入任何路径'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '不输入任何路径  — Linux 运维概念',
    description: `不输入任何路径 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '中央处理器',
    keywords: ['中央处理器'],
    category: '计算机基础',
    level: 'beginner',
    core: true,
    summary: '中央处理器 ⭐ 必修 — Linux 运维概念',
    description: `中央处理器 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '主分区已创建并使用',
    keywords: ['主分区已创建并使用'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '主分区已创建并使用  — Linux 运维概念',
    description: `主分区已创建并使用 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '主分区未创建未使用',
    keywords: ['主分区未创建未使用'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '主分区未创建未使用  — Linux 运维概念',
    description: `主分区未创建未使用 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '了解即可',
    keywords: ['了解即可'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '了解即可  — Linux 运维概念',
    description: `了解即可 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '从工作原理区分',
    keywords: ['从工作原理区分'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '从工作原理区分  — Linux 运维概念',
    description: `从工作原理区分 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '优先级图示',
    keywords: ['优先级图示'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '优先级图示  — Linux 运维概念',
    description: `优先级图示 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '优先级特性',
    keywords: ['优先级特性'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '优先级特性  — Linux 运维概念',
    description: `优先级特性 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '优先级范围和特性',
    keywords: ['优先级范围和特性'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '优先级范围和特性  — Linux 运维概念',
    description: `优先级范围和特性 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '作业要求',
    keywords: ['作业要求'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '作业要求  — Linux 运维概念',
    description: `作业要求 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '使用数字',
    keywords: ['使用数字'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '使用数字  — Linux 运维概念',
    description: `使用数字 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '使用符号',
    keywords: ['使用符号'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '使用符号  — Linux 运维概念',
    description: `使用符号 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '信号种类',
    keywords: ['信号种类'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '信号种类  — Linux 运维概念',
    description: `信号种类 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '先关闭虚拟机电源',
    keywords: ['先关闭虚拟机电源'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '先关闭虚拟机电源  — Linux 运维概念',
    description: `先关闭虚拟机电源 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '先准备一段邮件内容',
    keywords: ['先准备一段邮件内容'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '先准备一段邮件内容  — Linux 运维概念',
    description: `先准备一段邮件内容 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '关键词介绍',
    keywords: ['关键词介绍'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '关键词介绍  — Linux 运维概念',
    description: `关键词介绍 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '再次查看用户信息',
    keywords: ['再次查看用户信息'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '再次查看用户信息  — Linux 运维概念',
    description: `再次查看用户信息 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '冯诺依曼',
    keywords: ['冯诺依曼'],
    category: '计算机基础',
    level: 'beginner',
    core: true,
    summary: '冯诺依曼 ⭐ 必修 — Linux 运维概念',
    description: `冯诺依曼 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '准备文件',
    keywords: ['准备文件'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '准备文件  — Linux 运维概念',
    description: `准备文件 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '准备物理磁盘',
    keywords: ['准备物理磁盘'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '准备物理磁盘  — Linux 运维概念',
    description: `准备物理磁盘 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '分区方式',
    keywords: ['分区方式'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '分区方式  — Linux 运维概念',
    description: `分区方式 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '切换用户登录',
    keywords: ['切换用户登录'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '切换用户登录  — Linux 运维概念',
    description: `切换用户登录 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '创建一个文件',
    keywords: ['创建一个文件'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '创建一个文件  — Linux 运维概念',
    description: `创建一个文件 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '创建一个目录',
    keywords: ['创建一个目录'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '创建一个目录  — Linux 运维概念',
    description: `创建一个目录 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '创建分区',
    keywords: ['创建分区'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '创建分区  — Linux 运维概念',
    description: `创建分区 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '删除分区',
    keywords: ['删除分区'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '删除分区  — Linux 运维概念',
    description: `删除分区 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '删除所有',
    keywords: ['删除所有'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '删除所有  — Linux 运维概念',
    description: `删除所有 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '删除组',
    keywords: ['删除组'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '删除组  — Linux 运维概念',
    description: `删除组 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '删除部分',
    keywords: ['删除部分'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '删除部分  — Linux 运维概念',
    description: `删除部分 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '刷新分区表',
    keywords: ['刷新分区表'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '刷新分区表  — Linux 运维概念',
    description: `刷新分区表 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '南北桥芯片',
    keywords: ['南北桥芯片'],
    category: '计算机基础',
    level: 'beginner',
    core: false,
    summary: '南北桥芯片  — Linux 运维概念',
    description: `南北桥芯片 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '台式机',
    keywords: ['台式机'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '台式机  — Linux 运维概念',
    description: `台式机 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '台积电',
    keywords: ['台积电'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '台积电  — Linux 运维概念',
    description: `台积电 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '后台程序控制示例',
    keywords: ['后台程序控制示例'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '后台程序控制示例  — Linux 运维概念',
    description: `后台程序控制示例 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '启动分区工具',
    keywords: ['启动分区工具'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '启动分区工具  — Linux 运维概念',
    description: `启动分区工具 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '命令参数说明',
    keywords: ['命令参数说明'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '命令参数说明  — Linux 运维概念',
    description: `命令参数说明 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '命令模式',
    keywords: ['命令模式'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '命令模式  — Linux 运维概念',
    description: `命令模式 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '因为没有错误信息',
    keywords: ['因为没有错误信息'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '因为没有错误信息  — Linux 运维概念',
    description: `因为没有错误信息 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '图形安装详解',
    keywords: ['图形安装详解'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '图形安装详解  — Linux 运维概念',
    description: `图形安装详解 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '基本组',
    keywords: ['基本组'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '基本组  — Linux 运维概念',
    description: `基本组 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '如下命令不需要操作',
    keywords: ['如下命令不需要操作'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '如下命令不需要操作  — Linux 运维概念',
    description: `如下命令不需要操作 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '将用户加入到组',
    keywords: ['将用户加入到组'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '将用户加入到组  — Linux 运维概念',
    description: `将用户加入到组 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '常见硬件',
    keywords: ['常见硬件'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '常见硬件  — Linux 运维概念',
    description: `常见硬件 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '常见类型',
    keywords: ['常见类型'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '常见类型  — Linux 运维概念',
    description: `常见类型 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '常规文件',
    keywords: ['常规文件'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '常规文件  — Linux 运维概念',
    description: `常规文件 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '我从哪里来',
    keywords: ['我从哪里来'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '我从哪里来  — Linux 运维概念',
    description: `我从哪里来 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '手动挂载',
    keywords: ['手动挂载'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '手动挂载  — Linux 运维概念',
    description: `手动挂载 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '手机芯片厂商',
    keywords: ['手机芯片厂商'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '手机芯片厂商  — Linux 运维概念',
    description: `手机芯片厂商 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '扩展分区',
    keywords: ['扩展分区'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '扩展分区  — Linux 运维概念',
    description: `扩展分区 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '扩展命令模式',
    keywords: ['扩展命令模式'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '扩展命令模式  — Linux 运维概念',
    description: `扩展命令模式 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '挂载重启失效的问题',
    keywords: ['挂载重启失效的问题'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '挂载重启失效的问题  — Linux 运维概念',
    description: `挂载重启失效的问题 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '敲击回车键',
    keywords: ['敲击回车键'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '敲击回车键  — Linux 运维概念',
    description: `敲击回车键 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '文件权限设置真实的样子',
    keywords: ['文件权限设置真实的样子'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '文件权限设置真实的样子  — Linux 运维概念',
    description: `文件权限设置真实的样子 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '文件管理',
    keywords: ['文件管理'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '文件管理  — Linux 运维概念',
    description: `文件管理 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '文本编辑',
    keywords: ['文本编辑'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '文本编辑  — Linux 运维概念',
    description: `文本编辑 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '新建分区',
    keywords: ['新建分区'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '新建分区  — Linux 运维概念',
    description: `新建分区 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '新硬盘',
    keywords: ['新硬盘'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '新硬盘  — Linux 运维概念',
    description: `新硬盘 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '更改权限',
    keywords: ['更改权限'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '更改权限  — Linux 运维概念',
    description: `更改权限 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '有人认识这个软件吗',
    keywords: ['有人认识这个软件吗'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '有人认识这个软件吗  — Linux 运维概念',
    description: `有人认识这个软件吗 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '权限对象',
    keywords: ['权限对象'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '权限对象  — Linux 运维概念',
    description: `权限对象 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '权限类型',
    keywords: ['权限类型'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '权限类型  — Linux 运维概念',
    description: `权限类型 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '查看分区结果',
    keywords: ['查看分区结果'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '查看分区结果  — Linux 运维概念',
    description: `查看分区结果 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '查看卷组信息',
    keywords: ['查看卷组信息'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '查看卷组信息  — Linux 运维概念',
    description: `查看卷组信息 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '查看挂载结果',
    keywords: ['查看挂载结果'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '查看挂载结果  — Linux 运维概念',
    description: `查看挂载结果 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '查看文件',
    keywords: ['查看文件'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '查看文件  — Linux 运维概念',
    description: `查看文件 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '查看权限',
    keywords: ['查看权限'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '查看权限  — Linux 运维概念',
    description: `查看权限 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '查看用户原先信息',
    keywords: ['查看用户原先信息'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '查看用户原先信息  — Linux 运维概念',
    description: `查看用户原先信息 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '查看目录',
    keywords: ['查看目录'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '查看目录  — Linux 运维概念',
    description: `查看目录 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '查看邮件',
    keywords: ['查看邮件'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '查看邮件  — Linux 运维概念',
    description: `查看邮件 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '标准输入',
    keywords: ['标准输入'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: '标准输入 ⭐ 必修 — Linux 运维概念',
    description: `标准输入 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '标准输出',
    keywords: ['标准输出'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: '标准输出 ⭐ 必修 — Linux 运维概念',
    description: `标准输出 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '标准错误输出',
    keywords: ['标准错误输出'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: '标准错误输出 ⭐ 必修 — Linux 运维概念',
    description: `标准错误输出 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '标题内容',
    keywords: ['标题内容'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '标题内容  — Linux 运维概念',
    description: `标题内容 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '核心数',
    keywords: ['核心数'],
    category: '计算机基础',
    level: 'beginner',
    core: true,
    summary: '核心数 ⭐ 必修 — Linux 运维概念',
    description: `核心数 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '正确示范',
    keywords: ['正确示范'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '正确示范  — Linux 运维概念',
    description: `正确示范 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '正确输出',
    keywords: ['正确输出'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '正确输出  — Linux 运维概念',
    description: `正确输出 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '没有简写',
    keywords: ['没有简写'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '没有简写  — Linux 运维概念',
    description: `没有简写 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '添加磁盘',
    keywords: ['添加磁盘'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '添加磁盘  — Linux 运维概念',
    description: `添加磁盘 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '灵魂三问',
    keywords: ['灵魂三问'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '灵魂三问  — Linux 运维概念',
    description: `灵魂三问 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '然后使用立刻挂载命令',
    keywords: ['然后使用立刻挂载命令'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '然后使用立刻挂载命令  — Linux 运维概念',
    description: `然后使用立刻挂载命令 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '生产环境',
    keywords: ['生产环境'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '生产环境  — Linux 运维概念',
    description: `生产环境 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '用了多少内存',
    keywords: ['用了多少内存'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '用了多少内存  — Linux 运维概念',
    description: `用了多少内存 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '用户的作用',
    keywords: ['用户的作用'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '用户的作用  — Linux 运维概念',
    description: `用户的作用 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '用户管理',
    keywords: ['用户管理'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: '用户管理 ⭐ 必修 — Linux 运维概念',
    description: `用户管理 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '用户需要密码',
    keywords: ['用户需要密码'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '用户需要密码  — Linux 运维概念',
    description: `用户需要密码 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '电子邮件',
    keywords: ['电子邮件'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '电子邮件  — Linux 运维概念',
    description: `电子邮件 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '百度云盘',
    keywords: ['百度云盘'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '百度云盘  — Linux 运维概念',
    description: `百度云盘 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '相对路径',
    keywords: ['相对路径'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: '相对路径 ⭐ 必修 — Linux 运维概念',
    description: `相对路径 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '看到复制的文件即可',
    keywords: ['看到复制的文件即可'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '看到复制的文件即可  — Linux 运维概念',
    description: `看到复制的文件即可 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '看到文件即可',
    keywords: ['看到文件即可'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '看到文件即可  — Linux 运维概念',
    description: `看到文件即可 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '磁盘的结尾',
    keywords: ['磁盘的结尾'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '磁盘的结尾  — Linux 运维概念',
    description: `磁盘的结尾 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '磁盘简介',
    keywords: ['磁盘简介'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '磁盘简介  — Linux 运维概念',
    description: `磁盘简介 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '程序本身需要输出',
    keywords: ['程序本身需要输出'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '程序本身需要输出  — Linux 运维概念',
    description: `程序本身需要输出 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '笔记本',
    keywords: ['笔记本'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '笔记本  — Linux 运维概念',
    description: `笔记本 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '第四个分区',
    keywords: ['第四个分区'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '第四个分区  — Linux 运维概念',
    description: `第四个分区 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '答案是不',
    keywords: ['答案是不'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '答案是不  — Linux 运维概念',
    description: `答案是不 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '管理磁盘',
    keywords: ['管理磁盘'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '管理磁盘  — Linux 运维概念',
    description: `管理磁盘 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '管理磁盘流程三部曲',
    keywords: ['管理磁盘流程三部曲'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '管理磁盘流程三部曲  — Linux 运维概念',
    description: `管理磁盘流程三部曲 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '系统中的两种优先级',
    keywords: ['系统中的两种优先级'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '系统中的两种优先级  — Linux 运维概念',
    description: `系统中的两种优先级 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '系统的授权文件',
    keywords: ['系统的授权文件'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '系统的授权文件  — Linux 运维概念',
    description: `系统的授权文件 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '组成员默认为空',
    keywords: ['组成员默认为空'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '组成员默认为空  — Linux 运维概念',
    description: `组成员默认为空 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '结束符号',
    keywords: ['结束符号'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '结束符号  — Linux 运维概念',
    description: `结束符号 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '绝对路径',
    keywords: ['绝对路径'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: '绝对路径 ⭐ 必修 — Linux 运维概念',
    description: `绝对路径 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '编写邮件',
    keywords: ['编写邮件'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '编写邮件  — Linux 运维概念',
    description: `编写邮件 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '联发科',
    keywords: ['联发科'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '联发科  — Linux 运维概念',
    description: `联发科 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '自动退出分区工具',
    keywords: ['自动退出分区工具'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '自动退出分区工具  — Linux 运维概念',
    description: `自动退出分区工具 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '芯片组',
    keywords: ['芯片组'],
    category: '计算机基础',
    level: 'beginner',
    core: false,
    summary: '芯片组  — Linux 运维概念',
    description: `芯片组 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '英特尔',
    keywords: ['英特尔'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '英特尔  — Linux 运维概念',
    description: `英特尔 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '西部数据',
    keywords: ['西部数据'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '西部数据  — Linux 运维概念',
    description: `西部数据 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '观察授权信息',
    keywords: ['观察授权信息'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '观察授权信息  — Linux 运维概念',
    description: `观察授权信息 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '解决办法',
    keywords: ['解决办法'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '解决办法  — Linux 运维概念',
    description: `解决办法 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '记得磁铁的玩具吗',
    keywords: ['记得磁铁的玩具吗'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '记得磁铁的玩具吗  — Linux 运维概念',
    description: `记得磁铁的玩具吗 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '设置权限',
    keywords: ['设置权限'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '设置权限  — Linux 运维概念',
    description: `设置权限 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '该用户一定要注销',
    keywords: ['该用户一定要注销'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '该用户一定要注销  — Linux 运维概念',
    description: `该用户一定要注销 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '请思考',
    keywords: ['请思考'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '请思考  — Linux 运维概念',
    description: `请思考 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '起始扇区',
    keywords: ['起始扇区'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '起始扇区  — Linux 运维概念',
    description: `起始扇区 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '路径分为',
    keywords: ['路径分为'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '路径分为  — Linux 运维概念',
    description: `路径分为 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '输出提示',
    keywords: ['输出提示'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '输出提示  — Linux 运维概念',
    description: `输出提示 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '输出重定向分为',
    keywords: ['输出重定向分为'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '输出重定向分为  — Linux 运维概念',
    description: `输出重定向分为 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '过程略',
    keywords: ['过程略'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '过程略  — Linux 运维概念',
    description: `过程略 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '进入会话模式',
    keywords: ['进入会话模式'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '进入会话模式  — Linux 运维概念',
    description: `进入会话模式 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '进入其它模式',
    keywords: ['进入其它模式'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '进入其它模式  — Linux 运维概念',
    description: `进入其它模式 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '进程三问',
    keywords: ['进程三问'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '进程三问  — Linux 运维概念',
    description: `进程三问 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '进程排序',
    keywords: ['进程排序'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '进程排序  — Linux 运维概念',
    description: `进程排序 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '进程状态产生的原因',
    keywords: ['进程状态产生的原因'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '进程状态产生的原因  — Linux 运维概念',
    description: `进程状态产生的原因 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '进程的父子关系',
    keywords: ['进程的父子关系'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '进程的父子关系  — Linux 运维概念',
    description: `进程的父子关系 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '进程简介',
    keywords: ['进程简介'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '进程简介  — Linux 运维概念',
    description: `进程简介 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '选择分区号',
    keywords: ['选择分区号'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '选择分区号  — Linux 运维概念',
    description: `选择分区号 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '选择磁盘开始的扇区',
    keywords: ['选择磁盘开始的扇区'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '选择磁盘开始的扇区  — Linux 运维概念',
    description: `选择磁盘开始的扇区 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '邮件接收人',
    keywords: ['邮件接收人'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '邮件接收人  — Linux 运维概念',
    description: `邮件接收人 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '重定向',
    keywords: ['重定向'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: '重定向 ⭐ 必修 — Linux 运维概念',
    description: `重定向 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '针对文件内容进行过滤',
    keywords: ['针对文件内容进行过滤'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '针对文件内容进行过滤  — Linux 运维概念',
    description: `针对文件内容进行过滤 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '针脚数',
    keywords: ['针脚数'],
    category: '计算机基础',
    level: 'beginner',
    core: false,
    summary: '针脚数  — Linux 运维概念',
    description: `针脚数 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '链接文件',
    keywords: ['链接文件'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '链接文件  — Linux 运维概念',
    description: `链接文件 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '错误示范',
    keywords: ['错误示范'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '错误示范  — Linux 运维概念',
    description: `错误示范 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '错误输出',
    keywords: ['错误输出'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '错误输出  — Linux 运维概念',
    description: `错误输出 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '附加组',
    keywords: ['附加组'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '附加组  — Linux 运维概念',
    description: `附加组 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '随机箱赠送',
    keywords: ['随机箱赠送'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '随机箱赠送  — Linux 运维概念',
    description: `随机箱赠送 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '非常见类型',
    keywords: ['非常见类型'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '非常见类型  — Linux 运维概念',
    description: `非常见类型 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '高级权限的类型',
    keywords: ['高级权限的类型'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '高级权限的类型  — Linux 运维概念',
    description: `高级权限的类型 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '默认情况',
    keywords: ['默认情况'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '默认情况  — Linux 运维概念',
    description: `默认情况 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: '默认是用户名',
    keywords: ['默认是用户名'],
    category: 'Linux',
    level: 'beginner',
    core: false,
    summary: '默认是用户名  — Linux 运维概念',
    description: `默认是用户名 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  },
  {
    term: 'AMD',
    keywords: ['amd'],
    category: '计算机基础',
    level: 'beginner',
    summary: '半导体公司，生产 Ryzen 和 EPYC 系列 CPU',
    description: `半导体公司，生产 Ryzen 和 EPYC 系列 CPU`
  },
  {
    term: 'E5',
    keywords: ['e5'],
    category: '计算机基础',
    level: 'beginner',
    summary: 'Intel 至强 E5 系列服务器处理器，企业级服务器常用',
    description: `Intel 至强 E5 系列服务器处理器，企业级服务器常用`
  },
  {
    term: 'PS',
    keywords: ['ps'],
    category: 'Linux',
    level: 'beginner',
    summary: 'ps（Process Status）显示系统进程快照，最常用的进程查看命令',
    description: `ps（Process Status）显示系统进程快照，最常用的进程查看命令`
  },
  {
    term: 'bg',
    keywords: ['bg'],
    category: 'Linux',
    level: 'beginner',
    summary: 'bg（back）将暂停的后台作业继续运行',
    description: `bg（back）将暂停的后台作业继续运行`
  },
  {
    term: 'fg',
    keywords: ['fg'],
    category: 'Linux',
    level: 'beginner',
    summary: 'fg（fore）将后台作业调至前台运行',
    description: `fg（fore）将后台作业调至前台运行`
  },
  {
    term: '主频',
    keywords: ['主频'],
    category: '计算机基础',
    level: 'beginner',
    summary: 'CPU 的时钟频率，单位 GHz，决定每秒运算次数',
    description: `CPU 的时钟频率，单位 GHz，决定每秒运算次数`
  },
  {
    term: '八核',
    keywords: ['八核'],
    category: '计算机基础',
    level: 'beginner',
    summary: '包含八个物理核心的 CPU，适合高并发任务',
    description: `包含八个物理核心的 CPU，适合高并发任务`
  },
  {
    term: '兼容',
    keywords: ['兼容'],
    category: '计算机基础',
    level: 'beginner',
    summary: '软硬件在特定环境下能正常运行的能力',
    description: `软硬件在特定环境下能正常运行的能力`
  },
  {
    term: '内存',
    keywords: ['内存'],
    category: '计算机基础',
    level: 'beginner',
    summary: 'RAM（随机存取存储器），计算机的临时数据存储设备，断电丢失',
    description: `RAM（随机存取存储器），计算机的临时数据存储设备，断电丢失`
  },
  {
    term: '内核',
    keywords: ['内核'],
    category: '计算机基础',
    level: 'beginner',
    summary: '操作系统内核是系统最核心的程序，管理 CPU、内存、IO 等硬件资源',
    description: `操作系统内核是系统最核心的程序，管理 CPU、内存、IO 等硬件资源`
  },
  {
    term: '单核',
    keywords: ['单核'],
    category: '计算机基础',
    level: 'beginner',
    summary: '单个物理核心的 CPU，一次只能处理一个线程',
    description: `单个物理核心的 CPU，一次只能处理一个线程`
  },
  {
    term: '双核',
    keywords: ['双核'],
    category: '计算机基础',
    level: 'beginner',
    summary: '包含两个物理核心的 CPU，可并行处理两个任务',
    description: `包含两个物理核心的 CPU，可并行处理两个任务`
  },
  {
    term: '台积电',
    keywords: ['台积电'],
    category: '计算机基础',
    level: 'beginner',
    summary: 'TSMC，全球最大的芯片代工厂商',
    description: `TSMC，全球最大的芯片代工厂商`
  },
  {
    term: '四核',
    keywords: ['四核'],
    category: '计算机基础',
    level: 'beginner',
    summary: '包含四个物理核心的 CPU',
    description: `包含四个物理核心的 CPU`
  },
  {
    term: '固态',
    keywords: ['固态'],
    category: '存储',
    level: 'beginner',
    summary: 'SSD 固态硬盘使用 NAND 闪存，无机械部件，读写速度快',
    description: `SSD 固态硬盘使用 NAND 闪存，无机械部件，读写速度快`
  },
  {
    term: '希捷',
    keywords: ['希捷'],
    category: '存储',
    level: 'beginner',
    summary: 'Seagate，全球主要硬盘制造商',
    description: `Seagate，全球主要硬盘制造商`
  },
  {
    term: '开发',
    keywords: ['开发'],
    category: '计算机基础',
    level: 'beginner',
    summary: '编写和构建软件的过程',
    description: `编写和构建软件的过程`
  },
  {
    term: '志强',
    keywords: ['志强'],
    category: '计算机基础',
    level: 'beginner',
    summary: 'Intel 至强系列服务器级 CPU，支持 ECC 内存和多路配置',
    description: `Intel 至强系列服务器级 CPU，支持 ECC 内存和多路配置`
  },
  {
    term: '扇区',
    keywords: ['扇区'],
    category: '存储',
    level: 'beginner',
    summary: '磁盘的最小物理存储单元，通常 512 字节或 4K',
    description: `磁盘的最小物理存储单元，通常 512 字节或 4K`
  },
  {
    term: '显存',
    keywords: ['显存'],
    category: '计算机基础',
    level: 'beginner',
    summary: 'VRAM，显卡专用内存，用于存储图像数据、纹理和渲染缓冲',
    description: `VRAM，显卡专用内存，用于存储图像数据、纹理和渲染缓冲`
  },
  {
    term: '机械',
    keywords: ['机械'],
    category: '存储',
    level: 'beginner',
    summary: 'HDD 机械硬盘使用旋转盘片和磁头读写，容量大、性价比高',
    description: `HDD 机械硬盘使用旋转盘片和磁头读写，容量大、性价比高`
  },
  {
    term: '柱面',
    keywords: ['柱面'],
    category: '存储',
    level: 'beginner',
    summary: '所有盘面同一半径磁道的集合，是磁盘分区的基本单位',
    description: `所有盘面同一半径磁道的集合，是磁盘分区的基本单位`
  },
  {
    term: '登出',
    keywords: ['登出'],
    category: 'Linux',
    level: 'beginner',
    summary: '退出当前用户登录会话，释放占用的系统资源',
    description: `退出当前用户登录会话，释放占用的系统资源`
  },
  {
    term: '盘片',
    keywords: ['盘片'],
    category: '存储',
    level: 'beginner',
    summary: '硬盘内部的圆形磁盘片，表面涂有磁性材料保存数据',
    description: `硬盘内部的圆形磁盘片，表面涂有磁性材料保存数据`
  },
  {
    term: '相对',
    keywords: ['相对'],
    category: 'Linux',
    level: 'beginner',
    summary: '相对路径以当前目录为基准，使用 ./ 或 ../ 描述位置',
    description: `相对路径以当前目录为基准，使用 ./ 或 ../ 描述位置`
  },
  {
    term: '磁道',
    keywords: ['磁道'],
    category: '存储',
    level: 'beginner',
    summary: '磁盘盘面上的同心圆数据轨道',
    description: `磁盘盘面上的同心圆数据轨道`
  },
  {
    term: '管道',
    keywords: ['管道'],
    category: 'Linux',
    level: 'beginner',
    summary: '用 | 符号将前一个命令的输出作为后一个命令的输入',
    description: `用 | 符号将前一个命令的输出作为后一个命令的输入`
  },
  {
    term: '绝对',
    keywords: ['绝对'],
    category: 'Linux',
    level: 'beginner',
    summary: '绝对路径从根目录 / 开始描述文件系统位置',
    description: `绝对路径从根目录 / 开始描述文件系统位置`
  },
  {
    term: '联发科',
    keywords: ['联发科'],
    category: '计算机基础',
    level: 'beginner',
    summary: 'MediaTek，手机芯片设计公司',
    description: `MediaTek，手机芯片设计公司`
  },
  {
    term: '英特尔',
    keywords: ['英特尔'],
    category: '计算机基础',
    level: 'beginner',
    summary: 'Intel，全球最大的 CPU 和半导体制造商',
    description: `Intel，全球最大的 CPU 和半导体制造商`
  },
  {
    term: '西数',
    keywords: ['西数'],
    category: '存储',
    level: 'beginner',
    summary: 'Western Digital（WD），全球主要硬盘制造商',
    description: `Western Digital（WD），全球主要硬盘制造商`
  },
  {
    term: '覆盖',
    keywords: ['覆盖'],
    category: 'Linux',
    level: 'beginner',
    summary: '重定向符号 > 会覆盖目标文件原有内容',
    description: `重定向符号 > 会覆盖目标文件原有内容`
  },
  {
    term: '转速',
    keywords: ['转速'],
    category: '存储',
    level: 'beginner',
    summary: '硬盘盘片每分钟旋转次数（RPM），常见 5400/7200/15000 RPM',
    description: `硬盘盘片每分钟旋转次数（RPM），常见 5400/7200/15000 RPM`
  },
  {
    term: '追加',
    keywords: ['追加'],
    category: 'Linux',
    level: 'beginner',
    summary: '重定向符号 >> 将输出追加到目标文件末尾而不覆盖',
    description: `重定向符号 >> 将输出追加到目标文件末尾而不覆盖`
  },
  {
    term: '酷睿',
    keywords: ['酷睿'],
    category: '计算机基础',
    level: 'beginner',
    summary: 'Intel 酷睿系列消费级 CPU，分 i3/i5/i7/i9 等级',
    description: `Intel 酷睿系列消费级 CPU，分 i3/i5/i7/i9 等级`
  },
  {
    term: '高通',
    keywords: ['高通'],
    category: '计算机基础',
    level: 'beginner',
    summary: 'Qualcomm，手机和 ARM 架构芯片的主要厂商',
    description: `Qualcomm，手机和 ARM 架构芯片的主要厂商`
  }

]

export interface KnowledgeMatch {
  entry: KnowledgeEntry
  matchedTerm: string
}

/**
 * 在文本中查找所有匹配的知识点
 */
export function findKnowledgeTerms(text: string): KnowledgeMatch[] {
  if (!text || text.length < 2) return []
  const results: KnowledgeMatch[] = []
  const seen = new Set<string>()

  for (const entry of knowledgeDB) {
    for (const kw of entry.keywords) {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        if (!seen.has(entry.term)) {
          seen.add(entry.term)
          results.push({ entry, matchedTerm: kw })
        }
        break
      }
    }
  }

  return results
}

/**
 * 根据术语名称获取完整知识条目
 */
export function getKnowledgeEntry(term: string): KnowledgeEntry | undefined {
  const normalized = term.trim().toLowerCase()
  return knowledgeDB.find(
    (e) => e.term.toLowerCase() === normalized || e.keywords.some((k) => k.toLowerCase() === normalized)
  )
}

/**
 * 获取某个分类下的所有知识点
 */
export function getKnowledgeByCategory(category: string): KnowledgeEntry[] {
  return knowledgeDB.filter((e) => e.category === category)
}

/**
 * 获取所有知识条目（用于搜索）
 */
export function getAllKnowledge(): KnowledgeEntry[] {
  return knowledgeDB
}
