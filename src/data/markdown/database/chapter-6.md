## 7.1 日常巡检清单

### 每日检查

\`\`\`sql
-- 1. 检查数据库是否存活
SELECT 1;

-- 2. 检查主从复制状态
SHOW SLAVE STATUS\\G
-- 关注：Slave_IO_Running, Slave_SQL_Running, Seconds_Behind_Master

-- 3. 检查是否有锁等待
SELECT * FROM information_schema.innodb_lock_waits;
-- MySQL 8.0+
SELECT * FROM performance_schema.data_lock_waits;

-- 4. 检查慢查询
SELECT COUNT(*) FROM mysql.slow_log WHERE start_time > DATE_SUB(NOW(), INTERVAL 1 DAY);

-- 5. 检查连接数
SHOW PROCESSLIST;
SELECT COUNT(*) FROM information_schema.processlist;
\`\`\`

### 每周检查

\`\`\`sql
-- 1. 检查磁盘空间
SELECT table_schema, SUM(data_length + index_length) / 1024 / 1024 / 1024 AS size_gb
FROM information_schema.tables
GROUP BY table_schema
ORDER BY size_gb DESC;

-- 2. 检查表碎片
SELECT table_schema, table_name,
    ROUND(data_free / (data_length + index_length + data_free) * 100, 2) AS fragmentation_pct
FROM information_schema.tables
WHERE data_free > 0 AND table_schema NOT IN ('mysql', 'information_schema', 'performance_schema');

-- 3. 检查未使用索引
SELECT * FROM sys.schema_unused_indexes;

-- 4. 检查重复/冗余索引
SELECT * FROM sys.schema_redundant_indexes;

-- 5. 检查自增值的使用率
SELECT table_schema, table_name, auto_increment,
    MAX(auto_increment) / MAX(auto_increment + 1) * 100 AS usage_pct
FROM information_schema.tables
WHERE auto_increment IS NOT NULL AND auto_increment > 0
GROUP BY table_schema, table_name;
\`\`\`

## 7.2 关键监控指标

### 数据库层指标

| 指标 | 获取方式 | 含义 | 告警阈值 |
|------|---------|------|----------|
| QPS | SHOW GLOBAL STATUS LIKE 'Questions' | 每秒查询数 | 偏离基线 |
| TPS | SHOW GLOBAL STATUS LIKE 'Com_commit' + 'Com_rollback' | 每秒事务数 | 偏离基线 |
| 连接数 | SHOW PROCESSLIST / Threads_connected | 当前连接数 | > 80% max_connections |
| 慢查询数 | mysql.slow_log | 慢查询数量 | > 10/min |
| 缓存命中率 | Innodb_buffer_pool_read_requests / reads | InnoDB 缓存效率 | < 95% |
| 锁等待 | innodb_lock_waits | InnoDB 锁等待 | > 0 |
| 主从延迟 | Seconds_Behind_Master | 从库延迟 | > 10s |
| 临时表 | Created_tmp_disk_tables | 磁盘临时表 | 持续增长 |

### 关键 SQL 监控

\`\`\`sql
-- InnoDB 缓存命中率
SELECT
    (1 - (SUM(innodb_buffer_pool_reads) / SUM(innodb_buffer_pool_read_requests))) * 100 AS cache_hit_ratio
FROM information_schema.global_status
WHERE variable_name IN ('innodb_buffer_pool_reads', 'innodb_buffer_pool_read_requests');

-- 线程连接统计
SELECT
    SUM(variable_name = 'Threads_connected') AS connected,
    SUM(variable_name = 'Threads_running') AS running,
    SUM(variable_name = 'Threads_cached') AS cached,
    @@max_connections AS max_connections
FROM performance_schema.global_status
WHERE variable_name IN ('Threads_connected', 'Threads_running', 'Threads_cached');

-- 每秒查询和事务
SHOW GLOBAL STATUS LIKE 'Questions';
SHOW GLOBAL STATUS LIKE 'Uptime';
-- QPS = Questions / Uptime

-- 表锁争用
SHOW GLOBAL STATUS LIKE 'Table_locks%';
-- 争用率 = Table_locks_waited / Table_locks_immediate
\`\`\`

## 7.3 Performance Schema 分析

\`\`\`sql
-- 检查 Performance Schema 是否开启
SHOW VARIABLES LIKE 'performance_schema';

-- TOP 10 耗时 SQL 语句
SELECT
    DIGEST_TEXT,
    COUNT_STAR AS exec_count,
    SUM_TIMER_WAIT / 1000000000000 AS total_time_sec,
    AVG_TIMER_WAIT / 1000000000000 AS avg_time_sec,
    SUM_ROWS_EXAMINED AS rows_examined
FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 10;

-- 全表扫描最多的 SQL
SELECT
    DIGEST_TEXT,
    COUNT_STAR,
    SUM_NO_INDEX_USED,
    ROUND(SUM_NO_INDEX_USED / COUNT_STAR * 100, 2) AS no_index_pct
FROM performance_schema.events_statements_summary_by_digest
WHERE COUNT_STAR > 10
ORDER BY no_index_pct DESC
LIMIT 10;

-- 等待事件分析
SELECT
    EVENT_NAME,
    COUNT_STAR,
    SUM_TIMER_WAIT / 1000000000000 AS total_wait_sec
FROM performance_schema.events_waits_summary_global_by_event_name
WHERE SUM_TIMER_WAIT > 0
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 20;
\`\`\`

## 7.4 自动巡检脚本

\`\`\`bash
#!/bin/bash
# /opt/scripts/mysql_check.sh

MYSQL_USER="root"
MYSQL_PASS="password"
MYSQL_HOST="localhost"
ALERT_EMAIL="dba@example.com"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 检查数据库连通性
if ! mysqladmin -u"$MYSQL_USER" -p"$MYSQL_PASS" -h"$MYSQL_HOST" ping &>/dev/null; then
    log "FATAL: MySQL is not reachable"
    exit 1
fi

# 检查主从延迟
SLAVE_DELAY=$(mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" -h"$MYSQL_HOST" -e "SHOW SLAVE STATUS\\G" 2>/dev/null | grep "Seconds_Behind_Master" | awk '{print $2}')

if [ "$SLAVE_DELAY" != "NULL" ] && [ "$SLAVE_DELAY" -gt 10 ]; then
    log "WARNING: Slave delay is $SLAVE_DELAY seconds"
fi

# 检查连接数
CONNECTIONS=$(mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" -h"$MYSQL_HOST" -e "SHOW GLOBAL STATUS LIKE 'Threads_connected'" | tail -1 | awk '{print $2}')
MAX_CONN=$(mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" -h"$MYSQL_HOST" -e "SHOW VARIABLES LIKE 'max_connections'" | tail -1 | awk '{print $2}')
CONN_PCT=$((CONNECTIONS * 100 / MAX_CONN))

if [ "$CONN_PCT" -gt 80 ]; then
    log "WARNING: Connection usage is at $CONN_PCT%"
fi

log "Daily check completed"
\`\`\`

## 7.5 常用数据库巡检工具

| 工具 | 功能 | 说明 |
|------|------|------|
| pt-mysql-summary | 系统信息总览 | Percona Toolkit |
| mysqlcheck | 检查修复表 | MySQL 内置 |
| mysqlslap | 基准测试 | MySQL 内置 |
| sysbench | 性能压力测试 | 第三方 |
| pt-query-digest | 慢查询分析 | Percona Toolkit |
| orchestrator | 拓扑管理和自动故障切换 | GitHub 开源 |
| PMM | 监控和诊断 | Percona 出品 |