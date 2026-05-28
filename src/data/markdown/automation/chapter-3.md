## Ansible Galaxy 与 Role 组织

### Role 目录结构

roles/myapp/
├── defaults/    # 默认变量
├── vars/        # 高优先级变量
├── tasks/       # 任务列表
├── handlers/    # 处理器
├── templates/   # Jinja2 模板
├── files/       # 静态文件
└── meta/        # Role 元数据

### Ansible Galaxy

- ansible-galaxy search: 搜索 Role
- ansible-galaxy install: 安装 Role
- requirements.yml: 批量管理依赖