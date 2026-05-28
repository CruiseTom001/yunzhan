## 1.1 MySQL 版本选择

### 主流版本

| 版本 | 特点 | 推荐场景 |
|------|------|----------|
| MySQL 5.7 | 成熟稳定，广泛使用 | 保守型项目，已运行系统 |
| MySQL 8.0 | 新特性多，性能提升显著 | 新项目，现代化应用 |
| MariaDB 10.x | MySQL 开源分支，兼容性好 | 不想依赖 Oracle 的项目 |
| Percona Server | MySQL 增强版，企业功能 | 高负载生产环境 |

> **当前推荐**：新项目优先选择 **MySQL 8.0** 或 **Percona Server 8.0**。

## 1.2 安装 MySQL 8.0

### Ubuntu/Debian

\`\`\`bash
# 添加 MySQL APT 仓库
wget https://dev.mysql.com/get/mysql-apt-config_0.8.28-1_all.deb
sudo dpkg -i mysql-apt-config_0.8.28-1_all.deb
sudo apt update

# 安装 MySQL Server
sudo apt install mysql-server

# 安全初始化（设置 root 密码、删除匿名用户等）
sudo mysql_secure_installation
\`\`\`

### CentOS/RHEL

\`\`\`bash
# 添加 MySQL YUM 仓库
sudo yum install https://dev.mysql.com/get/mysql80-community-release-el7-3.noarch.rpm

# 安装 MySQL Server
sudo yum install mysql-community-server

# 启动
sudo systemctl start mysqld
sudo systemctl enable mysqld

# 获取临时密码
sudo grep 'temporary password' /var/log/mysqld.log

# 初始化
sudo mysql_secure_installation
\`\`\`

### Docker 安装（推荐开发/测试环境）

\`\`\`bash
docker run -d \\
  --name mysql8 \\
  -p 3306:3306 \\
  -e MYSQL_ROOT_PASSWORD=root123 \\
  -v /data/mysql:/var/lib/mysql \\
  -v /etc/mysql/conf.d:/etc/mysql/conf.d \\
  mysql:8.0 \\
  --character-set-server=utf8mb4 \\
  --collation-server=utf8mb4_unicode_ci
\`\`\`

## 1.3 基础配置优化

### /etc/mysql/my.cnf 关键配置

\`\`\`ini
[mysqld]
# 基础设置
server-id = 1
port = 3306
bind-address = 0.0.0.0
datadir = /var/lib/mysql
socket = /var/lib/mysql/mysql.sock

# 字符集
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# InnoDB 缓冲池（核心参数，设为物理内存的 60-80%）
innodb_buffer_pool_size = 4G
innodb_buffer_pool_instances = 4    # 每个实例 >= 1GB 时设置

# 日志配置
innodb_log_file_size = 512M          # 日志文件越大，写入性能越好
innodb_log_files_in_group = 2
innodb_flush_log_at_trx_commit = 2   # 2=性能优先，1=安全优先
innodb_flush_method = O_DIRECT

# 连接数
max_connections = 500
max_connect_errors = 10000

# 查询缓存（MySQL 8.0 已移除，5.7 建议关闭）
# query_cache_size = 0
# query_cache_type = 0

# 慢查询日志
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2                  # 超过 2 秒记录

# 二进制日志（主从复制必需）
log_bin = /var/log/mysql/mysql-bin
binlog_format = ROW
expire_logs_days = 7
max_binlog_size = 500M

# 临时表
tmp_table_size = 64M
max_heap_table_size = 64M

# 排序缓冲
sort_buffer_size = 4M
join_buffer_size = 4M
\`\`\`

### 查看运行中的配置

\`\`\`sql
-- 查看所有系统变量
SHOW VARIABLES;

-- 查看特定变量
SHOW VARIABLES LIKE '%buffer_pool%';
SHOW VARIABLES LIKE '%innodb%';

-- 查看状态变量
SHOW GLOBAL STATUS LIKE '%connections%';
SHOW GLOBAL STATUS LIKE '%threads%';
\`\`\`

## 1.4 连接到 MySQL

\`\`\`bash
# 本地连接
mysql -u root -p

# 连接远程 MySQL
mysql -h 192.168.1.100 -P 3306 -u username -p

# 连接并指定数据库
mysql -u root -p mydb

# 执行 SQL 文件
mysql -u root -p mydb < backup.sql

# 非交互式执行
mysql -u root -p -e "SHOW DATABASES;"
\`\`\`