## 4.1 进程基础概念

- **进程（Process）**：正在运行的程序实例，拥有独立的 PID、内存空间和资源
- **父进程与子进程**：父进程通过 fork 创建子进程，形成进程树
- **孤儿进程**：父进程终止后，子进程被 init（PID 1）接管
- **僵尸进程**：子进程已终止但父进程未回收其退出状态

## 4.2 ps —— 查看进程

\`\`\`bash
ps aux          # 显示所有进程（BSD 风格）
ps -ef          # 显示所有进程（Unix 风格）
ps -ef --forest # 树形显示进程关系
\`\`\`

### ps aux 输出解读

\`\`\`
USER   PID  %CPU %MEM    VSZ   RSS TTY  STAT  START   TIME COMMAND
root     1   0.0  0.1  22540  1396 ?    Ss   10:00   0:01 /sbin/init
\`\`\`

| 列 | 含义 |
|----|------|
| %CPU | CPU 使用率 |
| %MEM | 内存使用率 |
| VSZ | 虚拟内存大小 (KB) |
| RSS | 物理内存大小 (KB) |
| STAT | 进程状态（R 运行, S 睡眠, Z 僵尸, T 停止） |

### 常见组合

\`\`\`bash
# 查找包含 "nginx" 的进程
ps aux | grep nginx

# 按内存使用排序
ps aux --sort=-%mem | head -10

# 按 CPU 使用排序
ps aux --sort=-%cpu | head -10
\`\`\`

## 4.3 top / htop —— 实时进程监控

\`top\` 是实时系统监控工具，\`htop\` 是其增强版（需单独安装）。

\`\`\`bash
top                # 默认 3 秒刷新
top -d 1           # 1 秒刷新
top -u alice       # 只看指定用户的进程
top -p 1234,5678   # 只看指定 PID 的进程
\`\`\`

### top 交互快捷键

| 按键 | 功能 |
|------|------|
| 1 | 显示/隐藏各 CPU 核的状态 |
| M | 按内存使用排序 |
| P | 按 CPU 使用排序 |
| k | 杀死进程（输入 PID 和信号） |
| q | 退出 |
| c | 切换显示完整命令 |

### top 输出解读（关键指标）

\`\`\`
load average: 0.52, 0.38, 0.41
\`\`\`

> Load average 是过去 1、5、15 分钟的平均负载。对于单核 CPU，值=1 表示满载；多核 CPU 需除以核心数。例如 4 核 CPU 的 load average=4 才是满载。

## 4.4 kill —— 向进程发送信号

\`\`\`bash
kill [信号] PID
killall [信号] 进程名
pkill [信号] 进程匹配模式
\`\`\`

### 常用信号

| 信号编号 | 信号名 | 作用 |
|----------|--------|------|
| 1 | SIGHUP | 重新加载配置 |
| 2 | SIGINT | 中断（Ctrl+C） |
| 9 | SIGKILL | 强制终止（不可捕获） |
| 15 | SIGTERM | 优雅终止（默认） |
| 19 | SIGSTOP | 暂停进程 |
| 18 | SIGCONT | 继续暂停的进程 |

\`\`\`bash
kill 1234                # 优雅终止（默认 SIGTERM）
kill -9 1234             # 强制杀死（SIGKILL，不推荐，除非进程无响应）
kill -HUP 1234           # 重新加载配置（常用于守护进程）
kill -STOP 1234          # 暂停进程
kill -CONT 1234          # 恢复进程

killall -9 nginx          # 杀死所有 nginx 进程
pkill -f "python app.py"  # 按完整命令匹配
\`\`\`

## 4.5 systemctl —— 服务管理（Systemd）

现代 Linux 发行版（CentOS 7+, Ubuntu 16.04+）使用 systemd 管理服务。

\`\`\`bash
# 启动/停止/重启/重载/状态
systemctl start nginx
systemctl stop nginx
systemctl restart nginx
systemctl reload nginx
systemctl status nginx

# 启用/禁用开机自启
systemctl enable nginx
systemctl disable nginx
systemctl is-enabled nginx

# 查看所有服务
systemctl list-units --type=service
systemctl list-units --type=service --state=running
systemctl list-units --type=service --state=failed

# 查看日志
journalctl -u nginx
journalctl -u nginx -f           # 实时跟踪
journalctl -u nginx --since today
journalctl -u nginx -n 50        # 最近 50 条
\`\`\`

## 4.6 后台任务管理

\`\`\`bash
command &                        # 命令后加 & 后台运行
nohup command &                  # 忽略 HUP 信号，退出终端后继续运行
nohup command > output.log 2>&1 &  # 重定向输出到日志文件

# 查看和管理后台任务（当前 shell）
jobs                             # 查看后台任务
fg %1                            # 将 1 号任务调到前台
bg %1                            # 让暂停的任务在后台继续
Ctrl+Z                           # 暂停当前前台任务

# 脱离终端运行（推荐 screen 或 tmux）
screen -S mysession              # 创建会话
screen -r mysession              # 重新连接
Ctrl+A D                         # 脱离会话
\`\`\`

### nohup 详解

\`\`\`bash
# 标准用法
nohup java -jar app.jar > /dev/null 2>&1 &

# nohup.out 默认输出位置
nohup python server.py &
# 输出默认写入当前目录的 nohup.out

# 推荐：指定输出文件
nohup python server.py > /var/log/server.log 2>&1 &
\`\`\`

## 4.7 进程优先级 —— nice / renice

\`\`\`bash
nice -n -10 command    # 以高优先级运行（-20 最高，19 最低）
renice -5 -p 1234      # 修改运行中进程的优先级
\`\`\`