## 3.1 Redis 主从复制

### 复制原理

\`\`\`
Master (主)                     Slave (从)
    │                              │
    │←──────── PSYNC ──────────────│  1. 从库发起同步请求
    │                              │
    │─── BGSAVE → RDB 文件 ──────→│  2. 主库后台生成 RDB 传给从库
    │                              │
    │─── 增量命令缓冲 ───────────→│  3. 主库将 RDB 期间的写入也发给从库
    │                              │
    │────── 持续同步命令 ─────────→│  4. 进入命令传播阶段
\`\`\`

### 主库配置

\`\`\`bash
# redis.conf (Master)
bind 0.0.0.0
port 6379
requirepass master_password
masterauth master_password     # 主库也需要此配置（故障切换后成为从库时使用）
\`\`\`

### 从库配置

\`\`\`bash
# redis.conf (Slave)
bind 0.0.0.0
port 6380
replicaof 192.168.1.100 6379     # 指定主库地址和端口
masterauth master_password        # 主库密码
replica-read-only yes             # 从库只读（推荐）
replica-serve-stale-data yes      # 与主库断连时是否继续提供服务
\`\`\`

### 查看复制状态

\`\`\`bash
# 在主库或从库执行
redis-cli -p 6379 INFO replication

# 主库输出关键信息：
# role:master
# connected_slaves:2
# slave0:ip=192.168.1.101,port=6380,state=online,offset=123456,lag=0

# 从库输出关键信息：
# role:slave
# master_host:192.168.1.100
# master_port:6379
# master_link_status:up           # 复制连接状态
# slave_repl_offset:123456        # 复制偏移量
\`\`\`

### 常见复制问题

| 问题 | 原因 | 解决 |
|------|------|------|
| master_link_status:down | 网络不通或认证失败 | 检查网络、密码、防火墙 |
| 复制偏移量差距大 | 从库性能不足或网络差 | 优化硬件、提升网络 |
| 全量同步频繁 | 复制积压缓冲不足 | 增大 repl-backlog-size |
| 从库数据不一致 | 从库被写入 | 设置 replica-read-only yes |

## 3.2 哨兵模式（Sentinel）

哨兵是一个**独立的进程**，用于监控 Redis 实例，实现自动故障转移。

### 哨兵核心功能

1. **监控（Monitoring）**：持续检查主库和从库是否正常运行
2. **通知（Notification）**：当实例出问题时通过 API 通知管理员
3. **自动故障转移（Automatic Failover）**：主库故障时自动提升从库为新主库
4. **配置提供者（Configuration Provider）**：客户端可以从哨兵获取当前主库地址

### 哨兵架构

\`\`\`
┌──────┐  ┌──────┐  ┌──────┐
│Sentinel│  │Sentinel│  │Sentinel│    至少 3 个（形成仲裁）
│   1   │  │   2   │  │   3   │
└──┬───┘  └──┬───┘  └──┬───┘
   │         │         │
   └─────────┼─────────┘
             │ 监控
   ┌─────────┴─────────┐
   │     Redis Master  │
   └─────────┬─────────┘
      ┌──────┴──────┐
      │             │
  ┌───┴───┐    ┌───┴───┐
  │ Slave │    │ Slave │
  └───────┘    └───────┘
\`\`\`

### 哨兵配置 sentinel.conf

\`\`\`bash
# 基础配置
sentinel monitor mymaster 192.168.1.100 6379 2
# mymaster: 主库别名
# 192.168.1.100 6379: 主库地址
# 2: 至少有 2 个哨兵同意才判定主库故障（法定人数）

sentinel auth-pass mymaster master_password
sentinel down-after-milliseconds mymaster 30000    # 30 秒无响应判为下线
sentinel parallel-syncs mymaster 1                 # 故障转移时最多 1 个从库同时同步
sentinel failover-timeout mymaster 180000          # 故障转移超时时间（3 分钟）

# 哨兵自身配置
port 26379
dir /var/lib/redis/sentinel
logfile /var/log/redis/sentinel.log
\`\`\`

### 启动哨兵

\`\`\`bash
# 方式 1：redis-sentinel 命令
redis-sentinel /etc/redis/sentinel.conf

# 方式 2：redis-server 加参数
redis-server /etc/redis/sentinel.conf --sentinel

# 方式 3：systemd 服务
sudo systemctl start redis-sentinel
\`\`\`

### 哨兵操作命令

\`\`\`bash
# 连接哨兵
redis-cli -p 26379

# 查看主库信息
SENTINEL master mymaster

# 查看所有从库
SENTINEL slaves mymaster

# 查看所有哨兵
SENTINEL sentinels mymaster

# 获取主库地址
SENTINEL get-master-addr-by-name mymaster

# 手动故障转移
SENTINEL failover mymaster

# 监控哨兵事件
SENTINEL SUBSCRIBE +switch-master
\`\`\`

### 哨兵故障转移流程

\`\`\`
1. 哨兵发现主库不可达（down-after-milliseconds）
2. 哨兵间达成共识（投票，超过 quorum 数量）
3. 选出一个哨兵作为 leader 执行故障转移
4. leader 从在线从库中选择一个最优从库
   选择依据：复制偏移量最大 > 优先级高 > Run ID 小
5. 新主库 SLAVEOF NO ONE（升级为主库）
6. 其他从库 SLAVEOF 新主库
7. 通知客户端主库地址变化（通过 Pub/Sub 或 CONFIG REWRITE）
\`\`\`