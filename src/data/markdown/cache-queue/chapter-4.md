## 5.1 缓存穿透

### 问题描述

客户端查询一个**根本不存在**的数据（数据库中也没有），缓存不会命中，每次请求都穿透到数据库。

\`\`\`
客户端 → 缓存（无）→ 数据库（无）
大量恶意/无效请求穿透缓存直击数据库
\`\`\`

### 解决方案

**方案一：布隆过滤器（Bloom Filter）**

\`\`\`bash
# Redis 4.0+ 支持布隆过滤器模块
# 使用 RedisBloom 模块
BF.ADD users:bloom "user:999999"
BF.EXISTS users:bloom "user:999999"    # 返回 1（可能存在）
BF.EXISTS users:bloom "user:nonexist"  # 返回 0（一定不存在）

# 使用客户端本地布隆过滤器
\`\`\`

**方案二：缓存空值**

\`\`\`python
def get_user(user_id):
    cache_key = f"user:{user_id}"
    user = redis.get(cache_key)

    if user == "NULL":  # 空值标记
        return None

    if user is not None:
        return json.loads(user)

    user = db.query(user_id)

    if user is None:
        # 缓存空值，设置较短的过期时间（防止占用内存）
        redis.setex(cache_key, 60, "NULL")
    else:
        redis.setex(cache_key, 3600, json.dumps(user))

    return user
\`\`\`

## 5.2 缓存击穿

### 问题描述

一个**热点 Key** 在过期瞬间，大量并发请求同时查询数据库。

\`\`\`
时刻：   ────[Key 存在]────[过期]────[DB 查询完成]──→
请求：        命中缓存      大量请求直接打 DB
\`\`\`

### 解决方案

**方案一：互斥锁（Mutex Lock）**

\`\`\`python
import redis
import time

def get_with_mutex(key):
    value = redis.get(key)
    if value is not None:
        return value

    # 尝试获取锁
    lock_key = f"lock:{key}"
    if redis.set(lock_key, "1", nx=True, ex=10):  # 10 秒过期防死锁
        try:
            # 双重检查（其他线程可能已经重建了缓存）
            value = redis.get(key)
            if value is not None:
                return value

            value = db.query(key)
            redis.setex(key, 3600, value)
            return value
        finally:
            redis.delete(lock_key)
    else:
        # 没获取到锁，等待一小段时间后重试
        time.sleep(0.1)
        return get_with_mutex(key)  # 重试
\`\`\`

**方案二：永不过期 + 异步更新**

\`\`\`python
# 对热点 Key 不设置过期时间，而是异步更新
# 在 value 中存储逻辑过期时间

def get_hot_data(key):
    data = redis.get(key)
    if data is None:
        return load_from_db_and_cache(key)

    # 检查逻辑过期
    if data["expire_at"] < time.time():
        # 异步刷新（不阻塞当前请求）
        thread_pool.submit(refresh_cache, key)
        # 仍返回旧数据

    return data["value"]
\`\`\`

## 5.3 缓存雪崩

### 问题描述

**大量 Key 在同一时间过期**，或 Redis 服务宕机，导致所有请求直接打到数据库。

\`\`\`
原因 1：大量 Key 同时过期（如统一设置凌晨 12 点过期）
原因 2：Redis 集群宕机
\`\`\`

### 解决方案

**方案一：过期时间加随机值**

\`\`\`python
import random

def set_with_random_expire(key, value, base_ttl=3600):
    ttl = base_ttl + random.randint(0, 600)  # 加 0~10 分钟随机值
    redis.setex(key, ttl, value)
\`\`\`

**方案二：多级缓存**

\`\`\`
客户端 → 本地缓存 (Caffeine/Guava) → Redis Cache → Database
         第 1 层（纳秒级）        第 2 层（毫秒级）    第 3 层
\`\`\`

**方案三：限流降级**

当缓存不可用时，对数据库查询进行限流，返回降级数据或默认值。

\`\`\`python
def get_with_fallback(key):
    try:
        value = redis.get(key)
        if value is not None:
            return value

        # 限流
        if rate_limiter.allow():
            value = db.query(key)
            redis.setex(key, 3600, value)
            return value
        else:
            return get_fallback_value(key)  # 返回降级数据
    except redis.ConnectionError:
        return get_fallback_value(key)
\`\`\`

**方案四：Redis 高可用**

- 主从 + 哨兵：主库故障自动切换
- Redis Cluster：数据分片，部分节点故障不影响整体

## 5.4 三大问题对比总结

| 问题 | 原因 | 关键词 | 解决方案 |
|------|------|--------|----------|
| 缓存穿透 | 查询不存在的数据 | 不存在 | 布隆过滤器、缓存空值 |
| 缓存击穿 | 热点 Key 过期 | 热点+并发 | 互斥锁、永不过期 |
| 缓存雪崩 | 大量 Key 同时过期/Redis 宕机 | 大量+过期 | 随机 TTL、多级缓存、限流降级 |

## 5.5 缓存一致性

### 更新策略对比

| 策略 | 操作顺序 | 一致性 | 复杂度 |
|------|---------|--------|--------|
| Cache Aside | 先更新 DB，再删除缓存 | 最终一致性 | 低 |
| Read/Write Through | 缓存层负责同步 | 强一致性 | 中 |
| Write Behind | 先写缓存，异步写 DB | 最终一致性 | 高 |

### Cache Aside 模式（最常用）

\`\`\`python
def update_user(user):
    # 1. 先更新数据库
    db.update(user)
    # 2. 再删除缓存
    redis.delete(f"user:{user.id}")
    # 注意：不能先删除缓存再更新 DB（会产生不一致窗口）

def get_user(user_id):
    # 1. 先查缓存
    user = redis.get(f"user:{user_id}")
    if user:
        return user

    # 2. 缓存未命中，查数据库
    user = db.query(user_id)
    if user:
        # 3. 写入缓存
        redis.setex(f"user:{user_id}", 3600, user)
    return user
\`\`\`

### 延迟双删（应对高并发场景）

\`\`\`python
def update_user(user):
    # 1. 先删除缓存
    redis.delete(f"user:{user.id}")
    # 2. 更新数据库
    db.update(user)
    # 3. 延迟一段时间后再次删除
    time.sleep(0.5)   # 或使用消息队列延迟
    redis.delete(f"user:{user.id}")
\`\`\`