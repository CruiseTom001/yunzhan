"""彻底重建 knowledge.ts - 修复接口定义 + 加 core 标记"""
import re, zipfile, xml.etree.ElementTree as ET, os

base_xmind = r'D:\BaiduNetdiskDownload\云计算'
out_path = r'E:\trae_project\运维学习网站\src\utils\knowledge.ts'

# ===== Step 1: 提取 xmind 全部知识点 =====
xmind_terms = set()
for root, dirs, fnames in os.walk(base_xmind):
    for f in fnames:
        if not f.endswith('.xmind'): continue
        try:
            with zipfile.ZipFile(os.path.join(root, f), 'r') as z:
                if 'content.xml' not in z.namelist(): continue
                tree = ET.parse(z.open('content.xml'))
                ns = '{urn:xmind:xmap:xmlns:content:2.0}'
                for title in tree.getroot().iter(f'{ns}title'):
                    if title.text and title.text.strip():
                        t = title.text.strip()
                        if 2 < len(t) < 60:
                            xmind_terms.add(t)
        except:
            pass

print(f'XMind 知识点: {len(xmind_terms)}')

# ===== Step 2: 定义核心（必修）知识点白名单 =====
# 基于 xmind 课程结构：1-6章的核心命令和概念
core_terms = {
    # === 第1章：系统部署 ===
    'Linux 文件系统', 'GNU', 'GPL', 'Linux 发行版', 'RHEL', 'CentOS',
    'Ubuntu', 'Debian', 'RHCE', 'RHCA', 'RHCSA', 'VMware', '虚拟机',
    'CPU', '中央处理器', '主频', '核心数', '内存', '磁盘',
    '冯诺依曼', '开源', 'Kernel',
    
    # === 第2章：文件和用户管理 ===
    'cat', 'more', 'less', 'head', 'tail', 'grep', 'mkdir', 'rm', 'cp',
    'mv', 'touch', 'ln', 'find', 'tr', 'seq',
    '绝对路径', '相对路径', '文件类型', 'vim', 'vi',
    'inode', '硬链接', '软链接', '符号链接', '设备文件',
    '用户管理', '组管理', 'useradd', 'passwd', 'usermod', 'userdel',
    'groupadd', 'gpasswd', 'sudo', 'su', 'wheel',
    '/etc/passwd', '/etc/shadow', '/etc/group', 'UID', 'GID',
    
    # === 第3章：权限管理 ===
    'chmod', 'chown', 'chgrp', 'ACL', 'SUID', 'SGID', 'Sticky', 'Sticky Bit',
    'setfacl', 'getfacl', 'chattr', 'lsattr', 'umask', 'UGO',
    '权限管理', '文件权限', 'rwx', '读', '写', '执行',
    
    # === 第4章：进程管理 ===
    'ps', 'top', 'kill', 'pkill', 'killall', 'nice', 'renice',
    'jobs', 'fg', 'bg', 'nohup', 'proc', '/proc', '进程管理',
    '进程', '进程优先级', 'SIGTERM', 'SIGKILL', 'SIGHUP',
    'systemctl', 'systemd', 'PID', 'PPID', '信号',
    
    # === 第5章：管道重定向 ===
    '管道', '重定向', 'tee', 'xargs', 'awk', 'sed', 'sort', 'uniq', 'wc',
    'cut', 'diff', '文件描述符', 'stdin', 'stdout', 'stderr',
    '标准输入', '标准输出', '标准错误输出',
    
    # === 第6章：磁盘管理 ===
    'fdisk', 'parted', 'MBR', 'GPT', 'mkfs', 'mount', 'umount',
    'UUID', 'LVM', 'PV', 'VG', 'LV', 'swap', 'lvextend',
    'fstab', '/etc/fstab', '挂载', '磁盘分区', '格式化',
    '文件系统管理', 'df', 'du', 'dd', 'lsblk', 'blkid', 'fsck',
    
    # === 网络 ===
    'TCP/IP', 'DNS', 'HTTP', 'HTTPS', 'SSL/TLS', 'ping', 'traceroute',
    'ss', 'netstat', 'ip', 'ifconfig', 'curl', 'wget',
    'ssh', 'scp', 'rsync', 'NFS', '防火墙', 'iptables',
    
    # === 其他 ===
    'Docker', 'Kubernetes', 'Git', 'MySQL', 'Redis', 'Nginx',
    '负载均衡', '监控', 'Prometheus', 'Grafana', 'ELK',
    'Ansible', 'Terraform', 'DevOps', 'CI/CD', 'SSH',
    'Python', 'Shell', '定时任务', 'cron', '备份',
}

# ===== Step 3: 生成 JS 条目 =====
skip_words = {'作业','简介','图片','图示','比如','区别','案例','失败','概念',
    '回车','语法','类型','演示','测试','前提','示例','操作','错误','问题',
    '提示','接口','总结','练习','注意','推荐','开头','日常','用途','用法',
    '目标','选项','设置','说明','结论','覆盖','追加','容量','尺寸','型号',
    '配置','写入','读取','执行','删除','创建','移动','复制','大小','转速',
    '界面','样式','背景','颜色','内容','修改','保存','打开','关闭','描述',
    '目的','方法','步骤','定义','原理','结构','功能','范围','状态','信息',
    '选择','编辑','输入','输出','目录','作用','组织','完整','位置','方式',
    '划分','顺序','取消','硬件','连接','显示','监控','日志','需要','学习',
    '掌握','理解','知道','常用','灵魂','玩具','留下','概念','格式','前提',
    '在线','画布','手稿','小孩','毛坯房','隔间','口诀','默认'}

entries = []
for t in sorted(xmind_terms):
    clean = t.strip()
    if '\n' in clean or '\r' in clean: continue
    if '--' in clean or '//' in clean or '#' in clean: continue
    if re.match(r'^\d', clean): continue
    if re.search(r'[{}()\[\]]', clean): continue
    if len(clean) < 2: continue
    if clean in skip_words: continue
    
    is_en = bool(re.match(r'^[a-zA-Z][a-zA-Z0-9_.\-]{1,30}$', clean))
    is_cn = bool(re.match(r'^[\u4e00-\u9fff]{2,12}$', clean))
    if not (is_en or is_cn): continue
    
    if is_en and clean.lower() in {'the','and','for','are','but','not','you',
        'all','any','can','had','her','was','one','our','out','has','have',
        'been','some','them','then','this','that','with','from','they',
        'about','which','where','there','after','other','also','more',
        'than','very','just','over','such','each','only','own','same',
        'into','text','file','root','boot','home','help','list','test',
        'name','date','time','type','size','link','show','stop','find',
        'call','last','open','step','part','case','line','read','sort',
        'pass','edit','code','mode','view'}: continue

    esc = clean.replace("'", "\\'")
    kw = clean if is_cn else clean.lower()
    is_core = clean in core_terms
    
    cat = 'Linux'
    if clean in ['CPU','中央处理器','主频','核心数','针脚数','内存','显存','芯片组','南北桥芯片','冯诺依曼']:
        cat = '计算机基础'
    elif clean in ['MBR','GPT','扇区','柱面','磁道','盘片','固态','机械','LVM','PV','VG','LV','swap','UUID','分区','挂载','mkfs','mount']:
        cat = '存储'
    elif clean in ['GNU','GPL','RHCA','RHCE','RHCSA','Linux 发行版','开源']:
        cat = '云计算基础'
    elif clean in ['Docker','Kubernetes','Pod','容器','容器化']:
        cat = 'Docker'
    elif clean in ['Git','GitHub','版本控制']:
        cat = 'Git'
    elif clean in ['MySQL','Redis','性能','数据']:
        cat = '数据库'
    elif clean in ['TCP/IP','DNS','HTTP','HTTPS','SSL','TLS','IP','防火墙','网络']:
        cat = '网络基础'
    elif clean in ['Python','pip','脚本']:
        cat = 'Python'
    elif clean in ['Prometheus','Grafana','监控']:
        cat = '监控'
    elif clean in ['Ansible','Terraform','自动化']:
        cat = '自动化运维'
    elif clean in ['DevOps','SRE','CI/CD','敏捷']:
        cat = 'DevOps'
    elif clean in ['虚拟化','KVM','VMware','Hypervisor']:
        cat = '虚拟化'
    
    core_marker = 'true' if is_core else 'false'
    
    entries.append(f'''  {{
    term: '{esc}',
    keywords: ['{kw}'],
    category: '{cat}',
    level: 'beginner',
    core: {core_marker},
    summary: '{esc} {"⭐ 必修" if is_core else ""} — Linux 运维概念',
    description: `{esc} 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  }}''')

core_count = sum(1 for e in entries if 'core: true' in e)
print(f'条目: {len(entries)} 个, 其中必修: {core_count} 个')

# ===== Step 4: 构建完整文件 =====
types_and_header = '''/**
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
'''

functions = '''
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
'''

body = ',\n'.join(entries)
full_content = types_and_header + body + functions

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(full_content)

print(f'✅ 文件已写入: {out_path}')
print(f'   总大小: {len(full_content)} 字节')
