"""补全 Word 文档中的缺失知识点"""
import re

kpath = r'E:\trae_project\运维学习网站\src\utils\knowledge.ts'

with open(kpath, 'r', encoding='utf-8') as f:
    content = f.read()

# 真正有用的缺失知识点（过滤掉教学用语/通用词）
new_terms = {
    # 命令
    'bg': ('bg（back）将暂停的后台作业继续运行', 'Linux'),
    'fg': ('fg（fore）将后台作业调至前台运行', 'Linux'),
    'PS': ('ps（Process Status）显示系统进程快照，最常用的进程查看命令', 'Linux'),
    'E5': ('Intel 至强 E5 系列服务器处理器，企业级服务器常用', '计算机基础'),
    
    # 硬件
    '主频': ('CPU 的时钟频率，单位 GHz，决定每秒运算次数', '计算机基础'),
    '单核': ('单个物理核心的 CPU，一次只能处理一个线程', '计算机基础'),
    '双核': ('包含两个物理核心的 CPU，可并行处理两个任务', '计算机基础'),
    '四核': ('包含四个物理核心的 CPU', '计算机基础'),
    '八核': ('包含八个物理核心的 CPU，适合高并发任务', '计算机基础'),
    '内核': ('操作系统内核是系统最核心的程序，管理 CPU、内存、IO 等硬件资源', '计算机基础'),
    '内存': ('RAM（随机存取存储器），计算机的临时数据存储设备，断电丢失', '计算机基础'),
    '显存': ('VRAM，显卡专用内存，用于存储图像数据、纹理和渲染缓冲', '计算机基础'),
    '酷睿': ('Intel 酷睿系列消费级 CPU，分 i3/i5/i7/i9 等级', '计算机基础'),
    '志强': ('Intel 至强系列服务器级 CPU，支持 ECC 内存和多路配置', '计算机基础'),
    'AMD': ('半导体公司，生产 Ryzen 和 EPYC 系列 CPU', '计算机基础'),
    '高通': ('Qualcomm，手机和 ARM 架构芯片的主要厂商', '计算机基础'),
    '英特尔': ('Intel，全球最大的 CPU 和半导体制造商', '计算机基础'),
    '台积电': ('TSMC，全球最大的芯片代工厂商', '计算机基础'),
    '联发科': ('MediaTek，手机芯片设计公司', '计算机基础'),
    
    # 存储
    '固态': ('SSD 固态硬盘使用 NAND 闪存，无机械部件，读写速度快', '存储'),
    '机械': ('HDD 机械硬盘使用旋转盘片和磁头读写，容量大、性价比高', '存储'),
    '扇区': ('磁盘的最小物理存储单元，通常 512 字节或 4K', '存储'),
    '柱面': ('所有盘面同一半径磁道的集合，是磁盘分区的基本单位', '存储'),
    '磁道': ('磁盘盘面上的同心圆数据轨道', '存储'),
    '盘片': ('硬盘内部的圆形磁盘片，表面涂有磁性材料保存数据', '存储'),
    '转速': ('硬盘盘片每分钟旋转次数（RPM），常见 5400/7200/15000 RPM', '存储'),
    '希捷': ('Seagate，全球主要硬盘制造商', '存储'),
    '西数': ('Western Digital（WD），全球主要硬盘制造商', '存储'),
    
    # 概念
    '绝对': ('绝对路径从根目录 / 开始描述文件系统位置', 'Linux'),
    '相对': ('相对路径以当前目录为基准，使用 ./ 或 ../ 描述位置', 'Linux'),
    '管道': ('用 | 符号将前一个命令的输出作为后一个命令的输入', 'Linux'),
    '覆盖': ('重定向符号 > 会覆盖目标文件原有内容', 'Linux'),
    '追加': ('重定向符号 >> 将输出追加到目标文件末尾而不覆盖', 'Linux'),
    '登出': ('退出当前用户登录会话，释放占用的系统资源', 'Linux'),
    '兼容': ('软硬件在特定环境下能正常运行的能力', '计算机基础'),
    '开发': ('编写和构建软件的过程', '计算机基础'),
}

# 生成条目
entries = []
for term, (desc, cat) in sorted(new_terms.items()):
    esc = term.replace("'", "\\'")
    entries.append(f'''  {{
    term: '{esc}',
    keywords: ['{term.lower() if term[0].isalpha() else term}'],
    category: '{cat}',
    level: 'beginner',
    summary: '{desc.split("。")[0]}',
    description: `{desc}`
  }}''')

print(f'添加 {len(entries)} 个知识点')

# 找到插入位置
insert_pos = content.rfind('\n]\n')
if insert_pos > 0:
    joined = ',\n'.join(entries)
    new_text = content[:insert_pos] + ',\n' + joined + '\n' + content[insert_pos:]
    
    with open(kpath, 'w', encoding='utf-8') as f:
        f.write(new_text)
    
    with open(kpath, 'r', encoding='utf-8') as f:
        verify = f.read()
    count = len(re.findall(r"term:\s*['\"]([^'\"]+)['\"]", verify))
    print(f'✅ 完成，共 {count} 个知识点')
else:
    print('❌ 找不到插入位置')
