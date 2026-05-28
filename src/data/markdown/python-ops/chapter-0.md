## 1.1 Python 环境安装

### 安装 Python

\`\`\`bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip python3-venv

# CentOS/RHEL
sudo yum install python3 python3-pip

# 查看版本
python3 --version

# 创建虚拟环境
python3 -m venv ~/ops-env
source ~/ops-env/bin/activate    # 激活
deactivate                        # 退出虚拟环境
\`\`\`

### pip 包管理

\`\`\`bash
pip install requests             # 安装包
pip install paramiko==3.4.0      # 安装指定版本
pip install -r requirements.txt  # 从文件安装
pip list                         # 查看已安装的包
pip freeze > requirements.txt    # 导出依赖
pip uninstall requests           # 卸载包
\`\`\`

## 1.2 变量与数据类型

\`\`\`python
# 变量赋值（Python 是动态类型语言）
name = "Alice"
age = 30
is_admin = True
servers = ["web01", "web02", "web03"]
config = {"host": "localhost", "port": 8080}

# 常用数据类型
# int      - 整数：42
# float    - 浮点数：3.14
# str      - 字符串："hello"
# bool     - 布尔：True / False
# list     - 列表：[1, 2, 3]
# tuple    - 元组：(1, 2, 3)，不可变
# dict     - 字典：{"key": "value"}
# set      - 集合：{1, 2, 3}，不重复
# None     - 空值

# 类型查看
type(name)       # <class 'str'>
type(age)        # <class 'int'>
\`\`\`

### 字符串操作

\`\`\`python
# 格式化字符串（推荐 f-string）
host = "web01"
port = 8080
url = f"http://{host}:{port}/api"

# 常用字符串方法
text = "  Hello, World!  "
text.strip()           # "Hello, World!"  去除两端空白
text.lower()           # "  hello, world!  "
text.upper()           # "  HELLO, WORLD!  "
text.replace("World", "Python")  # "  Hello, Python!  "
text.split(",")        # ["  Hello", " World!  "]
",".join(["a", "b"])   # "a,b"
text.startswith("  H") # True
text.find("World")     # 9（返回索引，未找到返回 -1）
\`\`\`

### 列表操作

\`\`\`python
servers = ["web01", "web02", "web03"]

# 访问
servers[0]          # "web01"
servers[-1]         # "web03"
servers[1:3]        # ["web02", "web03"]

# 修改
servers.append("web04")       # 末尾添加
servers.insert(0, "web00")    # 指定位置插入
servers.remove("web02")       # 删除指定值
servers.pop()                 # 删除并返回最后一个
servers.sort()                # 排序（原地修改）

# 列表推导式
ports = [8080 + i for i in range(5)]  # [8080, 8081, 8082, 8083, 8084]
active = [s for s in servers if s.startswith("web")]
\`\`\`

### 字典操作

\`\`\`python
config = {
    "host": "localhost",
    "port": 8080,
    "debug": True
}

# 访问
config["host"]                  # "localhost"
config.get("timeout", 30)       # 不存在时返回默认值 30

# 修改
config["port"] = 9090           # 修改
config["workers"] = 4           # 添加

# 遍历
for key, value in config.items():
    print(f"{key}: {value}")

# 字典推导式
squares = {x: x**2 for x in range(5)}  # {0: 0, 1: 1, 2: 4, 3: 9, 4: 16}

# 安全获取嵌套值
config.get("database", {}).get("host", "unknown")
\`\`\`

## 1.3 条件判断

\`\`\`python
# if-elif-else
status_code = 200

if status_code == 200:
    print("OK")
elif status_code == 404:
    print("Not Found")
elif status_code >= 500:
    print("Server Error")
else:
    print(f"Status: {status_code}")

# 三元表达式
message = "OK" if status_code == 200 else "Error"

# 常用判断
if not servers:           # 列表为空
    print("No servers")

if "host" in config:      # 字典包含键
    print(config["host"])

if isinstance(port, int): # 类型判断
    print("Port is integer")
\`\`\`

## 1.4 循环

\`\`\`python
# for 循环
servers = ["web01", "web02", "web03"]
for server in servers:
    print(f"Checking {server}...")

# enumerate 获取索引
for i, server in enumerate(servers):
    print(f"{i}: {server}")

# 遍历字典
for key, value in config.items():
    print(f"{key} = {value}")

# while 循环
retry = 0
max_retries = 3
while retry < max_retries:
    result = check_service()
    if result:
        break
    retry += 1
    time.sleep(2)

# break 和 continue
for server in servers:
    if not ping(server):
        continue          # 跳过不可达的服务器
    if check_error(server):
        break             # 发现错误，停止循环
    deploy(server)
\`\`\`

## 1.5 函数

\`\`\`python
# 定义函数
def check_port(host, port, timeout=5):
    """检查端口是否可达"""
    import socket
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError):
        return False

# 调用函数
result = check_port("localhost", 8080)
result = check_port("localhost", 8080, timeout=10)

# 返回多个值（实际返回元组）
def get_server_info(host):
    return host, "running", 8080

name, status, port = get_server_info("web01")

# 可变参数
def deploy(*servers, **options):
    for server in servers:
        print(f"Deploying to {server}")
    if options.get("force"):
        print("Force deploy enabled")

deploy("web01", "web02", force=True, version="2.0")

# Lambda 表达式
is_active = lambda s: s["status"] == "running"
active_servers = list(filter(is_active, all_servers))
\`\`\`

## 1.6 模块与包

\`\`\`python
# 导入模块
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta

# 导入特定函数
from os.path import exists, join

# 别名导入
import subprocess as sp

# 自定义模块
# my_utils.py
def check_service(name):
    ...

# main.py
from my_utils import check_service
check_service("nginx")

# __name__ == "__main__" 惯用法
if __name__ == "__main__":
    main()
\`\`\`

## 1.7 异常处理

\`\`\`python
# try-except
try:
    with open("/etc/nginx/nginx.conf") as f:
        content = f.read()
except FileNotFoundError:
    print("Config file not found")
except PermissionError:
    print("Permission denied")
except Exception as e:
    print(f"Unexpected error: {e}")
finally:
    print("Cleanup")

# 常用异常类型
# FileNotFoundError    - 文件不存在
# PermissionError      - 权限不足
# ValueError           - 值错误
# TypeError            - 类型错误
# KeyError             - 字典键不存在
# IndexError           - 索引越界
# ConnectionError      - 网络连接错误
# TimeoutError         - 超时

# 主动抛出异常
if port < 1 or port > 65535:
    raise ValueError(f"Invalid port number: {port}")
\`\`\`

## 1.8 常用内置函数

\`\`\`python
# 文件读写
with open("config.txt", "r") as f:       # 读文件
    content = f.read()
    # lines = f.readlines()              # 按行读取

with open("output.txt", "w") as f:       # 写文件
    f.write("Hello, World!\\n")

with open("log.txt", "a") as f:          # 追加
    f.write("New log entry\\n")

# 其他常用函数
len(servers)                   # 长度
range(10)                      # 0-9 的序列
sorted(servers)                # 排序（返回新列表）
reversed(servers)              # 反转
max/min/sum                    # 最大/最小/求和
any/all                        # 任意/全部为 True
enumerate(servers)             # 带索引遍历
zip(keys, values)              # 配对
\`\`\`