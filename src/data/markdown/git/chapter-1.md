## 2.1 git init —— 初始化仓库

\`\`\`bash
# 在当前目录初始化 Git 仓库
mkdir my-project && cd my-project
git init

# 输出：Initialized empty Git repository in /path/my-project/.git/

# 初始化后目录下会创建 .git/ 目录
ls -la .git/
\`\`\`

## 2.2 git clone —— 克隆仓库

\`\`\`bash
# 克隆远程仓库
git clone https://github.com/user/repo.git

# 克隆到指定目录
git clone https://github.com/user/repo.git my-folder

# 克隆指定分支
git clone -b develop https://github.com/user/repo.git

# 浅克隆（只获取最近 N 次提交，节省时间和空间）
git clone --depth=1 https://github.com/user/repo.git
\`\`\`

## 2.3 git add —— 添加到暂存区

\`\`\`bash
# 添加单个文件
git add README.md

# 添加所有修改的文件
git add .

# 添加指定目录下的所有修改
git add src/

# 添加多个文件
git add file1.txt file2.txt

# 交互式添加（选择部分修改添加）
git add -p

# 添加所有修改（包括删除的文件）
git add -A
\`\`\`

### git add 的注意事项

\`\`\`bash
# git add . vs git add -A
# 在 Git 2.x 中，两者行为相同：添加所有修改、新增和删除
# 在旧版本中，git add . 不会添加仓库根目录的删除操作

# 如果修改了已暂存的文件，需要重新 add
git add file.txt       # 第一次 add
# ... 修改 file.txt ...
git add file.txt       # 需要再次 add 才能暂存新的修改
\`\`\`

## 2.4 git commit —— 提交变更

\`\`\`bash
# 提交暂存区的内容
git commit -m "feat: add login API"

# 打开编辑器编写详细提交信息
git commit

# 跳过暂存区，直接提交所有已跟踪文件的修改
git commit -a -m "fix: correct typo"

# 修改上次提交（追加修改或修改提交信息）
git commit --amend -m "feat: add login API with validation"

# 提交时显示 diff
git commit -v
\`\`\`

### 提交信息模板

\`\`\`
feat: 简短描述（不超过50字符）

详细说明本次变更的内容和原因，每行不超过72字符。
可以分多行写。

- 具体变更1
- 具体变更2

Closes #123
\`\`\`

## 2.5 git status —— 查看状态

\`\`\`bash
git status                    # 查看工作区和暂存区状态
git status -s                 # 简短输出
git status --short            # 同上
\`\`\`

### 状态输出解读

\`\`\`bash
$ git status -s
 M README.md          # 工作区修改，未暂存（M 在第二列）
M  lib/server.py      # 已暂存，未提交（M 在第一列）
MM lib/config.py      # 暂存后又有新修改
A  new_file.txt       # 新添加到暂存区
?? untracked.txt      # 未跟踪的新文件
D  deleted.txt        # 已删除
!! ignored.log        # 被忽略的文件
\`\`\`

## 2.6 git diff —— 查看差异

\`\`\`bash
# 工作区 vs 暂存区（未暂存的修改）
git diff

# 暂存区 vs 仓库（已暂存但未提交的修改）
git diff --cached
git diff --staged            # 同上

# 工作区 vs 仓库（所有修改）
git diff HEAD

# 比较两个提交
git diff commit1 commit2

# 比较两个分支
git diff main..feature

# 只看哪些文件有修改
git diff --name-only

# 统计修改行数
git diff --stat
\`\`\`

## 2.7 git log —— 查看历史

\`\`\`bash
# 查看提交历史
git log

# 单行显示
git log --oneline

# 图形化显示分支合并历史
git log --oneline --graph --all

# 查看最近 N 次提交
git log -5

# 查看指定文件的修改历史
git log -- path/to/file

# 查看每次提交的文件变更统计
git log --stat

# 查看每次提交的具体修改内容
git log -p

# 按作者筛选
git log --author="Alice"

# 按时间筛选
git log --since="2 weeks ago"
git log --after="2024-01-01" --before="2024-02-01"

# 按提交信息搜索
git log --grep="login"

# 自定义输出格式
git log --pretty=format:"%h - %an, %ar : %s"
\`\`\`

### log 格式占位符

| 占位符 | 说明 |
|--------|------|
| %H | 完整哈希 |
| %h | 短哈希 |
| %an | 作者名 |
| %ae | 作者邮箱 |
| %ar | 相对时间 |
| %ad | 绝对时间 |
| %s | 提交信息 |

## 2.8 git push / pull / fetch —— 远程操作

\`\`\`bash
# 推送到远程仓库
git push origin main          # 推送 main 分支到 origin
git push -u origin main       # 首次推送并设置上游跟踪
git push                      # 设置上游后可直接 push

# 拉取远程更新
git pull                      # 拉取并合并（= fetch + merge）
git pull --rebase             # 拉取并变基（= fetch + rebase）
git pull origin main          # 拉取指定远程的指定分支

# 只获取远程更新，不合并
git fetch                     # 获取所有远程分支的更新
git fetch origin              # 获取 origin 的更新
git fetch origin main         # 只获取 main 分支的更新

# fetch 后查看差异
git fetch origin
git diff main origin/main     # 比较本地和远程的差异
git log main..origin/main     # 查看远程有哪些新提交
\`\`\`

### push / pull / fetch 的区别

\`\`\`
git push：本地 → 远程（上传提交）
git fetch：远程 → 本地（下载提交到远程跟踪分支，不修改工作区）
git pull：远程 → 本地（= git fetch + git merge）
\`\`\`

## 2.9 git merge —— 合并分支

\`\`\`bash
# 将 feature 分支合并到当前分支
git checkout main
git merge feature

# 快进合并（Fast-forward）
# 当 main 没有新提交时，直接移动 main 指针到 feature 的最新提交

# 非快进合并（产生合并提交）
git merge --no-ff feature     # 即使可以快进，也创建合并提交

# 合并时不自动提交（可先检查再提交）
git merge --no-commit feature

# 中止合并
git merge --abort
\`\`\`

### 合并冲突

当两个分支修改了同一文件的同一位置时，会产生合并冲突。

\`\`\`bash
# 冲突标记
<<<<<<< HEAD
当前分支的内容
=======
被合并分支的内容
>>>>>>> feature

# 解决冲突步骤：
# 1. 手动编辑冲突文件，选择保留的内容
# 2. 删除冲突标记（<<<<<<<, =======, >>>>>>>）
# 3. git add 标记冲突已解决
# 4. git commit 完成合并
\`\`\`

## 2.10 常用命令速查表

| 命令 | 说明 |
|------|------|
| git init | 初始化仓库 |
| git clone | 克隆远程仓库 |
| git add | 添加到暂存区 |
| git commit | 提交变更 |
| git status | 查看状态 |
| git diff | 查看差异 |
| git log | 查看历史 |
| git push | 推送到远程 |
| git pull | 拉取并合并 |
| git fetch | 拉取不合并 |
| git merge | 合并分支 |