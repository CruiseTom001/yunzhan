## Ansible 常用模块

### 命令执行模块

- command: 执行简单命令
- shell: 执行 shell 命令（支持管道）
- script: 在远程执行本地脚本

### 文件操作模块

- copy: 复制文件到远程
- template: 使用 Jinja2 模板
- file: 管理文件/目录属性
- fetch: 从远程拉取文件

### 软件包管理

- apt (Debian/Ubuntu)
- yum (CentOS/RHEL)

### 服务管理

- service: 通用服务管理
- systemd: 更精细的 systemd 控制

### 用户和权限管理

- user: 创建/删除用户
- group: 管理组
- authorized_key: SSH 公钥管理