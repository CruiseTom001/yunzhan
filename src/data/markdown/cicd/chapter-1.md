## GitLab CI 实战

GitLab CI/CD 是 GitLab 内置的持续集成和持续部署工具，通过 .gitlab-ci.yml 文件定义流水线。

### .gitlab-ci.yml 基础结构

定义 stages、jobs、variables、cache、artifacts 等配置。

### 完整的 Node.js 应用 Pipeline

包含 install、lint、test、build、docker、deploy 多阶段流水线。

### 条件执行与规则

使用 rules 或 only/except 控制 job 的执行条件。

### 并行执行与矩阵构建

使用 parallel:matrix 实现多版本测试。

### GitLab Runner 配置

安装和注册 GitLab Runner 用于执行流水线任务。