## 2.1 持久化概述

Redis 提供两种持久化方式：

| 方式 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| RDB | 定期内存快照 | 恢复快、文件小、对性能影响小 | 可能丢失最近数据 |
| AOF | 追加写命令日志 | 数据安全性高（最多丢 1 秒） | 文件大、恢复慢、写性能略降 |

**生产环境推荐**：RDB + AOF 混合使用。

## 2.2 RDB（Redis Database）快照

### 触发快照的方式

\`\`\`bash
# 自动触发（在 N 秒内至少有 M 个 key 变更）
# redis.conf
save 900 1       # 15 分钟内有 1 个 key 变更
save 300 10      # 5 分钟内有 10 个 key 变更
save 60 10000    # 1 分钟内有 10000 个 key 变更

# 手动触发
SAVE             # 同步保存，阻塞所有客户端（不推荐）
BGSAVE           # 后台异步保存，fork 子进程执行（推荐）
LASTSAVE         # 查看上次保存时间
\`\`\`

### RDB 配置

\`\`\`bash
# redis.conf
dbfilename dump.rdb          # 文件名
dir /var/lib/redis           # 文件路径
stop-writes-on-bgsave-error yes  # 快照失败时停止写入（推荐 yes）
rdbcompression yes           # 压缩（推荐 yes，CPU 换磁盘空间）
rdbchecksum yes              # CRC64 校验（推荐 yes）
\`\`\`

### RDB 的优缺点

**优点**：
- 文件紧凑，适合备份和灾难恢复
- 恢复大数据集比 AOF 快
- fork 子进程进行 I/O，不影响主进程

**缺点**：
- 系统故障时可能丢失最后一次快照后的数据
- fork 时内存翻倍（写时复制，大内存实例可能卡顿）

## 2.3 AOF（Append Only File）日志

### 写入策略

\`\`\`bash
# redis.conf
appendonly yes               # 开启 AOF
appendfilename "appendonly.aof"

# fsync 策略
appendfsync everysec         # 每秒刷盘（推荐，最多丢 1 秒数据）
# appendfsync always         # 每次写入都刷盘（最安全但最慢）
# appendfsync no             # 由操作系统决定刷盘时机
\`\`\`

### AOF 重写

AOF 文件会随时间增长，需要定期压缩（重写）。

\`\`\`bash
# 自动触发条件
auto-aof-rewrite-percentage 100    # 比上次重写增长 100%
auto-aof-rewrite-min-size 64mb     # 最小 64MB 才触发

# 手动触发
BGREWRITEAOF    # 后台重写（推荐）
\`\`\`

### AOF 的优缺点

**优点**：
- 最多丢失 1 秒数据（everysec 策略）
- AOF 文件可读（文本格式）
- 自动重写防止文件无限增长

**缺点**：
- AOF 文件通常比 RDB 大
- 恢复速度比 RDB 慢
- everysec 策略下可能有约 1 秒的数据丢失窗口

## 2.4 RDB + AOF 混合持久化（Redis 4.0+）

混合持久化结合两者优点：重写时先写 RDB 格式的快照，再追加增量的 AOF。

\`\`\`bash
# redis.conf
aof-use-rdb-preamble yes    # 开启混合持久化
\`\`\`

**混合文件结构**：
\`\`\`
[RDB 快照数据][AOF 增量命令]...[AOF 增量命令]
\`\`\`

恢复时先加载 RDB 部分（快），再重放 AOF 部分（少）。

## 2.5 备份与恢复实战

### 备份策略

\`\`\`bash
# 备份 RDB 文件
cp /var/lib/redis/dump.rdb /backup/redis/dump_$(date +%Y%m%d).rdb

# 备份 AOF 文件
cp /var/lib/redis/appendonly.aof /backup/redis/aof_$(date +%Y%m%d).aof

# 自动备份脚本
#!/bin/bash
BACKUP_DIR="/backup/redis"
mkdir -p "$BACKUP_DIR"

# 触发 BGSAVE
redis-cli BGSAVE

# 等待 BGSAVE 完成
while [ $(redis-cli info persistence | grep rdb_bgsave_in_progress | cut -d: -f2) -eq 1 ]; do
    sleep 1
done

# 复制文件
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/dump_$(date +%Y%m%d_%H%M%S).rdb"

# 清理旧备份（保留 7 天）
find "$BACKUP_DIR" -name "dump_*.rdb" -mtime +7 -delete
\`\`\`

### 数据恢复

\`\`\`bash
# 1. 停止 Redis
sudo systemctl stop redis

# 2. 替换数据文件
cp /backup/redis/dump_20240101.rdb /var/lib/redis/dump.rdb
# 如果同时使用 AOF，也需恢复
cp /backup/redis/aof_20240101.aof /var/lib/redis/appendonly.aof

# 3. 修改权限
chown redis:redis /var/lib/redis/dump.rdb
chmod 640 /var/lib/redis/dump.rdb

# 4. 启动 Redis
sudo systemctl start redis

# 5. 验证
redis-cli PING
redis-cli DBSIZE
\`\`\`

## 2.6 持久化性能监控

\`\`\`bash
# 查看持久化状态
redis-cli INFO persistence

# 关键指标：
# rdb_last_bgsave_status: ok        RDB 上次保存状态
# rdb_last_bgsave_time_sec: 5       RDB 上次保存耗时
# aof_last_write_status: ok         AOF 上次写入状态
# aof_last_rewrite_time_sec: 2      AOF 上次重写耗时
# aof_current_size: 1234567         AOF 当前大小
# aof_base_size: 987654             AOF 基础大小
\`\`\`