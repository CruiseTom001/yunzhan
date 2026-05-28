## 3.1 备份策略概述

### 备份类型

| 类型 | 说明 | 优点 | 缺点 |
|------|------|------|------|
| 逻辑备份 | SQL 语句文本 | 可读、跨版本兼容 | 速度慢、占用空间大 |
| 物理备份 | 数据文件复制 | 速度快、恢复快 | 跨平台兼容性差 |
| 全量备份 | 完整数据备份 | 恢复简单 | 耗时长、空间大 |
| 增量备份 | 只备份变化数据 | 节省空间和时间 | 恢复复杂 |
| 热备份 | 不锁定表，服务在线 | 不影响业务 | 需 InnoDB 引擎 |

### 备份策略推荐

\`\`\`
中等规模业务策略：
- 每天凌晨 2 点：全量逻辑备份（mysqldump）
- 每小时：binlog 备份
- 保留 7 天本地备份 + 7 天异地备份

大规模业务策略：
- 每周日：xtrabackup 全量备份
- 每天：xtrabackup 增量备份
- binlog 实时归档
\`\`\`

## 3.2 mysqldump —— 逻辑备份

### 基础用法

\`\`\`bash
# 备份单个数据库
mysqldump -u root -p mydb > mydb_backup.sql

# 备份多个数据库
mysqldump -u root -p --databases db1 db2 > multi_db.sql

# 备份所有数据库
mysqldump -u root -p --all-databases > all_db.sql

# 只备份表结构（不含数据）
mysqldump -u root -p --no-data mydb > mydb_schema.sql

# 只备份数据（不含表结构）
mysqldump -u root -p --no-create-info mydb > mydb_data.sql

# 备份特定表
mysqldump -u root -p mydb table1 table2 > tables.sql
\`\`\`

### 生产级备份参数

\`\`\`bash
mysqldump \\
  -u root -p \\
  --single-transaction \\     # 一致性快照，不锁表（InnoDB）
  --routines \\                # 包含存储过程和函数
  --triggers \\                # 包含触发器
  --events \\                  # 包含事件
  --set-gtid-purged=OFF \\    # 避免 GTID 冲突
  --master-data=2 \\          # 记录 binlog 位置（注释形式）
  --databases mydb \\
  | gzip > mydb_$(date +%Y%m%d_%H%M%S).sql.gz
\`\`\`

### 重要参数说明

| 参数 | 说明 |
|------|------|
| --single-transaction | 在事务中导出，保证数据一致性，不锁表（仅 InnoDB） |
| --master-data=2 | 记录 CHANGE MASTER 语句（binlog 位置），2=注释形式 |
| --set-gtid-purged=OFF | 不写入 GTID 信息，避免主从切换时的问题 |
| --routines | 导出存储过程和函数 |
| --triggers | 导出触发器（默认开启） |
| --add-drop-database | 先 DROP DATABASE 再 CREATE |
| --compress | 压缩传输（客户端-服务器） |

## 3.3 数据恢复

\`\`\`bash
# 恢复全量备份
mysql -u root -p mydb < mydb_backup.sql

# 解压后恢复
gunzip < mydb_backup.sql.gz | mysql -u root -p mydb

# 恢复全部数据库
mysql -u root -p < all_db.sql

# 恢复时遇到错误继续执行
mysql -u root -p --force mydb < mydb_backup.sql

# 查看恢复进度
pv mydb_backup.sql | mysql -u root -p mydb
\`\`\`

## 3.4 xtrabackup —— 物理热备份

Percona XtraBackup 是 InnoDB 的在线热备份工具，适用于大数据库。

\`\`\`bash
# 安装
# Ubuntu
sudo apt install percona-xtrabackup-80
# CentOS
sudo yum install percona-xtrabackup-80

# 全量备份
xtrabackup --backup \\
  --target-dir=/backup/mysql/full \\
  --user=root --password=xxx

# 准备备份（恢复前必须执行）
xtrabackup --prepare --target-dir=/backup/mysql/full

# 恢复（需先停止 MySQL，清空 datadir）
systemctl stop mysql
rm -rf /var/lib/mysql/*
xtrabackup --copy-back --target-dir=/backup/mysql/full
chown -R mysql:mysql /var/lib/mysql
systemctl start mysql

# 增量备份
xtrabackup --backup \\
  --target-dir=/backup/mysql/inc1 \\
  --incremental-basedir=/backup/mysql/full \\
  --user=root --password=xxx
\`\`\`

## 3.5 binlog 恢复

### 查看 binlog 事件

\`\`\`bash
# 查看所有 binlog 文件
mysql -u root -p -e "SHOW BINARY LOGS;"

# 查看 binlog 内容
mysqlbinlog /var/log/mysql/mysql-bin.000001

# 按时间范围提取
mysqlbinlog \\
  --start-datetime="2024-01-01 10:00:00" \\
  --stop-datetime="2024-01-01 11:00:00" \\
  /var/log/mysql/mysql-bin.000001 > restore.sql

# 按位置提取
mysqlbinlog \\
  --start-position=1000 \\
  --stop-position=2000 \\
  /var/log/mysql/mysql-bin.000001 > restore.sql

# 恢复 binlog
mysql -u root -p < restore.sql
\`\`\`

### 完整恢复流程（mysqldump + binlog）

\`\`\`bash
# 1. 恢复全量备份（假设 2 点的备份）
mysql -u root -p mydb < /backup/mydb_20240101_020000.sql

# 2. 确认 binlog 位置（从备份文件中查找）
grep "CHANGE MASTER" /backup/mydb_20240101_020000.sql
# CHANGE MASTER TO MASTER_LOG_FILE='mysql-bin.000010', MASTER_LOG_POS=123456;

# 3. 提取 2 点之后到故障点前的 binlog
mysqlbinlog \\
  --start-position=123456 \\
  /var/log/mysql/mysql-bin.000010 \\
  /var/log/mysql/mysql-bin.000011 \\
  > incremental.sql

# 4. 恢复增量
mysql -u root -p mydb < incremental.sql
\`\`\`

## 3.6 自动化备份脚本

\`\`\`bash
#!/bin/bash
# /opt/scripts/mysql_backup.sh

BACKUP_DIR="/backup/mysql"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)
DB_USER="backup"
DB_PASS="password"
DB_NAME="mydb"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 执行备份
mysqldump -u"$DB_USER" -p"$DB_PASS" \\
  --single-transaction \\
  --routines \\
  --triggers \\
  --events \\
  --set-gtid-purged=OFF \\
  "$DB_NAME" | gzip > "$BACKUP_DIR/\${DB_NAME}_\${DATE}.sql.gz"

# 删除旧备份
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup completed: \${DB_NAME}_\${DATE}.sql.gz"
\`\`\`

### 配合 crontab

\`\`\`bash
# 每天凌晨 2 点备份
0 2 * * * /bin/bash /opt/scripts/mysql_backup.sh >> /var/log/mysql_backup.log 2>&1
\`\`\`