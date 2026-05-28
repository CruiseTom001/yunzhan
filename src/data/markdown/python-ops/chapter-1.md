## 2.1 os 模块

\`os\` 模块提供了与操作系统交互的接口。

\`\`\`python
import os

# 当前目录
os.getcwd()                    # 获取当前工作目录
os.chdir("/var/log")           # 切换工作目录

# 目录操作
os.mkdir("/tmp/test")          # 创建目录（父目录必须存在）
os.makedirs("/tmp/a/b/c", exist_ok=True)  # 递归创建（已存在不报错）

os.rmdir("/tmp/test")          # 删除空目录
os.removedirs("/tmp/a/b/c")    # 递归删除空目录

# 文件操作
os.remove("/tmp/file.txt")     # 删除文件
os.rename("old.txt", "new.txt")  # 重命名/移动

# 路径操作
os.path.exists("/etc/hosts")   # 路径是否存在
os.path.isfile("/etc/hosts")   # 是否是文件
os.path.isdir("/etc")          # 是否是目录
os.path.islink("/usr/bin/python")  # 是否是符号链接

os.path.basename("/etc/nginx/nginx.conf")  # "nginx.conf"
os.path.dirname("/etc/nginx/nginx.conf")   # "/etc/nginx"
os.path.abspath("config.txt")  # 转为绝对路径

os.path.getsize("/var/log/syslog")  # 文件大小（字节）
os.path.getmtime("/var/log/syslog") # 修改时间（时间戳）

# 环境变量
os.environ["HOME"]             # 获取环境变量
os.environ["MY_VAR"] = "value" # 设置环境变量
os.getenv("MY_VAR", "default") # 获取，不存在返回默认值

# 执行系统命令（简单场景）
exit_code = os.system("ls -la")  # 返回退出码
\`\`\`

## 2.2 pathlib 模块（推荐）

\`pathlib\` 提供了面向对象的路径操作，比 \`os.path\` 更优雅。

\`\`\`python
from pathlib import Path

# 创建 Path 对象
p = Path("/var/log/nginx")
p = Path("config.txt")          # 相对路径
p = Path.home()                 # 用户家目录
p = Path.cwd()                  # 当前工作目录

# 路径拼接（用 / 运算符，非常直观！）
config = Path("/etc") / "nginx" / "nginx.conf"
log_dir = Path.home() / "logs" / "app"

# 路径属性
p = Path("/var/log/nginx/access.log")
p.name          # "access.log"
p.stem          # "access"
p.suffix        # ".log"
p.parent        # Path("/var/log/nginx")
p.parents[0]    # Path("/var/log/nginx")
p.parents[1]    # Path("/var/log")

# 判断
p.exists()      # 是否存在
p.is_file()     # 是否是文件
p.is_dir()      # 是否是目录
p.is_absolute() # 是否是绝对路径

# 创建和删除
p.mkdir(parents=True, exist_ok=True)  # 创建目录
p.rmdir()       # 删除空目录
p.unlink()      # 删除文件
p.unlink(missing_ok=True)  # 删除文件（不存在不报错）

# 遍历目录
for f in Path("/var/log").iterdir():
    print(f.name)

# glob 模式匹配
for f in Path("/var/log").glob("*.log"):
    print(f)

# 递归匹配
for f in Path("/var/log").rglob("*.log"):
    print(f)

# 读写文件（Path 对象直接读写）
content = p.read_text()        # 读取全部文本
p.write_text("new content")    # 写入文本
bytes_data = p.read_bytes()    # 读取二进制
p.write_bytes(bytes_data)      # 写入二进制
\`\`\`

### os.path vs pathlib 对比

| 操作 | os.path | pathlib |
|------|---------|---------|
| 拼接路径 | os.path.join(a, b) | Path(a) / b |
| 文件名 | os.path.basename(p) | Path(p).name |
| 目录名 | os.path.dirname(p) | Path(p).parent |
| 是否存在 | os.path.exists(p) | Path(p).exists() |
| 读写文件 | open(p, "r") | Path(p).read_text() |

## 2.3 shutil 模块

\`shutil\` 提供了高级文件操作。

\`\`\`python
import shutil

# 复制文件
shutil.copy("src.txt", "dst.txt")         # 复制内容和权限
shutil.copy2("src.txt", "dst.txt")        # 复制内容、权限、时间戳
shutil.copyfile("src.txt", "dst.txt")     # 只复制内容

# 复制目录
shutil.copytree("src_dir", "dst_dir")     # 递归复制目录
shutil.copytree("src_dir", "dst_dir", symlinks=True)  # 保留符号链接

# 移动/重命名
shutil.move("src.txt", "dst.txt")         # 移动文件或目录

# 删除目录（包括内容！）
shutil.rmtree("/tmp/test_dir")            # 递归删除目录
shutil.rmtree("/tmp/test_dir", ignore_errors=True)  # 忽略错误

# 磁盘使用情况
usage = shutil.disk_usage("/")
print(f"Total: {usage.total // (1024**3)} GB")
print(f"Used: {usage.used // (1024**3)} GB")
print(f"Free: {usage.free // (1024**3)} GB")

# 查找可执行文件
python_path = shutil.which("python3")     # 返回 python3 的完整路径
\`\`\`

## 2.4 glob 模块

\`glob\` 使用 Unix shell 风格的通配符匹配文件。

\`\`\`python
import glob

# 匹配当前目录下的 .log 文件
files = glob.glob("*.log")

# 递归匹配
files = glob.glob("/var/log/**/*.log", recursive=True)

# 常用模式
# *      匹配任意字符（不含路径分隔符）
# **     匹配任意路径（recursive=True 时）
# ?      匹配单个字符
# [abc]  匹配 a、b 或 c

# 示例：清理 7 天前的日志
import os
import time

log_dir = "/var/log/myapp"
cutoff = time.time() - 7 * 86400  # 7 天前

for log_file in glob.glob(os.path.join(log_dir, "*.log")):
    if os.path.getmtime(log_file) < cutoff:
        os.remove(log_file)
        print(f"Removed: {log_file}")
\`\`\`

## 2.5 文件监控实战

\`\`\`python
#!/usr/bin/env python3
"""监控目录变化，记录新增文件"""
import os
import time
from pathlib import Path

def watch_directory(path, interval=5):
    """监控目录变化"""
    watch_path = Path(path)
    known_files = set(f.name for f in watch_path.iterdir())

    print(f"Watching {path} (known: {len(known_files)} files)")

    while True:
        time.sleep(interval)
        current_files = set(f.name for f in watch_path.iterdir())

        added = current_files - known_files
        removed = known_files - current_files

        if added:
            print(f"[+] New files: {added}")
        if removed:
            print(f"[-] Removed files: {removed}")

        known_files = current_files

if __name__ == "__main__":
    watch_directory("/var/log/myapp")
\`\`\`

## 2.6 批量文件操作实战

\`\`\`python
#!/usr/bin/env python3
"""批量重命名日志文件，添加日期前缀"""
import os
from pathlib import Path
from datetime import datetime

def rename_logs(directory):
    """给日志文件添加日期前缀"""
    log_dir = Path(directory)
    today = datetime.now().strftime("%Y%m%d")

    for log_file in log_dir.glob("*.log"):
        if log_file.name.startswith(today):
            continue  # 已有日期前缀，跳过

        new_name = f"{today}_{log_file.name}"
        new_path = log_file.parent / new_name
        log_file.rename(new_path)
        print(f"Renamed: {log_file.name} -> {new_name}")

if __name__ == "__main__":
    rename_logs("/var/log/myapp")
\`\`\`