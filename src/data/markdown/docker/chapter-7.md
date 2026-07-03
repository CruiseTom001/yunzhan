## Compose Watch 与本地开发闭环

传统 Docker Compose 更偏“启动一组服务”，开发时经常遇到两个问题：

- 改一行代码就要手动 rebuild，反馈慢。
- 直接把整个项目 bind mount 进容器，容易把 `node_modules`、构建缓存、宿主机差异一起带进去。

Compose Watch 的目标是把“代码变更 → 同步/重启/重建 → 继续调试”变成自动化流程。它通过 `develop.watch` 为每个服务声明文件监听规则，让本地开发更接近生产镜像，又保留热更新体验。

### 适合使用的场景

| 场景 | 推荐动作 | 说明 |
| --- | --- | --- |
| 前端源码、后端业务代码变化 | `sync` | 把本地文件同步进容器，交给框架热更新 |
| 配置文件变化后需要进程重启 | `sync+restart` | 同步后自动重启容器 |
| `package.json`、`requirements.txt`、Dockerfile 变化 | `rebuild` | 依赖或镜像层变化，需要重新构建 |
| 首次启动需要同步已有文件 | `initial_sync: true` | 避免容器启动后缺少初始源码 |

### 最小示例

```yaml
services:
  web:
    build: .
    command: npm run dev -- --host 0.0.0.0
    ports:
      - "5173:5173"
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
          initial_sync: true
          ignore:
            - node_modules/
            - dist/
        - action: rebuild
          path: package.json
        - action: rebuild
          path: package-lock.json
```

运行：

```bash
docker compose watch
```

如果希望启动服务后立刻进入 watch 模式：

```bash
docker compose up --watch
```

### Node.js 项目推荐写法

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    command: npm run dev
    environment:
      NODE_ENV: development
    ports:
      - "3000:3000"
    develop:
      watch:
        - action: sync
          path: ./src
          target: /usr/src/app/src
          initial_sync: true
        - action: sync
          path: ./public
          target: /usr/src/app/public
          initial_sync: true
        - action: rebuild
          path: package.json
        - action: rebuild
          path: package-lock.json
```

关键点：

- 不要把整个项目无脑同步到容器。
- `node_modules` 通常留在镜像或容器内，不从 Windows/macOS 同步进去。
- 依赖文件变化时用 `rebuild`，源码变化时用 `sync`。

### Python 项目推荐写法

```yaml
services:
  api:
    build: .
    command: uvicorn app.main:app --host 0.0.0.0 --reload
    ports:
      - "8000:8000"
    develop:
      watch:
        - action: sync
          path: ./app
          target: /srv/app
          initial_sync: true
          ignore:
            - __pycache__/
            - .pytest_cache/
        - action: rebuild
          path: requirements.txt
```

Python 框架本身带 `--reload` 时，Compose Watch 负责同步文件，框架负责重载进程。

### 生产思维

Compose Watch 不是生产部署工具，但它能帮助你养成生产化习惯：

- 开发环境也从 Dockerfile 构建，不依赖宿主机“刚好装了某个版本”。
- 依赖变化必须重建镜像，避免“容器里和仓库里不是一个状态”。
- 忽略缓存、构建产物、临时文件，降低同步噪声。
- 把开发命令写进 compose 文件，团队新成员拿到代码就能启动。

### 常见问题排查

| 问题 | 排查方向 |
| --- | --- |
| 文件改了容器没变化 | 检查 `path` 是否正确、是否被 `ignore` 排除 |
| 容器里文件变化但服务没重载 | 检查框架是否开启 hot reload，或改用 `sync+restart` |
| 每次保存都很慢 | 缩小 watch 路径，不要同步整个仓库 |
| 依赖安装后仍报缺包 | 依赖文件变化应触发 `rebuild`，不是 `sync` |
| Windows 下路径异常 | 尽量使用相对路径，避免监听系统目录或网盘目录 |

### 实战任务

把一个已有 Node/Vue 或 Python/FastAPI 项目改造成 Compose Watch 开发模式：

1. 服务仍然从 Dockerfile 构建。
2. 源码目录使用 `sync`。
3. 依赖文件使用 `rebuild`。
4. 缓存目录加入 `ignore`。
5. 能通过 `docker compose up --watch` 进入开发闭环。

完成后，你的简历可以这样写：

> 使用 Docker Compose Watch 优化本地容器化开发流程，将源码同步、热更新、依赖重建纳入统一编排，降低团队开发环境差异。
