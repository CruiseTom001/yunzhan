## 6.1 技术栈总览

本项目实战覆盖了 **云计算入门到精通** 全部 6 个阶段的核心技能：

| 阶段 | 技能 | 在本项目中的实践 |
|------|------|-----------------|
| 基础 | Linux 命令 | Shell 脚本编写、文件操作、权限管理 |
| 核心 | Docker | docker compose 多服务编排、数据卷管理 |
| 进阶 | Nginx | 反向代理、虚拟主机、FastCGI、Gzip、限流 |
| 进阶 | MySQL | 数据库持久化、mysqldump 备份 |
| 进阶 | Redis | 缓存服务配置与连接 |
| 架构 | Prometheus | 指标采集、告警规则、exporter 配置 |
| 架构 | Grafana | 仪表板导入、可视化监控 |
| 实战 | Shell 脚本 | 自动备份、健康检查、一键部署 |

## 6.2 写在简历上的项目描述

```
企业级 DevOps 平台部署与监控系统

【个人项目】2024年独立完成

项目描述：
基于 Docker Compose 编排的企业级多服务运维平台，实现 LNMP
（Linux/Nginx/MySQL/PHP）部署、Redis 缓存、Prometheus 全栈监
控与 Grafana 可视化看板，集成自动备份、健康检查、日志轮转等
生产级运维能力。

技术栈：
• 容器化：Docker、Docker Compose、多服务编排
• Web 服务：Nginx 反向代理、FastCGI、Gzip 压缩、SSL
• 数据层：MySQL 8.0、Redis 7、WordPress
• 监控运维：Prometheus、Grafana、Node Exporter、MySQL Exporter
• 自动化：Shell 脚本、Crontab 定时任务、Logrotate 日志管理

核心成果：
• 搭建了 7 个容器的生产级微服务架构
• 配置了 4 条 Prometheus 告警规则（CPU/内存/磁盘/服务状态）
• 实现了数据库每日自动备份，保留 30 天历史
• 编写一键部署脚本，新环境 5 分钟内完成部署
```

## 6.3 面试要点

### 可能会被问到的问题

1. **为什么用 Docker Compose 而不是 Kubernetes？**
   > Docker Compose 适合单机多服务部署场景，简单高效。对于学习和小型项目足够。K8s 更适合大规模集群编排。

2. **Nginx 反向代理和正向代理有什么区别？**
   > 反向代理代服务端接收请求（对客户端透明的服务端代理），正向代理代客户端访问外部资源。

3. **Prometheus 的 pull 模式和 push 模式有什么区别？**
   > Prometheus 默认用 pull 模式主动拉取 metrics。短生命周期任务使用 Pushgateway 做 push。

4. **如何保证数据库备份的可靠性？**
   > 使用 mysqldump 导出 + gzip 压缩 + scp 异地备份。配合 crontab 定时执行，监控脚本日志。

5. **如果服务挂了如何排查？**
   > 先看健康检查脚本的告警 → docker compose logs 查日志 → Prometheus/Grafana 看指标趋势 → 针对性修复。

## 6.4 生产化改进建议

| 方向 | 改进 |
|------|------|
| 高可用 | 引入 Nginx Keepalived 双机热备 |
| CI/CD | GitHub Actions 自动构建和部署 |
| 日志 | ELK（Elasticsearch + Logstash + Kibana）集中日志 |
| 安全 | 加入防火墙规则、fail2ban 防暴力破解、SSL 证书自动续期 |
| 监控 | 加入 Alertmanager 告警通知（邮件/钉钉/微信） |
| 容器 | 迁移到 Kubernetes + Helm 编排 |

---

✅ **恭喜！完成这个实战项目后，你已经掌握了从 Linux 基础到企业级 DevOps 平台的完整技能栈，可以在简历上骄傲地写上这段经历了。**
