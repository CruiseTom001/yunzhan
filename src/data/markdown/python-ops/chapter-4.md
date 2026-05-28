## 5.1 logging 模块

Python 标准库的日志模块，支持多级别、多输出、格式化。

### 基本配置

\`\`\`python
import logging

# 简单配置
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    filename="/var/log/myapp/script.log"
)

# 日志级别（从低到高）
logging.debug("Debug message")      # 调试信息
logging.info("Info message")        # 一般信息
logging.warning("Warning message")  # 警告
logging.error("Error message")      # 错误
logging.critical("Critical!")       # 严重错误
\`\`\`

### 日志级别

| 级别 | 数值 | 使用场景 |
|------|------|----------|
| DEBUG | 10 | 调试信息，仅开发时使用 |
| INFO | 20 | 正常运行信息 |
| WARNING | 30 | 警告，不影响运行但需关注 |
| ERROR | 40 | 错误，部分功能受影响 |
| CRITICAL | 50 | 严重错误，程序可能无法继续 |

### 高级配置（推荐）

\`\`\`python
import logging
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler

def setup_logger(name="ops", log_file="/var/log/myapp/script.log", level=logging.INFO):
    """配置日志记录器"""
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # 避免重复添加 handler
    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s %(filename)s:%(lineno)d - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # 控制台输出
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 文件输出（按大小轮转）
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,               # 保留 5 个备份
        encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger

# 使用
logger = setup_logger()
logger.info("Script started")
logger.error("Connection failed", exc_info=True)  # 包含异常堆栈
\`\`\`

### 按时间轮转日志

\`\`\`python
from logging.handlers import TimedRotatingFileHandler

# 每天轮转，保留 30 天
handler = TimedRotatingFileHandler(
    "/var/log/myapp/script.log",
    when="midnight",    # 每天午夜轮转
    interval=1,
    backupCount=30,
    encoding="utf-8"
)
# when 选项：S(秒), M(分), H(小时), D(天), midnight(午夜), W0-W6(星期)
\`\`\`

## 5.2 configparser 模块

处理 INI 格式配置文件。

\`\`\`python
import configparser

# 创建配置
config = configparser.ConfigParser()
config["server"] = {
    "host": "0.0.0.0",
    "port": "8080",
    "debug": "False"
}
config["database"] = {
    "host": "localhost",
    "port": "3306",
    "name": "myapp"
}

# 写入文件
with open("config.ini", "w") as f:
    config.write(f)

# 读取配置
config = configparser.ConfigParser()
config.read("config.ini")

host = config.get("server", "host")           # "0.0.0.0"
port = config.getint("server", "port")         # 8080 (int)
debug = config.getboolean("server", "debug")   # False (bool)

# 带默认值
timeout = config.getint("server", "timeout", fallback=30)

# 检查选项是否存在
if config.has_option("database", "password"):
    password = config.get("database", "password")
\`\`\`

### INI 配置文件格式

\`\`\`ini
[server]
host = 0.0.0.0
port = 8080
debug = False

[database]
host = localhost
port = 3306
name = myapp
\`\`\`

## 5.3 YAML 配置处理

\`\`\`python
# 安装：pip install pyyaml
import yaml

# 读取 YAML
with open("config.yaml", "r") as f:
    config = yaml.safe_load(f)    # safe_load 防止代码注入

# config 是 Python 字典
print(config["server"]["host"])
print(config["database"]["port"])

# 写入 YAML
config = {
    "server": {
        "host": "0.0.0.0",
        "port": 8080,
        "workers": 4
    },
    "database": {
        "host": "localhost",
        "port": 3306,
        "name": "myapp",
        "pool_size": 10
    }
}

with open("config.yaml", "w") as f:
    yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
\`\`\`

### YAML 配置文件格式

\`\`\`yaml
server:
  host: 0.0.0.0
  port: 8080
  workers: 4
  debug: false

database:
  host: localhost
  port: 3306
  name: myapp
  pool_size: 10

logging:
  level: INFO
  file: /var/log/myapp/app.log
\`\`\`

## 5.4 JSON 配置处理

\`\`\`python
import json

# 读取 JSON
with open("config.json", "r") as f:
    config = json.load(f)

# 写入 JSON
with open("config.json", "w") as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

# 字符串与 JSON 互转
json_str = json.dumps(config, indent=2, ensure_ascii=False)
config = json.loads(json_str)

# JSON 配置合并
def merge_config(base, override):
    """递归合并配置字典"""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_config(result[key], value)
        else:
            result[key] = value
    return result
\`\`\`

## 5.5 配置管理最佳实践

\`\`\`python
#!/usr/bin/env python3
"""配置管理模块"""
import os
import yaml
from pathlib import Path

class Config:
    """统一配置管理"""

    def __init__(self, config_file="config.yaml"):
        self._config = {}
        self._load_config(config_file)
        self._load_env_overrides()

    def _load_config(self, config_file):
        """加载配置文件"""
        config_path = Path(config_file)
        if config_path.exists():
            with open(config_path) as f:
                self._config = yaml.safe_load(f) or {}

    def _load_env_overrides(self):
        """环境变量覆盖配置（优先级最高）"""
        # 环境变量格式：APP_SERVER_HOST -> config["server"]["host"]
        for key, value in os.environ.items():
            if key.startswith("APP_"):
                parts = key[4:].lower().split("_")
                d = self._config
                for part in parts[:-1]:
                    d = d.setdefault(part, {})
                d[parts[-1]] = value

    def get(self, key_path, default=None):
        """获取配置值，支持点号路径"""
        keys = key_path.split(".")
        value = self._config
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value

# 使用
config = Config()
host = config.get("server.host", "localhost")
port = config.get("server.port", 8080)
\`\`\`