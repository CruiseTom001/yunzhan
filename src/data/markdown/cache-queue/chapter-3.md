## 4.1 Redis Cluster 概述

Redis Cluster 是 Redis 官方的**分布式**解决方案，支持数据自动分片和部分可用性。

### 核心特性

- **自动分片**：数据分布到 16384 个哈希槽（Hash Slot），自动分配到不同节点
- **去中心化**：无代理层，客户端直连节点
- **故障转移**：节点故障时自动将从节点提升为主节点
- **可扩展性**：支持在线增删节点
- **最低配置**：至少 6 个节点（3 主 + 3 从）

### Cluster vs Sentinel

| 特性 | Sentinel | Cluster |
|------|----------|---------|
| 数据分片 | 不支持 | 支持（16384 槽） |
| 扩展方式 | 垂直扩展 | 水平扩展 |
| 写扩展 | 不能 | 可以（多主写入） |
| 复杂度 | 低 | 高 |
| 适用场景 | 单机/主从架构，数据量 < 机器内存 | 大数据量，需要水平扩展 |

## 4.2 Cluster 架构

\`\`\`
Slot 范围:    0-5460    5461-10922    10923-16383
               │          │             │
           ┌───┴───┐  ┌───┴───┐    ┌───┴───┐
           │Master1│  │Master2│    │Master3│     3 主节点
           └───┬───┘  └───┬───┘    └───┬───┘
               │          │             │
           ┌───┴───┐  ┌───┴───┐    ┌───┴───┐
           │Slave1 │  │Slave2 │    │Slave3 │     3 从节点（备副本）
           └───────┘  └───────┘    └───────┘
\`\`\`

### 哈希槽（Hash Slot）

- Redis Cluster 有 **16384** 个槽
- \`HASH_SLOT = CRC16(key) % 16384\`
- 每个主节点负责一部分槽

## 4.3 搭建 Cluster

### 配置每个节点

\`\`\`bash
# redis.conf（每个节点）
port 6379                                # 每个端口不同
cluster-enabled yes
cluster-config-file nodes-6379.conf      # 集群状态文件
cluster-node-timeout 15000               # 节点超时时间（毫秒）
appendonly yes
\`\`\`

### 启动并创建集群

\`\`\`bash
# 启动所有 6 个 Redis 实例
redis-server /path/to/conf/redis-7000.conf
redis-server /path/to/conf/redis-7001.conf
# ... 一直到 7005

# 创建集群（Redis 5.0+）
redis-cli --cluster create \\
  192.168.1.100:7000 192.168.1.100:7001 \\
  192.168.1.100:7002 192.168.1.100:7003 \\
  192.168.1.100:7004 192.168.1.100:7005 \\
  --cluster-replicas 1
# --cluster-replicas 1: 每个主节点有 1 个从节点
\`\`\`

### 集群管理命令

\`\`\`bash
# 查看集群状态
redis-cli -p 7000 CLUSTER INFO
redis-cli -p 7000 CLUSTER NODES

# 查看槽分配
redis-cli -p 7000 CLUSTER SLOTS

# 添加新节点
redis-cli --cluster add-node 192.168.1.106:7006 192.168.1.100:7000

# 添加从节点
redis-cli --cluster add-node 192.168.1.107:7007 192.168.1.100:7000 --cluster-slave

# 重新分片（迁移槽）
redis-cli --cluster reshard 192.168.1.100:7000

# 删除节点
redis-cli --cluster del-node 192.168.1.100:7000 <node-id>
\`\`\`

## 4.4 客户端连接集群

\`\`\`bash
# redis-cli 连接集群模式
redis-cli -c -h 192.168.1.100 -p 7000

# -c 参数启用集群模式，遇到 MOVED 重定向自动跳转
redis-cli -c -p 7000
> SET user:1 "Alice"
# → Redirected to slot [1044] located at 192.168.1.101:7001
# OK
\`\`\`

### 程序客户端连接

主流语言的 Redis 客户端都支持集群模式：

\`\`\`python
# Python (redis-py) 示例
from redis.cluster import RedisCluster

rc = RedisCluster(
    host="192.168.1.100",
    port=7000,
    decode_responses=True
)

rc.set("user:1", "Alice")
print(rc.get("user:1"))
\`\`\`

## 4.5 集群故障处理

### 节点故障

\`\`\`
主节点故障:
  1. 集群检测到主节点不可达（cluster-node-timeout）
  2. 对应的从节点自动提升为新的主节点
  3. slot 重新分配给新主节点

从节点故障:
  1. 主节点标记从节点为 FAIL
  2. 集群继续正常工作（主节点承担读写）
  3. 从节点恢复后重新加入集群
\`\`\`

### 集群的健康条件

- 所有 16384 个槽都有节点负责
- 每个主节点都有至少一个正常运行的从节点（可选）
- 集群中超过半数的主节点可达（有 quorum）

### 常见问题

| 问题 | 说明 | 解决 |
|------|------|------|
| CLUSTERDOWN | 集群未正常工作（槽未全部分配） | 检查 CLUSTER INFO |
| MOVED 重定向 | 数据在另一个节点 | 客户端自动处理 |
| ASK 重定向 | 槽正在迁移中 | 客户端自动处理 |
| 脑裂 | 网络分区导致多主 | 配置合理的 cluster-node-timeout |