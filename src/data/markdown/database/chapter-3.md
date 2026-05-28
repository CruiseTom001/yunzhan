## 4.1 主从复制原理

MySQL 主从复制基于**二进制日志（Binary Log）**实现异步数据同步。

### 复制流程

\`\`\`
Master (主库)                          Slave (从库)
  │                                      │
  │ 1. 记录事务到 binlog                │
  ├────────── binlog ──────────→        │
  │                                      │
  │                              ┌───────┴───────┐
  │                              │ I/O Thread   │ 2. 读取 binlog，写入 relay log
  │                              └───────┬───────┘
  │                                      │
  │                              ┌───────┴───────┐
  │                              │ SQL Thread   │ 3. 执行 relay log 中的操作
  │                              └───────────────┘
\`\`\`

### 三种线程

| 线程 | 位置 | 功能 |
|------|------|------|
| Binlog Dump Thread | 主库 | 将 binlog 日志发送给从库 |
| I/O Thread | 从库 | 接收 binlog 并写入 relay log |
| SQL Thread | 从库 | 从 relay log 读取并执行操作 |

## 4.2 主从复制配置

### 主库配置（/etc/mysql/my.cnf）

\`\`\`ini
[mysqld]
server-id = 1                     # 唯一 ID
log_bin = /var/log/mysql/mysql-bin
binlog_format = ROW
binlog_do_db = mydb               # 只复制特定数据库（可选）
expire_logs_days = 7
max_binlog_size = 500M
sync_binlog = 1                   # 每次提交同步 binlog
\`\`\`

### 创建复制用户（主库）

\`\`\`sql
CREATE USER 'repl'@'%' IDENTIFIED BY 'repl_password';
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';
FLUSH PRIVILEGES;
\`\`\`

### 锁定并获取 binlog 位置（主库）

\`\`\`sql
-- 锁定表防止写入（或使用 mysqldump --master-data）
FLUSH TABLES WITH READ LOCK;

-- 查看 binlog 文件和位置
SHOW MASTER STATUS;
-- +------------------+----------+
-- | File             | Position |
-- +------------------+----------+
-- | mysql-bin.000001 |     1234 |
-- +------------------+----------+
\`\`\`

### 从库配置

\`\`\`ini
[mysqld]
server-id = 2                     # 与主库不同即可
relay_log = /var/log/mysql/relay-bin
read_only = 1                     # 从库只读（推荐）
log_bin = /var/log/mysql/mysql-bin  # 从库也开启 binlog（用于级联复制或故障切换）
\`\`\`

### 建立复制关系（从库）

\`\`\`sql
-- 配置主库连接信息
CHANGE MASTER TO
    MASTER_HOST='192.168.1.100',
    MASTER_PORT=3306,
    MASTER_USER='repl',
    MASTER_PASSWORD='repl_password',
    MASTER_LOG_FILE='mysql-bin.000001',
    MASTER_LOG_POS=1234;

-- 启动复制
START SLAVE;

-- 查看复制状态
SHOW SLAVE STATUS\\G
\`\`\`

### 判断复制健康的关键字段

\`\`\`sql
SHOW SLAVE STATUS\\G
\`\`\`

重点关注：

| 字段 | 正常值 |
|------|--------|
| Slave_IO_Running | Yes |
| Slave_SQL_Running | Yes |
| Seconds_Behind_Master | 0（或较小值） |
| Last_IO_Errno | 0 |
| Last_SQL_Errno | 0 |

## 4.3 复制格式对比

| 格式 | 优点 | 缺点 |
|------|------|------|
| STATEMENT | binlog 小 | 不确定的 SQL 可能导致不一致 |
| ROW | 精确，数据一致 | binlog 大，无法查看 SQL 语句 |
| MIXED | 自动选择最优格式 | 不推荐，存在不确定性 |

> **推荐**：生产环境使用 **ROW** 格式。

## 4.4 GTID 复制（MySQL 5.6+）

GTID（Global Transaction Identifier）为每个事务分配全局唯一的 ID，简化故障切换。

### 启用 GTID

\`\`\`ini
# 主库和从库都需要配置
[mysqld]
server-id = 1
gtid_mode = ON
enforce_gtid_consistency = ON
log_bin = /var/log/mysql/mysql-bin
\`\`\`

### 使用 GTID 建立复制

\`\`\`sql
CHANGE MASTER TO
    MASTER_HOST='192.168.1.100',
    MASTER_PORT=3306,
    MASTER_USER='repl',
    MASTER_PASSWORD='repl_password',
    MASTER_AUTO_POSITION = 1;    -- 自动定位，无需关心 binlog 位置
\`\`\`

## 4.5 半同步复制

MySQL 默认是**异步复制**（主库提交不等待从库确认），半同步复制确保至少一台从库收到 binlog。

\`\`\`sql
-- 主库和从库都安装插件
INSTALL PLUGIN rpl_semi_sync_master SONAME 'semisync_master.so';
INSTALL PLUGIN rpl_semi_sync_slave SONAME 'semisync_slave.so';

-- 启用半同步
SET GLOBAL rpl_semi_sync_master_enabled = 1;
SET GLOBAL rpl_semi_sync_slave_enabled = 1;
\`\`\`

## 4.6 延迟复制

延迟复制让从库比主库延迟指定时间，可以防止误操作（如 DROP TABLE）。

\`\`\`sql
-- 设置从库延迟 1 小时
CHANGE MASTER TO MASTER_DELAY = 3600;
START SLAVE;
\`\`\`

## 4.7 常见复制问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| Slave_IO_Running: Connecting | 网络不通或认证失败 | 检查网络、用户密码、防火墙 |
| Slave_SQL_Running: No | SQL 执行出错 | 查看 Last_SQL_Error，手动修复或跳过 |
| Seconds_Behind_Master 过大 | 主库写入量大、从库性能不足 | 优化从库、升级硬件、使用并行复制 |
| 主从数据不一致 | STATEMENT 格式导致 | 改用 ROW 格式，使用 pt-table-checksum 校验 |

### 跳过复制错误

\`\`\`sql
-- 跳过一个错误（谨慎使用！）
SET GLOBAL SQL_SLAVE_SKIP_COUNTER = 1;
START SLAVE;
\`\`\`

### 并行复制（MySQL 5.7+）

\`\`\`sql
-- 从库配置
SET GLOBAL slave_parallel_type = LOGICAL_CLOCK;
SET GLOBAL slave_parallel_workers = 4;
\`\`\`