## 7.1 访问日志配置

### 自定义日志格式

\`\`\`nginx
http {
    # 详细日志格式
    log_format detailed '$remote_addr - $remote_user [$time_local] '
                        '"$request" $status $body_bytes_sent '
                        '"$http_referer" "$http_user_agent" '
                        'rt=$request_time uct="$upstream_connect_time" '
                        'uht="$upstream_header_time" urt="$upstream_response_time"';

    # JSON 格式（方便日志收集系统解析）
    log_format json escape=json '{'
        '"timestamp":"$time_iso8601",'
        '"remote_addr":"$remote_addr",'
        '"request":"$request",'
        '"status":$status,'
        '"body_bytes_sent":$body_bytes_sent,'
        '"request_time":$request_time,'
        '"upstream_response_time":"$upstream_response_time",'
        '"http_referer":"$http_referer",'
        '"http_user_agent":"$http_user_agent",'
        '"http_x_forwarded_for":"$http_x_forwarded_for"'
    '}';

    # 使用日志格式
    access_log /var/log/nginx/access.log json;
}
\`\`\`

### 常用日志变量

| 变量 | 含义 |
|------|------|
| $remote_addr | 客户端 IP |
| $time_local | 本地时间 |
| $request | 完整请求行（方法 + URI + 协议） |
| $status | 响应状态码 |
| $body_bytes_sent | 响应体大小 |
| $request_time | 请求处理总时间（秒） |
| $upstream_response_time | 后端响应时间 |
| $http_referer | 来源页面 |
| $http_user_agent | 用户代理 |
| $http_x_forwarded_for | 原始 IP（经代理时） |

### 条件日志

\`\`\`nginx
# 不记录特定请求的访问日志
location /health {
    access_log off;
}

# 只记录错误请求
map $status $loggable {
    ~^[23]  0;
    default 1;
}
access_log /var/log/nginx/access.log json if=$loggable;

# 不记录静态资源日志
location ~* \\.(js|css|png|jpg|jpeg|gif|ico)$ {
    access_log off;
    expires 30d;
}
\`\`\`

## 7.2 错误日志配置

\`\`\`nginx
error_log /var/log/nginx/error.log warn;
# 日志级别：debug > info > notice > warn > error > crit > alert > emerg

# 生产环境建议 warn，调试时改为 debug
error_log /var/log/nginx/error.log debug;    # 需要编译时包含 --with-debug
\`\`\`

## 7.3 日志分析命令

\`\`\`bash
# 统计访问最多的 10 个 IP
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10

# 统计状态码分布
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# 统计请求最多的 URL
awk '{print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20

# 统计 4xx 和 5xx 错误
awk '$9 ~ /^[45]/ {print $7, $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20

# 响应时间超过 1 秒的慢请求
awk '$NF > 1 {print $0}' /var/log/nginx/access.log | head -20

# 统计每分钟请求数
awk '{print substr($4,2,17)}' /var/log/nginx/access.log | uniq -c

# 统计独立 IP 数
awk '{print $1}' /var/log/nginx/access.log | sort -u | wc -l

# 实时监控状态码分布
tail -f /var/log/nginx/access.log | awk '{print $9}' | while read code; do echo "Status: $code"; done
\`\`\`

## 7.4 日志轮转（logrotate）

\`\`\`bash
# /etc/logrotate.d/nginx
/var/log/nginx/*.log {
    daily
    rotate 60
    missingok
    notifempty
    compress
    delaycompress
    sharedscripts
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 $(cat /var/run/nginx.pid)
        fi
    endscript
    dateext
    dateformat -%Y%m%d
}
\`\`\`

## 7.5 集中化日志方案

### ELK/EFK Stack

\`\`\`
Nginx → Filebeat/Fluentd → Elasticsearch → Kibana
                            或
Nginx → Fluentd → OpenSearch → OpenSearch Dashboards
\`\`\`

### Filebeat 配置示例

\`\`\`yaml
# /etc/filebeat/filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/nginx/access.log
    json.keys_under_root: true
    json.add_error_key: true
    fields:
      log_type: nginx_access

output.elasticsearch:
  hosts: ["http://elasticsearch:9200"]
  index: "nginx-access-%{+yyyy.MM.dd}"
\`\`\`

### 使用 GoAccess 实时分析

\`\`\`bash
# 安装 GoAccess
sudo apt install goaccess    # Ubuntu/Debian
sudo yum install goaccess    # CentOS/RHEL

# 实时分析（终端）
goaccess /var/log/nginx/access.log -c

# 生成 HTML 报告
goaccess /var/log/nginx/access.log -o /var/www/html/report.html --log-format=COMBINED --real-time-html
\`\`\`