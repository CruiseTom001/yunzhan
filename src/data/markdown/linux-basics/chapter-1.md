## 2.1 cat —— 查看文件内容

\`cat\`（concatenate）用于查看、合并文件内容。

\`\`\`bash
cat file.txt              # 显示全部内容
cat -n file.txt           # 带行号显示
cat file1.txt file2.txt   # 合并显示多个文件
cat file1.txt > merged.txt # 合并保存
\`\`\`

## 2.2 less / more —— 分页查看

\`less\` 比 \`more\` 功能更强（可前后翻页），**推荐优先使用 less**。

\`\`\`bash
less /var/log/syslog
\`\`\`

### less 常用操作

| 按键 | 功能 |
|------|------|
| Space / f | 向下翻一页 |
| b | 向上翻一页 |
| g | 跳到文件开头 |
| G | 跳到文件末尾 |
| /pattern | 向下搜索 |
| ?pattern | 向上搜索 |
| n / N | 跳转到下一个/上一个匹配 |
| q | 退出 |

## 2.3 head / tail —— 查看文件头部/尾部

\`\`\`bash
head -n 20 file.txt       # 前 20 行（默认 10 行）
tail -n 20 file.txt       # 后 20 行
tail -f /var/log/nginx/access.log  # 实时跟踪日志（最重要用法）
tail -F /var/log/nginx/access.log  # 文件被删除重建后继续跟踪
\`\`\`

### 结合使用

\`\`\`bash
# 查看第 50 到 60 行
head -n 60 file.txt | tail -n 11
# 或使用 sed
sed -n '50,60p' file.txt
\`\`\`

## 2.4 grep —— 文本搜索

\`grep\` 是 Linux 中最强大的文本搜索工具。

\`\`\`bash
grep [选项] "模式" [文件...]
\`\`\`

| 选项 | 说明 |
|------|------|
| -i | 不区分大小写 |
| -v | 反向匹配（排除） |
| -r | 递归搜索目录 |
| -n | 显示行号 |
| -c | 只显示匹配行数 |
| -A N | 显示匹配行及后 N 行 |
| -B N | 显示匹配行及前 N 行 |
| -C N | 显示匹配行及前后 N 行 |
| -E | 使用扩展正则表达式 |
| -w | 匹配整个单词 |
| -l | 只显示文件名 |

### 实战示例

\`\`\`bash
# 在日志中搜索错误
grep -n "ERROR" /var/log/app.log

# 递归搜索所有 .go 文件中的函数定义
grep -rn "func.*Handler" --include="*.go" .

# 查找不包含注释的行
grep -v "^#" nginx.conf

# 搜索并显示上下文
grep -C 3 "timeout" /etc/nginx/nginx.conf

# 统计 "404" 出现次数
grep -c " 404 " /var/log/nginx/access.log
\`\`\`

## 2.5 sed —— 流编辑器

\`sed\` 用于对文本进行过滤和替换，处理管道数据或大文件时非常高效。

\`\`\`bash
sed [选项] '命令' 文件
\`\`\`

### 常用操作

\`\`\`bash
# 替换文本（s/旧/新/g）
sed 's/foo/bar/g' file.txt          # 全局替换
sed 's/foo/bar/2' file.txt          # 只替换每行第 2 个匹配

# 指定行操作
sed -n '5,10p' file.txt             # 打印第 5-10 行
sed '5,10d' file.txt                # 删除第 5-10 行
sed -i 's/old/new/g' file.txt       # 直接修改文件（-i）

# 正则替换
sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}/YYYY-MM-DD/g' file.txt

# 在匹配行前后插入文本
sed '/pattern/i\\新行插在前面' file.txt
sed '/pattern/a\\新行插在后面' file.txt
\`\`\`

## 2.6 awk —— 文本分析利器

\`awk\` 是一种编程语言，专门用于文本处理和数据分析。

\`\`\`bash
awk [选项] '模式 { 动作 }' 文件
\`\`\`

### 内置变量

| 变量 | 含义 |
|------|------|
| $0 | 整行内容 |
| $1, $2, ... | 第 1, 2, ... 个字段 |
| NF | 当前行的字段数量 |
| NR | 当前行号 |
| FS | 字段分隔符（默认空格） |
| OFS | 输出字段分隔符 |

### 实战示例

\`\`\`bash
# 打印第 1 和第 3 列
awk '{print $1, $3}' file.txt

# 使用指定分隔符
awk -F: '{print $1, $7}' /etc/passwd

# 条件过滤
awk '$3 > 100 {print $1, $3}' data.txt

# 统计日志中每个 IP 的访问次数
awk '{count[$1]++} END {for (ip in count) print ip, count[ip]}' access.log

# 计算总和
awk '{sum+=$2} END {print "Total:", sum}' data.txt
\`\`\`

## 2.7 cut —— 按列提取

\`\`\`bash
cut -d: -f1,7 /etc/passwd      # 以 : 为分隔符，提取第 1、7 列
cut -c1-10 file.txt             # 提取每行前 10 个字符
cut -d',' -f2- data.csv         # 提取第 2 列到最后一列
\`\`\`

## 2.8 sort / uniq —— 排序与去重

\`\`\`bash
sort file.txt                   # 字典排序
sort -n file.txt                # 数值排序
sort -r file.txt                # 逆序
sort -t, -k2 data.csv           # 以逗号分隔，按第 2 列排序

sort file.txt | uniq            # 去重（需先排序）
sort file.txt | uniq -c         # 去重并统计出现次数
sort file.txt | uniq -d         # 只显示重复行
sort file.txt | uniq -u         # 只显示唯一行

# 统计访问最多的 10 个 IP
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10
\`\`\`

## 2.9 wc —— 统计

\`\`\`bash
wc file.txt         # 显示：行数 单词数 字节数 文件名
wc -l file.txt      # 只统计行数
wc -w file.txt      # 只统计单词数
wc -c file.txt      # 只统计字节数
\`\`\`

## 2.10 diff —— 比较文件差异

\`\`\`bash
diff file1.txt file2.txt        # 标准差异输出
diff -u file1.txt file2.txt     # unified 格式（类似 git diff）
diff -r dir1/ dir2/             # 递归比较目录
\`\`\`

## 2.11 vim 基本操作

\`\`\`
三种模式：
- 普通模式（默认，用于导航和执行命令）
- 插入模式（按 i 进入，用于编辑文本）
- 命令模式（按 : 进入，用于保存/退出等）
\`\`\`

### 常用命令速查

| 操作 | 命令 |
|------|------|
| 进入插入模式 | i / a / o / O |
| 保存 | :w |
| 退出 | :q |
| 保存并退出 | :wq 或 ZZ |
| 强制退出不保存 | :q! |
| 撤销 | u |
| 重做 | Ctrl + r |
| 复制一行 | yy |
| 粘贴 | p |
| 删除一行 | dd |
| 跳到文件开头 | gg |
| 跳到文件末尾 | G |
| 搜索 | /keyword，n 下一个 |
| 替换 | :%s/old/new/g |