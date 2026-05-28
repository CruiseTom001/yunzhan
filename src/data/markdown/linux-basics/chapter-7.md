## 8.1 crontab —— 定时任务

\`crontab\` 用于设置周期性执行的任务。

### Crontab 语法

\`\`\`
*    *    *    *    *    命令
│    │    │    │    │
│    │    │    │    └── 星期 (0-7, 0 和 7 都表示周日)
│    │    │    └─────── 月份 (1-12)
│    │    └──────────── 日期 (1-31)
│    │    └───────────── 小时 (0-23)
│    └────────────────── 分钟 (0-59)
\`\`\`

### 特殊字符

| 字符 | 含义 | 示例 |
|------|------|------|
| * | 所有可能的值 | * * * * * 每分钟 |
| , | 列举 | 0,30 * * * * 每小时第 0 和 30 分 |
| - | 范围 | 0 9-17 * * * 9 点到 17 点每小时 |
| / | 间隔 | */5 * * * * 每 5 分钟 |

### 常用示例

\`\`\`bash
# 每天凌晨 2 点执行备份
0 2 * * * /opt/scripts/backup.sh >> /var/log/backup.log 2>&1

# 每 5 分钟检查服务状态
*/5 * * * * /opt/scripts/healthcheck.sh

# 每周日凌晨 3 点清理日志
0 3 * * 0 find /var/log -name "*.log" -mtime +30 -delete

# 每月 1 号凌晨 1 点执行
0 1 1 * * /opt/scripts/monthly.sh

# 每天 8:00-20:00 每两小时执行
0 8-20/2 * * * /opt/scripts/report.sh
\`\`\`

### crontab 命令

\`\`\`bash
crontab -e         # 编辑当前用户的定时任务
crontab -l         # 查看当前用户的定时任务
crontab -r         # 删除所有定时任务（慎用！）
crontab -u alice -e  # 编辑指定用户的定时任务（root）

# 系统级定时任务
cat /etc/crontab   # 系统 crontab
ls /etc/cron.d/    # 系统 cron 配置目录
ls /etc/cron.daily/ /etc/cron.hourly/ /etc/cron.weekly/ /etc/cron.monthly/
\`\`\`

### Crontab 常见问题

1. **环境变量**：cron 运行时的 PATH 可能与用户 shell 不同，建议使用绝对路径
2. **% 号**：在 crontab 中 % 是特殊字符，需要转义 \\%
3. **日志**：默认 crontab 输出会通过邮件发送，建议重定向到文件

\`\`\`bash
# 推荐写法
0 2 * * * /usr/bin/bash /opt/scripts/backup.sh >> /var/log/backup.log 2>&1
\`\`\`

## 8.2 journalctl —— Systemd 日志管理

\`\`\`bash
# 查看所有日志
journalctl

# 查看指定服务的日志
journalctl -u nginx
journalctl -u nginx -f                  # 实时跟踪
journalctl -u nginx --since "2024-01-01"
journalctl -u nginx --since "1 hour ago"
journalctl -u nginx -n 100              # 最近 100 条

# 按时间筛选
journalctl --since "2024-01-01 10:00:00" --until "2024-01-01 12:00:00"

# 按优先级筛选
journalctl -p err                       # 只显示错误级别
journalctl -p warning                   # 警告及以上

# 查看启动日志
journalctl -b                           # 本次启动
journalctl -b -1                        # 上次启动

# 按内核日志
journalctl -k

# 磁盘使用
journalctl --disk-usage
\`\`\`

### 日志级别

| 级别 | 值 | 含义 |
|------|-----|------|
| emerg | 0 | 系统不可用 |
| alert | 1 | 必须立即处理 |
| crit | 2 | 严重错误 |
| err | 3 | 错误 |
| warning | 4 | 警告 |
| notice | 5 | 正常但重要 |
| info | 6 | 信息 |
| debug | 7 | 调试信息 |

## 8.3 logrotate —— 日志轮转

\`logrotate\` 防止日志文件无限增长占满磁盘。

### 配置文件

\`/etc/logrotate.conf\` 是主配置，\`/etc/logrotate.d/\` 下存放各应用配置。

\`\`\`bash
# /etc/logrotate.d/nginx 示例
/var/log/nginx/*.log {
    daily                   # 每天轮转
    rotate 30               # 保留 30 个归档
    missingok               # 日志不存在不报错
    notifempty              # 空文件不轮转
    compress                # 压缩归档日志
    delaycompress           # 延迟压缩（保留最近一个不压缩）
    sharedscripts           # 所有日志共享 postrotate 脚本
    postrotate
        /usr/bin/kill -USR1 $(cat /var/run/nginx.pid 2>/dev/null) 2>/dev/null || true
    endscript
    dateext                 # 使用日期作为后缀
    dateformat -%Y%m%d
}
\`\`\`

### 常用配置选项

| 选项 | 说明 |
|------|------|
| daily/weekly/monthly | 轮转频率 |
| rotate N | 保留 N 个归档副本 |
| size 100M | 日志大于指定大小时轮转 |
| compress | 使用 gzip 压缩归档 |
| missingok | 日志文件不存在时不报错 |
| copytruncate | 复制后截断（避免重启服务） |
| create 644 root root | 创建新日志文件的权限和所有者 |
| maxage 30 | 超过 30 天的归档删除 |

### 测试和执行

\`\`\`bash
# 以 debug 模式测试（不实际执行）
logrotate -d /etc/logrotate.conf

# 强制执行
logrotate -f /etc/logrotate.conf

# 查看状态
cat /var/lib/logrotate/logrotate.status
\`\`\`

## 8.4 自定义日志管理脚本示例

\`\`\`bash
#!/bin/bash
# 清理 N 天前的日志
LOG_DIR="/var/log/myapp"
RETENTION_DAYS=30

find "$LOG_DIR" -name "*.log" -mtime +$RETENTION_DAYS -exec rm -f {} \\;
find "$LOG_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -exec rm -f {} \\;

# 压缩昨天的日志
find "$LOG_DIR" -name "*.log" -mtime +0 -not -name "*.gz" -exec gzip {} \\;
\`\`\`