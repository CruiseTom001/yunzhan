/**
 * 命令讲解数据库
 * 为每个命令提供：用途说明、常用选项、实战技巧、演示视频链接
 */

export interface CommandExplanation {
  /** 命令名称 */
  command: string
  /** 一句话概述 */
  summary: string
  /** 详细说明 */
  description: string
  /** 常用选项说明，{ option: 说明 } */
  options?: Record<string, string>
  /** 实战示例 */
  examples?: string[]
  /** 演示视频 URL（YouTube / Bilibili 等） */
  demoUrl?: string
  /** 演示视频标题 */
  demoTitle?: string
}

const explainDB: Record<string, CommandExplanation> = {
  // ========== Linux 文件目录操作 ==========
  ls: {
    command: 'ls',
    summary: '列出目录内容',
    description: 'ls 是 Linux 中使用频率最高的命令之一，用于列出目录中的文件和子目录。支持多种选项组合来定制输出格式。',
    options: {
      '-l': '长格式显示（权限、所有者、大小、修改时间）',
      '-a': '显示所有文件，包括以 . 开头的隐藏文件',
      '-h': '以人类可读格式显示文件大小（与 -l 联用）',
      '-t': '按修改时间排序（最新的在前）',
      '-r': '反转排序顺序',
      '-S': '按文件大小排序',
      '-R': '递归显示所有子目录',
      '-d': '只显示目录本身，不展开内容',
    },
    examples: [
      'ls -lha  # 查看所有文件的详细信息',
      'ls -lt   # 按修改时间排序查看',
      'ls -d */ # 只列出目录',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=linux%20ls%20%E5%91%BD%E4%BB%A4',
    demoTitle: '搜索 ls 命令教程',
  },
  cd: {
    command: 'cd',
    summary: '切换工作目录',
    description: 'cd（Change Directory）用于在不同目录之间切换。Linux 的目录切换遵循绝对路径（从 / 开始）和相对路径（从当前目录开始）两种方式。',
    options: {
      '~': '切换到当前用户的家目录',
      '-': '切换到上一次所在的目录',
      '..': '上一级目录',
      '.': '当前目录',
    },
    examples: [
      'cd ~          # 回到用户家目录',
      'cd -          # 返回上次目录',
      'cd /etc/nginx # 进入绝对路径',
      'cd ../..      # 向上走两级',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=linux%20cd%20%E5%91%BD%E4%BB%A4',
    demoTitle: '搜索 cd 命令教程',
  },
  pwd: {
    command: 'pwd',
    summary: '显示当前工作目录的完整路径',
    description: 'pwd（Print Working Directory）输出当前所在的绝对路径。当你在目录结构中迷路时，pwd 是你的定位器。',
    examples: ['pwd  # 输出类似 /home/user/docs'],
  },
  mkdir: {
    command: 'mkdir',
    summary: '创建新目录',
    description: 'mkdir（Make Directory）用于创建一个或多个新目录。结合 -p 选项可以递归创建多层不存在的父目录，这是最常见的用法。',
    options: {
      '-p': '递归创建目录，父目录不存在时自动创建',
      '-v': '显示创建过程的详细信息',
      '-m': '创建时直接设置权限模式',
    },
    examples: [
      'mkdir mydir              # 创建单层目录',
      'mkdir -p a/b/c/d         # 递归创建多层目录',
      'mkdir -m 755 newdir      # 创建并设置权限为 755',
    ],
  },
  rmdir: {
    command: 'rmdir',
    summary: '删除空目录',
    description: 'rmdir 用于删除空目录。目录非空时会报错。实际工作中更常用 rm -rf 来删除非空目录，但使用 -rf 时要格外小心！',
    options: {
      '-p': '递归删除父目录（父目录也必须为空）',
    },
  },
  rm: {
    command: 'rm',
    summary: '删除文件或目录',
    description: 'rm（Remove）用于删除文件或目录。⚠️ Linux 中删除的文件不会进回收站，一旦删除很难恢复，请谨慎操作！',
    options: {
      '-r': '递归删除（删除目录时必需）',
      '-f': '强制删除，不提示确认',
      '-i': '逐个文件确认删除',
      '-v': '显示删除过程的详细信息',
    },
    examples: [
      'rm file.txt         # 删除文件',
      'rm -rf dir/         # ⚠️ 递归强制删除目录（极其危险！）',
      'rm -i *.tmp         # 逐个确认删除 .tmp 文件',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=linux%20rm%20%E5%91%BD%E4%BB%A4',
    demoTitle: '搜索 rm 命令教程',
  },
  cp: {
    command: 'cp',
    summary: '复制文件或目录',
    description: 'cp（Copy）用于复制文件或目录。支持保留属性、递归复制、创建备份等多种模式。',
    options: {
      '-r': '递归复制（复制目录时必需）',
      '-p': '保留原文件的属性（时间、权限等）',
      '-a': '归档模式，相当于 -dpr（保留所有属性）',
      '-i': '覆盖前提示确认',
      '-u': '只复制源文件更新的文件（增量复制）',
      '-v': '显示复制过程',
    },
    examples: [
      'cp file.txt backup/          # 复制文件到目录',
      'cp -r src/ dest/             # 递归复制整个目录',
      'cp -a /home/user /backup/    # 完整归档备份',
    ],
  },
  mv: {
    command: 'mv',
    summary: '移动或重命名文件/目录',
    description: 'mv（Move）用于移动文件到不同位置，或在同一目录下重命名。相比 cp，mv 不复制数据，只修改文件系统的指针，速度更快。',
    options: {
      '-i': '覆盖前提示确认',
      '-u': '只移动更新的文件',
      '-v': '显示移动过程',
    },
    examples: [
      'mv old.txt new.txt    # 重命名文件',
      'mv file.txt dir/      # 移动到其他目录',
      'mv dir1/ dir2/        # 移动或重命名目录',
    ],
  },
  touch: {
    command: 'touch',
    summary: '创建空文件或更新时间戳',
    description: 'touch 的主要用途有两个：创建一个新的空文件，或者更新已有文件的访问/修改时间为当前时间。在需要快速创建占位文件时非常实用。',
  },
  cat: {
    command: 'cat',
    summary: '查看文件内容（连接文件）',
    description: 'cat（Concatenate）将文件内容输出到终端。适合查看短文件。对于长文件，建议用 less 或 head/tail 分页查看。',
    options: {
      '-n': '显示行号',
      '-b': '显示行号（只对非空行编号）',
      '-s': '压缩连续空行为一行',
      '-E': '在每行末尾显示 $',
    },
    examples: [
      'cat file.txt              # 查看文件内容',
      'cat -n file.txt           # 带行号查看',
      'cat file1.txt file2.txt > merged.txt  # 合并文件',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=linux%20cat%20%E5%91%BD%E4%BB%A4',
    demoTitle: '搜索 cat 命令教程',
  },
  less: {
    command: 'less',
    summary: '分页查看文件内容',
    description: 'less 是一个强大的文件查看器，支持前后翻页、搜索、跳转等操作。比 more 功能更强，且不会一次性将整个文件读入内存，适合查看大文件。',
    options: {
      '-N': '显示行号',
      '-S': '截断长行（不换行），←→ 滚动查看',
      '+F': '跟踪模式（类似 tail -f）',
      '-i': '搜索时忽略大小写',
    },
    examples: [
      'less large.log        # 分页查看大日志文件',
      'less -N config.yml    # 带行号查看配置',
      'less +F app.log       # 实时跟踪日志输出',
    ],
  },
  head: {
    command: 'head',
    summary: '显示文件开头部分',
    description: 'head 默认显示文件的前 10 行。常用于快速查看日志或配置文件的开头部分。',
    options: {
      '-n': '指定显示的行数',
      '-c': '指定显示的字节数',
    },
    examples: ['head -n 20 file.txt   # 显示前 20 行', 'head -c 100 file.txt  # 显示前 100 个字节'],
  },
  tail: {
    command: 'tail',
    summary: '显示文件末尾部分',
    description: 'tail 默认显示文件的后 10 行。-f 模式是运维最常用的功能之一，可以实时跟踪日志文件的新增内容。',
    options: {
      '-n': '指定显示的行数',
      '-f': '实时跟踪文件新增内容（按 Ctrl+C 退出）',
      '-F': '跟踪文件，支持日志轮转（文件名变化后自动重连）',
    },
    examples: [
      'tail -f /var/log/syslog    # 实时查看系统日志',
      'tail -n 100 app.log        # 查看最后 100 行',
      'tail -F /var/log/nginx/access.log  # 跟踪 Nginx 访问日志',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=linux%20tail%20%E5%91%BD%E4%BB%A4',
    demoTitle: '搜索 tail 命令教程',
  },
  // ========== 文件查找与内容处理 ==========
  find: {
    command: 'find',
    summary: '在目录树中搜索文件',
    description: 'find 是 Linux 最强大的文件搜索工具。它能按文件名、类型、大小、时间、权限等多种条件搜索，并可以对搜索结果执行操作。',
    options: {
      '-name': '按文件名匹配（支持通配符）',
      '-type': '按类型搜索（f=文件, d=目录, l=链接）',
      '-size': '按大小搜索（+100M=大于100MB）',
      '-mtime': '按修改时间搜索（+7=7天前）',
      '-exec': '对搜索到的文件执行命令',
    },
    examples: [
      'find /var -name "*.log" -size +100M  # 查找大日志文件',
      'find . -type f -name "*.tmp" -delete # 删除所有 .tmp 文件',
      'find . -mtime +30 -exec rm {} \\;     # 删除 30 天前的文件',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=linux%20find%20%E5%91%BD%E4%BB%A4',
    demoTitle: '搜索 find 命令教程',
  },
  grep: {
    command: 'grep',
    summary: '在文件中搜索文本模式',
    description: 'grep（Global Regular Expression Print）是运维最常用的文本搜索工具。它使用正则表达式在文件中匹配模式，是日志分析的利器。',
    options: {
      '-i': '忽略大小写',
      '-r': '递归搜索子目录',
      '-n': '显示匹配行的行号',
      '-c': '只统计匹配行数',
      '-v': '反向匹配（显示不匹配的行）',
      '-l': '只显示包含匹配的文件名',
      '-E': '使用扩展正则表达式（同 egrep）',
      '-A N': '同时显示匹配行的后 N 行',
      '-B N': '同时显示匹配行的前 N 行',
      '-C N': '同时显示匹配行的前后各 N 行',
    },
    examples: [
      'grep "ERROR" app.log              # 搜索错误日志',
      'grep -r "TODO" --include="*.ts" . # 在源码中搜索 TODO',
      'tail -f app.log | grep "timeout"  # 实时过滤日志',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=linux%20grep%20%E5%91%BD%E4%BB%A4',
    demoTitle: '搜索 grep 命令教程',
  },
  sed: {
    command: 'sed',
    summary: '流编辑器——对文本进行查找替换',
    description: 'sed（Stream Editor）是一个非交互式流编辑器，常用于对文件进行批量的查找替换、插入删除等操作。运维中批量修改配置文件时非常高效。',
    options: {
      '-i': '直接修改文件内容（不加 -i 只预览结果）',
      '-n': '静默模式，只打印被处理的行',
      '-e': '指定多个编辑命令',
    },
    examples: [
      "sed -i 's/old/new/g' file.txt     # 全局替换",
      "sed -n '/ERROR/p' app.log         # 只打印包含 ERROR 的行",
      "sed -i '/^#/d' config.conf        # 删除所有注释行",
    ],
  },
  awk: {
    command: 'awk',
    summary: '文本处理和数据提取工具',
    description: 'awk 是一个强大的文本分析工具，擅长处理按列分隔的数据。它将每一行视为一条记录，每个字段（默认按空格分割）作为一个列，非常适合分析日志和报表。',
    options: {
      '-F': '指定字段分隔符（默认空格/制表符）',
      '-v': '传递外部变量',
    },
    examples: [
      "awk '{print $1}' access.log       # 打印第一列（IP）",
      "awk -F: '{print $1}' /etc/passwd  # 按 : 分割，取用户名",
      "awk '$3 > 100 {print $1, $3}' data.txt  # 条件过滤",
    ],
  },
  // ========== 权限管理 ==========
  chmod: {
    command: 'chmod',
    summary: '修改文件或目录的权限',
    description: 'chmod（Change Mode）用于修改文件或目录的读（r=4）、写（w=2）、执行（x=1）权限。可以用数字模式（如 755）或符号模式（如 u+x）来设置。',
    examples: [
      'chmod 755 script.sh     # rwxr-xr-x 所有者可读写执行',
      'chmod +x script.sh      # 给所有用户添加执行权限',
      'chmod -R 644 dir/       # 递归设置目录下所有文件权限',
    ],
  },
  chown: {
    command: 'chown',
    summary: '修改文件或目录的所有者',
    description: 'chown（Change Owner）用于修改文件或目录的所有者和所属组。修改所有者需要 root 权限。',
    examples: [
      'chown user:group file.txt  # 同时修改所有者和组',
      'chown -R user:group dir/   # 递归修改整个目录',
      'chown user file.txt        # 只修改所有者',
    ],
  },
  // ========== 进程管理 ==========
  ps: {
    command: 'ps',
    summary: '查看当前运行的进程',
    description: 'ps（Process Status）用于查看当前系统的进程信息。通常与 aux 或 ef 组合使用来查看所有进程的详细信息，是排查问题的第一步。',
    options: {
      'aux': '显示所有进程（a=所有用户, u=详细信息, x=无终端进程）',
      'ef': '显示所有进程及完整命令行',
      '-eo': '自定义输出格式',
    },
    examples: [
      'ps aux                       # 查看所有进程',
      'ps aux --sort=-%mem          # 按内存使用排序',
      'ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%cpu | head  # top CPU 进程',
    ],
  },
  top: {
    command: 'top',
    summary: '实时监控系统进程和资源',
    description: 'top 是 Linux 系统管理员最重要的实时监控工具之一。它动态显示 CPU、内存使用率以及各进程的资源占用情况，是定位性能瓶颈的首选工具。',
    examples: [
      'top              # 启动 top 监控',
      'top -u nginx     # 只监控特定用户的进程',
      'top -bn1         # 一次性输出（适合脚本采集）',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=linux%20top%20%E5%91%BD%E4%BB%A4',
    demoTitle: '搜索 top 命令教程',
  },
  kill: {
    command: 'kill',
    summary: '终止进程',
    description: 'kill 用于向进程发送信号。默认发送 SIGTERM（15），让进程优雅退出。如果进程不响应，可以发送 SIGKILL（9）强制终止。',
    options: {
      '-9': 'SIGKILL，强制终止进程（无法被捕获）',
      '-15': 'SIGTERM，请求进程优雅退出（默认）',
      '-2': 'SIGINT，等同于 Ctrl+C',
      '-1': 'SIGHUP，重新加载配置',
    },
    examples: [
      'kill 1234           # 优雅终止 PID 为 1234 的进程',
      'kill -9 1234        # 强制终止',
      'kill -1 $(cat /var/run/nginx.pid)  # 重载 Nginx 配置',
    ],
  },
  // ========== 网络工具 ==========
  ping: {
    command: 'ping',
    summary: '测试网络连通性和延迟',
    description: 'ping 使用 ICMP 协议向目标主机发送数据包并等待回应，用于检测网络连通性、测量往返延迟和丢包率。',
    options: {
      '-c': '指定发送次数（Linux 下不会自动停止）',
      '-i': '设置发送间隔（秒）',
      '-s': '设置数据包大小',
    },
    examples: [
      'ping -c 4 baidu.com       # 发 4 个包后停止',
      'ping -i 0.5 192.168.1.1  # 每 0.5 秒 ping 一次',
    ],
  },
  curl: {
    command: 'curl',
    summary: '发送 HTTP 请求或下载文件',
    description: 'curl 是一个强大的命令行 HTTP 客户端，支持多种协议（HTTP/HTTPS/FTP 等）。是 API 调试、文件下载、接口测试的必备工具。',
    options: {
      '-X': '指定请求方法（GET/POST/PUT/DELETE）',
      '-H': '添加请求头',
      '-d': '发送 POST 数据体',
      '-o': '将输出保存到文件',
      '-L': '跟随重定向',
      '-v': '显示详细通信过程（调试利器）',
    },
    examples: [
      'curl https://api.example.com          # GET 请求',
      "curl -X POST -H 'Content-Type: application/json' -d '{\"key\":\"value\"}' https://api.example.com",
      'curl -o file.zip https://example.com/file.zip  # 下载文件',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=curl%20%E5%91%BD%E4%BB%A4%20%E6%95%99%E7%A8%8B',
    demoTitle: '搜索 curl 教程',
  },
  wget: {
    command: 'wget',
    summary: '命令行下载工具',
    description: 'wget 是一个非交互式的命令行下载工具，支持断点续传、递归下载、后台下载等特性。适合在脚本中自动化下载任务。',
    options: {
      '-c': '断点续传',
      '-O': '指定保存的文件名',
      '-P': '指定保存目录',
      '-q': '安静模式（不输出日志）',
      '-b': '后台下载',
    },
    examples: [
      'wget -c https://example.com/bigfile.zip  # 断点续传',
      'wget -O output.zip https://example.com/file.zip  # 指定输出文件名',
    ],
  },
  ssh: {
    command: 'ssh',
    summary: '远程登录到另一台主机',
    description: 'ssh（Secure Shell）是 Linux/Unix 系统之间安全远程连接的标准协议。所有通信均经过加密，是运维人员最常用的工具。',
    options: {
      '-p': '指定端口号（默认 22）',
      '-i': '指定私钥文件',
      '-N': '不执行远程命令（用于端口转发）',
      '-L': '本地端口转发',
      '-R': '远程端口转发',
    },
    examples: [
      'ssh user@192.168.1.100                # 默认端口登录',
      'ssh -p 2222 -i ~/.ssh/id_rsa user@host  # 指定端口和密钥',
      'ssh -L 8080:localhost:80 user@server  # 本地端口转发',
    ],
  },
  scp: {
    command: 'scp',
    summary: '通过 SSH 安全传输文件',
    description: 'scp（Secure Copy）基于 SSH 协议在本地和远程主机之间安全地复制文件。语法类似于 cp 命令。',
    examples: [
      'scp file.txt user@host:/remote/path/    # 上传文件',
      'scp -r dir/ user@host:/remote/path/     # 递归上传目录',
      'scp user@host:/remote/file.txt ./       # 下载文件',
    ],
  },
  // ========== 系统信息 ==========
  df: {
    command: 'df',
    summary: '查看磁盘空间使用情况',
    description: 'df（Disk Free）显示文件系统的磁盘空间使用情况。运维中常用 df -h 来快速检查磁盘是否快满了。',
    options: {
      '-h': '以人类可读格式显示（GB/MB）',
      '-T': '显示文件系统类型',
      '-i': '显示 inode 使用情况',
    },
    examples: ['df -h              # 查看磁盘使用情况', 'df -hT             # 显示文件系统类型', 'df -i /var         # 查看 /var 分区的 inode 使用'],
  },
  du: {
    command: 'du',
    summary: '统计文件或目录的磁盘使用量',
    description: 'du（Disk Usage）用于统计文件或目录占用的磁盘空间。常用 du -sh * 来查看当前目录下每个子目录的大小。',
    options: {
      '-h': '以人类可读格式显示',
      '-s': '只显示总计（不递归显示子目录）',
      '-c': '显示总计行',
      '--max-depth=N': '限制递归深度',
    },
    examples: [
      'du -sh *              # 查看当前目录下各项目大小',
      'du -h --max-depth=1   # 查看一级子目录大小',
      'du -sh /var/log       # 查看日志目录总大小',
    ],
  },
  free: {
    command: 'free',
    summary: '查看系统内存使用情况',
    description: 'free 显示系统的内存总量、已用、空闲以及缓存/buffer 使用情况。注意 Linux 会将空闲内存用作缓存，所以 "available" 列才是真正可用的内存。',
    options: {
      '-h': '以人类可读格式显示',
      '-m': '以 MB 为单位显示',
      '-g': '以 GB 为单位显示',
      '-s N': '每 N 秒刷新一次',
    },
    examples: ['free -h           # 查看内存使用', 'free -s 5         # 每 5 秒刷新一次'],
  },
  uname: {
    command: 'uname',
    summary: '查看系统内核信息',
    description: 'uname（Unix Name）显示当前系统的内核版本、主机名、架构等信息。常用 uname -a 获取完整的系统信息。',
    options: {
      '-a': '显示所有信息',
      '-r': '显示内核版本',
      '-m': '显示机器架构（x86_64/aarch64）',
    },
    examples: ['uname -a    # 查看完整系统信息', 'uname -m    # 查看架构（如 x86_64）'],
  },
  // ========== 压缩归档 ==========
  tar: {
    command: 'tar',
    summary: '创建和解压归档文件',
    description: 'tar（Tape Archive）是 Linux 上最常用的归档工具。常与 gzip（.tar.gz/.tgz）或 bzip2（.tar.bz2）组合使用。',
    options: {
      '-c': '创建归档',
      '-x': '解压归档',
      '-z': '通过 gzip 压缩/解压',
      '-j': '通过 bzip2 压缩/解压',
      '-v': '显示处理过程',
      '-f': '指定归档文件名',
      '-t': '查看归档内容',
    },
    examples: [
      'tar -czvf archive.tar.gz dir/    # 创建 .tar.gz 压缩包',
      'tar -xzvf archive.tar.gz         # 解压 .tar.gz',
      'tar -tf archive.tar.gz           # 查看包内文件列表',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=linux%20tar%20%E5%91%BD%E4%BB%A4',
    demoTitle: '搜索 tar 命令教程',
  },
  zip: {
    command: 'zip',
    summary: '创建和解压 ZIP 格式文件',
    description: 'zip 是跨平台的压缩格式，在 Linux/macOS/Windows 上通用。常用于与 Windows 用户交换文件。',
    options: {
      '-r': '递归处理目录',
      '-q': '安静模式',
      '-d': '从压缩包中删除文件',
    },
    examples: [
      'zip -r archive.zip dir/      # 压缩目录',
      'unzip archive.zip            # 解压 ZIP 文件',
      'unzip -l archive.zip         # 查看 ZIP 内容',
    ],
  },
  // ========== Shell 相关 ==========
  echo: {
    command: 'echo',
    summary: '输出文本到终端',
    description: 'echo 是最简单的输出命令。常用于脚本中输出提示信息、查看变量值、将文本写入文件。',
    options: {
      '-n': '不输出末尾换行符',
      '-e': '启用转义字符（\\n 换行, \\t 制表符等）',
    },
    examples: [
      'echo "Hello World"           # 输出文本',
      'echo $PATH                   # 查看环境变量',
      'echo "text" > file.txt       # 写入文件',
    ],
  },
  export: {
    command: 'export',
    summary: '设置环境变量',
    description: 'export 用于设置或导出环境变量，使变量在当前 shell 及所有子进程中可见。只在当前 shell 会话中有效，想要永久生效需要写入 ~/.bashrc 或 ~/.profile。',
    examples: [
      'export PATH=$PATH:/usr/local/bin  # 添加路径到 PATH',
      'export JAVA_HOME=/usr/lib/jvm/java-11  # 设置 JAVA_HOME',
    ],
  },
  alias: {
    command: 'alias',
    summary: '定义命令别名',
    description: "alias 用于给常用命令创建简短别名。例如 alias ll='ls -alF'。定义的别名只在当前 shell 有效，想要永久生效需要写入 ~/.bashrc。",
    examples: [
      "alias ll='ls -alF'          # 常用别名",
      "alias ..='cd ..'            # 快捷返回上级",
      "alias grep='grep --color=auto'  # grep 带颜色",
    ],
  },
  // ========== 包管理 ==========
  apt: {
    command: 'apt',
    summary: 'Debian/Ubuntu 包管理器',
    description: 'apt（Advanced Package Tool）是 Debian/Ubuntu 系列的包管理工具。用于安装、更新、卸载软件包。注意 apt 命令通常需要 root 权限（加 sudo）。',
    examples: [
      'sudo apt update              # 更新软件包索引',
      'sudo apt install nginx       # 安装 Nginx',
      'sudo apt remove nginx        # 卸载 Nginx',
      'sudo apt upgrade             # 升级所有已安装的包',
    ],
  },
  yum: {
    command: 'yum',
    summary: 'CentOS/RHEL 包管理器',
    description: 'yum（Yellowdog Updater Modified）是 CentOS/RHEL 7 及之前版本的包管理工具。CentOS 8+ 已改用 dnf。',
    examples: [
      'sudo yum install nginx       # 安装 Nginx',
      'sudo yum update              # 更新所有包',
      'sudo yum remove nginx        # 卸载 Nginx',
    ],
  },
  systemctl: {
    command: 'systemctl',
    summary: '管理系统服务（systemd）',
    description: 'systemctl 是 systemd 系统和服务管理器的核心命令，用于管理 Linux 服务的启动、停止、重启、开机自启等。',
    options: {
      'start': '启动服务',
      'stop': '停止服务',
      'restart': '重启服务',
      'reload': '重新加载配置（不中断服务）',
      'enable': '设置开机自启',
      'disable': '取消开机自启',
      'status': '查看服务状态',
    },
    examples: [
      'systemctl status nginx        # 查看 Nginx 服务状态',
      'sudo systemctl start nginx    # 启动 Nginx',
      'sudo systemctl enable nginx   # 设置开机自启',
      'sudo systemctl restart nginx  # 重启 Nginx',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=systemctl%20%E5%91%BD%E4%BB%A4%20%E6%95%99%E7%A8%8B',
    demoTitle: '搜索 systemctl 教程',
  },
  // ========== 网络排查 ==========
  netstat: {
    command: 'netstat',
    summary: '查看网络连接和端口状态',
    description: 'netstat 用于显示网络连接、路由表、接口统计等信息。虽然已被 ss 和 ip 命令逐步取代，但仍然是排查网络问题的常用工具。',
    examples: [
      'netstat -tlnp               # 查看所有 TCP 监听端口',
      'netstat -an | grep ESTABLISHED  # 查看已建立的连接',
      'netstat -i                  # 查看网络接口统计',
    ],
  },
  ss: {
    command: 'ss',
    summary: '查看套接字统计（netstat 替代）',
    description: 'ss（Socket Statistics）是 netstat 的现代替代品，速度更快、信息更全。在排查网络问题时，ss -tlnp 是最常用的组合。',
    examples: [
      'ss -tlnp                    # 查看所有 TCP 监听端口及对应进程',
      'ss -tulnp                   # 查看 TCP 和 UDP 端口',
      'ss -s                       # 查看套接字统计摘要',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=linux%20ss%20%E5%91%BD%E4%BB%A4',
    demoTitle: '搜索 ss 命令教程',
  },
  // ========== Linux 高频运维补充 ==========
  sudo: {
    command: 'sudo',
    summary: '以授权用户身份执行命令',
    description: 'sudo（Superuser Do）用于让普通用户临时以 root 或其他用户权限执行命令。运维中安装软件、修改系统配置、管理服务时经常需要 sudo，但应坚持最小权限原则，只在确实需要时使用。',
    options: {
      '-u': '指定以哪个用户身份执行命令',
      '-i': '启动目标用户的登录 Shell，常用于进入 root 环境',
      '-l': '列出当前用户被允许执行的 sudo 命令',
      '-k': '清除已缓存的认证状态，下次 sudo 需要重新输入密码',
    },
    examples: [
      'sudo systemctl restart nginx     # 以管理员权限重启服务',
      'sudo -l                          # 查看当前用户可执行的提权命令',
      'sudo -u deploy whoami            # 以 deploy 用户身份执行命令',
    ],
  },
  vi: {
    command: 'vi',
    summary: '终端文本编辑器',
    description: 'vi 是几乎所有类 Unix 系统都会提供的文本编辑器。运维改配置时常遇到 vi：按 i 进入插入模式，按 Esc 回到普通模式，输入 :wq 保存退出，输入 :q! 放弃修改退出。',
    options: {
      '+数字': '打开文件后跳到指定行号',
      '-R': '只读方式打开文件',
    },
    examples: [
      'vi /etc/nginx/nginx.conf         # 编辑 Nginx 配置',
      'vi +120 app.log                  # 打开文件并跳到第 120 行',
      '按 i 编辑，Esc 后输入 :wq 保存退出',
    ],
  },
  vim: {
    command: 'vim',
    summary: '增强版 vi 文本编辑器',
    description: 'vim 是 vi 的增强版，支持语法高亮、搜索、分屏、插件等功能。服务器上如果安装了 vim，通常比 vi 更适合长时间编辑配置和脚本。',
    options: {
      '-O': '垂直分屏打开多个文件',
      '-d': '以 diff 模式比较文件',
      '+/关键词': '打开文件后跳到第一个匹配关键词的位置',
    },
    examples: [
      'vim /etc/ssh/sshd_config         # 编辑 SSH 配置',
      'vim -d old.conf new.conf         # 对比两个配置文件',
      'vim +/server nginx.conf          # 打开后定位到 server 关键字',
    ],
  },
  nano: {
    command: 'nano',
    summary: '新手友好的终端文本编辑器',
    description: 'nano 比 vi/vim 更直观，底部会显示快捷键提示。常用 Ctrl+O 保存、Enter 确认文件名、Ctrl+X 退出，适合初学者快速修改小配置。',
    options: {
      '-l': '显示行号',
      '-w': '关闭自动换行',
      '+行号': '打开后跳到指定行',
    },
    examples: [
      'nano /etc/hosts                  # 编辑 hosts 文件',
      'nano -l script.sh                # 显示行号编辑脚本',
    ],
  },
  which: {
    command: 'which',
    summary: '查找命令实际执行路径',
    description: 'which 会根据 PATH 环境变量查找命令的位置。排查“为什么执行的是这个版本”“为什么命令找不到”时非常有用。',
    examples: [
      'which nginx                      # 查看 nginx 命令路径',
      'which python                     # 判断当前默认 python 来自哪里',
      'which -a node                    # 显示 PATH 中所有匹配的 node',
    ],
  },
  whereis: {
    command: 'whereis',
    summary: '查找命令、源码和手册页位置',
    description: 'whereis 不只看 PATH，还会在系统常见目录中查找二进制文件、源码和 man 手册。它适合粗略定位软件安装位置。',
    options: {
      '-b': '只查找二进制文件',
      '-m': '只查找 man 手册',
      '-s': '只查找源码',
    },
    examples: [
      'whereis nginx                    # 查找 nginx 相关路径',
      'whereis -b python                # 只查找 python 可执行文件',
    ],
  },
  env: {
    command: 'env',
    summary: '查看或临时设置环境变量',
    description: 'env 常用于列出当前进程环境变量，也可以在不污染当前 Shell 的情况下临时设置变量执行命令。它与 export、PATH、脚本运行环境关系很密切。',
    options: {
      '-i': '从空环境启动命令',
      'VAR=value': '临时设置环境变量',
    },
    examples: [
      'env                              # 查看所有环境变量',
      'env | grep PATH                  # 查看 PATH 配置',
      'env NODE_ENV=production npm run build  # 临时设置变量执行命令',
    ],
  },
  history: {
    command: 'history',
    summary: '查看 Shell 命令历史',
    description: 'history 可以查看曾经执行过的命令，是提升终端效率和复盘操作的重要工具。配合 Ctrl+R 反向搜索历史命令，能显著减少重复输入。',
    options: {
      '-c': '清空当前 Shell 历史记录',
      '-d': '删除指定编号的历史记录',
      '-w': '将当前历史写入历史文件',
    },
    examples: [
      'history                          # 查看历史命令',
      'history | grep docker            # 搜索执行过的 docker 命令',
      '!123                             # 重新执行编号为 123 的历史命令',
    ],
  },
  tree: {
    command: 'tree',
    summary: '树形展示目录结构',
    description: 'tree 会用层级树的形式展示目录，比 ls -R 更适合快速理解项目结构、配置目录和部署产物。部分系统需要先安装 tree 软件包。',
    options: {
      '-L': '限制显示层级深度',
      '-a': '显示隐藏文件',
      '-d': '只显示目录',
      '-I': '排除匹配的文件或目录',
    },
    examples: [
      'tree -L 2                         # 展示两层目录结构',
      'tree -a -I node_modules           # 显示隐藏文件并排除 node_modules',
    ],
  },
  ln: {
    command: 'ln',
    summary: '创建硬链接或软链接',
    description: 'ln 用于创建链接文件。默认创建硬链接，最常见的是 ln -s 创建软链接。运维中常用软链接管理版本目录、配置文件入口和可执行文件快捷路径。',
    options: {
      '-s': '创建符号链接（软链接）',
      '-f': '目标存在时强制覆盖',
      '-n': '把已存在的符号链接当作普通文件处理',
      '-v': '显示创建过程',
    },
    examples: [
      'ln -s /opt/app/releases/v2 /opt/app/current  # 创建当前版本软链接',
      'ln -s /etc/nginx/sites-available/app.conf /etc/nginx/sites-enabled/app.conf',
      'ln source.log hardlink.log       # 创建硬链接',
    ],
  },
  tee: {
    command: 'tee',
    summary: '同时输出到屏幕和文件',
    description: 'tee 会从标准输入读取内容，一边显示到终端，一边写入文件。它常用于管道中保存日志，也常配合 sudo 写入普通重定向无法写入的系统文件。',
    options: {
      '-a': '追加写入，不覆盖原文件',
      '-i': '忽略中断信号',
    },
    examples: [
      'echo "server_name example.com;" | sudo tee /etc/nginx/conf.d/app.conf',
      'docker logs -f api | tee api.log  # 实时查看并保存日志',
      'command 2>&1 | tee run.log        # 同时保存标准输出和错误输出',
    ],
  },
  source: {
    command: 'source',
    summary: '在当前 Shell 中执行脚本',
    description: 'source 会让脚本在当前 Shell 进程中执行，因此脚本里设置的变量、函数、alias 会保留下来。修改 ~/.bashrc、~/.profile 后常用 source 立即生效。',
    examples: [
      'source ~/.bashrc                  # 让新的 Shell 配置立即生效',
      '. ./env.sh                        # source 的简写形式',
      'source venv/bin/activate          # 激活 Python 虚拟环境',
    ],
  },
  stat: {
    command: 'stat',
    summary: '查看文件元数据',
    description: 'stat 用于查看文件的 inode、权限、大小、所有者、访问/修改/状态变更时间等元数据。排查文件是否被改动、软硬链接关系、inode 问题时非常常用。',
    options: {
      '-c': '自定义输出格式',
      '-f': '查看文件所在文件系统的信息',
      '-L': '跟随符号链接，显示目标文件信息',
    },
    examples: [
      'stat /etc/passwd                 # 查看文件完整元数据',
      'stat -c "%i %n" *                # 输出 inode 和文件名',
      'stat -f /var/log                 # 查看文件系统信息',
    ],
  },
  diff: {
    command: 'diff',
    summary: '比较文件差异',
    description: 'diff 用于比较两个文件或目录的差异。运维改配置前后、升级前后、排障回滚时都常用它确认到底改了什么。',
    options: {
      '-u': '以 unified 格式显示差异，最常用',
      '-r': '递归比较目录',
      '-q': '只报告是否不同，不显示具体差异',
    },
    examples: [
      'diff -u nginx.conf.bak nginx.conf  # 比较配置改动',
      'diff -qr old-dir new-dir           # 递归比较目录',
    ],
  },
  sort: {
    command: 'sort',
    summary: '排序文本行',
    description: 'sort 对文本按行排序，常和 uniq、cut、grep、awk 组合处理日志和清单。默认按字典序排序，数值统计时要加 -n。',
    options: {
      '-n': '按数字大小排序',
      '-r': '倒序排序',
      '-k': '按指定列排序',
      '-u': '排序并去重',
    },
    examples: [
      'sort access.log                  # 按行排序日志',
      'sort -nr count.txt               # 数值倒序排序',
      'sort -k2 users.txt               # 按第 2 列排序',
    ],
  },
  uniq: {
    command: 'uniq',
    summary: '合并相邻重复行',
    description: 'uniq 用于去除或统计相邻重复行，所以通常要先 sort 再 uniq。它非常适合统计访问 IP、错误类型、重复条目。',
    options: {
      '-c': '统计每行出现次数',
      '-d': '只显示重复行',
      '-u': '只显示不重复行',
    },
    examples: [
      "awk '{print $1}' access.log | sort | uniq -c",
      'sort names.txt | uniq            # 去重',
      'sort errors.txt | uniq -c | sort -nr',
    ],
  },
  cut: {
    command: 'cut',
    summary: '按列或字符切割文本',
    description: 'cut 用于从每行文本中提取指定字段或字符范围。处理冒号分隔的 /etc/passwd、CSV、日志字段时很方便。',
    options: {
      '-d': '指定字段分隔符',
      '-f': '选择字段编号',
      '-c': '按字符位置截取',
    },
    examples: [
      "cut -d: -f1 /etc/passwd          # 提取用户名",
      "echo 'a,b,c' | cut -d, -f2       # 输出 b",
      'cut -c1-10 app.log              # 提取前 10 个字符',
    ],
  },
  wc: {
    command: 'wc',
    summary: '统计行数、单词数和字节数',
    description: 'wc 常用于统计文件行数、日志匹配数量、命令输出规模。运维里最常见的是 wc -l。',
    options: {
      '-l': '统计行数',
      '-w': '统计单词数',
      '-c': '统计字节数',
      '-m': '统计字符数',
    },
    examples: [
      'wc -l app.log                    # 查看日志行数',
      'grep ERROR app.log | wc -l       # 统计错误行数',
      'find . -type f | wc -l           # 统计文件数量',
    ],
  },
  id: {
    command: 'id',
    summary: '查看用户 UID、GID 和组信息',
    description: 'id 用于确认当前或指定用户的 UID、主组、附加组。排查文件权限、sudo 权限、服务运行用户时很常用。',
    options: {
      '-u': '只显示 UID',
      '-g': '只显示主组 GID',
      '-G': '显示所有组 ID',
      '-n': '显示名称而不是数字 ID',
    },
    examples: [
      'id                              # 查看当前用户身份',
      'id nginx                        # 查看 nginx 用户信息',
      'id -nG deploy                   # 查看 deploy 所属组名',
    ],
  },
  useradd: {
    command: 'useradd',
    summary: '创建系统用户',
    description: 'useradd 用于创建新用户。生产环境中创建服务用户、部署用户时很常见，通常需要 sudo 权限，并配合 passwd、usermod、id 检查结果。',
    options: {
      '-m': '创建用户家目录',
      '-s': '指定登录 Shell',
      '-G': '指定附加组',
      '-r': '创建系统用户',
    },
    examples: [
      'sudo useradd -m -s /bin/bash deploy',
      'sudo useradd -r -s /usr/sbin/nologin app',
      'id deploy                       # 验证用户创建结果',
    ],
  },
  usermod: {
    command: 'usermod',
    summary: '修改用户属性',
    description: 'usermod 用于修改已有用户的组、Shell、家目录、锁定状态等。把用户加入 docker 或 sudo 组时经常用到。',
    options: {
      '-aG': '追加用户到附加组，注意通常要带 -a',
      '-s': '修改登录 Shell',
      '-L': '锁定用户密码',
      '-U': '解锁用户密码',
    },
    examples: [
      'sudo usermod -aG docker deploy   # 将用户加入 docker 组',
      'sudo usermod -s /bin/bash app    # 修改登录 Shell',
      'id deploy                        # 查看组是否生效',
    ],
  },
  file: {
    command: 'file',
    summary: '识别文件类型',
    description: 'file 根据文件内容判断类型，而不是只看后缀。遇到没有扩展名的文件、脚本执行失败、二进制和文本混淆时很好用。',
    options: {
      '-b': '只输出类型，不输出文件名',
      '-i': '输出 MIME 类型',
      '-L': '跟随符号链接',
    },
    examples: [
      'file deploy.sh                   # 判断脚本类型',
      'file -i data.json                # 查看 MIME 和编码',
      'file /usr/bin/ls                 # 查看可执行文件类型',
    ],
  },
  xargs: {
    command: 'xargs',
    summary: '把标准输入转换成命令参数',
    description: 'xargs 会把管道输入转换为后续命令的参数，常用于 find、grep、awk 后面批量处理文件。处理文件名含空格时要使用 -0 搭配 find -print0。',
    options: {
      '-0': '以 NUL 字符分隔输入，安全处理空格文件名',
      '-n': '每次传给命令的参数数量',
      '-I': '指定占位符，逐项替换执行',
    },
    examples: [
      'find . -name "*.log" -print0 | xargs -0 rm',
      'cat hosts.txt | xargs -n1 ping -c1',
      'find . -name "*.conf" | xargs grep server_name',
    ],
  },
  jobs: {
    command: 'jobs',
    summary: '查看当前 Shell 的后台作业',
    description: 'jobs 显示当前 Shell 启动并管理的后台/暂停作业。它和 Ctrl+Z、bg、fg、& 组成基础的作业控制能力。',
    options: {
      '-l': '显示作业对应的进程 ID',
      '-r': '只显示正在运行的作业',
      '-s': '只显示已停止的作业',
    },
    examples: [
      'jobs                            # 查看后台作业',
      'jobs -l                         # 显示 PID',
      'fg %1                           # 把 1 号作业切回前台',
    ],
  },
  nohup: {
    command: 'nohup',
    summary: '让命令忽略退出登录信号',
    description: 'nohup 用于让命令在终端退出后继续运行，常配合 & 放到后台。它适合临时任务，但正式服务更推荐 systemd、supervisor 或容器编排管理。',
    examples: [
      'nohup ./backup.sh > backup.log 2>&1 &',
      'nohup python app.py > app.log 2>&1 &',
      'tail -f nohup.out               # 查看默认输出',
    ],
  },
  ulimit: {
    command: 'ulimit',
    summary: '查看或设置 Shell 资源限制',
    description: 'ulimit 控制当前 Shell 及其子进程的资源限制，比如最大打开文件数、最大进程数、core dump 大小。排查 too many open files 时必看。',
    options: {
      '-a': '显示所有限制',
      '-n': '查看或设置最大打开文件数',
      '-u': '查看或设置最大用户进程数',
      '-c': '查看或设置 core 文件大小',
    },
    examples: [
      'ulimit -a                       # 查看全部限制',
      'ulimit -n                       # 查看最大打开文件数',
      'ulimit -n 65535                 # 临时提高打开文件数限制',
    ],
  },
  heredoc: {
    command: 'heredoc',
    summary: '使用 <<EOF 写入多行文本',
    description: 'Heredoc 不是独立命令，而是 Shell 的多行输入语法。它常和 cat、tee、ssh 配合，用来生成配置文件或把多行脚本传给远程主机执行。',
    examples: [
      'cat > app.conf <<EOF\nserver_name example.com;\nEOF',
      'sudo tee /etc/app/config.yml >/dev/null <<EOF\nport: 8080\nEOF',
      'ssh host <<EOF\nhostname\nuptime\nEOF',
    ],
  },
  // ========== Docker ==========
  docker: {
    command: 'docker',
    summary: '容器化应用管理工具',
    description: 'Docker 是应用最广泛的容器引擎。通过 docker 命令可以管理镜像、容器、网络、卷等。现代运维必备技能。',
    options: {
      'ps': '列出容器',
      'images': '列出本地镜像',
      'pull': '拉取镜像',
      'run': '创建并启动容器',
      'exec': '在运行中的容器内执行命令',
      'logs': '查看容器日志',
      'compose': '管理多容器应用',
    },
    examples: [
      'docker ps -a                     # 查看所有容器（含已停止）',
      'docker pull nginx:latest         # 拉取最新 Nginx 镜像',
      'docker run -d -p 80:80 nginx     # 后台运行 Nginx',
      'docker exec -it container_id bash  # 进入容器',
    ],
    demoUrl: 'https://www.bilibili.com/search?keyword=docker%20%E5%85%A5%E9%97%A8%E6%95%99%E7%A8%8B',
    demoTitle: '搜索 Docker 教程',
  },
  // ========== Git ==========
  git: {
    command: 'git',
    summary: '分布式版本控制',
    description: 'Git 是目前最流行的版本控制工具，用于追踪文件变更、协作开发。掌握 Git 是工程师的必备技能。',
    examples: [
      'git clone <url>            # 克隆仓库',
      'git add . && git commit -m "msg"  # 提交变更',
      'git push origin main       # 推送到远程',
      'git log --oneline          # 查看提交历史',
    ],
  },
}

/**
 * 从代码块文本中提取命令名
 */
export function extractCommand(code: string, _lang?: string): string | null {
  // 取第一行第一个词作为命令名
  const firstLine = code.trim().split('\n')[0].trim()
  // 去掉行首的 $ 或 #
  const normalizedLine = firstLine.replace(/^[$#%>]\s*/, '')
  if (/<<\s*['"]?[A-Za-z_][A-Za-z0-9_]*['"]?/.test(normalizedLine)) return 'heredoc'
  if (/^\.\s+/.test(normalizedLine)) return 'source'
  const cmd = normalizedLine.split(/\s+/)[0]
  if (!cmd) return null
  // 去掉路径前缀（如 /usr/bin/ls 取 ls）
  return cmd.split('/').pop() || null
}

/**
 * 查找命令的讲解信息
 */
export function lookupCommand(command: string): CommandExplanation | null {
  const normalized = command.toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return explainDB[normalized] || null
}

export function getAllCommandExplanations(): CommandExplanation[] {
  return Object.values(explainDB)
}

/**
 * 获取命令的演示视频链接
 */
export function getDemoUrl(command: string): { url: string; title: string } | null {
  const info = lookupCommand(command)
  if (info?.demoUrl) {
    return { url: info.demoUrl, title: info.demoTitle || `${command} 教程` }
  }
  // 没有预置视频时，生成搜索链接
  return {
    url: `https://www.bilibili.com/search?keyword=${encodeURIComponent(command + ' Linux 命令')}`,
    title: `搜索 ${command} 教程`,
  }
}
