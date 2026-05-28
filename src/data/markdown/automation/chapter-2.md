## Playbook 编写实战

### 变量

- vars: Play 级别变量
- vars_files: 外部变量文件
- set_fact: 动态变量
- register: 注册变量

### 条件判断

- when: 条件执行
- 多条件组合
- 基于注册变量的条件

### 循环

- loop: 列表/字典循环
- until: 重试循环
- with_nested: 嵌套循环

### Handlers 处理器

- notify: 通知 handler
- listen: 监听特定通知
- flush_handlers: 强制执行