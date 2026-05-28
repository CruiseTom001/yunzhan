## 漏洞扫描与修复

### Nmap 网络扫描

nmap -sS -sV -O -p 1-65535

### OpenVAS（Greenbone）漏洞扫描

Docker 部署 OpenVAS 进行全面的漏洞扫描。

### CVSS 评分与优先级

| CVSS 分数 | 严重程度 | 修复 SLA |
|-----------|----------|----------|
| 9.0-10.0 | Critical | 24 小时内 |
| 7.0-8.9 | High | 72 小时内 |
| 4.0-6.9 | Medium | 2 周内 |
| 0.1-3.9 | Low | 下次维护窗口 |

### 漏洞修复最佳实践

- 系统补丁管理（yum update --security）
- 应用依赖漏洞扫描（npm audit, safety check）
- Docker 镜像扫描（Trivy）