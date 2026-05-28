## 1.1 什么是版本控制

版本控制（Version Control）是记录文件内容变化，以便将来查阅特定版本修订情况的系统。

### 为什么需要版本控制

| 没有版本控制 | 有版本控制 |
|-------------|-----------|
| 手动备份文件（report_v1, report_v2...） | 自动记录每次变更 |
| 无法追溯谁改了什么 | 完整的变更历史和作者信息 |
| 多人协作容易覆盖 | 并行开发，合并管理 |
| 误删无法恢复 | 随时回退到任意版本 |
| 变更原因不明 | 每次提交附带说明信息 |

### 版本控制系统的演进

| 类型 | 代表 | 特点 |
|------|------|------|
| 本地版本控制 | RCS | 只在本地管理版本 |
| 集中式 | SVN, CVS | 单一中央服务器，需联网 |
| 分布式 | Git, Mercurial | 每人拥有完整仓库副本 |

## 1.2 Git 简介

Git 是 Linus Torvalds 在 2005 年为管理 Linux 内核代码而创建的分布式版本控制系统。

### Git 的核心特点

| 特点 | 说明 |
|------|------|
| 分布式 | 每个开发者拥有完整的仓库历史 |
| 快速 | 大部分操作在本地完成，无需网络 |
| 数据完整性 | 使用 SHA-1 哈希校验，确保数据不被篡改 |
| 轻量分支 | 创建和切换分支几乎瞬间完成 |
| 暂存区 | 精确控制每次提交的内容 |

## 1.3 Git 的三个区域

理解 Git 的三个区域是掌握 Git 的关键：

\`\`\`
工作区 (Working Directory)    暂存区 (Staging Area)     本地仓库 (Repository)
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  实际的文件目录   │      │  Index/Stage     │      │  .git/ 目录      │
│  你编辑文件的地方  │      │  下次提交的内容   │      │  所有提交历史     │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         │  git add               │  git commit            │
         │───────────────────────►│───────────────────────►│
         │                        │                        │
         │  git diff              │  git diff --cached     │
         │◄───────────────────────│◄───────────────────────│
         │                        │                        │
         │  git checkout / git restore                    │
         │◄───────────────────────────────────────────────│
\`\`\`

### 文件的三种状态

| 状态 | 说明 | 所在区域 |
|------|------|----------|
| 已修改（Modified） | 修改了文件，但还没暂存 | 工作区 |
| 已暂存（Staged） | 修改已添加到暂存区，将在下次提交 | 暂存区 |
| 已提交（Committed） | 数据已安全保存在本地仓库 | 仓库 |

## 1.4 仓库（Repository）

仓库是 Git 管理的项目目录，包含所有文件和完整的变更历史。

\`\`\`bash
# 仓库结构
my-project/
├── .git/              # Git 仓库数据（不要手动修改！）
│   ├── HEAD           # 当前分支引用
│   ├── config         # 仓库配置
│   ├── objects/       # 所有数据对象（blob, tree, commit）
│   ├── refs/          # 分支和标签引用
│   └── index          # 暂存区
├── src/               # 工作区文件
├── README.md
└── .gitignore         # 忽略文件配置
\`\`\`

### Git 的数据模型

Git 将所有数据存储为**对象**：

| 对象类型 | 说明 | 内容 |
|----------|------|------|
| Blob | 文件内容 | 文件的原始数据（不包含文件名） |
| Tree | 目录结构 | 文件名 + Blob 引用 / 子目录名 + Tree 引用 |
| Commit | 提交记录 | Tree 引用 + 父提交 + 作者 + 时间 + 消息 |
| Tag | 标签 | 指向特定 Commit 的命名引用 |

\`\`\`
Commit → Tree → Blob (文件内容)
              → Tree → Blob (子目录中的文件)

每次提交生成一个完整的目录快照，而非差异！
\`\`\`

## 1.5 提交（Commit）

提交是 Git 中的基本操作单位，每次提交记录一个完整的项目快照。

### 提交的组成

\`\`\`
commit a1b2c3d4e5f6... (SHA-1 哈希值，唯一标识)
Author: Alice <alice@example.com>
Date:   Mon Jan 15 10:30:00 2024 +0800

    feat: add user login API

    - Implement JWT authentication
    - Add login endpoint
\`\`\`

### 好的提交信息规范

\`\`\`
<type>(<scope>): <subject>

<body>

<footer>
\`\`\`

| Type | 说明 |
|------|------|
| feat | 新功能 |
| fix | 修复 Bug |
| docs | 文档变更 |
| style | 代码格式（不影响逻辑） |
| refactor | 重构 |
| test | 测试相关 |
| chore | 构建/工具变更 |

### 提交最佳实践

- 每次提交只做一件事（原子提交）
- 提交信息清晰描述变更内容
- 不要提交半成品代码
- 不要提交自动生成的文件和敏感信息

## 1.6 分支（Branch）

分支是指向某个 Commit 的可移动指针，是 Git 最强大的特性之一。

\`\`\`
main:     A ── B ── C ── D ── E
                \\
feature:         F ── G ── H

HEAD → main (当前分支)
\`\`\`

### 分支的本质

\`\`\`bash
# 分支只是一个包含 40 字符 SHA-1 哈希值的文件
cat .git/refs/heads/main
# 输出：a1b2c3d4e5f6789...

# 创建分支只是创建一个新文件，指向某个 Commit
# 所以 Git 创建分支是 O(1) 操作，非常快
\`\`\`

### HEAD 指针

HEAD 是一个特殊指针，指向当前所在的分支（或直接指向某个 Commit，即" detached HEAD "状态）。

\`\`\`bash
# 查看 HEAD 指向
cat .git/HEAD
# 输出：ref: refs/heads/main

# 分离 HEAD 状态（直接 checkout 到某个 commit）
git checkout a1b2c3d
# 此时 HEAD 直接指向该 commit，不在任何分支上
\`\`\`

## 1.7 Git 配置

\`\`\`bash
# 设置用户名和邮箱（必须配置）
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

# 查看配置
git config --list
git config user.name

# 配置级别
# --system  → /etc/gitconfig（系统级）
# --global  → ~/.gitconfig（用户级）
# --local   → .git/config（仓库级，默认）

# 常用配置
git config --global core.editor vim          # 默认编辑器
git config --global init.defaultBranch main  # 默认分支名
git config --global alias.st status          # 别名
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.lg "log --oneline --graph --all"
\`\`\`

## 1.8 .gitignore 文件

\`\`\`bash
# .gitignore 示例
# 忽略编译产物
*.o
*.class
__pycache__/
node_modules/
dist/
build/

# 忽略 IDE 配置
.vscode/
.idea/
*.swp

# 忽略环境配置（包含敏感信息）
.env
*.pem
*.key

# 忽略日志
*.log
logs/

# 但不忽略某个特定文件（! 取反）
!important.log
\`\`\`