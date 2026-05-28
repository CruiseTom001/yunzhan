## 6.1 消息队列概述

消息队列（Message Queue）是分布式系统中的异步通信中间件，实现系统解耦、削峰填谷。

### 为什么需要消息队列

| 作用 | 说明 | 场景示例 |
|------|------|----------|
| 解耦 | 生产者和消费者不直接依赖 | 订单系统 → 消息队列 → 库存/物流/通知 |
| 削峰 | 缓冲瞬时高峰流量 | 秒杀：瞬时 10 万请求 → MQ → 后端按能力消费 |
| 异步 | 非核心操作异步处理 | 注册后发邮件（同步 200ms → 异步 10ms） |
| 广播 | 一条消息多个消费者 | 数据变更通知多个下游系统 |

### 主流消息队列对比

| 特性 | RabbitMQ | Kafka | RocketMQ | Redis (List/Stream) |
|------|----------|-------|----------|---------------------|
| 定位 | 企业级消息中间件 | 流处理平台 | 金融级消息中间件 | 轻量消息队列 |
| 吞吐量 | 万级 | 百万级 | 十万级 | 十万级 |
| 消息可靠 | 高（ACK 确认） | 高（副本机制） | 极高 | 一般 |
| 消息顺序 | 支持（单队列） | 支持（单分区） | 支持 | 支持 |
| 延迟 | 微秒级 | 毫秒级 | 毫秒级 | 微秒级 |
| 消息回溯 | 不支持 | 支持（时间/偏移量） | 支持 | 不支持 |
| 事务消息 | 不支持 | 支持（幂等） | 支持 | 不支持 |
| 适用场景 | 业务消息 | 日志/大数据 | 电商/金融 | 简单队列 |

## 6.2 RabbitMQ 基础概念

### 核心组件

\`\`\`
Producer → Exchange → [Binding] → Queue → Consumer
                     根据路由键
                     将消息投递到队列
\`\`\`

| 组件 | 说明 |
|------|------|
| Producer | 消息生产者 |
| Exchange | 交换机，接收消息并根据路由键转发到队列 |
| Queue | 消息队列，存储消息 |
| Consumer | 消息消费者 |
| Binding | 交换机和队列的绑定关系 |
| Routing Key | 路由键，交换机根据它决定投递到哪个队列 |
| Virtual Host | 虚拟主机，资源隔离的基本单位 |

### 交换机类型

| 类型 | 路由方式 | 场景 |
|------|---------|------|
| Direct | 精确匹配 Routing Key | 点对点消息 |
| Topic | 通配符匹配 Routing Key（* 匹配一个词，# 匹配零或多个词） | 灵活路由 |
| Fanout | 广播到所有绑定的队列（忽略 Routing Key） | 发布/订阅 |
| Headers | 根据消息 Header 匹配 | 复杂路由 |

### Direct Exchange 示例

\`\`\`
Exchange: order_exchange (type=direct)
  ├── Binding: Routing Key = "order.created" → order_queue
  └── Binding: Routing Key = "order.paid"    → payment_queue
\`\`\`

### Topic Exchange 示例

\`\`\`
Exchange: log_exchange (type=topic)
  ├── Binding: "error.*"     → error_queue      (匹配 error.db, error.api)
  ├── Binding: "*.critical"  → critical_queue   (匹配 db.critical, api.critical)
  └── Binding: "#.log"       → all_logs         (匹配 a.log, a.b.log)
\`\`\`

## 6.3 Kafka 基础概念

### 核心组件

| 组件 | 说明 |
|------|------|
| Broker | Kafka 服务器节点 |
| Topic | 消息类别，类似数据库的表 |
| Partition | 分区，Topic 的物理分片，实现并行和扩展 |
| Producer | 消息生产者 |
| Consumer | 消息消费者 |
| Consumer Group | 消费者组，组内分工消费，组间广播 |
| Offset | 消息在分区中的位置（偏移量） |
| Replica | 分区副本，保证高可用 |
| Leader | 每个分区的主副本，负责读写 |
| Follower | 跟随副本，从 Leader 同步数据 |

### Kafka 架构

\`\`\`
                    ┌─── Topic: orders ───┐
                    │                      │
    Producer ──→ Partition 0 [0][1][2][3] ←── Consumer A
              ──→ Partition 1 [0][1][2]    ←── Consumer B (Consumer Group 1)
              ──→ Partition 2 [0][1][2][3][4] ← Consumer C
                    │                      │
                    └──────────────────────┘
\`\`\`

### 关键设计点

1. **顺序保证**：同一分区内消息有序，跨分区无序
2. **持久化**：消息写入磁盘并复制，默认保留 7 天
3. **水平扩展**：增加分区和 Broker 即可扩展
4. **高性能**：顺序读写磁盘、零拷贝、批量发送

### Kafka vs RabbitMQ 选型

| 场景 | 推荐 |
|------|------|
| 业务消息、事务消息、路由复杂 | RabbitMQ |
| 日志收集、流处理、大数据管道 | Kafka |
| 金融级可靠性、顺序消息 | RocketMQ |
| 轻量级、简单队列、无额外依赖 | Redis List/Stream |

## 6.4 Redis Stream（Redis 5.0+）

Redis Stream 是 Redis 内置的轻量级消息队列，适合简单队列场景。

\`\`\`bash
# 添加消息
XADD mystream * field1 value1 field2 value2
# * 表示自动生成消息 ID

# 读取消息
XREAD COUNT 2 STREAMS mystream 0    # 从开头读
XREAD BLOCK 0 STREAMS mystream $     # 阻塞读取新消息

# 创建消费者组
XGROUP CREATE mystream mygroup $ MKSTREAM

# 消费者组读取
XREADGROUP GROUP mygroup consumer1 COUNT 1 BLOCK 5000 STREAMS mystream >

# 确认消息
XACK mystream mygroup <message-id>
\`\`\`

### Redis Stream vs Redis List 做队列

| 特性 | List + BLPOP | Stream |
|------|-------------|--------|
| 消息确认 | 不支持 | 支持 (XACK) |
| 消费者组 | 不支持 | 支持 |
| 消息回溯 | 不支持 | 支持 |
| 消息持久化 | 依赖 RDB/AOF | 依赖 RDB/AOF |
| 适用场景 | 简单队列 | 需要可靠消费的队列 |

## 6.5 消息队列常见问题

### 消息丢失

| 阶段 | 原因 | RabbitMQ 解决 | Kafka 解决 |
|------|------|-------------|-----------|
| 生产端 | 发送失败 | Publisher Confirm | acks=all |
| Broker | 宕机未持久 | 队列/消息持久化 | replication.factor > 1 |
| 消费端 | 自动 ACK | 手动 ACK | 手动提交 offset |

### 重复消费

消息队列无法保证完全不重复，需要**消费者实现幂等**：

\`\`\`python
# 幂等方案 1：数据库唯一约束
try:
    db.insert(order_id=msg.order_id, ...)
except DuplicateKeyError:
    pass    # 已处理，忽略

# 幂等方案 2：Redis 去重
if redis.setnx(f"consumed:{msg.id}", "1"):
    # 处理消息
    process(msg)
# 否则已处理，跳过
\`\`\`

### 消息堆积

| 原因 | 解决方案 |
|------|----------|
| 消费能力不足 | 增加消费者数量 |
| 消费逻辑慢 | 优化消费逻辑、异步处理 |
| 生产过快 | 限流生产者、增加分区/队列 |