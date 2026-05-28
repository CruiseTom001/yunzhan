## 7.1 Shell 脚本基础

Shell 脚本是 Linux 运维的必备技能。脚本文件以 \`#!/bin/bash\` 开头，指定解释器。

\`\`\`bash
#!/bin/bash
# 这是注释

echo "Hello, World!"           # 输出文本
read -p "Enter your name: " name  # 读取用户输入
echo "Hello, \$name!"
\`\`\`

### 变量

\`\`\`bash
#!/bin/bash

# 定义变量（= 两边不能有空格！）
name="Alice"
age=25

# 使用变量
echo "Name: $name, Age: $age"
echo "Name: \${name}"        # 推荐用 {} 避免歧义

# 只读变量
readonly PI=3.14159

# 命令替换
current_date=$(date +%Y-%m-%d)
file_count=$(ls | wc -l)

# 特殊变量
echo "脚本名: $0"
echo "参数个数: $#"
echo "所有参数: $@"
echo "第一个参数: $1"
echo "退出状态: $?"
echo "当前 PID: $$"
\`\`\`

### 字符串操作

\`\`\`bash
str="Hello World"

# 拼接
greeting="$str, welcome!"

# 长度
echo \${#str}              # 11

# 子串截取
echo \${str:0:5}          # Hello

# 替换
echo \${str/World/Linux}  # Hello Linux

# 字符串包含
if [[ $str == *"World"* ]]; then
    echo "Contains World"
fi
\`\`\`

## 7.2 条件判断

### if 语句

\`\`\`bash
#!/bin/bash

# 数值比较
num=10
if [ $num -gt 5 ]; then
    echo "> 5"
elif [ $num -eq 5 ]; then
    echo "= 5"
else
    echo "< 5"
fi

# 字符串比较
name="alice"
if [ "$name" = "alice" ]; then
    echo "Hello alice"
fi

# 文件测试
if [ -f "/etc/nginx/nginx.conf" ]; then
    echo "配置文件存在"
fi
if [ -d "/var/log" ]; then
    echo "目录存在"
fi
if [ -x "/usr/bin/python3" ]; then
    echo "Python 可执行"
fi
\`\`\`

### 常用条件判断

| 数值判断 | 含义 | 字符串判断 | 含义 | 文件判断 | 含义 |
|----------|------|------------|------|----------|------|
| -eq | 等于 | = | 相等 | -f | 普通文件存在 |
| -ne | 不等于 | != | 不等 | -d | 目录存在 |
| -gt | 大于 | -z | 长度为 0 | -x | 可执行 |
| -lt | 小于 | -n | 长度非 0 | -r | 可读 |
| -ge | 大于等于 | | | -e | 存在（任何类型） |

### [[ ]] vs [ ]

\`[[ ]]\` 是 Bash 的增强版，推荐使用：
- 支持 \`&&\` 和 \`||\` 逻辑运算
- 支持正则匹配 \`=~\`
- 不需要对变量加引号防止分词

\`\`\`bash
if [[ -f $file && $name =~ ^[A-Z] ]]; then
    echo "文件存在且名字以大写字母开头"
fi
\`\`\`

## 7.3 循环

\`\`\`bash
#!/bin/bash

# for 循环 - 遍历列表
for i in 1 2 3 4 5; do
    echo "Number: $i"
done

# for 循环 - 数值范围
for i in {1..10}; do
    echo $i
done

# for 循环 - C 风格
for ((i=0; i<10; i++)); do
    echo $i
done

# for 遍历文件
for file in /var/log/*.log; do
    echo "Processing $file"
    if [[ -f $file ]]; then
        wc -l "$file"
    fi
done

# while 循环
count=0
while [ $count -lt 5 ]; do
    echo "Count: $count"
    ((count++))
done

# 逐行读取文件
while IFS= read -r line; do
    echo "Line: $line"
done < /etc/hosts
\`\`\`

## 7.4 函数

\`\`\`bash
#!/bin/bash

# 定义函数
greet() {
    local name=$1          # local 声明局部变量
    echo "Hello, $name!"
}

# 调用函数
greet "Alice"

# 带返回值的函数
add() {
    local result=$(($1 + $2))
    echo $result           # 通过 echo 返回值
}

sum=$(add 3 5)
echo "Sum: $sum"

# 通过 return 返回退出码（仅 0-255）
check_file() {
    if [[ -f $1 ]]; then
        return 0           # 成功
    else
        return 1           # 失败
    fi
}

if check_file "/etc/hosts"; then
    echo "File exists"
fi
\`\`\`

## 7.5 重定向与管道

\`\`\`bash
# 标准输出重定向
command > file.txt       # 覆盖写入
command >> file.txt      # 追加写入

# 标准错误重定向
command 2> error.log
command 2>> error.log    # 追加错误输出

# 同时重定向 stdout 和 stderr
command > output.log 2>&1       # 都写入同一个文件
command &> output.log           # 同上（简洁写法）
command > out.log 2> err.log    # 分别写入不同文件

# 丢弃输出
command > /dev/null 2>&1

# 管道
command1 | command2      # command1 的输出作为 command2 的输入
cat access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -10

# /dev/null —— 数据黑洞
# 写入 /dev/null 的内容会被丢弃，读取则返回 EOF
\`\`\`

## 7.6 正则表达式

| 元字符 | 含义 | 示例 |
|--------|------|------|
| ^ | 行开头 | ^ERROR |
| $ | 行结尾 | \\.log$ |
| . | 任意字符 | a.b |
| * | 前一个字符 0 次或多次 | ab*c |
| + | 前一个字符 1 次或多次 | ab+c |
| ? | 前一个字符 0 次或 1 次 | ab?c |
| [] | 字符类 | [0-9]、[a-zA-Z] |
| [^] | 否定字符类 | [^0-9] |
| {n} | 精确 n 次 | [0-9]{3} |
| {n,m} | n 到 m 次 | [0-9]{2,4} |
| \| | 或 | error\|warn |
| () | 分组 | (ab)+ |
| \\s | 空白字符 | \\s+ |
| \\d | 数字 | \\d{4} |

\`\`\`bash
# 实战示例
grep -E "^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+" access.log   # 匹配 IP 地址
grep -E "\\b404\\b" access.log                              # 匹配 404 状态码
sed -E 's/\\s+/ /g' file.txt                                 # 压缩多余空格
awk '/^ERROR/' app.log                                       # 打印以 ERROR 开头的行
\`\`\`

## 7.7 Shell 脚本调试

\`\`\`bash
# 调试模式
bash -x script.sh          # 打印每条命令及参数
bash -n script.sh          # 语法检查（不执行）
bash -v script.sh          # 显示读取的每一行

# 脚本内设置调试
#!/bin/bash
set -x                     # 开启调试
set +x                     # 关闭调试
set -e                     # 遇错即退出
set -u                     # 使用未定义变量时报错
set -o pipefail            # 管道中任一命令失败即失败
\`\`\`

### 生产级脚本模板

\`\`\`bash
#!/bin/bash
set -euo pipefail

LOG_FILE="/var/log/myapp/script.log"
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

cleanup() {
    log "Cleaning up..."
    # 清理临时文件等
}

trap cleanup EXIT

log "Script started"

# 主逻辑
main() {
    # ...
}

main
log "Script completed"
\`\`\`