## 6.1 开发环境

虚拟化让开发环境的创建和销毁变得极其便捷。

### 本地开发环境

\`\`\`bash
# Vagrant + VirtualBox 快速创建开发环境

# 安装
# macOS: brew install vagrant
# Linux: 下载安装包

# 创建 Vagrantfile
cat > Vagrantfile << 'EOF'
Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  config.vm.network "private_network", ip: "192.168.33.10"
  config.vm.provider "virtualbox" do |vb|
    vb.memory = "2048"
    vb.cpus = 2
  end
  config.vm.provision "shell", inline: <<-SHELL
    apt update
    apt install -y nginx docker.io
  SHELL
end
EOF

# 启动
vagrant up

# 连接
vagrant ssh

# 停止
vagrant halt

# 销毁
vagrant destroy
\`\`\`

### 多节点开发环境

\`\`\`ruby
# Vagrantfile - 多节点
Vagrant.configure("2") do |config|
  config.vm.define "web" do |web|
    web.vm.box = "ubuntu/jammy64"
    web.vm.network "private_network", ip: "192.168.33.10"
    web.vm.provision "shell", inline: "apt install -y nginx"
  end

  config.vm.define "db" do |db|
    db.vm.box = "ubuntu/jammy64"
    db.vm.network "private_network", ip: "192.168.33.11"
    db.vm.provision "shell", inline: "apt install -y mysql-server"
  end

  config.vm.define "cache" do |cache|
    cache.vm.box = "ubuntu/jammy64"
    cache.vm.network "private_network", ip: "192.168.33.12"
    cache.vm.provision "shell", inline: "apt install -y redis-server"
  end
end
\`\`\`

### Docker 开发环境

\`\`\`yaml
# docker-compose.yml
version: "3.8"
services:
  web:
    image: nginx:latest
    ports: ["8080:80"]
    volumes: ["./src:/usr/share/nginx/html"]

  api:
    build: ./api
    ports: ["3000:3000"]
    environment:
      - DB_HOST=db
      - REDIS_HOST=cache

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: devpassword
    volumes: ["db_data:/var/lib/mysql"]

  cache:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  db_data:
\`\`\`

\`\`\`bash
# 一键启动开发环境
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f api

# 停止并清理
docker-compose down -v
\`\`\`

## 6.2 测试环境

### 测试环境管理

\`\`\`bash
# 使用 KVM 创建测试环境
# 1. 创建基础模板
virt-install \\
  --name template-centos7 \\
  --ram 2048 --vcpus 2 \\
  --disk path=/var/lib/libvirt/images/template.qcow2,size=30 \\
  --cdrom /iso/CentOS-7-x86_64-Minimal.iso \\
  --os-variant centos7.0 \\
  --network network=default

# 2. 安装后配置模板
# - 更新系统
# - 安装常用工具
# - 配置 SSH
# - 清理（cloud-init / sys-unconfig）

# 3. 从模板克隆
virt-clone \\
  --original template-centos7 \\
  --name test-web01 \\
  --file /var/lib/libvirt/images/test-web01.qcow2

# 4. 启动克隆的虚拟机
virsh start test-web01
\`\`\`

### 自动化测试环境

\`\`\`python
#!/usr/bin/env python3
"""自动化创建测试环境"""
import subprocess
import time

class TestEnvManager:
    def __init__(self, template="template-centos7"):
        self.template = template

    def create_vm(self, name, ram=2048, vcpus=2):
        """从模板克隆虚拟机"""
        cmd = [
            "virt-clone",
            "--original", self.template,
            "--name", name,
            "--file", f"/var/lib/libvirt/images/{name}.qcow2"
        ]
        subprocess.run(cmd, check=True)

        # 启动虚拟机
        subprocess.run(["virsh", "start", name], check=True)
        time.sleep(30)  # 等待启动

        return self.get_vm_ip(name)

    def get_vm_ip(self, name):
        """获取虚拟机 IP"""
        cmd = ["virsh", "domifaddr", name]
        result = subprocess.run(cmd, capture_output=True, text=True)
        # 解析 IP 地址
        for line in result.stdout.split("\\n"):
            if "ipv4" in line.lower():
                return line.split()[3].split("/")[0]
        return None

    def destroy_vm(self, name):
        """销毁虚拟机"""
        subprocess.run(["virsh", "destroy", name], check=False)
        subprocess.run(["virsh", "undefine", name, "--remove-all-storage"], check=False)

    def create_test_cluster(self, prefix, count=3):
        """创建测试集群"""
        vms = []
        for i in range(1, count + 1):
            name = f"{prefix}-{i:02d}"
            ip = self.create_vm(name)
            vms.append({"name": name, "ip": ip})
            print(f"Created {name}: {ip}")
        return vms

# 使用
manager = TestEnvManager()
cluster = manager.create_test_cluster("test", count=3)
\`\`\`

## 6.3 资源隔离

虚拟化实现不同级别的工作负载隔离。

### 多租户隔离

\`\`\`
物理服务器
├── 租户 A（虚拟机隔离）
│   ├── VM: Web 服务
│   ├── VM: 数据库
│   └── VLAN 100
├── 租户 B（虚拟机隔离）
│   ├── VM: Web 服务
│   ├── VM: 数据库
│   └── VLAN 200
└── 租户 C（容器隔离）
    ├── Container: API 服务
    ├── Container: Worker
    └── Network Namespace
\`\`\`

### 资源配额

\`\`\`bash
# KVM 虚拟机资源限制
# 编辑虚拟机 XML 配置

# CPU 限制（cfs_quota/cfs_period）
<vcpu placement='static'>2</vcpu>
<cputune>
  <shares>1024</shares>
  <period>100000</period>
  <quota>200000</quota>     # 2 个 vCPU 的 100%
</cputune>

# 内存限制
<memory unit='GiB'>4</memory>
<currentMemory unit='GiB'>2</currentMemory>
<memtune>
  <hard_limit unit='GiB'>4</hard_limit>
  <soft_limit unit='GiB'>2</soft_limit>
</memtune>

# I/O 限制（blkio）
<blkiotune>
  <weight>500</weight>
  <device>
    <path>/dev/sda</path>
    <weight>500</weight>
    <read_iops_sec>1000</read_iops_sec>
    <write_iops_sec>500</write_iops_sec>
  </device>
</blkiotune>
\`\`\`

### 容器资源限制

\`\`\`bash
# Docker 资源限制
docker run \\
  --memory=2g \\                    # 内存限制
  --memory-swap=2g \\               # Swap 限制（=内存则禁用 Swap）
  --cpus=2 \\                       # CPU 限制
  --cpu-shares=512 \\               # CPU 份额
  --pids-limit=100 \\               # 进程数限制
  --device-write-bps /dev/sda:10mb \\  # 磁盘写入限速
  myapp:latest
\`\`\`

## 6.4 虚拟化运维最佳实践

### 资源规划

\`\`\`
CPU Overcommit 比率建议：
  - 生产环境：1:1 到 2:1
  - 测试环境：2:1 到 4:1
  - 开发环境：4:1 到 8:1

内存 Overcommit 比率建议：
  - 生产环境：1:1（不建议超分）
  - 测试环境：1.2:1 到 1.5:1
  - 开发环境：1.5:1 到 2:1

存储规划：
  - 系统盘：SSD，50-100GB
  - 数据盘：根据应用需求
  - 日志盘：独立磁盘，避免影响数据盘 I/O
\`\`\`

### 备份策略

\`\`\`bash
# 虚拟机备份方式
# 1. 快照（临时保护，不是备份）
virsh snapshot-create-as vm-name snap-$(date +%Y%m%d)

# 2. 磁盘导出（离线备份）
virsh dumpxml vm-name > vm-name.xml
cp /var/lib/libvirt/images/vm-name.qcow2 /backup/

# 3. 增量备份（qcow2）
qemu-img create -f qcow2 -b base.qcow2 -F qcow2 overlay.qcow2

# 4. 使用专业备份工具
# - Veeam Backup（VMware）
# - Bacula / Bareos（KVM）
\`\`\`

### 监控与告警

\`\`\`bash
# 宿主机监控
# - CPU/内存/磁盘/网络使用率
# - 虚拟机数量和状态
# - 存储使用率
# - 网络流量

# KVM 监控命令
virsh domstats vm-name          # 虚拟机统计
virsh nodeinfo                  # 宿主机信息

# 推荐监控方案
# Prometheus + libvirt_exporter
# Grafana 仪表盘
# 告警规则：
#   - 宿主机 CPU > 80%
#   - 宿主机内存 > 90%
#   - 存储使用 > 85%
#   - 虚拟机异常关机
\`\`\`

### 故障排查

\`\`\`bash
# 虚拟机无法启动
virsh start vm-name            # 查看错误信息
virsh dumpxml vm-name          # 检查配置
virsh console vm-name          # 连接控制台

# 性能问题
virsh domstats vm-name         # 查看统计
top / htop                     # 宿主机 CPU/内存
iostat -x 1                    # 磁盘 I/O

# 网络问题
brctl show                     # 检查网桥
tcpdump -i vnet0               # 抓包
iptables -L -n -v              # 检查防火墙

# 存储问题
qemu-img info vm.qcow2         # 检查磁盘
df -h                          # 存储空间
virsh pool-info default        # 存储池信息
\`\`\`