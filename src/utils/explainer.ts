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
  const cmd = firstLine.replace(/^[$#%>]\s*/, '').split(/\s+/)[0]
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
