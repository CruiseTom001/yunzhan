## Filebeat 配置与使用

Filebeat 是 Elastic 公司开发的轻量级日志采集器，内存占用极低（约 20MB）。

### 核心配置：filebeat.yml

- filebeat.inputs: 日志输入配置
- output: 输出目标（Logstash / Elasticsearch / Kafka）
- processors: 数据预处理
- 多行日志合并

### 多行日志处理三种模式

1. 时间戳开头（推荐）
2. 特定标记
3. Java 异常堆栈

### Registry 文件机制

Filebeat 使用 registry 文件跟踪读取进度，删除会导致数据重复。

### 常用运维命令

- filebeat test config
- filebeat test output
- filebeat inspect