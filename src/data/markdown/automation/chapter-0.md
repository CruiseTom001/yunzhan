## Ansible 基础

Ansible 是一个开源的 IT 自动化工具，使用 SSH 协议与目标主机通信，无需在目标主机上安装 Agent。

### 核心概念

| 概念 | 说明 |
|------|------|
| Control Node | 控制节点 |
| Managed Node | 被管理节点 |
| Inventory | 主机清单 |
| Module | 模块 |
| Playbook | 剧本（YAML 格式） |
| Role | 角色（可复用的组织单元） |
| Facts | 主机信息 |

### 基本命令使用

- ansible all -m ping：测试连通性
- ansible web -m command -a "uptime"：执行命令
- ansible-playbook playbook.yml：执行 Playbook
- ansible-playbook playbook.yml --check：Dry-Run 模式