## 项目概述

本项目是在本地搭建一个**企业级 Web 服务部署与监控平台**，完整实践 Linux、Docker、Nginx、MySQL、Redis、Prometheus、Grafana 等技术栈。

💡 **写在简历上的话：**
> 独立设计并部署了一个基于 Docker Compose 的企业级多服务架构平台，包含 LNMP 环境、Redis 缓存、Nginx 反向代理、Prometheus 监控与 Grafana 可视化，涵盖日志收集、自动备份、健康检查等生产级运维能力。

## 项目架构

```
                         Internet
                            │
                    ┌───────▼───────┐
                    │  Nginx (443)  │  ← 反向代理 + SSL
                    └───────┬───────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
    ┌───────▼───────┐ ┌─────▼─────┐ ┌───────▼───────┐
    │  WordPress    │ │  Grafana  │ │  静态页面      │
    │  (PHP + Nginx)│ │  (端口3000)│ │  (HTML/CSS)   │
    └───────┬───────┘ └─────┬─────┘ └───────────────┘
            │               │
    ┌───────▼───────┐ ┌─────▼─────┐
    │  MySQL 数据库  │ │Prometheus │
    └───────┬───────┘ └─────┬─────┘
            │               │
    ┌───────▼───────────────▼───────┐
    │         Redis 缓存            │
    └───────────────────────────────┘
```

## 涉及技术

| 技术 | 用途 |
|------|------|
| Docker + Docker Compose | 容器化编排 |
| Nginx | 反向代理/负载均衡/SSL |
| MySQL | 数据持久化 |
| Redis | 缓存层 |
| Prometheus | 指标监控 |
| Grafana | 可视化仪表板 |
| Node Exporter | 系统级监控 |
| Shell Script | 自动备份脚本 |
| Git | 版本控制 |

## 项目文件结构

```bash
~/devops-platform/
├── docker-compose.yml      # 核心编排文件
├── .env                     # 环境变量
├── nginx/
│   ├── nginx.conf           # 主配置文件
│   ├── conf.d/
│   │   ├── wordpress.conf   # WordPress 虚拟主机
│   │   └── grafana.conf     # Grafana 虚拟主机
│   └── ssl/                 # SSL 证书
├── prometheus/
│   └── prometheus.yml       # 监控配置
├── grafana/
│   └── dashboards/          # 预置仪表板 JSON
├── scripts/
│   ├── backup.sh            # 数据库自动备份
│   ├── healthcheck.sh       # 健康检查脚本
│   └── deploy.sh            # 一键部署脚本
├── www/
│   └── index.html           # 静态首页
└── README.md
```
