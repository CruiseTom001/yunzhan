## 5.1 慢查询日志配置

### 开启慢查询

\`\`\`ini
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1                    # 超过 1 秒记录
log_queries_not_using_indexes = 1      # 记录未使用索引的查询
log_slow_admin_statements = 1          # 记录慢 DDL 语句
\`\`\`

### 动态修改

\`\`\`sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.5;
SET GLOBAL log_queries_not_using_indexes = 'ON';
\`\`\`

## 5.2 慢查询日志分析

### mysqldumpslow（官方工具）

\`\`\`bash
# 按查询时间排序，显示前 10 条
mysqldumpslow -s t -t 10 /var/log/mysql/slow.log

# 按出现次数排序
mysqldumpslow -s c -t 10 /var/log/mysql/slow.log

# 按锁定时间排序
mysqldumpslow -s l -t 10 /var/log/mysql/slow.log

# 按扫描行数排序
mysqldumpslow -s r -t 10 /var/log/mysql/slow.log
\`\`\`

### pt-query-digest（Percona Toolkit）

\`\`\`bash
# 安装
sudo apt install percona-toolkit

# 分析慢查询日志
pt-query-digest /var/log/mysql/slow.log

# 分析最近 1 小时的慢查询
pt-query-digest --since=1h /var/log/mysql/slow.log

# 分析一般查询日志
pt-query-digest --type=genlog /var/log/mysql/general.log

# 分析 tcpdump 抓包
pt-query-digest --type=tcpdump mysql.pcap
\`\`\`

## 5.3 EXPLAIN —— 查询执行计划

EXPLAIN 是 SQL 优化的核心工具，显示了 MySQL 如何执行查询。

\`\`\`sql
EXPLAIN SELECT * FROM users WHERE email = 'alice@example.com';

-- MySQL 8.0+ 支持更多格式
EXPLAIN FORMAT=JSON SELECT * FROM users WHERE email = 'alice@example.com';
EXPLAIN FORMAT=TREE SELECT * FROM users WHERE email = 'alice@example.com';
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'alice@example.com';  -- 实际执行
\`\`\`

### EXPLAIN 关键字段

| 字段 | 含义 | 期望值 |
|------|------|--------|
| id | 查询序号，大值先执行 | |
| select_type | 查询类型（SIMPLE/PRIMARY/SUBQUERY） | SIMPLE |
| type | **访问方式（最重要）** | ALL < index < range < ref < eq_ref < const/system |
| possible_keys | 可能使用的索引 | |
| key | **实际使用的索引** | 应匹配你的索引 |
| key_len | 索引使用长度 | |
| rows | **预估扫描行数** | 应尽可能小 |
| Extra | 额外信息 | Using index（覆盖索引）、Using filesort（需排序优化） |
| filtered | 按条件过滤后的比例 | |

### type 访问方式详解（从差到好）

\`\`\`
ALL       → 全表扫描（最差，必须优化）
index     → 全索引扫描
range     → 索引范围扫描（>, <, BETWEEN, IN）
ref       → 非唯一索引查找
eq_ref    → 唯一索引查找（JOIN 时）
const     → 主键/唯一索引等值查找
system    → 表只有一行（最优）
\`\`\`

### Extra 中的危险信号

| 值 | 含义 | 建议 |
|----|------|------|
| Using filesort | 无法使用索引排序 | 优化 ORDER BY 列添加索引 |
| Using temporary | 使用了临时表 | 优化 GROUP BY / DISTINCT |
| Using index | 覆盖索引（好） | 无需回表，性能好 |
| Using where | 使用 WHERE 过滤 | 正常 |
| Using index condition | 索引下推（ICP） | 好 |

## 5.4 索引优化策略

### 索引创建原则

\`\`\`sql
-- 单列索引
CREATE INDEX idx_email ON users(email);

-- 联合索引（最左前缀原则）
CREATE INDEX idx_status_created ON orders(status, created_at);

-- 前缀索引（长字符串）
CREATE INDEX idx_title_prefix ON articles(title(20));

-- 唯一索引
CREATE UNIQUE INDEX uk_email ON users(email);

-- 全文索引（InnoDB 5.6+）
CREATE FULLTEXT INDEX ft_content ON articles(content);
\`\`\`

### 最左前缀原则

对于联合索引 \`(A, B, C)\`：

\`\`\`sql
-- 可以使用索引：
WHERE A = ? AND B = ? AND C = ?   -- 全部匹配 ✓
WHERE A = ? AND B = ?             -- 前缀匹配 ✓
WHERE A = ? AND C = ?             -- 只用 A（跳过 B） ✓
WHERE A = ?                       -- 只用 A ✓

-- 不能使用索引：
WHERE B = ?                       -- 不包含 A ✗
WHERE B = ? AND C = ?             -- 不包含 A ✗
WHERE C = ?                       -- 不包含 A ✗
\`\`\`

### 覆盖索引

当查询的所有列都在索引中时，MySQL 只读索引不回表，性能最好。

\`\`\`sql
-- 如果 idx_email 包含 email 列
EXPLAIN SELECT email FROM users WHERE email = 'a@b.com';
-- Extra: Using index  ← 覆盖索引

-- 如果查询了不在索引中的列
EXPLAIN SELECT * FROM users WHERE email = 'a@b.com';
-- Extra: NULL  ← 需要回表
\`\`\`

### 索引优化清单

| 检查项 | 说明 |
|--------|------|
| WHERE 条件列是否加索引 | 高频过滤条件必加 |
| JOIN 关联列是否加索引 | 避免全表扫描 JOIN |
| ORDER BY 列是否在索引中 | 避免 filesort |
| 是否使用覆盖索引 | 减少回表 |
| 索引列是否参与计算 | WHERE id + 1 = 10 不会用索引 |
| 是否避免前缀模糊查询 | WHERE name LIKE '%foo' 不走索引 |
| 是否有冗余索引 | (A, B) 已包含 (A) |
| 联合索引顺序是否合理 | 区分度高的放前面 |

## 5.5 查询优化实用技巧

\`\`\`sql
-- 1. 避免 SELECT *
SELECT id, name, email FROM users WHERE id = 1;

-- 2. 使用 LIMIT 分页
-- 差：OFFSET 很大时效率低
SELECT * FROM users ORDER BY id LIMIT 100000, 20;
-- 好：基于索引的分页
SELECT * FROM users WHERE id > 100000 ORDER BY id LIMIT 20;

-- 3. IN 替代多个 OR
SELECT * FROM users WHERE id IN (1, 2, 3, 4, 5);

-- 4. UNION ALL 替代 UNION（不需去重时）
SELECT id FROM table1 UNION ALL SELECT id FROM table2;

-- 5. EXISTS 替代 IN（子查询是大表时）
SELECT * FROM users WHERE EXISTS (SELECT 1 FROM orders WHERE orders.user_id = users.id);

-- 6. 避免隐式类型转换
-- WHERE phone = 13800138000   ← phone 是 VARCHAR，发生隐式转换
-- WHERE phone = '13800138000' ← 正确
\`\`\`