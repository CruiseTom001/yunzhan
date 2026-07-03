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
  },
  {
    term: 'PATH 环境变量',
    keywords: ['PATH', '环境变量PATH', '命令查找路径'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: 'PATH 决定 Shell 到哪些目录里查找可执行命令',
    description: `PATH 是一组用冒号分隔的目录列表。你输入 ls、docker、python 这类命令时，Shell 会按 PATH 的顺序逐个目录查找可执行文件。命令找不到、执行到了错误版本、自己写的脚本无法直接运行，很多都和 PATH 有关。`,
    related: ['export', 'which', 'env'],
    tips: '用 echo $PATH 查看当前查找路径，用 which 命令确认实际执行的是哪个程序。'
  },
  {
    term: 'inode',
    keywords: ['inode', '索引节点', 'df -i'],
    category: 'Linux',
    level: 'intermediate',
    core: true,
    summary: 'inode 保存文件元数据和数据块指针，不保存文件名',
    description: `inode 是 Linux 文件系统中的索引节点，保存权限、所有者、大小、时间戳和数据块位置等元数据。文件名保存在目录项里，所以硬链接可以让多个文件名指向同一个 inode。磁盘空间没满但无法创建文件时，可能是 inode 用尽。`,
    related: ['硬链接', 'stat', 'df'],
    tips: '用 stat file 查看 inode 详细信息，用 df -i 查看 inode 使用率。'
  },
  {
    term: '软链接与硬链接',
    keywords: ['软链接', '硬链接', '符号链接', 'symbolic link', 'hard link'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: '软链接像快捷方式，硬链接是同一 inode 的多个文件名',
    description: `软链接保存的是目标路径，可以跨文件系统，也可以指向目录；目标被删除后软链接会失效。硬链接直接指向同一个 inode，不能跨文件系统，通常也不能给目录创建硬链接。运维中更常用软链接管理版本目录和配置入口。`,
    related: ['ln', 'inode'],
    tips: '用 ln -s target link 创建软链接，用 ls -l 查看链接指向。'
  },
  {
    term: 'FHS 文件系统层级',
    keywords: ['FHS', '/etc', '/var', '/usr', '/opt', '文件系统层级'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: 'FHS 约定 Linux 关键目录分别存放配置、日志、程序和数据',
    description: `FHS（Filesystem Hierarchy Standard）帮助你理解 Linux 目录职责：/etc 放系统配置，/var 放日志和可变数据，/usr 放系统软件和共享资源，/opt 常放第三方应用，/home 放普通用户数据，/tmp 放临时文件。理解这些目录能显著提升排障效率。`,
    related: ['绝对路径', '相对路径'],
    tips: '排查服务时通常先看 /etc 下的配置，再看 /var/log 下的日志。'
  },
  {
    term: '通配符 glob',
    keywords: ['glob', '通配符', '文件名通配', '模式匹配'],
    category: 'Shell',
    level: 'beginner',
    core: true,
    summary: 'glob 是 Shell 在执行命令前展开文件名的匹配规则',
    description: `通配符由 Shell 先展开，再把结果交给命令执行。* 匹配任意长度字符，? 匹配单个字符，[abc] 匹配指定字符集合。它常用于批量查看、移动、删除文件，但 rm *.log 这类命令需要格外谨慎。`,
    related: ['rm', 'find'],
    tips: '执行危险操作前先用 ls *.log 确认匹配结果，再换成 rm。'
  },
  {
    term: 'sudo 机制',
    keywords: ['sudo机制', 'sudoers', '/etc/sudoers', '提权'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: 'sudo 根据 sudoers 策略临时授予用户执行高权限命令的能力',
    description: `sudo 不是简单的“变成 root”，而是根据 /etc/sudoers 或 /etc/sudoers.d/ 中的规则，判断用户能否以指定身份执行某条命令。sudo 会记录审计日志，并通常缓存一小段时间的认证状态。生产环境应避免直接共享 root 密码，而是用普通账号 + sudo 控制权限。`,
    related: ['sudo', '用户管理'],
    tips: '编辑 sudoers 应使用 visudo，它会做语法检查，避免写错导致无法提权。'
  },
  {
    term: '特殊权限位',
    keywords: ['SUID', 'SGID', 'Sticky Bit', 'suid', 'sgid', 'sticky'],
    category: 'Linux',
    level: 'intermediate',
    core: true,
    summary: 'SUID、SGID、Sticky Bit 是 rwx 之外的高级权限控制',
    description: `SUID 让可执行文件运行时临时获得文件所有者权限，典型例子是 passwd；SGID 让程序以所属组权限运行，或让目录中新文件继承目录所属组；Sticky Bit 常用于 /tmp，允许多人写入但只能删除自己的文件。`,
    related: ['chmod', '权限管理'],
    tips: '用 ls -l 可看到 s、S、t、T 标记；生产中不要随意给脚本或可写目录设置 SUID。'
  },
  {
    term: 'systemd unit',
    keywords: ['systemd', 'unit', 'service unit', 'systemd unit', 'journalctl'],
    category: 'Linux',
    level: 'intermediate',
    core: true,
    summary: 'systemd 用 unit 描述服务、挂载、定时器等系统资源',
    description: `systemd 是现代 Linux 常见的系统和服务管理器。unit 是它的管理对象，常见类型包括 .service、.socket、.timer、.mount、.target。systemctl 管理 unit 状态，journalctl 查看 systemd 收集的日志。`,
    related: ['systemctl', 'journalctl'],
    tips: '排查服务常用三连：systemctl status 服务名、journalctl -u 服务名、systemctl cat 服务名。'
  },
  {
    term: 'Linux 信号',
    keywords: ['SIGTERM', 'SIGKILL', 'SIGHUP', '信号机制', 'kill信号'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: '信号是内核和进程之间传递控制事件的机制',
    description: `Linux 信号用于通知进程发生了某类事件。SIGTERM 请求进程正常退出，SIGKILL 强制终止且无法被捕获，SIGHUP 常用于让守护进程重新加载配置。kill 命令本质上就是向进程发送信号。`,
    related: ['kill', '进程'],
    tips: '优先用 kill PID 或 systemctl stop，让程序有机会清理资源；最后才用 kill -9。'
  },
  {
    term: '守护进程 daemon',
    keywords: ['daemon', '守护进程', '后台服务'],
    category: 'Linux',
    level: 'beginner',
    core: true,
    summary: '守护进程是在后台长期运行、提供系统或网络能力的进程',
    description: `守护进程通常不依赖交互式终端，随系统启动，在后台持续提供服务，例如 sshd、nginx、cron、dockerd。现代 Linux 通常由 systemd 负责启动、停止、重启和监督这些服务。`,
    related: ['systemd unit', 'systemctl'],
    tips: '服务异常时先看 systemctl status，再看 journalctl -u 对应服务。'
  },
  {
    term: 'Heredoc',
    keywords: ['Heredoc', '<<EOF', 'EOF', '多行写入'],
    category: 'Shell',
    level: 'beginner',
    core: true,
    summary: 'Heredoc 用 <<EOF 这类语法向命令传入多行文本',
    description: `Heredoc 是 Shell 的多行输入语法，常用于生成配置文件、写入脚本片段或通过 ssh 执行多行远程命令。它不是一个独立命令，而是一种把多行文本作为标准输入传给命令的方式。`,
    related: ['tee', 'cat', '重定向'],
    tips: '写系统文件时常用 sudo tee file <<EOF，而不是 sudo echo ... > file，因为重定向发生在当前普通用户 Shell 中。'
  },
  {
    term: 'DNS 解析流程',
    keywords: ['DNS', '域名解析', '递归查询', '权威 DNS'],
    category: '网络',
    level: 'beginner',
    core: true,
    summary: 'DNS 把域名解析成 IP，是访问网站和服务发现的基础',
    description: `DNS 解析通常会先查本机缓存和 hosts，再询问递归解析器；递归解析器必要时依次向根域、顶级域、权威 DNS 查询，最终返回记录。排查域名问题时要区分“解析不到”“解析到错误 IP”和“解析正确但网络不通”。`,
    related: ['dig', 'nslookup', 'ping'],
    tips: '先用 dig 域名 看解析结果，再用 curl -v 或 ping 判断服务连通性。'
  }
]

export interface KnowledgeMatch {
  entry: KnowledgeEntry
  matchedTerm: string
}

/**
 * 在文本中查找所有匹配的知识点
 *
 * 短关键词（纯 ASCII 且长度 ≤4，如 ps/bg/fg/amd/e5）用单词边界匹配，
 * 避免在 "config"/"specs"/"maps" 等无关单词子串上误命中；
 * 其余关键词（含中文或较长术语）保持 includes 子串匹配。
 */
export function findKnowledgeTerms(text: string): KnowledgeMatch[] {
  if (!text || text.length < 2) return []
  const results: KnowledgeMatch[] = []
  const seen = new Set<string>()

  const lowerText = text.toLowerCase()

  for (const entry of knowledgeDB) {
    for (const kw of entry.keywords) {
      const lkw = kw.toLowerCase()
      // 短 ASCII 关键词（如 ps/bg/fg/amd/e5）用单词边界匹配，
      // 避免在 "config"/"specs"/"maps" 等无关单词子串上误命中；
      // 含中文或较长的关键词保持 includes 子串匹配。
      const matched = isShortAsciiKeyword(lkw)
        ? new RegExp(`\\b${escapeRegExp(lkw)}\\b`).test(lowerText)
        : lowerText.includes(lkw)
      if (matched && !seen.has(entry.term)) {
        seen.add(entry.term)
        results.push({ entry, matchedTerm: kw })
        break
      }
    }
  }

  return results
}

/** 短 ASCII 关键词：纯字母数字且长度 ≤4，需要单词边界约束以减少误标 */
function isShortAsciiKeyword(kw: string): boolean {
  return kw.length > 0 && kw.length <= 4 && /^[a-z0-9]+$/.test(kw)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
