## Elasticsearch 集群基础

Elasticsearch 是一个基于 Lucene 的分布式搜索引擎。

### 核心概念速览

| 概念 | 类比（RDBMS） |
|------|---------------|
| Index（索引） | Database |
| Document | Row |
| Field | Column |
| Mapping | Schema |
| Shard（分片） | 水平分表 |
| Replica（副本） | 从库 |

### 索引生命周期管理（ILM）

hot → warm → cold → delete，自动管理索引从创建到删除的全过程。

### 重要性能配置

- JVM 堆内存不超过物理内存的 50%，不超过 32GB
- bootstrap.memory_lock: true