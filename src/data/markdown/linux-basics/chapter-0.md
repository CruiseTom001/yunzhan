## 1.1 ls —— 列出目录内容

\`ls\` 是 Linux 中使用频率最高的命令之一，用于列出目录中的文件和子目录。

### 基本语法

\`\`\`bash
ls [选项] [路径]
\`\`\`

### 常用选项

| 选项 | 说明 |
|------|------|
| -l | 长格式显示（权限、所有者、大小、时间） |
| -a | 显示所有文件，包括隐藏文件（. 开头） |
| -h | 以人类可读的格式显示文件大小（与 -l 联用） |
| -t | 按修改时间排序 |
| -r | 反向排序 |
| -R | 递归显示子目录 |
| -S | 按文件大小排序 |
| -d | 只显示目录本身而非其内容 |
| -i | 显示 inode 号 |
| --color | 彩色输出（通常默认开启） |

### 实战示例

\`\`\`bash
# 按修改时间排序，最新文件在最前面
ls -lt

# 按文件大小排序，最大的在前面
ls -lSh

# 递归显示所有 .log 文件
ls -lR *.log

# 只列出目录
ls -d */
\`\`\`

### ll 别名

大多数发行版默认配置了 \`alias ll='ls -alF'\`，你可以通过 \`alias\` 命令查看当前 shell 中定义的所有别名。

## 1.2 cd —— 切换目录

\`\`\`bash
cd [目录路径]
\`\`\`

### 特殊路径符号

| 符号 | 含义 |
|------|------|
| ~ | 当前用户的家目录 |
| - | 上一次所在的目录 |
| .. | 上一级目录 |
| . | 当前目录 |
| / | 根目录 |

\`\`\`bash
cd ~          # 回到用户家目录
cd -          # 返回上次的目录
cd /etc/nginx # 进入绝对路径
cd ../..      # 向上两级
\`\`\`

## 1.3 pwd —— 显示当前工作目录

\`\`\`bash
pwd          # 输出物理路径
pwd -L       # 输出逻辑路径（包含符号链接）
pwd -P       # 输出物理路径（解析符号链接）
\`\`\`

\`\`\`bash
$ cd /var
$ ln -s /var /tmp/v
$ cd /tmp/v
$ pwd        # 输出 /tmp/v
$ pwd -P     # 输出 /var
\`\`\`

## 1.4 mkdir —— 创建目录

\`\`\`bash
mkdir [选项] 目录名
\`\`\`

| 选项 | 说明 |
|------|------|
| -p | 递归创建父目录 |
| -m | 指定权限模式（如 -m 755） |
| -v | 显示创建过程 |

\`\`\`bash
# 递归创建多级目录
mkdir -p /app/data/logs/2024

# 创建目录并指定权限
mkdir -m 700 /secure_folder
\`\`\`

## 1.5 rm —— 删除文件或目录

> **警告**：Linux 下删除操作不可逆，请谨慎使用！

\`\`\`bash
rm [选项] 文件...
\`\`\`

| 选项 | 说明 |
|------|------|
| -r | 递归删除目录及其内容 |
| -f | 强制删除，不提示确认 |
| -i | 删除前逐一确认 |
| -v | 显示删除过程 |

\`\`\`bash
rm file.txt              # 删除单个文件
rm -r directory/         # 递归删除目录
rm -rf /tmp/test/*       # 强制递归删除
rm -i *.log              # 逐一确认删除所有 .log 文件
\`\`\`

## 1.6 cp —— 复制文件或目录

\`\`\`bash
cp [选项] 源 目标
\`\`\`

| 选项 | 说明 |
|------|------|
| -r | 递归复制目录 |
| -p | 保留文件属性（权限、时间戳） |
| -a | 归档模式（等同于 -dpR） |
| -i | 覆盖前确认 |
| -u | 仅复制更新的文件（目标较旧或不存在） |
| -v | 显示复制过程 |

\`\`\`bash
cp file.txt /backup/              # 复制到目录
cp file.txt /backup/file.bak      # 复制并重命名
cp -r /app/config /backup/        # 递归复制目录
cp -a /app/data /backup/          # 归档复制，保留所有属性
\`\`\`

## 1.7 mv —— 移动或重命名

\`\`\`bash
mv [选项] 源 目标
\`\`\`

\`\`\`bash
mv oldname.txt newname.txt        # 重命名
mv file.txt /tmp/                 # 移动到指定目录
mv /app/config/* /backup/config/  # 批量移动
\`\`\`

## 1.8 find —— 文件查找

\`\`\`bash
find [路径] [表达式] [操作]
\`\`\`

### 常用查找条件

| 条件 | 说明 |
|------|------|
| -name pattern | 按文件名查找（区分大小写） |
| -iname pattern | 按文件名查找（不区分大小写） |
| -type f/d/l | 按类型查找：文件/目录/符号链接 |
| -size +10M | 按大小查找，+ 大于，- 小于 |
| -mtime +7 | 修改时间（天），+7 表示 7 天前 |
| -mmin -60 | 修改时间（分钟），-60 表示 60 分钟内 |
| -user username | 按所有者查找 |
| -perm 755 | 按权限查找 |
| -maxdepth N | 最大搜索深度 |

### 实战示例

\`\`\`bash
# 查找 /var/log 下大于 100M 的文件
find /var/log -type f -size +100M

# 查找最近 24 小时修改的 .log 文件
find /app -name "*.log" -mtime -1

# 查找所有空文件并删除
find /tmp -type f -empty -delete

# 查找并执行操作（-exec）
find /app/logs -name "*.log" -mtime +30 -exec rm -f {} \\;

# 查找 .go 文件并统计行数
find . -name "*.go" -exec wc -l {} +
\`\`\`

## 1.9 locate —— 快速查找文件

\`locate\` 基于预构建的数据库索引查找，速度远快于 \`find\`，但结果可能不是最新的。

\`\`\`bash
# 更新数据库
sudo updatedb

# 查找文件
locate nginx.conf
locate -i nginx.conf    # 不区分大小写
locate -c "*.log"       # 只显示匹配数量
\`\`\`

## 1.10 tree —— 树形显示目录结构

\`\`\`bash
tree /app                # 树形显示目录
tree -L 2 /app           # 只显示 2 层
tree -d /app             # 只显示目录
tree -h /app             # 显示文件大小
\`\`\`

## 1.11 stat —— 查看文件详细信息

\`\`\`bash
stat filename
# 输出：文件大小、inode、权限、时间戳（atime/mtime/ctime）等
\`\`\`

### 三种时间戳

| 时间 | 全称 | 含义 |
|------|------|------|
| atime | Access Time | 最后访问时间 |
| mtime | Modify Time | 最后修改内容时间 |
| ctime | Change Time | 最后修改元数据时间（权限/所有者） |