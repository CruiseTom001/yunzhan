## 3.1 VMware 虚拟化产品线

| 产品 | 类型 | 适用场景 |
|------|------|----------|
| ESXi | Type 1 Hypervisor | 服务器虚拟化 |
| vCenter Server | 管理平台 | 集中管理多台 ESXi |
| vSphere | ESXi + vCenter | 企业虚拟化解决方案 |
| Workstation | Type 2 Hypervisor | 桌面虚拟化（开发/测试） |
| Fusion | Type 2 Hypervisor | macOS 桌面虚拟化 |

## 3.2 ESXi

ESXi 是 VMware 的裸金属 Hypervisor，直接安装在物理服务器上。

### ESXi 架构

\`\`\`
┌─────────────────────────────────────────┐
│  VM 1    │  VM 2    │  VM 3    │  VM 4  │
├──────────┼──────────┼──────────┼────────┤
│  VMkernel（微内核 Hypervisor）           │
│  - CPU 调度  - 内存管理                  │
│  - I/O 栈    - 网络栈                    │
├─────────────────────────────────────────┤
│  物理硬件                                │
└─────────────────────────────────────────┘
\`\`\`

### ESXi 安装要求

| 要求 | 最低 | 推荐 |
|------|------|------|
| CPU | 2 核，支持 VT-x | 4 核+ |
| 内存 | 4 GB | 16 GB+ |
| 磁盘 | 8 GB | 32 GB+（SSD） |
| 网卡 | 1 Gbps | 10 Gbps |

### ESXi 常用管理操作

\`\`\`bash
# ESXi Shell 命令（通过 SSH 或直接控制台）

# 查看主机信息
esxcli system version get          # 版本信息
esxcli hardware cpu list           # CPU 信息
esxcli hardware memory get         # 内存信息

# 虚拟机管理
vim-cmd vmsvc/getallvms            # 列出所有虚拟机
vim-cmd vmsvc/power.on <vmid>      # 开机
vim-cmd vmsvc/power.off <vmid>     # 关机
vim-cmd vmsvc/power.reboot <vmid>  # 重启
vim-cmd vmsvc/snapshot.create <vmid> <name>  # 创建快照

# 网络管理
esxcli network ip interface list   # 查看网络接口
esxcli network ip connection list  # 查看网络连接

# 存储管理
esxcli storage filesystem list     # 查看存储
esxcli storage core device list    # 查看存储设备
\`\`\`

## 3.3 vCenter Server

vCenter 是 VMware 虚拟化的集中管理平台。

### vCenter 核心功能

| 功能 | 说明 |
|------|------|
| 集中管理 | 统一管理多台 ESXi 主机 |
| vMotion | 虚拟机在线迁移（无停机） |
| Storage vMotion | 虚拟机存储在线迁移 |
| DRS | 动态资源调度（自动负载均衡） |
| HA | 高可用（主机故障自动重启 VM） |
| FT | 容错（主备 VM 实时同步） |
| 模板 | 从虚拟机创建模板，快速部署 |

### vCenter 层级结构

\`\`\`
vCenter
├── 数据中心 (Data Center)
│   ├── 集群 (Cluster)
│   │   ├── ESXi 主机 1
│   │   │   ├── 虚拟机 A
│   │   │   └── 虚拟机 B
│   │   ├── ESXi 主机 2
│   │   └── ESXi 主机 3
│   └── 资源池 (Resource Pool)
│       ├── 生产环境池
│       └── 测试环境池
├── 数据存储 (Datastore)
│   ├── 存储 A (NFS/iSCSI/FC)
│   └── 存储 B
└── 网络 (Network)
    ├── 虚拟交换机 (vSwitch)
    └── 分布式交换机 (VDS)
\`\`\`

## 3.4 虚拟机管理

### 创建虚拟机

\`\`\`
1. 登录 vSphere Client
2. 右键点击主机或集群 → 新建虚拟机
3. 选择创建类型：
   - 创建新虚拟机
   - 从模板部署（推荐）
4. 配置：
   - 名称和位置
   - 计算资源（ESXi 主机/集群）
   - 存储（Datastore）
   - 兼容性（ESXi 版本）
   - 操作系统类型
   - 硬件配置（CPU/内存/磁盘/网络）
5. 完成创建
\`\`\`

### 虚拟机硬件配置

| 组件 | 说明 | 建议 |
|------|------|------|
| vCPU | 虚拟 CPU 核心数 | 按需分配，不要过度分配 |
| 内存 | 虚拟机内存 | 预留 50-100% 保证性能 |
| 磁盘 | 虚拟磁盘 | Thin（按需）/ Thick（预分配） |
| 网卡 | 虚拟网卡 | VMXNET3（高性能）/ E1000（兼容） |
| SCSI 控制器 | 磁盘控制器 | PVSCSI（高性能）/ LSI Logic |

### 磁盘置备类型

| 类型 | 说明 | 空间占用 | 性能 |
|------|------|----------|------|
| Thin Provision | 按需分配，初始占用小 | 小 | 一般 |
| Thick Lazy Zero | 预分配，首次写入时清零 | 大 | 较好 |
| Thick Eager Zero | 预分配，创建时全部清零 | 大 | 最好 |

### 快照管理

\`\`\`
注意事项：
1. 快照不是备份！
2. 不要长期保留快照（影响性能）
3. 快照链越长，性能越差
4. 快照占用存储空间会增长
5. 建议快照保留不超过 72 小时

操作：
1. 右键虚拟机 → 快照 → 拍摄快照
2. 快照管理器：查看/恢复/删除快照
3. 合并快照：删除快照时自动合并到父快照
\`\`\`

## 3.5 资源池

资源池用于对集群资源进行逻辑划分和分配。

\`\`\`
集群总资源：32 vCPU, 128 GB RAM
├── 生产资源池（预留 80%）
│   ├── CPU 预留：24 GHz
│   ├── 内存预留：96 GB
│   └── 虚拟机：DB, App, Web
└── 测试资源池（预留 20%）
    ├── CPU 预留：6 GHz
    ├── 内存预留：24 GB
    └── 虚拟机：Dev, QA
\`\`\`

### 资源分配参数

| 参数 | 说明 |
|------|------|
| Reservation（预留） | 保证分配的最小资源量 |
| Limit（上限） | 可使用的最大资源量 |
| Shares（份额） | 竞争资源时的分配比例 |

\`\`\`
场景：3 个虚拟机竞争 CPU
- VM1: Shares = High (2000)
- VM2: Shares = Normal (1000)
- VM3: Shares = Low (500)

竞争时分配比例：VM1:VM2:VM3 = 4:2:1
\`\`\`

## 3.6 vMotion 与 DRS

### vMotion（在线迁移）

\`\`\`
vMotion 流程：
1. 在目标主机创建 VM 副本（内存结构）
2. 源主机将内存页面复制到目标主机
3. 源主机继续运行，记录修改的内存页
4. 增量复制修改的内存页
5. 短暂暂停（毫秒级），切换到目标主机
6. 目标主机继续运行 VM

条件：
- 共享存储
- 源和目标主机兼容
- 网络带宽充足（建议 10Gbps）
- VM 磁盘在共享存储上
\`\`\`

### DRS（动态资源调度）

\`\`\`
DRS 自动化级别：
- Manual：只给建议，不自动迁移
- Partially Automated：自动放置新 VM，只给迁移建议
- Fully Automated：自动放置和迁移

DRS 规则：
- Affinity Rule：VM 必须在同一主机（如 App + DB）
- Anti-Affinity Rule：VM 必须在不同主机（如两个 Web 节点）
\`\`\`

## 3.7 VMware 常用运维操作

\`\`\`bash
# 通过 PowerCLI 管理（Windows PowerShell）
# 安装 PowerCLI
Install-Module VMware.PowerCLI

# 连接 vCenter
Connect-VIServer vcenter.example.com -User admin -Password xxx

# 常用操作
Get-VM                              # 列出所有虚拟机
Get-VM -Name "web*"                 # 按名称筛选
Start-VM -Name "web01"              # 启动虚拟机
Stop-VM -Name "web01"               # 关闭虚拟机
Restart-VM -Name "web01"            # 重启虚拟机

# 快照操作
New-Snapshot -VM "web01" -Name "pre-update"   # 创建快照
Get-Snapshot -VM "web01"                       # 查看快照
Set-VM -VM "web01" -Snapshot "pre-update"      # 恢复快照

# 迁移
Move-VM -VM "web01" -Destination "esxi02"      # vMotion

# 信息查看
Get-VMHost                           # 列出所有主机
Get-Datastore                        # 列出所有存储
Get-Cluster                          # 列出所有集群
\`\`\`