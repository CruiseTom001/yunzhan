## 3.1 分支基本操作

\`\`\`bash
# 查看分支
git branch                    # 查看本地分支
git branch -a                 # 查看所有分支（含远程）
git branch -v                 # 查看分支及最后一次提交
git branch -vv                # 查看分支及跟踪的远程分支

# 创建分支
git branch feature-login      # 创建新分支（但不切换）
git checkout -b feature-login # 创建并切换到新分支
git switch -c feature-login   # Git 2.23+ 推荐写法

# 切换分支
git checkout main             # 切换到 main 分支
git switch main               # Git 2.23+ 推荐写法

# 删除分支
git branch -d feature-login   # 删除已合并的分支
git branch -D feature-login   # 强制删除分支（即使未合并）

# 重命名分支
git branch -m old-name new-name  # 重命名分支
git branch -m new-name           # 重命名当前分支
\`\`\`

### checkout vs switch vs restore

Git 2.23 将 \`checkout\` 的功能拆分为两个命令：

| 命令 | 用途 |
|------|------|
| git switch | 切换分支 |
| git switch -c | 创建并切换分支 |
| git restore | 恢复工作区文件 |
| git restore --staged | 取消暂存 |

\`\`\`bash
# 旧写法
git checkout -b feature       # 创建并切换分支
git checkout -- file.txt      # 丢弃工作区修改

# 新写法（推荐）
git switch -c feature         # 创建并切换分支
git restore file.txt          # 丢弃工作区修改
git restore --staged file.txt # 取消暂存
\`\`\`

## 3.2 分支工作流模型

### Git Flow

\`\`\`
main:     ──────────────────────────── 稳定发布版本
develop:  ──────────────────────────── 开发主线
feature:       ╭────────╮             功能分支
release:                ╭──────╮      发布分支
hotfix:       ╭──────╮              紧急修复分支
\`\`\`

| 分支类型 | 命名 | 说明 |
|----------|------|------|
| main | main/master | 生产环境代码 |
| develop | develop | 开发集成分支 |
| feature | feature/* | 功能开发 |
| release | release/* | 发布准备 |
| hotfix | hotfix/* | 紧急修复 |

### GitHub Flow（简化版）

\`\`\`
main:     ──────────────────────────── 始终可部署
feature:       ╭────────╮─→ 合并      功能分支 + PR
\`\`\`

- main 分支始终可部署
- 所有开发在 feature 分支进行
- 通过 Pull Request 合并
- 合并后立即部署

### GitLab Flow

结合了 Git Flow 和 GitHub Flow，支持环境分支：

\`\`\`
feature → main → staging → production
\`\`\`

## 3.3 git rebase —— 变基

Rebase 将当前分支的提交"重新播放"到目标分支之上。

### merge vs rebase

\`\`\`
# merge：保留分支历史，创建合并提交
main:     A ── B ── C ────── M
                \\           /
feature:         D ── E ──/

# rebase：线性历史，不产生合并提交
main:     A ── B ── C ── D' ── E'
\`\`\`

\`\`\`bash
# 变基操作
git checkout feature
git rebase main              # 将 feature 的提交变基到 main 之上

# 变基后需要更新远程分支（强制推送）
git push --force-with-lease origin feature

# 交互式变基（可修改、合并、删除提交）
git rebase -i HEAD~3         # 修改最近 3 次提交
\`\`\`

### 交互式 rebase 操作

\`\`\`bash
# 执行 git rebase -i HEAD~3 后打开编辑器：
pick a1b2c3d feat: add login
pick d4e5f6g fix: validate input
pick h7i8j9k docs: update README

# 可用操作：
# pick   = 使用该提交
# reword = 使用该提交，但修改提交信息
# edit   = 使用该提交，但暂停进行修改
# squash = 将该提交合并到前一个提交
# fixup  = 同 squash，但丢弃提交信息
# drop   = 删除该提交
\`\`\`

### Rebase 的黄金法则

> **永远不要对已经推送到远程仓库的提交执行 rebase！**

因为 rebase 会改变提交的哈希值，如果其他人已经基于这些提交工作，会导致历史混乱。

\`\`\`bash
# 什么时候用 rebase：
# ✅ 在推送前整理本地提交历史
# ✅ 将 feature 分支更新到最新的 main

# 什么时候用 merge：
# ✅ 合并已经推送到远程的分支
# ✅ 保留完整的分支历史
# ✅ 不确定时，用 merge 更安全
\`\`\`

### Rebase 冲突处理

\`\`\`bash
# rebase 过程中遇到冲突
# 1. 手动解决冲突
# 2. git add 标记已解决
# 3. git rebase --continue    # 继续变基
# 4. 或 git rebase --skip     # 跳过当前提交
# 5. 或 git rebase --abort    # 放弃变基，回到原始状态
\`\`\`

## 3.4 冲突解决详解

### 产生冲突的场景

\`\`\`bash
# 1. 合并冲突
git merge feature             # 两个分支修改了同一位置

# 2. 变基冲突
git rebase main               # 当前分支的提交与 main 冲突

# 3. 拉取冲突
git pull                      # 本地修改与远程更新冲突
\`\`\`

### 冲突标记详解

\`\`\`
<<<<<<< HEAD
这是当前分支（HEAD）的内容
这是当前分支的第二行
=======
这是被合并分支的内容
这是被合并分支的第二行
>>>>>>> feature-branch
\`\`\`

### 解决冲突的策略

\`\`\`bash
# 策略1：手动编辑（最常用）
# 打开冲突文件，选择需要保留的内容，删除冲突标记

# 策略2：选择一方的版本
git checkout --ours file.txt          # 保留当前分支的版本
git checkout --theirs file.txt        # 保留被合并分支的版本

# 策略3：使用合并工具
git mergetool                         # 使用配置的合并工具

# 策略4：针对特定文件使用策略
git merge -X ours feature             # 冲突时自动选择当前分支
git merge -X theirs feature           # 冲突时自动选择被合并分支
\`\`\`

### 减少冲突的最佳实践

- 频繁从主分支拉取更新（\`git pull --rebase\`）
- 小步提交，减少每次变更的范围
- 团队约定文件修改规则（避免多人修改同一区域）
- 功能拆分到独立文件/模块

## 3.5 分支管理技巧

\`\`\`bash
# 查看已合并到当前分支的分支
git branch --merged

# 查看未合并的分支
git branch --no-merged

# 批量删除已合并的分支
git branch --merged | grep -v "\\*\\|main\\|develop" | xargs -n 1 git branch -d

# 查看分支的创建时间
git reflog show --date=iso feature-branch

# 追踪远程分支
git branch -u origin/feature feature   # 设置本地分支追踪远程分支
git branch -vv                          # 查看追踪关系
\`\`\`