## 2.1 MySQL 权限模型

MySQL 权限分为多个层级，通过 \`GRANT\` 和 \`REVOKE\` 管理。

### 权限层级

| 层级 | 说明 | 存储位置 |
|------|------|----------|
| 全局层级 | 对服务器所有数据库 | mysql.user |
| 数据库层级 | 对特定数据库 | mysql.db |
| 表层级 | 对特定表 | mysql.tables_priv |
| 列层级 | 对特定列 | mysql.columns_priv |
| 存储过程层级 | 对特定存储过程/函数 | mysql.procs_priv |

## 2.2 创建用户与授权

### 创建用户

\`\`\`sql
-- 基本创建
CREATE USER 'username'@'%' IDENTIFIED BY 'password';

-- 指定认证插件（MySQL 8.0 默认 caching_sha2_password）
CREATE USER 'username'@'%' IDENTIFIED WITH caching_sha2_password BY 'password';

-- 兼容旧客户端的用户（需要 mysql_native_password）
CREATE USER 'legacy_user'@'%' IDENTIFIED WITH mysql_native_password BY 'password';

-- 创建并设置过期策略
CREATE USER 'temp_user'@'%' IDENTIFIED BY 'password' PASSWORD EXPIRE INTERVAL 90 DAY;
\`\`\`

### 主机名说明

| 写法 | 含义 |
|------|------|
| 'user'@'localhost' | 仅本地连接 |
| 'user'@'192.168.1.%' | 特定网段 |
| 'user'@'%' | 任意主机 |
| 'user'@'10.0.0.1' | 特定 IP |

## 2.3 GRANT —— 授权

\`\`\`sql
-- 授予所有数据库所有权限（管理员）
GRANT ALL PRIVILEGES ON *.* TO 'admin'@'%' WITH GRANT OPTION;

-- 授予特定数据库所有权限
GRANT ALL PRIVILEGES ON mydb.* TO 'dev'@'%';

-- 授予只读权限
GRANT SELECT ON mydb.* TO 'readonly'@'%';

-- 授予读写权限（不含 DDL）
GRANT SELECT, INSERT, UPDATE, DELETE ON mydb.* TO 'app_user'@'%';

-- 授予特定表的所有权限
GRANT ALL PRIVILEGES ON mydb.users TO 'user_mgr'@'%';

-- 授予特定列权限
GRANT SELECT (id, name, email) ON mydb.users TO 'limited_user'@'%';

-- 授予执行存储过程权限
GRANT EXECUTE ON PROCEDURE mydb.sp_calculate TO 'app'@'%';

-- 刷新权限（使更改立即生效）
FLUSH PRIVILEGES;
\`\`\`

### 常用权限列表

| 权限 | 说明 |
|------|------|
| ALL PRIVILEGES | 所有权限（不含 GRANT OPTION） |
| SELECT | 查询数据 |
| INSERT | 插入数据 |
| UPDATE | 更新数据 |
| DELETE | 删除数据 |
| CREATE | 创建数据库/表 |
| DROP | 删除数据库/表 |
| ALTER | 修改表结构 |
| INDEX | 创建/删除索引 |
| RELOAD | FLUSH 操作 |
| SHUTDOWN | 关闭服务器 |
| SUPER | 超级权限（KILL 等） |
| REPLICATION SLAVE | 从库复制权限 |
| REPLICATION CLIENT | 查看复制状态 |
| PROCESS | SHOW PROCESSLIST |

## 2.4 REVOKE —— 回收权限

\`\`\`sql
-- 回收特定权限
REVOKE DELETE ON mydb.* FROM 'app_user'@'%';

-- 回收所有权限
REVOKE ALL PRIVILEGES ON mydb.* FROM 'dev'@'%';

-- 回收 GRANT OPTION
REVOKE GRANT OPTION ON *.* FROM 'admin'@'%';
\`\`\`

## 2.5 查看与管理

\`\`\`sql
-- 查看当前用户权限
SHOW GRANTS;
SHOW GRANTS FOR 'username'@'%';

-- 查看所有用户
SELECT user, host, authentication_string FROM mysql.user;

-- 修改密码
ALTER USER 'username'@'%' IDENTIFIED BY 'new_password';
SET PASSWORD FOR 'username'@'%' = 'new_password';   -- MySQL 5.7

-- 锁定/解锁用户
ALTER USER 'username'@'%' ACCOUNT LOCK;
ALTER USER 'username'@'%' ACCOUNT UNLOCK;

-- 删除用户
DROP USER 'username'@'%';

-- 重命名用户
RENAME USER 'old_name'@'%' TO 'new_name'@'%';
\`\`\`

## 2.6 安全最佳实践

1. **最小权限原则**：只授予必要的最小权限
2. **避免 root 远程登录**：root 仅限 localhost
3. **应用账户隔离**：每个应用使用独立的数据库用户
4. **定期审计权限**：\`SELECT * FROM mysql.user WHERE host = '%';\`
5. **使用强密码**：配合 validate_password 组件

\`\`\`sql
-- 安装密码验证组件
INSTALL COMPONENT 'file://component_validate_password';

-- 查看密码策略
SHOW VARIABLES LIKE 'validate_password%';

-- 设置密码策略
SET GLOBAL validate_password.length = 12;
SET GLOBAL validate_password.mixed_case_count = 1;
SET GLOBAL validate_password.number_count = 1;
\`\`\`