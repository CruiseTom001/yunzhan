## 6.1 启动流程概览

Linux 系统从按下电源键到出现登录界面，经历以下阶段：

\`\`\`
开机通电
  │
  ▼
BIOS/UEFI（硬件自检 + 选择启动设备）
  │
  ▼
MBR/GPT（读取磁盘第一个扇区，找到引导程序）
  │
  ▼
GRUB2（引导加载器，选择内核和启动参数）
  │
  ▼
Kernel（内核初始化：硬件检测、驱动加载、挂载根文件系统）
  │
  ▼
init/systemd（1号进程，启动系统服务）
  │
  ▼
登录界面（getty/图形界面）
\`\`\`

## 6.2 BIOS / UEFI

### BIOS（Basic Input/Output System）

传统固件接口，正在被 UEFI 淘汰。

\`\`\`
BIOS 启动流程：
1. POST（加电自检）：检测 CPU、内存、硬件
2. 查找启动设备（按 BIOS 设置的顺序）
3. 读取启动设备的第一个扇区（MBR，512字节）
4. 执行 MBR 中的引导代码
\`\`\`

### UEFI（Unified Extensible Firmware Interface）

BIOS 的现代替代品。

| 特性 | BIOS | UEFI |
|------|------|------|
| 启动模式 | 16位实模式 | 32/64位保护模式 |
| 最大磁盘 | 2TB（MBR 限制） | 无限制（GPT） |
| 启动速度 | 较慢 | 较快 |
| 图形界面 | 文本界面 | 支持 GUI |
| 安全启动 | 不支持 | 支持 Secure Boot |
| 分区表 | MBR | GPT |

### MBR vs GPT

| 特性 | MBR | GPT |
|------|-----|-----|
| 最大磁盘 | 2TB | 18EB |
| 最大分区 | 4个主分区（或3主+1扩展） | 128个分区 |
| 冗余 | 无（单点故障） | 有（备份 GPT 头） |
| 校验 | 无 | CRC32 校验 |

\`\`\`bash
# 查看分区表类型
fdisk -l                      # 查看 "Disklabel type: gpt" 或 "dos"
parted /dev/sda print         # 查看 "Partition Table: gpt" 或 "msdos"
\`\`\`

## 6.3 GRUB2 —— 引导加载器

GRUB2（GRand Unified Bootloader 2）是 Linux 最常用的引导加载器。

### GRUB2 启动阶段

\`\`\`
1. BIOS/UEFI 加载磁盘上的 boot.img（MBR 前 446 字节）
2. boot.img 加载 core.img（磁盘启动空间）
3. core.img 加载 /boot/grub2/ 下的正常模块
4. 显示 GRUB 菜单
5. 用户选择内核，GRUB 加载内核和 initramfs 到内存
6. GRUB 将控制权交给内核
\`\`\`

### GRUB2 配置

\`\`\`bash
# GRUB2 主配置文件（不要直接编辑！）
/boot/grub2/grub.cfg          # BIOS 系统
/boot/efi/EFI/centos/grub.cfg # UEFI 系统

# 编辑配置（推荐方式）
vim /etc/default/grub          # 编辑默认设置

# 重新生成 grub.cfg
grub2-mkconfig -o /boot/grub2/grub.cfg           # BIOS
grub2-mkconfig -o /boot/efi/EFI/centos/grub.cfg  # UEFI
\`\`\`

### /etc/default/grub 常用配置

\`\`\`bash
GRUB_TIMEOUT=5                # 菜单显示时间（秒）
GRUB_DEFAULT=0                # 默认启动项
GRUB_CMDLINE_LINUX="rhgb quiet"  # 内核启动参数
\`\`\`

### 常用内核启动参数

| 参数 | 说明 |
|------|------|
| rhgb | 图形化启动（Red Hat） |
| quiet | 减少启动信息 |
| single / rescue | 单用户/救援模式 |
| nomodeset | 禁用内核模式设置（显示问题排查） |
| maxcpus=1 | 限制 CPU 核心数 |
| mem=4G | 限制内存使用 |

### GRUB2 救援模式

\`\`\`
1. 重启系统，在 GRUB 菜单按 'e' 编辑启动项
2. 找到 linux 行，在行尾添加：
   - single（单用户模式）
   - 或 rd.break（救援模式，RHEL/CentOS）
3. Ctrl+X 启动
4. 进入救援模式后可重置密码、修复文件系统等
\`\`\`

## 6.4 内核初始化

内核被 GRUB 加载后，执行以下初始化步骤：

\`\`\`
1. 解压内核映像
2. 检测硬件（CPU、内存、设备）
3. 加载驱动程序（内置驱动 + 模块）
4. 挂载 initramfs（临时根文件系统）
5. 从 initramfs 加载必要的驱动（如磁盘驱动）
6. 挂载真正的根文件系统
7. 切换到真正的根文件系统
8. 启动 PID 1 进程（init/systemd）
\`\`\`

### initramfs

initramfs 是一个临时的根文件系统，包含内核启动所需的驱动和脚本。

\`\`\`bash
# 查看 initramfs 内容
lsinitrd /boot/initramfs-$(uname -r).img

# 重建 initramfs（添加新驱动后）
dracut -f                     # RHEL/CentOS
update-initramfs -u           # Debian/Ubuntu
\`\`\`

### 内核启动日志

\`\`\`bash
dmesg                         # 查看内核启动日志
dmesg | less                  # 分页查看
journalctl -k                 # 查看内核日志
\`\`\`

## 6.5 init 与 systemd

### init（传统 SysVinit）

\`\`\`
init 是传统的 1 号进程，按运行级别（runlevel）启动服务。

运行级别：
0 - 关机
1 - 单用户模式
2 - 多用户（无 NFS）
3 - 完全多用户（命令行）
4 - 未使用
5 - 图形界面
6 - 重启
\`\`\`

### systemd（现代 init 系统）

systemd 是现代 Linux 的 init 系统，取代了 SysVinit。

| 特性 | SysVinit | systemd |
|------|----------|---------|
| 启动方式 | 串行启动服务 | 并行启动（依赖管理） |
| 服务管理 | service 命令 | systemctl 命令 |
| 配置文件 | Shell 脚本 | .service 单元文件 |
| 日志 | 各服务自行管理 | journalctl 统一管理 |
| 依赖管理 | 手动排序 | 自动依赖解析 |

### systemd 核心概念

| 概念 | 说明 |
|------|------|
| Unit | systemd 管理的基本单元 |
| Target | 一组 Unit 的集合，类似运行级别 |
| Service | 服务单元 |
| Timer | 定时器单元（替代 cron） |
| Socket | 套接字单元（按需启动服务） |
| Mount | 挂载单元 |

### systemd 启动目标

\`\`\`bash
# 常用 target
systemctl get-default                    # 查看默认启动目标
systemctl set-default multi-user.target  # 设置默认为命令行
systemctl set-default graphical.target   # 设置默认为图形界面

# target 与运行级别对照
# runlevel 0 → poweroff.target
# runlevel 1 → rescue.target
# runlevel 3 → multi-user.target
# runlevel 5 → graphical.target
# runlevel 6 → reboot.target
\`\`\`

### systemd 启动流程

\`\`\`
kernel 启动 systemd (PID 1)
  │
  ├─→ default.target
  │     ├─→ basic.target
  │     │     ├─→ sysinit.target
  │     │     │     ├─→ local-fs.target（本地文件系统）
  │     │     │     ├─→ swap.target（交换空间）
  │     │     │     └─→ systemd-tmpfiles（临时文件）
  │     │     └─→ sockets.target（套接字）
  │     └─→ multi-user.target
  │           ├─→ network.target（网络）
  │           ├─→ nginx.service
  │           ├─→ sshd.service
  │           └─→ crond.service
  └─→ 并行启动各服务
\`\`\`

### 分析启动性能

\`\`\`bash
# 查看启动耗时
systemd-analyze

# 查看各服务启动耗时
systemd-analyze blame

# 生成启动流程图
systemd-analyze plot > boot.svg

# 查看关键路径
systemd-analyze critical-chain
\`\`\`

## 6.6 系统关机流程

\`\`\`bash
# 关机
shutdown -h now               # 立即关机
shutdown -h +10 "维护通知"     # 10 分钟后关机并通知用户
poweroff                      # 关机

# 重启
shutdown -r now               # 立即重启
reboot                        # 重启

# 关机流程
# 1. systemd 向所有服务发送 SIGTERM
# 2. 等待服务优雅退出（DefaultTimeoutStopSec，通常 90s）
# 3. 超时后发送 SIGKILL 强制终止
# 4. 卸载文件系统
# 5. 同步磁盘缓存
# 6. 通知内核关机/重启
\`\`\`