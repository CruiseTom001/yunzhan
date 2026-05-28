## 3.1 subprocess 模块

\`subprocess\` 是 Python 执行系统命令的标准模块。

### 基本用法

\`\`\`python
import subprocess

# 执行命令并获取输出
result = subprocess.run(
    ["ls", "-la", "/var/log"],
    capture_output=True,       # 捕获 stdout 和 stderr
    text=True,                 # 输出为字符串（而非 bytes）
    timeout=30                 # 超时时间（秒）
)

print(result.stdout)           # 标准输出
print(result.stderr)           # 标准错误
print(result.returncode)       # 退出码（0 表示成功）

# 检查命令是否成功
result = subprocess.run(["ls", "/nonexistent"], capture_output=True, text=True)
if result.returncode != 0:
    print(f"Error: {result.stderr}")

# 命令失败时抛出异常
result = subprocess.run(
    ["ls", "/nonexistent"],
    capture_output=True,
    text=True,
    check=True                 # 非零退出码时抛出 CalledProcessError
)
\`\`\`

### 高级用法

\`\`\`python
# 使用 shell 管道（shell=True）
result = subprocess.run(
    "cat access.log | grep 404 | wc -l",
    shell=True,
    capture_output=True,
    text=True
)

# 管道连接多个命令
p1 = subprocess.Popen(["cat", "access.log"], stdout=subprocess.PIPE)
p2 = subprocess.Popen(["grep", "404"], stdin=p1.stdout, stdout=subprocess.PIPE)
p3 = subprocess.Popen(["wc", "-l"], stdin=p2.stdout, stdout=subprocess.PIPE)
output = p3.communicate()[0]

# 输入传递
result = subprocess.run(
    ["grep", "error"],
    input="info message\\nerror message\\n",
    capture_output=True,
    text=True
)

# 实时输出
process = subprocess.Popen(
    ["tail", "-f", "/var/log/app.log"],
    stdout=subprocess.PIPE,
    text=True
)
for line in process.stdout:
    print(line.strip())
\`\`\`

### 运维常用封装

\`\`\`python
def run_command(cmd, check=True, timeout=30):
    """执行系统命令的封装函数"""
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=check,
        timeout=timeout
    )
    return result.stdout.strip()

# 使用示例
output = run_command(["df", "-h"])
output = run_command(["systemctl", "status", "nginx"], check=False)
\`\`\`

> **安全提示**：避免使用 \`shell=True\` 处理用户输入，可能导致命令注入。优先使用列表形式传参。

## 3.2 sys 模块

\`\`\`python
import sys

# 命令行参数
sys.argv              # ["script.py", "arg1", "arg2"]
sys.argv[0]           # 脚本名
sys.argv[1:]          # 参数列表

# 标准输入/输出/错误
sys.stdout            # 标准输出
sys.stderr            # 标准错误
sys.stdin             # 标准输入

# 退出程序
sys.exit(0)           # 正常退出
sys.exit(1)           # 异常退出

# Python 路径
sys.path              # 模块搜索路径
sys.version           # Python 版本
sys.platform          # 平台标识（"linux", "win32"）

# 命令行参数解析示例
def main():
    if len(sys.argv) < 2:
        print("Usage: script.py <command>", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    if command == "start":
        start_service()
    elif command == "stop":
        stop_service()
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        sys.exit(1)
\`\`\`

### argparse 命令行参数解析

\`\`\`python
import argparse

parser = argparse.ArgumentParser(description="Service management tool")
parser.add_argument("action", choices=["start", "stop", "restart", "status"])
parser.add_argument("-s", "--service", required=True, help="Service name")
parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
parser.add_argument("-t", "--timeout", type=int, default=30, help="Timeout in seconds")

args = parser.parse_args()

# 使用
# python script.py start --service nginx --verbose --timeout 60
print(args.action)    # "start"
print(args.service)   # "nginx"
print(args.verbose)   # True
print(args.timeout)   # 60
\`\`\`

## 3.3 platform 模块

\`\`\`python
import platform

platform.system()        # "Linux"
platform.node()          # 主机名
platform.release()       # 内核版本 "5.15.0-91-generic"
platform.version()       # 内核版本详细信息
platform.machine()       # "x86_64"
platform.processor()     # 处理器信息
platform.dist()          # 发行版信息（旧版）
platform.python_version()  # Python 版本

# 获取 Linux 发行版信息（Python 3.8+）
import distro
distro.name()            # "Ubuntu"
distro.version()         # "22.04"
distro.id()              # "ubuntu"
\`\`\`

## 3.4 信号处理

\`\`\`python
import signal
import sys

# 捕获 SIGINT (Ctrl+C) 和 SIGTERM
def signal_handler(signum, frame):
    print(f"\\nReceived signal {signum}, cleaning up...")
    # 执行清理操作
    cleanup()
    sys.exit(0)

# 注册信号处理函数
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# 定时器（SIGALRM）
def timeout_handler(signum, frame):
    raise TimeoutError("Operation timed out")

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(30)  # 30 秒后发送 SIGALRM

try:
    long_running_operation()
finally:
    signal.alarm(0)  # 取消定时器

# 忽略信号
signal.signal(signal.SIGINT, signal.SIG_IGN)  # 忽略 Ctrl+C
\`\`\`

### 优雅退出的运维脚本模板

\`\`\`python
#!/usr/bin/env python3
"""运维脚本模板：支持优雅退出"""
import signal
import sys
import time

running = True

def cleanup():
    """清理资源"""
    print("Cleaning up resources...")
    # 关闭连接、释放锁、删除临时文件等

def signal_handler(signum, frame):
    global running
    print(f"\\nReceived signal {signum}, shutting down gracefully...")
    running = False

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def main():
    while running:
        try:
            do_work()
            time.sleep(5)
        except Exception as e:
            print(f"Error: {e}")
            continue

    cleanup()
    print("Exited cleanly")

if __name__ == "__main__":
    main()
\`\`\`

## 3.5 定时任务

\`\`\`python
import sched
import time

# 使用 sched 模块
scheduler = sched.scheduler(time.time, time.sleep)

def check_service(name):
    """定时检查服务状态"""
    print(f"Checking {name} at {time.ctime()}")
    # 检查逻辑...
    # 重新调度（每 60 秒执行一次）
    scheduler.enter(60, 1, check_service, argument=(name,))

# 首次调度
scheduler.enter(0, 1, check_service, argument=("nginx",))
scheduler.run()  # 阻塞运行

# 使用 time.sleep 实现简单定时
import time

def periodic_task(interval, task, *args):
    """周期性执行任务"""
    while True:
        task(*args)
        time.sleep(interval)

periodic_task(60, check_service, "nginx")
\`\`\`