## 存储管理（PV/PVC/StorageClass）

### 核心概念

| 资源 | 角色 | 类比 |
|------|------|------|
| PersistentVolume (PV) | 集群管理员提供的存储资源 | 物理磁盘 |
| PersistentVolumeClaim (PVC) | 用户对存储的请求 | 磁盘申请单 |
| StorageClass | 动态存储类型定义 | 磁盘类型模板 |

### Access Modes（访问模式）

| 模式 | 缩写 | 说明 |
|------|------|------|
| ReadWriteOnce | RWO | 单个节点读写 |
| ReadOnlyMany | ROX | 多节点只读 |
| ReadWriteMany | RWX | 多节点读写 |
| ReadWriteOncePod | RWOP | 单 Pod 读写（K8s 1.22+） |

### StatefulSet 与持久化存储

StatefulSet 的每个 Pod 会获得独立的 PVC。

### 存储扩容与快照

支持在线扩容和基于 CSI 的快照恢复。