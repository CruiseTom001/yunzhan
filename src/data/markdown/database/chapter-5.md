## 6.1 高可用方案总览

| 方案 | 复杂度 | 故障切换 | 数据一致性 | 适用场景 |
|------|--------|---------|-----------|----------|
| 主从 + 手动切换 | 低 | 手动 | 可能少量丢失 | 小型业务 |
| MHA | 中 | 自动 (秒级) | 可能少量丢失 | 中型业务 |
| MGR (Group Replication) | 高 | 自动 | 强一致 | 关键业务 |
| MySQL InnoDB Cluster | 高 | 自动 | 强一致 | 企业级 |
| Orchestrator + 半同步 | 中高 | 自动 | 极少丢失 | 中型到大型业务 |
| ProxySQL/MySQL Router + 主从 | 中 | 应用层切换 | 可能少量丢失 | 读写分离 |

## 6.2 MHA（Master High Availability）

MHA 是经典的 MySQL 高可用方案，监控主库并在故障时自动切换。

### 架构

\`\`\`
┌─────────────┐
│    MHA      │  Manager 节点监控主库
│   Manager   │
└──────┬──────┘
       │ 监控
  ┌────┴────┐
  │ Master  │ ←─── 故障
  │ (当前主) │
  └────┬────┘
       │ 异步复制
  ┌────┴────┬────────────┐
  │ Slave1  │  Slave2    │  候选主库
  │ (候选)  │  (候选)    │
  └─────────┴────────────┘
\`\`\`

### MHA 切换流程

1. MHA Manager 检测到主库不可达（连续 N 次 ping 失败）
2. 确认主库确实宕机（通过 SSH 检查）
3. 选出一个从库作为新主库（选择数据最新的从库）
4. 从其他从库补齐差异 relay log
5. 提升新主库，其他从库切换复制到新主库
6. 通过 VIP 或 DNS 切换应用连接

### 关键配置

\`\`\`ini
# /etc/mha/app1.cnf
[server default]
user=mha
password=mha_password
ssh_user=root
repl_user=repl
repl_password=repl_password
manager_workdir=/var/log/masterha/app1
manager_log=/var/log/masterha/app1/manager.log
ping_interval=1

[server1]
hostname=192.168.1.101
candidate_master=1

[server2]
hostname=192.168.1.102
candidate_master=1

[server3]
hostname=192.168.1.103
no_master=1          # 不参与主库选举
\`\`\`

## 6.3 MySQL Group Replication（MGR）

MGR 是 MySQL 官方的**多主**复制方案，基于 Paxos 协议。

### 特点

- **多主写入**：任意节点都可写入
- **自动故障检测和恢复**：节点宕机自动踢出
- **强一致性**：基于 Paxos 协议
- **冲突检测**：自动检测写冲突

### 配置要点

\`\`\`ini
[mysqld]
# 组复制配置
plugin_load_add='group_replication.so'
group_replication_group_name="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
group_replication_start_on_boot=off
group_replication_local_address="192.168.1.101:33061"
group_replication_group_seeds="192.168.1.101:33061,192.168.1.102:33061,192.168.1.103:33061"
group_replication_bootstrap_group=off

# 单主模式（推荐）
group_replication_single_primary_mode=ON
group_replication_enforce_update_everywhere_checks=OFF
\`\`\`

## 6.4 读写分离

### ProxySQL 方案

ProxySQL 是一个高性能的 MySQL 代理，位于应用和数据库之间。

\`\`\`
Application
    │
    ▼
┌──────────┐
│ ProxySQL │  ──→ 读请求 → Slave1, Slave2
│  (中间件) │  ──→ 写请求 → Master
└──────────┘
\`\`\`

### 关键概念

| 概念 | 说明 |
|------|------|
| mysql_servers | 后端 MySQL 服务器列表 |
| mysql_replication_hostgroups | 读写组配置 |
| mysql_query_rules | 基于 SQL 的路由规则 |

### 基础的 SQL 路由规则

\`\`\`sql
-- 将 SELECT 语句路由到读组
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup, apply)
VALUES (1, 1, '^SELECT.*', 1, 1);

-- 其他路由到写组
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup, apply)
VALUES (2, 1, '^.*', 0, 0);
\`\`\`

### MySQL Router（官方方案）

\`\`\`bash
# 安装 MySQL Router
sudo apt install mysql-router

# 初始化（配合 InnoDB Cluster）
mysqlrouter --bootstrap root@192.168.1.101:3306 --user=mysqlrouter

# 启动
sudo systemctl start mysqlrouter
\`\`\`

## 6.5 故障切换流程总结

\`\`\`
1. 检测：监控系统发现主库不可用
2. 确认：二次确认，避免误判（网络抖动）
3. 选主：选择一个从库作为新主库
4. 补齐：从其他从库补同步差异数据
5. 切换：新主库上线，应用指向新主库
6. 恢复：原主库修复后作为从库加入
7. 通知：告警通知相关人员
\`\`\`