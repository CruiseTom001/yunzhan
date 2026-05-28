## 7.1 批量部署脚本

\`\`\`python
#!/usr/bin/env python3
"""批量部署脚本：在多台服务器上部署应用"""
import paramiko
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("deploy")

class Deployer:
    def __init__(self, servers, user="root", key_file="~/.ssh/id_rsa"):
        self.servers = servers
        self.user = user
        self.key_file = key_file

    def _ssh_exec(self, host, command):
        """在远程服务器执行命令"""
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(host, username=self.user, key_filename=self.key_file, timeout=10)
            stdin, stdout, stderr = client.exec_command(command, timeout=300)
            exit_code = stdout.channel.recv_exit_status()
            output = stdout.read().decode().strip()
            error = stderr.read().decode().strip()
            return exit_code, output, error
        finally:
            client.close()

    def deploy(self, host, version):
        """在单台服务器上部署"""
        steps = [
            ("Health check", f"curl -sf http://localhost:8080/health || exit 1"),
            ("Pull image", f"docker pull myapp:{version}"),
            ("Stop old container", f"docker stop myapp || true"),
            ("Remove old container", f"docker rm myapp || true"),
            ("Start new container", f"docker run -d --name myapp -p 8080:8080 myapp:{version}"),
            ("Wait for startup", "sleep 5"),
            ("Verify", f"curl -sf http://localhost:8080/health || exit 1"),
        ]

        logger.info(f"[{host}] Starting deployment v{version}")
        for step_name, command in steps:
            logger.info(f"[{host}] Step: {step_name}")
            exit_code, output, error = self._ssh_exec(host, command)
            if exit_code != 0:
                logger.error(f"[{host}] Failed at '{step_name}': {error}")
                return False, f"Failed at {step_name}: {error}"

        logger.info(f"[{host}] Deployment successful")
        return True, "OK"

    def batch_deploy(self, version, max_workers=5):
        """批量并行部署"""
        results = {}
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(self.deploy, host, version): host
                for host in self.servers
            }
            for future in as_completed(futures):
                host = futures[future]
                try:
                    success, message = future.result()
                    results[host] = {"success": success, "message": message}
                except Exception as e:
                    results[host] = {"success": False, "message": str(e)}

        return results

if __name__ == "__main__":
    servers = ["web01", "web02", "web03"]
    deployer = Deployer(servers)
    results = deployer.batch_deploy("2.1.0")

    for host, result in results.items():
        status = "✓" if result["success"] else "✗"
        print(f"{status} {host}: {result['message']}")
\`\`\`

## 7.2 日志分析脚本

\`\`\`python
#!/usr/bin/env python3
"""Nginx 访问日志分析"""
import re
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime

LOG_PATTERN = re.compile(
    r'(?P<ip>\\S+) \\S+ \\S+ '
    r'\\[(?P<time>[^\\]]+)\\] '
    r'"(?P<method>\\S+) (?P<path>\\S+) \\S+" '
    r'(?P<status>\\d+) (?P<size>\\d+) '
    r'"(?P<referer>[^"]*)" '
    r'"(?P<ua>[^"]*)"'
)

def parse_log_line(line):
    """解析单行日志"""
    match = LOG_PATTERN.match(line)
    if match:
        return match.groupdict()
    return None

def analyze_access_log(log_file, top_n=10):
    """分析访问日志"""
    ips = Counter()
    paths = Counter()
    status_codes = Counter()
    hourly = defaultdict(int)
    slow_requests = []

    with open(log_file) as f:
        for line in f:
            entry = parse_log_line(line)
            if not entry:
                continue

            ips[entry["ip"]] += 1
            paths[entry["path"]] += 1
            status_codes[entry["status"]] += 1

            # 按小时统计
            try:
                hour = datetime.strptime(entry["time"][:14], "%d/%b/%Y:%H")
                hourly[hour] += 1
            except ValueError:
                pass

    # 输出报告
    print("=" * 60)
    print(f"Access Log Analysis: {log_file}")
    print("=" * 60)

    print(f"\\nTotal requests: {sum(status_codes.values())}")

    print(f"\\nTop {top_n} IPs:")
    for ip, count in ips.most_common(top_n):
        print(f"  {ip}: {count}")

    print(f"\\nTop {top_n} Paths:")
    for path, count in paths.most_common(top_n):
        print(f"  {path}: {count}")

    print(f"\\nStatus Codes:")
    for code, count in sorted(status_codes.items()):
        print(f"  {code}: {count}")

    # 错误率
    total = sum(status_codes.values())
    errors = sum(count for code, count in status_codes.items() if code.startswith(("4", "5")))
    print(f"\\nError rate: {errors/total*100:.2f}%")

if __name__ == "__main__":
    analyze_access_log("/var/log/nginx/access.log")
\`\`\`

## 7.3 服务器巡检脚本

\`\`\`python
#!/usr/bin/env python3
"""服务器巡检脚本：收集系统信息并生成报告"""
import psutil
import socket
import platform
import subprocess
from datetime import datetime
from pathlib import Path

class ServerInspector:
    def __init__(self):
        self.report = []
        self.hostname = socket.gethostname()

    def add_section(self, title, content):
        self.report.append(f"\\n## {title}")
        self.report.append(content)

    def check_system_info(self):
        """系统基本信息"""
        info = f"""
- Hostname: {self.hostname}
- OS: {platform.system()} {platform.release()}
- Architecture: {platform.machine()}
- Python: {platform.python_version()}
- Uptime: {self._get_uptime()}
- Current Time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
"""
        self.add_section("System Info", info)

    def check_cpu(self):
        """CPU 检查"""
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        load1, load5, load15 = psutil.getloadavg() if hasattr(psutil, "getloadavg") else (0, 0, 0)

        status = "OK" if cpu_percent < 80 else "WARNING"
        content = f"""
- CPU Usage: {cpu_percent}% [{status}]
- CPU Cores: {cpu_count}
- Load Average: {load1:.2f}, {load5:.2f}, {load15:.2f}
"""
        self.add_section("CPU", content)

    def check_memory(self):
        """内存检查"""
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()

        mem_status = "OK" if mem.percent < 85 else "WARNING"
        swap_status = "OK" if swap.percent < 50 else "WARNING"

        content = f"""
- Memory: {mem.used/(1024**3):.1f}G / {mem.total/(1024**3):.1f}G ({mem.percent}%) [{mem_status}]
- Swap: {swap.used/(1024**3):.1f}G / {swap.total/(1024**3):.1f}G ({swap.percent}%) [{swap_status}]
"""
        self.add_section("Memory", content)

    def check_disk(self):
        """磁盘检查"""
        lines = []
        for part in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(part.mountpoint)
                status = "OK" if usage.percent < 90 else "WARNING"
                lines.append(
                    f"- {part.mountpoint}: {usage.used/(1024**3):.1f}G / "
                    f"{usage.total/(1024**3):.1f}G ({usage.percent}%) [{status}]"
                )
            except PermissionError:
                continue
        self.add_section("Disk", "\\n".join(lines))

    def check_network(self):
        """网络检查"""
        lines = []
        for name, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family.name == "AF_INET":
                    lines.append(f"- {name}: {addr.address}")
        self.add_section("Network", "\\n".join(lines))

    def check_services(self, services=None):
        """检查关键服务状态"""
        services = services or ["nginx", "sshd", "docker"]
        lines = []
        for svc in services:
            result = subprocess.run(
                ["systemctl", "is-active", svc],
                capture_output=True, text=True
            )
            status = result.stdout.strip()
            icon = "✓" if status == "active" else "✗"
            lines.append(f"- {icon} {svc}: {status}")
        self.add_section("Services", "\\n".join(lines))

    def _get_uptime(self):
        """获取系统运行时间"""
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        delta = datetime.now() - boot_time
        days = delta.days
        hours, remainder = divmod(delta.seconds, 3600)
        minutes, _ = divmod(remainder, 60)
        return f"{days}d {hours}h {minutes}m"

    def generate_report(self):
        """生成巡检报告"""
        header = f"# Server Inspection Report - {self.hostname}"
        header += f"\\nDate: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        return header + "\\n".join(self.report)

    def run(self):
        """执行巡检"""
        self.check_system_info()
        self.check_cpu()
        self.check_memory()
        self.check_disk()
        self.check_network()
        self.check_services()
        return self.generate_report()

if __name__ == "__main__":
    inspector = ServerInspector()
    report = inspector.run()
    print(report)

    # 保存报告
    report_dir = Path("/var/log/inspection")
    report_dir.mkdir(parents=True, exist_ok=True)
    report_file = report_dir / f"inspect_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    report_file.write_text(report)
    print(f"\\nReport saved to: {report_file}")
\`\`\`

## 7.4 自动化运维脚本模板

\`\`\`python
#!/usr/bin/env python3
"""运维脚本通用模板"""
import argparse
import logging
import signal
import sys
from pathlib import Path

# 日志配置
def setup_logging(verbose=False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

# 优雅退出
running = True
def signal_handler(signum, frame):
    global running
    logging.info(f"Received signal {signum}, shutting down...")
    running = False

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def main():
    parser = argparse.ArgumentParser(description="Ops script template")
    parser.add_argument("action", choices=["check", "deploy", "rollback"])
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("-c", "--config", default="config.yaml")
    args = parser.parse_args()

    setup_logging(args.verbose)
    logger = logging.getLogger(__name__)

    logger.info(f"Action: {args.action}")

    try:
        if args.action == "check":
            do_check()
        elif args.action == "deploy":
            do_deploy()
        elif args.action == "rollback":
            do_rollback()
    except Exception as e:
        logger.error(f"Failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
\`\`\`