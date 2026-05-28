## 1.1 Redis 简介

Redis（Remote Dictionary Server）是一个高性能的**内存**键值存储，支持多种数据结构。

### 核心特性

- **内存存储**：所有数据在内存中，读写极快（10万+ QPS）
- **持久化**：支持 RDB 快照和 AOF 日志两种持久化方式
- **丰富的数据结构**：String、Hash、List、Set、Sorted Set、Stream、Bitmap、HyperLogLog、Geo
- **原子操作**：所有命令都是原子的
- **发布/订阅**：内置 Pub/Sub 机制
- **Lua 脚本**：支持 Lua 脚本实现复杂操作
- **过期策略**：可以为每个 Key 设置过期时间

### 安装 Redis

\`\`\`bash
# Ubuntu/Debian
sudo apt update
sudo apt install redis-server

# CentOS/RHEL
sudo yum install epel-release
sudo yum install redis

# Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine

# 编译安装（最新版本）
wget https://download.redis.io/redis-stable.tar.gz
tar -xzf redis-stable.tar.gz
cd redis-stable
make && sudo make install
\`\`\`

### 连接到 Redis

\`\`\`bash
# 本地连接
redis-cli

# 远程连接
redis-cli -h 192.168.1.100 -p 6379 -a password

# 交互模式下测试
redis-cli
> PING          # 返回 PONG 表示正常
> SET key value
> GET key
\`\`\`

## 1.2 String（字符串）—— 最基础的类型

\`\`\`bash
# 基本操作
SET user:1:name "Alice"
SET user:1:age 25
GET user:1:name                # "Alice"

# 带过期时间（秒）
SETEX session:abc123 3600 "user_id=1"
SET token:xyz token_value EX 7200

# 仅在 key 不存在时设置（分布式锁的基础）
SETNX lock:order:123 "locked"
SET lock:order:123 "locked" NX EX 30

# 自增/自减
INCR counter:views             # 1 → 2 → 3 ...（原子递增）
INCRBY counter:score 10        # 增加 10
DECR counter:views
DECRBY counter:score 5

# 批量操作
MSET user:1:name "Alice" user:1:age 25 user:1:email "a@b.com"
MGET user:1:name user:1:age user:1:email

# 追加和长度
APPEND greetings ", World!"    # 追加内容
STRLEN mykey                   # 获取长度

# GETSET：先 GET 旧值，再 SET 新值
GETSET counter:total 0
\`\`\`

### String 使用场景

| 场景 | 示例 |
|------|------|
| 缓存对象 | 将 JSON 序列化为字符串缓存 |
| 计数器 | 文章阅读量、点赞数 |
| 分布式锁 | SETNX + EX 实现 |
| Session 存储 | Web 应用的 Session 管理 |
| 限流 | INCR + EXPIRE 实现简单计数器限流 |

## 1.3 Hash（哈希）—— 存储对象

Hash 类似 Java 的 HashMap，适合存储对象属性。

\`\`\`bash
# 设置字段
HSET user:1 name "Alice" age 25 email "a@b.com"

# 获取
HGET user:1 name               # "Alice"
HGETALL user:1                 # 获取所有字段和值
HMGET user:1 name email        # 获取多个字段

# 检查字段是否存在
HEXISTS user:1 name            # 1（存在）/ 0（不存在）
HKEYS user:1                   # 所有字段名
HVALS user:1                   # 所有值
HLEN user:1                    # 字段数量

# 自增
HINCRBY user:1 age 1           # 年龄 +1

# 删除字段
HDEL user:1 email
\`\`\`

### Hash vs String 存储对象

| 方式 | 优点 | 缺点 |
|------|------|------|
| String (JSON) | 简单，一次性读写 | 更新部分字段需反序列化整个对象 |
| Hash | 按字段读写，节省内存（ziplist 编码时） | 不能设置字段级别的过期时间 |

**建议**：对象属性经常独立更新的选 Hash；对象整体读写的选 String。

## 1.4 List（列表）—— 有序可重复

List 是一个**双向链表**，两端操作都是 O(1)。

\`\`\`bash
# 左侧操作
LPUSH queue:tasks "task1" "task2"   # 从左侧插入
LPOP queue:tasks                     # 从左侧弹出
LLEN queue:tasks                     # 列表长度

# 右侧操作
RPUSH notifications "msg1"
RPOP notifications

# 范围查询
LRANGE queue:tasks 0 -1               # 获取全部
LRANGE queue:tasks 0 9                # 前 10 个
LINDEX queue:tasks 0                  # 获取指定位置

# 阻塞弹出（消息队列核心命令）
BLPOP queue:tasks 30                  # 阻塞 30 秒等待元素
BRPOP queue:tasks 0                   # 永久阻塞等待

# 修剪（保留指定范围）
LTRIM recent:log 0 99                 # 只保留前 100 条
\`\`\`

### List 使用场景

| 场景 | 命令组合 |
|------|----------|
| 消息队列 | LPUSH + BRPOP |
| 最新消息列表 | LPUSH + LTRIM |
| 时间线 | LPUSH + LRANGE |
| 任务队列 | RPUSH + BLPOP |

## 1.5 Set（集合）—— 无序不重复

\`\`\`bash
# 添加/删除
SADD tags:article:1 redis database cache
SREM tags:article:1 cache

# 查询
SMEMBERS tags:article:1          # 所有成员
SISMEMBER tags:article:1 redis   # 是否成员
SCARD tags:article:1             # 数量
SRANDMEMBER tags:article:1 2     # 随机获取 2 个

# 集合运算
SADD set1 a b c d
SADD set2 c d e f
SINTER set1 set2                 # 交集：c d
SUNION set1 set2                 # 并集：a b c d e f
SDIFF set1 set2                  # 差集（set1 有而 set2 没有）：a b
SINTERSTORE dest set1 set2       # 交集体存到 dest
\`\`\`

### Set 使用场景

| 场景 | 命令 |
|------|------|
| 标签系统 | SADD + SMEMBERS |
| 共同好友 | SINTER friends:alice friends:bob |
| 好友推荐 | SDIFF（对方的减去自己的） |
| 抽奖系统 | SRANDMEMBER / SPOP |
| UV 统计 | SADD page:uv 192.168.1.1 |

## 1.6 Sorted Set（有序集合）—— 排序不重复

ZSet 的每个成员都关联一个 **Score**（分值），按 Score 排序。

\`\`\`bash
# 添加
ZADD leaderboard 100 "Alice" 85 "Bob" 92 "Charlie"

# 查询（按 Score 升序）
ZRANGE leaderboard 0 -1                 # 所有成员
ZRANGE leaderboard 0 -1 WITHSCORES      # 带分值
ZREVRANGE leaderboard 0 -1 WITHSCORES   # 降序（排行榜）

# 按 Score 范围查询
ZRANGEBYSCORE leaderboard 80 100
ZRANGEBYSCORE leaderboard 80 100 WITHSCORES LIMIT 0 10

# 获取排名
ZRANK leaderboard "Alice"               # 排名（从 0 开始，升序）
ZREVRANK leaderboard "Alice"            # 降序排名

# 获取分值
ZSCORE leaderboard "Alice"              # 100

# 增减分值
ZINCRBY leaderboard 5 "Alice"           # Alice 加 5 分

# 统计数量
ZCARD leaderboard                       # 总成员数
ZCOUNT leaderboard 90 100               # 分值在 90-100 的成员数

# 删除
ZREM leaderboard "Bob"
ZREMRANGEBYRANK leaderboard 0 10        # 移除排名最低的 10 个
ZREMRANGEBYSCORE leaderboard 0 60       # 移除 60 分以下的
\`\`\`

### ZSet 使用场景

| 场景 | 说明 |
|------|------|
| 排行榜 | 游戏积分、文章热度、商品销量 |
| 延时队列 | Score 设为处理时间，定时获取到期任务 |
| 带权重的消息队列 | Score 为优先级 |
| 滑动窗口限流 | Score 为时间戳，ZREMRANGEBYSCORE 清理过期记录 |

## 1.7 通用 Key 操作

\`\`\`bash
# 查看 Key
KEYS user:*                     # 匹配模式（生产环境慎用！）
SCAN 0 MATCH user:* COUNT 100   # 游标迭代（生产环境推荐）

# 类型和存在
TYPE mykey                      # 数据类型
EXISTS mykey                    # 是否存在
TTL mykey                       # 剩余过期时间（秒），-1=永不过期，-2=不存在
EXPIRE mykey 3600               # 设置过期时间
PERSIST mykey                   # 移除过期时间

# 重命名
RENAME oldkey newkey
RENAMENX oldkey newkey          # 仅当 newkey 不存在时

# 删除
DEL key1 key2 key3              # 删除多个 Key
UNLINK key1 key2                # 异步删除（大 Key 推荐）

# 序列化/反序列化
DUMP mykey                      # 序列化
RESTORE newkey 0 <dump_value>   # 反序列化
\`\`\`