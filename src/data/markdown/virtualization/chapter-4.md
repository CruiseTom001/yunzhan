## 5.1 虚拟网络概述

虚拟网络是在物理网络基础设施之上构建的逻辑网络，为虚拟机提供网络连接。

### 虚拟网络的核心组件

\`\`\`
┌─────────────────────────────────────────┐
│  VM1 (vNIC)  │  VM2 (vNIC)  │  VM3     │
├──────────────┼──────────────┼──────────┤
│  vnet0       │  vnet1       │  vnet2   │  ← 虚拟网卡
├──────────────┴──────────────┴──────────┤
│         虚拟交换机 (vSwitch / Bridge)    │  ← 虚拟交换机
├─────────────────────────────────────────┤
│         物理网卡 (eth0)                  │  ← 上行链路
├─────────────────────────────────────────┤
│         物理网络                         │
\`\`\`

## 5.2 Bridge（桥接网络）

Bridge 是最基础的虚拟网络模式，相当于软件实现的交换机。

### Bridge 工作原理

\`\`\`
物理网络 (192.168.1.0/24)
    │
    │  eth0 (192.168.1.10)
    │
┌───┴───────────────────────────┐
│       br0 (Bridge)            │
│   ┌──────┬──────┬──────┐     │
│   │vnet0 │vnet1 │vnet2 │     │
└───┼──────┼──────┼──────┼─────┘
    │      │      │
   VM1    VM2    VM3
  .11    .12    .13    ← 虚拟机获得与物理网络同网段 IP
\`\`\`

### Linux Bridge 配置

\`\`\`bash
# 创建网桥
ip link add name br0 type bridge
ip link set br0 up

# 将物理网卡加入网桥
ip link set eth0 master br0

# 给网桥配置 IP（替代原 eth0 的 IP）
ip addr add 192.168.1.10/24 dev br0
ip route add default via 192.168.1.1

# 查看网桥
bridge link show
bridge fdb show                # MAC 转发表
brctl show                     # 传统命令

# KVM 虚拟机默认使用 Bridge 网络
# virsh 编辑虚拟机配置：
# <interface type='bridge'>
#   <source bridge='br0'/>
#   <model type='virtio'/>
# </interface>
\`\`\`

### 持久化 Bridge 配置

\`\`\`bash
# /etc/network/interfaces (Debian/Ubuntu)
auto br0
iface br0 inet static
    address 192.168.1.10
    netmask 255.255.255.0
    gateway 192.168.1.1
    bridge_ports eth0
    bridge_stp off
    bridge_fd 0

# /etc/sysconfig/network-scripts/ifcfg-br0 (RHEL/CentOS)
DEVICE=br0
TYPE=Bridge
IPADDR=192.168.1.10
NETMASK=255.255.255.0
GATEWAY=192.168.1.1
ONBOOT=yes
\`\`\`

## 5.3 NAT 网络

NAT（网络地址转换）模式允许虚拟机通过宿主机访问外部网络。

### NAT 工作原理

\`\`\`
外部网络 (Internet)
    │
    │  eth0 (192.168.1.10)
    │
┌───┴───────────────────────────┐
│    宿主机 (NAT/路由)           │
│    virbr0: 192.168.122.1      │
│   ┌──────┬──────┬──────┐     │
│   │vnet0 │vnet1 │vnet2 │     │
└───┼──────┼──────┼──────┼─────┘
    │      │      │
   VM1    VM2    VM3
  .2     .3     .4    ← 虚拟机获得私有网段 IP (192.168.122.0/24)
                         通过 NAT 访问外部网络
\`\`\`

### NAT 配置

\`\`\`bash
# libvirt 默认创建 NAT 网络
virsh net-list
virsh net-info default
virsh net-dumpxml default

# 创建自定义 NAT 网络
cat > nat-network.xml << 'EOF'
<network>
  <name>mynat</name>
  <forward mode='nat'/>
  <bridge name='virbr1' stp='on' delay='0'/>
  <ip address='10.10.10.1' netmask='255.255.255.0'>
    <dhcp>
      <range start='10.10.10.100' end='10.10.10.200'/>
    </dhcp>
  </ip>
</network>
EOF

virsh net-define nat-network.xml
virsh net-start mynat
virsh net-autostart mynat
\`\`\`

### iptables NAT 规则

\`\`\`bash
# libvirt 自动创建的 NAT 规则
iptables -t nat -L -n -v

# POSTROUTING 链：源地址转换
-A POSTROUTING -s 192.168.122.0/24 ! -d 192.168.122.0/24 -j MASQUERADE

# FORWARD 链：允许转发
-A FORWARD -s 192.168.122.0/24 -j ACCEPT
-A FORWARD -d 192.168.122.0/24 -j ACCEPT

# 开启 IP 转发
sysctl net.ipv4.ip_forward=1
\`\`\`

## 5.4 VLAN

VLAN（虚拟局域网）在虚拟化环境中实现网络隔离。

### VLAN 原理

\`\`\`
802.1Q 帧：
┌──────┬──────┬──────────┬─────┬──────┐
│ 目标  │ 源    │ VLAN Tag │类型 │ 数据 │
│ MAC  │ MAC  │ TPID|PCP|VID│     │      │
└──────┴──────┴──────────┴─────┴──────┘
                   0x8100 优先级 VLAN ID (1-4094)
\`\`\`

### 虚拟化中的 VLAN 配置

\`\`\`bash
# 在宿主机创建 VLAN 接口
ip link add link eth0 name eth0.100 type vlan id 100
ip link set eth0.100 up

# 将 VLAN 接口加入 Bridge
ip link add name br100 type bridge
ip link set eth0.100 master br100
ip link set br100 up

# KVM 虚拟机使用 VLAN
# <interface type='bridge'>
#   <source bridge='br100'/>
#   <vlan>
#     <tag id='100'/>
#   </vlan>
#   <model type='virtio'/>
# </interface>
\`\`\`

### VLAN 架构示例

\`\`\`
物理交换机
├── Trunk Port (eth0) ← 承载多个 VLAN
│   ├── VLAN 10 (生产网络)
│   ├── VLAN 20 (测试网络)
│   └── VLAN 30 (管理网络)
│
宿主机
├── br10 (VLAN 10) → 生产虚拟机
├── br20 (VLAN 20) → 测试虚拟机
└── br30 (VLAN 30) → 管理虚拟机
\`\`\`

## 5.5 VXLAN

VXLAN（虚拟扩展局域网）解决了 VLAN 的 4094 限制，支持跨物理网络的二层互通。

### VXLAN vs VLAN

| 特性 | VLAN | VXLAN |
|------|------|-------|
| ID 范围 | 1-4094 | 1-16777216 |
| 跨三层 | 不支持 | 支持（UDP 封装） |
| 帧大小 | 1518 字节 | 1550 字节（需 jumbo frame） |
| 适用 | 小规模隔离 | 大规模云环境 |

### VXLAN 原理

\`\`\`
原始帧封装：
┌──────────┬──────────┬─────────┬──────────┐
│ 外层 IP   │ 外层 UDP  │ VXLAN   │ 原始      │
│ (源/目标) │ (4789)   │ Header  │ 二层帧    │
└──────────┴──────────┴─────────┴──────────┘
  物理网络传输          虚拟网络标识(VNI)

VNI (VXLAN Network Identifier)：24 位，支持 1600 万网络
\`\`\`

### VXLAN 配置

\`\`\`bash
# 创建 VXLAN 接口
ip link add name vxlan10 type vxlan id 10 \
  dstport 4789 \
  remote 192.168.1.20 \    # 对端 VTEP IP
  local 192.168.1.10 \     # 本地 VTEP IP
  dev eth0

# 将 VXLAN 接口加入 Bridge
ip link add name br-vxlan10 type bridge
ip link set vxlan10 master br-vxlan10
ip link set vxlan10 up
ip link set br-vxlan10 up
\`\`\`

## 5.6 SDN 概念

SDN（Software-Defined Networking）将网络控制面与数据面分离。

### 传统网络 vs SDN

\`\`\`
传统网络：
  每台设备独立运行路由协议
  控制面和数据面耦合在设备中

SDN：
  ┌──────────────┐
  │  SDN 控制器   │  ← 集中控制面
  │  (OpenFlow)  │
  └──────┬───────┘
         │ 下发流表
    ┌────┼────┐
    │    │    │
  交换机1 交换机2 交换机3  ← 数据面（只转发）
\`\`\`

### SDN 在虚拟化中的应用

| 技术 | 说明 |
|------|------|
| Open vSwitch (OVS) | 开源虚拟交换机，支持 OpenFlow |
| Neutron | OpenStack 网络组件 |
| Calico | Kubernetes 网络方案 |
| Cilium | 基于 eBPF 的 K8s 网络方案 |
| NSX | VMware SDN 方案 |

\`\`\`bash
# Open vSwitch 基本操作
ovs-vsctl add-br br-int                    # 创建网桥
ovs-vsctl add-port br-int vnet0            # 添加端口
ovs-vsctl show                             # 查看配置
ovs-ofctl dump-flows br-int                # 查看流表
\`\`\`