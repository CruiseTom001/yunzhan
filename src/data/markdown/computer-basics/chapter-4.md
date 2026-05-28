## 5.1 文件系统概述

文件系统是操作系统用于组织、存储和检索数据的方法和数据结构。

### 常见文件系统类型

| 文件系统 | 适用场景 | 特点 |
|----------|----------|------|
| ext4 | Linux 默认 | 稳定、成熟、支持大文件 |
| xfs | 大文件、高性能 | 高并发 I/O，适合数据库 |
| btrfs | 现代 Linux | 快照、压缩、校验 |
| tmpfs | 临时数据 | 基于内存，重启丢失 |
| NFS | 网络共享 | 跨机器文件访问 |
| FAT32/exFAT | 跨平台 | U 盘常用 |
| NTFS | Windows | Windows 默认 |

\`\`\`bash
# 查看文件系统类型
df -Th
blkid
lsblk -f
\`\`\`

## 5.2 inode —— 文件的灵魂

**inode（索引节点）**是文件系统中存储文件元数据的数据结构。

### inode 包含的信息

| 信息 | 说明 |
|------|------|
| 文件大小 | 文件的字节数 |
| 所有者 | UID 和 GID |
| 权限 | 读/写/执行权限 |
| 时间戳 | atime/mtime/ctime |
| 数据块指针 | 指向文件数据在磁盘上的位置 |
| 链接计数 | 硬链接数量 |
| 文件类型 | 普通文件/目录/设备/链接等 |

> **注意**：inode 中**不包含文件名**！文件名存储在目录项中。

### inode 的工作原理

\`\`\`
目录项（dentry）         inode 表              数据块
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 文件名: report │───►│ inode #12345 │───►│ 数据块1       │
│ inode: 12345  │    │ 大小: 4096   │    │ 数据块2       │
└──────────────┘    │ 权限: 644    │    │ 数据块3       │
                    │ 块指针: ...  │    └──────────────┘
                    └──────────────┘
\`\`\`

### inode 相关操作

\`\`\`bash
# 查看 inode 号
ls -i filename
stat filename

# 查看文件系统 inode 使用情况
df -i

# inode 耗尽的场景
# 即使磁盘空间充足，inode 用完也无法创建新文件
# 常见原因：大量小文件（如邮件队列、session 文件）

# 查找大量文件
find /path -type f | wc -l
\`\`\`

### inode 与数据块指针

ext4 的 inode 使用多级指针结构：

\`\`\`
inode
├── 直接指针（12个）→ 直接指向数据块（0-48KB）
├── 间接指针（1个）  → 指向一个指针块 → 数据块
├── 双重间接指针    → 指向指针块 → 指针块 → 数据块
└── 三重间接指针    → 指向指针块 → 指针块 → 指针块 → 数据块
\`\`\`

## 5.3 超级块（Superblock）

超级块记录了整个文件系统的元信息。

### 超级块包含的信息

| 信息 | 说明 |
|------|------|
| 文件系统类型 | ext4, xfs 等 |
| 总块数 | 文件系统的总数据块数 |
| 空闲块数 | 可用的数据块数 |
| 总 inode 数 | 文件系统的总 inode 数 |
| 空闲 inode 数 | 可用的 inode 数 |
| 块大小 | 每个数据块的大小（通常 4KB） |
| 挂载信息 | 挂载次数、上次挂载时间等 |

\`\`\`bash
# 查看超级块信息
dumpe2fs /dev/sda1 | head -30     # ext4 文件系统
xfs_db -r /dev/sda1 -c "sb"       # xfs 文件系统

# 备份超级块
# ext4 在磁盘的多个位置保存了超级块副本
dumpe2fs /dev/sda1 | grep -i "superblock"

# 超级块损坏时使用备份恢复
fsck -b 32768 /dev/sda1
\`\`\`

## 5.4 挂载（Mount）

挂载是将文件系统与目录树中某个目录关联的过程。

### 挂载原理

\`\`\`
挂载前：
/ (ext4 on /dev/sda1)
├── etc/
├── home/
└── mnt/
    └── data/  (空目录)

挂载后：
/ (ext4 on /dev/sda1)
├── etc/
├── home/
└── mnt/
    └── data/  (xfs on /dev/sdb1) ← 挂载点
        ├── file1.txt
        └── file2.txt
\`\`\`

### 挂载操作

\`\`\`bash
# 查看挂载信息
mount                         # 查看所有挂载
findmnt                       # 树形显示挂载关系

# 挂载文件系统
mount /dev/sdb1 /mnt/data     # 挂载设备
mount -t ext4 /dev/sdb1 /mnt/data  # 指定文件系统类型
mount -o ro /dev/sdb1 /mnt/data    # 只读挂载
mount -o noatime /dev/sdb1 /mnt/data  # 不更新访问时间

# 卸载
umount /mnt/data
umount /dev/sdb1

# 强制卸载（当设备忙时）
umount -l /mnt/data           # 懒卸载（等引用消失后卸载）
fuser -m /mnt/data            # 查看使用该挂载点的进程
\`\`\`

### /etc/fstab —— 开机自动挂载

\`\`\`bash
# /etc/fstab 格式
# <设备>          <挂载点>    <类型>  <选项>       <dump> <pass>
/dev/sda1        /          ext4    defaults      1      1
/dev/sda2        /home      ext4    defaults      1      2
/dev/sdb1        /data      xfs     noatime       0      0
tmpfs            /dev/shm   tmpfs   defaults      0      0

# 使用 UUID 挂载（推荐，设备名可能变化）
UUID=xxxx-xxxx  /data      xfs     defaults      0      0

# 查看 UUID
blkid
lsblk -f
\`\`\`

## 5.5 软链接与硬链接

### 硬链接（Hard Link）

硬链接是指向同一 inode 的多个目录项。

\`\`\`
目录项1: file.txt  → inode #12345 → 数据块
目录项2: hardlink.txt → inode #12345 → 数据块（同一个！）
\`\`\`

### 软链接（Symbolic Link / Symlink）

软链接是一个独立的文件，其内容是另一个文件的路径。

\`\`\`
symlink.txt → "/path/to/target.txt"
（symlink.txt 有自己的 inode，内容是目标路径字符串）
\`\`\`

### 对比

| 特性 | 硬链接 | 软链接 |
|------|--------|--------|
| inode | 与原文件相同 | 有独立 inode |
| 删除原文件 | 不影响硬链接 | 软链接失效（悬空链接） |
| 跨文件系统 | 不可以 | 可以 |
| 链接目录 | 不可以 | 可以 |
| 文件大小 | 与原文件相同 | 目标路径字符串长度 |

### 操作命令

\`\`\`bash
# 创建硬链接
ln original.txt hardlink.txt

# 创建软链接
ln -s /path/to/original.txt symlink.txt

# 查看链接信息
ls -li                        # 查看 inode 号和链接数
readlink symlink.txt          # 查看软链接指向
stat file.txt                 # 查看链接数（Links 字段）

# 查找指向某文件的所有硬链接
find / -samefile original.txt
find / -inum 12345
\`\`\`

### 硬链接计数

\`\`\`bash
# 创建文件时链接数为 1
touch file.txt                # Links: 1

# 创建硬链接，链接数 +1
ln file.txt hardlink.txt      # Links: 2

# 删除一个硬链接，链接数 -1
rm hardlink.txt               # Links: 1

# 链接数降为 0 时，文件数据才被真正删除
\`\`\`

> **目录的链接数**：一个空目录的链接数为 2（目录项 "." 和父目录中的条目），每增加一个子目录，链接数 +1（子目录的 ".." 指向父目录）。

## 5.6 文件系统检查与修复

\`\`\`bash
# ext4 文件系统检查
fsck.ext4 /dev/sda1           # 检查并修复
fsck.ext4 -n /dev/sda1        # 只检查不修复
fsck.ext4 -y /dev/sda1        # 自动回答 yes

# xfs 文件系统检查
xfs_repair /dev/sdb1

# 注意：检查前必须先卸载文件系统！
umount /dev/sda1
fsck.ext4 /dev/sda1
\`\`\`