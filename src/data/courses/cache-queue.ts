import type { Course } from '@/types'

export const course: Course = {
  id: 'cache-queue',
  title: '缓存与队列',
  description: 'Redis/Memcached 部署、持久化策略、哨兵集群与消息队列实战',
  icon: 'Zap',
  difficulty: 'intermediate',
  category: 'cache',
  chapters: [
    {
      index: 0,
      title: '第1章：Redis 核心数据结构',
      contentFile: 'cache-queue/chapter-0.md',
      content: '',
      keyConcepts: ['String', 'Hash', 'List', 'Set', 'Sorted Set', 'ZSet', 'SETNX', 'TTL', 'SCAN', '分布式锁', '排行榜', '消息队列']
    },
    {
      index: 1,
      title: '第2章：Redis 持久化',
      contentFile: 'cache-queue/chapter-1.md',
      content: '',
      keyConcepts: ['RDB', 'AOF', 'BGSAVE', 'BGREWRITEAOF', 'appendfsync', '混合持久化', 'fork', '写时复制', '数据恢复']
    },
    {
      index: 2,
      title: '第3章：Redis 主从复制与哨兵模式',
      contentFile: 'cache-queue/chapter-2.md',
      content: '',
      keyConcepts: ['主从复制', 'Sentinel', '哨兵', '故障转移', 'quorum', 'SLAVEOF', 'PSYNC', 'repl-backlog', 'down-after-milliseconds']
    },
    {
      index: 3,
      title: '第4章：Redis Cluster 集群',
      contentFile: 'cache-queue/chapter-3.md',
      content: '',
      keyConcepts: ['Cluster', '哈希槽', '16384', 'CRC16', 'CLUSTER NODES', 'MOVED重定向', 'reshard', '故障转移', '节点增删', '分片']
    },
    {
      index: 4,
      title: '第5章：缓存穿透/击穿/雪崩解决方案',
      contentFile: 'cache-queue/chapter-4.md',
      content: '',
      keyConcepts: ['缓存穿透', '缓存击穿', '缓存雪崩', '布隆过滤器', '互斥锁', '随机过期', '多级缓存', '限流降级', 'Cache Aside', '延迟双删', '缓存一致性']
    },
    {
      index: 5,
      title: '第6章：消息队列概念',
      contentFile: 'cache-queue/chapter-5.md',
      content: '',
      keyConcepts: ['消息队列', 'RabbitMQ', 'Kafka', 'Exchange', 'Topic', 'Partition', 'Consumer Group', 'Offset', 'Redis Stream', '消息丢失', '重复消费', '幂等', '消息堆积']
    }
  ],
  prerequisites: ['linux-basics'],
  estimatedHours: 14,
}
