## 2.1 KVM 简介

KVM（Kernel-based Virtual Machine）是 Linux 内核自带的虚拟化模块，将 Linux 变为 Type 1 Hypervisor。

### KVM 架构

\`\`\`
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Guest 1  │  │  Guest 2  │  │  Guest 3  │
│  用户进程  │  │  用户进程  │  │  用户进程  │
├──────────┤  ├──────────┤  ├──────────┤
│  QEMU     │  │  QEMU     │  │  QEMU     │  ← 用户态：设备模拟
│  /dev/kvm │  │  /dev/kvm │  │  /dev/kvm │
├──────────┴──┴──────────┴──┴──────────┤
│           KVM 内核模块                  │  ← 内核态：CPU/内存虚拟化
├───────────────────────────────────────┤
│           Linux 内核                   │
├───────────────────────────────────────┤
│           物理硬件                      │
\`\`\`

- **KVM**：内核模块，负责 CPU 和内存的虚拟化（利用 VT-x/AMD-V）
- **QEMU**：用户态程序，负责 I/O 设备模拟
- **libvirt**：管理 API 和工具集，提供统一的虚拟化管理接口

## 2.2 KVM 安装

\`\`\`bash
# 1. 检查 CPU 虚拟化支持
grep -E '(vmx|svm)' /proc/cpuinfo
# 有输出表示支持

# 2. 安装 KVM 和管理工具
# CentOS/RHEL
sudo yum install -y qemu-kvm libvirt virt-install virt-manager libvirt-client

# Ubuntu/Debian
sudo apt install -y qemu-kvm libvirt-daemon-system libvirt-clients virt-manager virtinst

# 3. 启动 libvirtd 服务
sudo systemctl enable --now libvirtd
sudo systemctl status libvirtd

# 4. 验证 KVM 模块已加载
lsmod | grep kvm
# kvm_intel / kvm_amd
# kvm

# 5. 验证 KVM 可用
virsh list --all
# Id   Name   State
# (空列表表示正常)

# 6. 将用户加入 libvirt 组（免 sudo）
sudo usermod -aG libvirt $(whoami)
\`\`\`

## 2.3 创建虚拟机

### 使用 virt-install 命令行创建

\`\`\`bash
# 创建 CentOS 虚拟机
sudo virt-install \\
  --name centos-vm \\
  --ram 2048 \\
  --vcpus 2 \\
  --disk path=/var/lib/libvirt/images/centos-vm.qcow2,size=20,format=qcow2 \\
  --os-variant centos7.0 \\
  --network network=default,model=virtio \\
  --graphics vnc,listen=0.0.0.0,port=5901 \\
  --cdrom /iso/CentOS-7-x86_64-Minimal-2009.iso \\
  --noautoconsole

# 参数说明：
# --name         虚拟机名称
# --ram          内存大小（MB）
# --vcpus        虚拟 CPU 核心数
# --disk         磁盘路径和大小（GB）
# --os-variant   操作系统类型（优化配置）
# --network      网络配置
# --graphics     图形显示方式
# --cdrom        安装介质
# --noautoconsole 不自动连接控制台
\`\`\`

### 使用 virt-manager 图形界面创建

\`\`\`bash
# 启动图形管理器
virt-manager

# 步骤：
# 1. 点击 "Create a new virtual machine"
# 2. 选择安装介质（ISO 或网络安装）
# 3. 设置内存和 CPU
# 4. 设置磁盘大小
# 5. 配置网络
# 6. 开始安装
\`\`\`

### 磁盘格式选择

| 格式 | 说明 | 特点 |
|------|------|------|
| qcow2 | QEMU 推荐格式 | 支持快照、压缩、稀疏、加密 |
| raw | 原始磁盘格式 | 性能最好，不支持快照 |
| vmdk | VMware 格式 | 兼容 VMware |
| vdi | VirtualBox 格式 | 兼容 VirtualBox |

\`\`\`bash
# 创建 qcow2 磁盘
qemu-img create -f qcow2 /var/lib/libvirt/images/vm.qcow2 20G

# 查看磁盘信息
qemu-img info /var/lib/libvirt/images/vm.qcow2

# 转换磁盘格式
qemu-img convert -f raw -O qcow2 vm.raw vm.qcow2
\`\`\`

## 2.4 virsh 管理

\`virsh\` 是 libvirt 的命令行管理工具。

### 虚拟机生命周期管理

\`\`\`bash
# 列出虚拟机
virsh list                      # 运行中的虚拟机
virsh list --all                # 所有虚拟机（含关机的）
virsh list --inactive           # 只显示关机的

# 启动/关机/重启
virsh start centos-vm           # 启动
virsh shutdown centos-vm        # 优雅关机（发送 ACPI 信号）
virsh reboot centos-vm          # 重启
virsh destroy centos-vm         # 强制关机（相当于拔电源）
virsh reset centos-vm           # 硬重置

# 暂停和恢复
virsh suspend centos-vm         # 暂停（状态保存在内存）
virsh resume centos-vm          # 恢复

# 删除虚拟机
virsh undefine centos-vm        # 取消定义（删除配置）
virsh undefine centos-vm --remove-all-storage  # 同时删除磁盘
\`\`\`

### 虚拟机信息查看

\`\`\`bash
# 虚拟机详细信息
virsh dominfo centos-vm

# CPU 和内存使用
virsh domstats centos-vm

# 虚拟机 XML 配置
virsh dumpxml centos-vm

# 编辑虚拟机配置
virsh edit centos-vm            # 自动生效

# VNC 连接信息
virsh vncdisplay centos-vm
\`\`\`

### 资源调整

\`\`\`bash
# 修改内存（需要关机后修改配置，或动态调整）
virsh setmaxmem centos-vm 4G --config   # 设置最大内存（关机后生效）
virsh setmem centos-vm 2G               # 动态调整当前内存

# 修改 vCPU
virsh setvcpus centos-vm 4 --maximum --config  # 设置最大 vCPU
virsh setvcpus centos-vm 2              # 动态调整当前 vCPU（不超过最大值）

# 添加磁盘
virsh attach-disk centos-vm /var/lib/libvirt/images/disk2.qcow2 vdb --persistent

# 添加网卡
virsh attach-interface centos-vm network default --model virtio --persistent
\`\`\`

## 2.5 快照管理

\`\`\`bash
# 创建快照
virsh snapshot-create-as centos-vm snap1 "Before update"  # 创建命名快照
virsh snapshot-create centos-vm                             # 自动命名快照

# 查看快照
virsh snapshot-list centos-vm
virsh snapshot-info centos-vm snap1

# 恢复快照
virsh snapshot-revert centos-vm snap1

# 删除快照
virsh snapshot-delete centos-vm snap1

# 当前快照
virsh snapshot-current centos-vm
\`\`\`

### 快照原理

\`\`\`
原始镜像 ←── 快照1 ←── 快照2 ←── 快照3

创建快照时：
- 原始镜像变为只读
- 新的写入写入新的 overlay 文件
- 读取时：先读 overlay，未命中读原始镜像

恢复快照时：
- 丢弃当前 overlay
- 回到指定快照的状态
\`\`\`

> **注意**：快照不是备份！如果原始镜像损坏，所有快照都无法使用。

## 2.6 虚拟机迁移

### 迁移类型

| 类型 | 说明 | 停机时间 |
|------|------|----------|
| 冷迁移（Cold） | 关机后迁移磁盘和配置 | 长（分钟级） |
| 温迁移（Warm） | 暂停后迁移内存和磁盘 | 中（秒级） |
| 热迁移（Live） | 运行中迁移，几乎无感知 | 短（毫秒级） |

### 热迁移条件

- 共享存储（NFS/Ceph/iSCSI）
- 源和目标主机相同的 CPU 架构
- 网络连通且低延迟
- 足够的目标主机资源

\`\`\`bash
# 热迁移（需要共享存储）
virsh migrate --live centos-vm qemu+ssh://dest-host/system

# 指定迁移参数
virsh migrate --live \\
  --persistent \\                    # 在目标主机持久化定义
  --undefinesource \\                # 从源主机删除定义
  --verbose \\
  centos-vm qemu+ssh://dest-host/system

# 迁移到本地存储（非共享存储）
virsh migrate --live --copy-disk-all centos-vm qemu+ssh://dest-host/system
\`\`\`