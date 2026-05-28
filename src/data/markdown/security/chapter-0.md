## Linux 系统安全加固

### SSH 服务加固

- PermitRootLogin no
- PasswordAuthentication no（仅允许密钥认证）
- 修改默认端口
- 限制登录用户/IP
- MaxAuthTries 3

### 用户与权限安全策略

- 密码策略：minlen=12, dcredit=-1, ucredit=-1, lcredit=-1, ocredit=-1
- 密码过期：PASS_MAX_DAYS 90
- 账户锁定：deny=5 unlock_time=600

### 内核安全参数（sysctl）

- net.ipv4.ip_forward = 0
- net.ipv4.conf.all.rp_filter = 1
- net.ipv4.tcp_syncookies = 1
- net.ipv4.icmp_echo_ignore_broadcasts = 1

### 服务最小化原则

禁用不需要的服务，只开放必要的端口。