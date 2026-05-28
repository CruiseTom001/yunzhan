## 6.1 psutil —— 系统监控

\`psutil\`（Python System and Process Utilities）是跨平台的系统监控库。

\`\`\`bash
pip install psutil
\`\`\`

### CPU 监控

\`\`\`python
import psutil

# CPU 使用率
psutil.cpu_percent(interval=1)           # 总 CPU 使用率
psutil.cpu_percent(interval=1, percpu=True)  # 每个 CPU 核心的使用率

# CPU 信息
psutil.cpu_count()                       # 逻辑 CPU 核心数
psutil.cpu_count(logical=False)          # 物理 CPU 核心数
psutil.cpu_freq()                        # CPU 频率

# CPU 时间统计
psutil.cpu_times()                       # 用户/系统/空闲时间
psutil.cpu_stats()                       # 上下文切换、中断次数
\`\`\`

### 内存监控

\`\`\`python
# 物理内存
mem = psutil.virtual_memory()
print(f"Total: {mem.total / (1024**3):.1f} GB")
print(f"Used: {mem.used / (1024**3):.1f} GB")
print(f"Available: {mem.available / (1024**3):.1f} GB")
print(f"Percent: {mem.percent}%")

# Swap
swap = psutil.swap_memory()
print(f"Swap Total: {swap.total / (1024**3):.1f} GB")
print(f"Swap Used: {swap.used / (1024**3):.1f} GB")
\`\`\`

### 磁盘监控

\`\`\`python
# 磁盘使用情况
for partition in psutil.disk_partitions():
    usage = psutil.disk_usage(partition.mountpoint)
    print(f"{partition.mountpoint}: {usage.percent}% used")

# 磁盘 I/O
io = psutil.disk_io_counters()
print(f"Read: {io.read_bytes / (1024**3):.1f} GB")
print(f"Write: {io.write_bytes / (1024**3):.1f} GB")

# 每个磁盘的 I/O
for disk, counters in psutil.disk_io_counters(perdisk=True).items():
    print(f"{disk}: read={counters.read_bytes}, write={counters.write_bytes}")
\`\`\`

### 网络监控

\`\`\`python
# 网络 I/O
net = psutil.net_io_counters()
print(f"Sent: {net.bytes_sent / (1024**2):.1f} MB")
print(f"Recv: {net.bytes_recv / (1024**2):.1f} MB")

# 每个网卡的 I/O
for nic, counters in psutil.net_io_counters(pernic=True).items():
    print(f"{nic}: sent={counters.bytes_sent}, recv={counters.bytes_recv}")

# 网络连接
connections = psutil.net_connections(kind="tcp")
for conn in connections:
    if conn.status == "LISTEN":
        print(f"Listening: {conn.laddr.ip}:{conn.laddr.port}")

# 网卡信息
for name, addrs in psutil.net_if_addrs().items():
    for addr in addrs:
        if addr.family.name == "AF_INET":
            print(f"{name}: {addr.address}")
\`\`\`

### 进程管理

\`\`\`python
# 所有进程
for proc in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
    try:
        info = proc.info
        if info["cpu_percent"] > 50:
            print(f"PID={info['pid']} Name={info['name']} CPU={info['cpu_percent']}%")
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

# 指定进程
p = psutil.Process(1234)
p.name()                    # 进程名
p.status()                  # 进程状态
p.cpu_percent()             # CPU 使用率
p.memory_info()             # 内存使用
p.cmdline()                 # 完整命令行
p.create_time()             # 创建时间
p.connections()             # 网络连接
p.open_files()              # 打开的文件

# 终止进程
p.terminate()               # 发送 SIGTERM
p.kill()                    # 发送 SIGKILL
\`\`\`

### 系统监控脚本

\`\`\`python
#!/usr/bin/env python3
"""系统资源监控脚本"""
import psutil
import time

def check_system():
    """检查系统资源使用情况"""
    alerts = []

    # CPU 检查
    cpu_percent = psutil.cpu_percent(interval=1)
    if cpu_percent > 80:
        alerts.append(f"CPU usage high: {cpu_percent}%")

    # 内存检查
    mem = psutil.virtual_memory()
    if mem.percent > 85:
        alerts.append(f"Memory usage high: {mem.percent}%")

    # 磁盘检查
    for partition in psutil.disk_partitions():
        try:
            usage = psutil.disk_usage(partition.mountpoint)
            if usage.percent > 90:
                alerts.append(f"Disk {partition.mountpoint} usage high: {usage.percent}%")
        except PermissionError:
            continue

    # Swap 检查
    swap = psutil.swap_memory()
    if swap.percent > 50:
        alerts.append(f"Swap usage high: {swap.percent}%")

    return alerts

if __name__ == "__main__":
    alerts = check_system()
    if alerts:
        for alert in alerts:
            print(f"[ALERT] {alert}")
    else:
        print("[OK] System resources normal")
\`\`\`

## 6.2 定时任务（APScheduler）

\`\`\`bash
pip install apscheduler
\`\`\`

\`\`\`python
from apscheduler.schedulers.blocking import BlockingScheduler

scheduler = BlockingScheduler()

# 固定间隔执行
@scheduler.scheduled_job("interval", minutes=5)
def check_services():
    """每 5 分钟检查服务状态"""
    print("Checking services...")

# Cron 风格调度
@scheduler.scheduled_job("cron", hour=2, minute=0)
def daily_backup():
    """每天凌晨 2 点执行备份"""
    print("Running daily backup...")

@scheduler.scheduled_job("cron", day_of_week="mon", hour=9)
def weekly_report():
    """每周一上午 9 点生成报告"""
    print("Generating weekly report...")

# 启动调度器
scheduler.start()
\`\`\`

## 6.3 邮件告警

\`\`\`python
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_alert(subject, body, to_emails, from_email="ops@example.com",
               smtp_host="smtp.example.com", smtp_port=587,
               smtp_user=None, smtp_password=None):
    """发送告警邮件"""
    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = ", ".join(to_emails)
    msg["Subject"] = subject

    msg.attach(MIMEText(body, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(from_email, to_emails, msg.as_string())
        print("Alert email sent successfully")
    except Exception as e:
        print(f"Failed to send email: {e}")

# 使用
send_alert(
    subject="[ALERT] High CPU Usage on web01",
    body="<h2>CPU Alert</h2><p>CPU usage is 95% on web01</p>",
    to_emails=["admin@example.com", "oncall@example.com"]
)
\`\`\`

## 6.4 综合监控告警脚本

\`\`\`python
#!/usr/bin/env python3
"""综合系统监控与告警"""
import psutil
import time
import logging
from datetime import datetime

logger = logging.getLogger("monitor")

class SystemMonitor:
    def __init__(self, thresholds=None):
        self.thresholds = thresholds or {
            "cpu_percent": 80,
            "memory_percent": 85,
            "disk_percent": 90,
            "swap_percent": 50,
        }
        self.alert_cooldown = {}  # 防止频繁告警

    def check(self):
        """执行所有检查"""
        alerts = []

        # CPU
        cpu = psutil.cpu_percent(interval=1)
        if cpu > self.thresholds["cpu_percent"]:
            alerts.append(("cpu", f"CPU usage: {cpu}%"))

        # 内存
        mem = psutil.virtual_memory()
        if mem.percent > self.thresholds["memory_percent"]:
            alerts.append(("memory", f"Memory usage: {mem.percent}%"))

        # 磁盘
        for part in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(part.mountpoint)
                if usage.percent > self.thresholds["disk_percent"]:
                    alerts.append(("disk", f"Disk {part.mountpoint}: {usage.percent}%"))
            except PermissionError:
                continue

        return alerts

    def run(self, interval=60):
        """持续监控"""
        logger.info("Monitor started")
        while True:
            alerts = self.check()
            for alert_type, message in alerts:
                logger.warning(f"[ALERT] {message}")
                # 此处可集成邮件/钉钉/Slack 告警
            time.sleep(interval)

if __name__ == "__main__":
    monitor = SystemMonitor()
    monitor.run()
\`\`\`