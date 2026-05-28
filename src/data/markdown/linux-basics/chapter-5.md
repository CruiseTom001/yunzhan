## 6.1 df —— 查看磁盘空间使用

\`\`\`bash
df -h                  # 人类可读格式
df -hT                 # 显示文件系统类型
df -i                  # 查看 inode 使用情况
df -h /home            # 查看指定目录所在分区
\`\`\`

### 输出解读

\`\`\`
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G   20G   28G  42% /
\`\`\`

## 6.2 du —— 查看目录/文件占用空间

\`\`\`bash
du -sh /var/log         # 查看总大小
du -sh *                # 查看当前目录下各文件/目录大小
du -h --max-depth=1 /   # 查看一级子目录大小
du -sh * | sort -rh     # 按大小排序，最大的在前
\`\`\`

## 6.3 mount —— 挂载文件系统

\`\`\`bash
mount                           # 查看所有挂载
mount /dev/sdb1 /mnt/data       # 挂载设备
mount -t nfs 10.0.0.1:/share /mnt/nfs  # 挂载 NFS

# /etc/fstab 自动挂载配置
# <设备>           <挂载点>  <类型>  <选项>    <dump> <pass>
/dev/sdb1         /data     ext4    defaults  0      2
\`\`\`

### 常用挂载选项

| 选项 | 含义 |
|------|------|
| defaults | rw, suid, dev, exec, auto, nouser, async |
| noatime | 不更新访问时间（提升性能） |
| ro | 只读挂载 |
| noexec | 禁止执行文件 |
| nosuid | 禁止 SUID/SGID 位生效 |

## 6.4 tar —— 打包与压缩

\`\`\`bash
# 打包压缩（推荐使用 .tar.gz）
tar -czvf archive.tar.gz /path/to/directory    # 打包并 gzip 压缩
tar -cjvf archive.tar.bz2 /path/to/directory   # 打包并 bzip2 压缩
tar -cJvf archive.tar.xz /path/to/directory    # 打包并 xz 压缩

# 解压
tar -xzvf archive.tar.gz                       # 解压 .tar.gz
tar -xjvf archive.tar.bz2                      # 解压 .tar.bz2
tar -xJvf archive.tar.xz                       # 解压 .tar.xz

# 解压到指定目录
tar -xzvf archive.tar.gz -C /target/dir

# 查看压缩包内容
tar -tzvf archive.tar.gz
\`\`\`

### tar 参数速记

| 参数 | 含义 |
|------|------|
| -c | 创建归档 |
| -x | 提取归档 |
| -z | gzip 压缩/解压 |
| -j | bzip2 压缩/解压 |
| -J | xz 压缩/解压 |
| -v | 显示处理过程 |
| -f | 指定文件名 |
| -C | 指定目标目录 |

## 6.5 gzip / gunzip —— 单个文件压缩

\`\`\`bash
gzip file.txt           # 压缩为 file.txt.gz（原文件删除）
gzip -k file.txt        # 保留原文件
gzip -9 file.txt        # 最高压缩率（1-9，默认 6）
gunzip file.txt.gz      # 解压
zcat file.txt.gz        # 不解压查看内容
\`\`\`

## 6.6 rsync —— 远程同步

\`\`\`bash
# 本地同步
rsync -av /source/ /destination/

# 远程同步
rsync -avz /local/dir/ user@remote:/remote/dir/

# 增量备份（只传输差异部分）
rsync -avz --delete /source/ user@remote:/backup/

# 限速传输
rsync -avz --bwlimit=1000 /source/ user@remote:/backup/

# 排除指定文件
rsync -avz --exclude='*.log' --exclude='tmp/' /app/ user@remote:/backup/
\`\`\`

### rsync 常用参数

| 参数 | 含义 |
|------|------|
| -a | 归档模式（保留权限、时间戳等） |
| -v | 显示详情 |
| -z | 传输时压缩 |
| --delete | 删除目标端存在但源端不存在的文件 |
| -n | 模拟运行（不实际传输） |
| -P | 显示进度 + 断点续传 |

## 6.7 scp —— 安全拷贝

\`\`\`bash
# 本地到远程
scp file.txt user@remote:/path/

# 远程到本地
scp user@remote:/path/file.txt ./

# 拷贝目录
scp -r /local/dir user@remote:/path/

# 指定端口
scp -P 2222 file.txt user@remote:/path/

# 限速
scp -l 8192 file.txt user@remote:/path/   # 单位 Kbps
\`\`\`

## 6.8 LVM（逻辑卷管理器）概念

LVM 提供了更灵活的磁盘管理方式：

| 概念 | 说明 |
|------|------|
| PV (Physical Volume) | 物理卷，如 /dev/sdb |
| VG (Volume Group) | 卷组，由多个 PV 组成 |
| LV (Logical Volume) | 逻辑卷，从 VG 中划分，可动态调整大小 |

### 核心优势

- **动态扩容**：无需卸载文件系统即可增加容量
- **快照**：创建文件系统的时间点快照用于备份
- **条带化**：数据分散到多个磁盘提升 I/O 性能

### LVM 基本操作流程

\`\`\`bash
# 1. 创建 PV
pvcreate /dev/sdb

# 2. 创建 VG
vgcreate vg_data /dev/sdb

# 3. 创建 LV（10G 大小）
lvcreate -L 10G -n lv_data vg_data

# 4. 格式化并挂载
mkfs.ext4 /dev/vg_data/lv_data
mount /dev/vg_data/lv_data /data

# 5. 扩容 LV（先扩 LV，再扩文件系统）
lvextend -L +5G /dev/vg_data/lv_data
resize2fs /dev/vg_data/lv_data
\`\`\`