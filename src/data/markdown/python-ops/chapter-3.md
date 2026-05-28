## 4.1 socket 模块

\`socket\` 是 Python 网络编程的基础模块。

### TCP 客户端

\`\`\`python
import socket

def check_port(host, port, timeout=5):
    """检查端口是否开放"""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False

# 使用
if check_port("192.168.1.100", 22):
    print("SSH port is open")
else:
    print("SSH port is closed")

# 批量端口扫描
def scan_ports(host, ports):
    """扫描指定主机的端口"""
    open_ports = []
    for port in ports:
        if check_port(host, port, timeout=2):
            open_ports.append(port)
    return open_ports

open_ports = scan_ports("192.168.1.100", range(1, 1025))
print(f"Open ports: {open_ports}")
\`\`\`

### TCP 服务端

\`\`\`python
import socket

def start_server(host="0.0.0.0", port=9090):
    """简单的 TCP 服务器"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((host, port))
        s.listen(5)
        print(f"Server listening on {host}:{port}")

        while True:
            conn, addr = s.accept()
            with conn:
                print(f"Connected by {addr}")
                data = conn.recv(1024)
                if data:
                    response = process_request(data)
                    conn.sendall(response)
\`\`\`

### UDP 操作

\`\`\`python
import socket

def send_udp(host, port, message):
    """发送 UDP 消息"""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.sendto(message.encode(), (host, port))

def dns_query(domain, dns_server="8.8.8.8"):
    """简单的 DNS 查询"""
    # 实际运维中建议使用 dnspython 库
    pass
\`\`\`

## 4.2 requests 库

\`requests\` 是 Python 最流行的 HTTP 库。

\`\`\`python
import requests

# GET 请求
resp = requests.get("https://api.example.com/users")
print(resp.status_code)        # 200
print(resp.json())             # 解析 JSON 响应
print(resp.text)               # 原始文本
print(resp.headers)            # 响应头

# 带参数的 GET 请求
resp = requests.get(
    "https://api.example.com/search",
    params={"q": "nginx", "page": 1}
)

# POST 请求
resp = requests.post(
    "https://api.example.com/login",
    json={"username": "admin", "password": "secret"}
)

# 发送表单数据
resp = requests.post(
    "https://api.example.com/upload",
    data={"field": "value"}
)

# 上传文件
with open("config.yaml", "rb") as f:
    resp = requests.post(
        "https://api.example.com/upload",
        files={"file": f}
    )

# 自定义请求头
headers = {"Authorization": "Bearer token123"}
resp = requests.get("https://api.example.com/me", headers=headers)

# 超时和重试
resp = requests.get("https://api.example.com", timeout=10)

# Session（复用连接）
session = requests.Session()
session.headers.update({"Authorization": "Bearer token123"})
resp1 = session.get("https://api.example.com/users")
resp2 = session.get("https://api.example.com/profile")
\`\`\`

### 健康检查脚本

\`\`\`python
#!/usr/bin/env python3
"""Web 服务健康检查"""
import requests
import time
import sys

def health_check(url, expected_status=200, timeout=10):
    """检查 Web 服务是否正常"""
    try:
        resp = requests.get(url, timeout=timeout)
        if resp.status_code == expected_status:
            return True, f"OK (status={resp.status_code})"
        else:
            return False, f"Unexpected status: {resp.status_code}"
    except requests.ConnectionError:
        return False, "Connection refused"
    except requests.Timeout:
        return False, "Request timed out"
    except Exception as e:
        return False, f"Error: {e}"

def monitor(urls, interval=30):
    """持续监控多个 URL"""
    while True:
        for url in urls:
            ok, message = health_check(url)
            status = "✓" if ok else "✗"
            print(f"[{status}] {url} - {message}")
        print("-" * 50)
        time.sleep(interval)

if __name__ == "__main__":
    urls = [
        "http://localhost:8080/health",
        "http://localhost:9090/health",
    ]
    monitor(urls)
\`\`\`

## 4.3 paramiko 库 —— SSH 自动化

\`paramiko\` 是 Python 的 SSH 客户端库，用于远程服务器管理。

### 基本连接

\`\`\`python
import paramiko

def ssh_command(host, user, command, key_file=None, password=None):
    """执行远程 SSH 命令"""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        # 连接方式1：使用密钥
        if key_file:
            client.connect(host, username=user, key_filename=key_file)
        # 连接方式2：使用密码
        else:
            client.connect(host, username=user, password=password)

        stdin, stdout, stderr = client.exec_command(command)
        exit_code = stdout.channel.recv_exit_status()

        return {
            "stdout": stdout.read().decode(),
            "stderr": stderr.read().decode(),
            "exit_code": exit_code
        }
    finally:
        client.close()

# 使用
result = ssh_command("192.168.1.100", "root", "df -h", key_file="~/.ssh/id_rsa")
print(result["stdout"])
\`\`\`

### 批量执行命令

\`\`\`python
def batch_execute(servers, command, user="root", key_file="~/.ssh/id_rsa"):
    """在多台服务器上批量执行命令"""
    results = {}

    for server in servers:
        try:
            result = ssh_command(server, user, command, key_file=key_file)
            results[server] = result
            print(f"[{server}] Exit: {result['exit_code']}")
        except Exception as e:
            results[server] = {"error": str(e)}
            print(f"[{server}] Error: {e}")

    return results

# 使用
servers = ["web01", "web02", "web03"]
results = batch_execute(servers, "uptime")
\`\`\`

### SFTP 文件传输

\`\`\`python
import paramiko

def upload_file(host, user, local_path, remote_path, key_file=None):
    """上传文件到远程服务器"""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(host, username=user, key_filename=key_file)
        sftp = client.open_sftp()
        sftp.put(local_path, remote_path)
        sftp.close()
        print(f"Uploaded {local_path} -> {host}:{remote_path}")
    finally:
        client.close()

def download_file(host, user, remote_path, local_path, key_file=None):
    """从远程服务器下载文件"""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(host, username=user, key_filename=key_file)
        sftp = client.open_sftp()
        sftp.get(remote_path, local_path)
        sftp.close()
        print(f"Downloaded {host}:{remote_path} -> {local_path}")
    finally:
        client.close()
\`\`\`

## 4.4 网络工具函数

\`\`\`python
import socket
import requests

def get_local_ip():
    """获取本机 IP 地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def get_public_ip():
    """获取公网 IP 地址"""
    try:
        resp = requests.get("https://api.ipify.org", timeout=5)
        return resp.text
    except Exception:
        return None

def resolve_dns(hostname):
    """DNS 解析"""
    try:
        return socket.gethostbyname(hostname)
    except socket.gaierror:
        return None

def check_tcp_connection(host, port, timeout=5):
    """检查 TCP 连接"""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False
\`\`\`