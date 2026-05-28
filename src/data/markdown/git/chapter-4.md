## 5.1 git stash —— 暂存工作区

当需要临时切换分支但不想提交当前修改时，使用 stash 保存工作进度。

\`\`\`bash
# 保存当前工作区修改
git stash                     # 保存修改（不包括未跟踪文件）
git stash -u                  # 包含未跟踪文件
git stash -a                  # 包含所有文件（含忽略的文件）
git stash save "描述信息"      # 带描述的保存

# 查看 stash 列表
git stash list
# stash@{0}: On feature: 描述信息
# stash@{1}: On main: WIP

# 恢复 stash
git stash pop                 # 恢复最近一个 stash 并删除
git stash pop stash@{1}       # 恢复指定 stash
git stash apply               # 恢复但不删除 stash
git stash apply stash@{1}     # 恢复指定 stash

# 删除 stash
git stash drop stash@{0}      # 删除指定 stash
git stash clear               # 删除所有 stash

# 查看 stash 内容
git stash show                # 查看 stash 的文件变更
git stash show -p             # 查看 stash 的详细 diff

# 从 stash 创建分支
git stash branch new-branch   # 从 stash 创建新分支
\`\`\`

### stash 使用场景

\`\`\`bash
# 场景1：紧急修复 Bug
git stash                     # 暂存当前开发
git checkout main
git checkout -b hotfix/bug-123
# ... 修复 Bug ...
git commit -m "fix: resolve bug #123"
git checkout feature
git stash pop                 # 恢复开发

# 场景2：切换分支测试
git stash
git checkout other-branch
# ... 测试 ...
git checkout feature
git stash pop
\`\`\`

## 5.2 git cherry-pick —— 摘取提交

将指定的提交应用到当前分支。

\`\`\`bash
# 摘取单个提交
git cherry-pick a1b2c3d

# 摘取多个提交
git cherry-pick a1b2c3d e4f5g6h

# 摘取提交范围
git cherry-pick commit1..commit2

# 只摘取但不自动提交
git cherry-pick -n a1b2c3d

# 解决 cherry-pick 冲突
# 1. 手动解决冲突
# 2. git add .
# 3. git cherry-pick --continue
# 4. 或 git cherry-pick --abort（放弃）
\`\`\`

### cherry-pick 使用场景

\`\`\`bash
# 场景1：将 hotfix 应用到多个分支
git checkout main
git cherry-pick hotfix-commit  # 应用到 main

git checkout release/v1.0
git cherry-pick hotfix-commit  # 也应用到 release 分支

# 场景2：只合并某个功能提交
git checkout main
git cherry-pick feature-commit # 只摘取需要的提交
\`\`\`

## 5.3 git reset —— 重置提交

\`\`\`bash
# --soft：只移动 HEAD，暂存区和工作区不变
git reset --soft HEAD~1       # 撤销最近一次提交，修改保留在暂存区

# --mixed（默认）：移动 HEAD，重置暂存区，工作区不变
git reset HEAD~1              # 撤销最近一次提交和暂存，修改保留在工作区
git reset --mixed HEAD~1      # 同上

# --hard：移动 HEAD，重置暂存区和工作区（危险！）
git reset --hard HEAD~1       # 撤销最近一次提交，所有修改丢弃！
\`\`\`

### reset 三种模式对比

\`\`\`
                HEAD位置   暂存区   工作区
--soft          改变      不变     不变     ← 只撤销提交
--mixed(默认)   改变      改变     不变     ← 撤销提交 + 取消暂存
--hard          改变      改变     改变     ← 全部撤销（危险）
\`\`\`

### reset 使用场景

\`\`\`bash
# 场景1：提交后发现漏了文件
git reset --soft HEAD~1       # 撤销提交，修改保留在暂存区
git add forgotten-file.txt    # 添加遗漏的文件
git commit -c ORIG_HEAD       # 使用原来的提交信息重新提交

# 场景2：撤销错误的暂存
git reset HEAD file.txt       # 取消 file.txt 的暂存

# 场景3：完全回退到某个版本
git reset --hard a1b2c3d      # 回退到指定提交（之后的修改全部丢失！）
\`\`\`

## 5.4 git revert —— 反做提交

创建一个新的提交来撤销指定提交的修改（不修改历史）。

\`\`\`bash
# 反做最近一次提交
git revert HEAD

# 反做指定提交
git revert a1b2c3d

# 反做多个提交
git revert a1b2c3d e4f5g6h

# 反做但不自动提交
git revert -n a1b2c3d

# 反做合并提交
git revert -m 1 merge-commit  # -m 1 保留第一个父分支的版本
\`\`\`

### reset vs revert

| 特性 | reset | revert |
|------|-------|--------|
| 修改历史 | 是（重写提交历史） | 否（新增撤销提交） |
| 安全性 | 已推送的提交不应 reset | 安全，适合已推送的提交 |
| 协作影响 | 影响其他开发者 | 不影响其他开发者 |
| 适用场景 | 本地未推送的提交 | 已推送到远程的提交 |

\`\`\`bash
# 已推送的提交 → 用 revert
git revert a1b2c3d            # 安全撤销

# 未推送的提交 → 用 reset
git reset --soft HEAD~1       # 撤销本地提交
\`\`\`

## 5.5 git bisect —— 二分查找 Bug

使用二分法定位引入 Bug 的提交。

\`\`\`bash
# 开始二分查找
git bisect start

# 标记当前版本有 Bug
git bisect bad

# 标记已知正常的版本
git bisect good v1.0.0

# Git 自动 checkout 到中间版本
# 测试后标记
git bisect good               # 当前版本正常
git bisect bad                # 当前版本有 Bug

# 重复直到找到引入 Bug 的提交
# Git 会提示：xxx is the first bad commit

# 结束二分查找
git bisect reset

# 自动化二分查找
git bisect start HEAD v1.0.0 --
git bisect run ./test.sh      # 用脚本自动判断（0=good, 1-124=bad, 125=skip）
\`\`\`

## 5.6 git tag —— 标签管理

标签用于标记重要的版本节点（如发布版本）。

\`\`\`bash
# 创建轻量标签
git tag v1.0.0

# 创建附注标签（推荐，包含作者、日期、信息）
git tag -a v1.0.0 -m "Release version 1.0.0"

# 查看标签
git tag                       # 列出所有标签
git tag -l "v1.*"             # 按模式筛选
git show v1.0.0               # 查看标签信息

# 给历史提交打标签
git tag -a v0.9.0 a1b2c3d -m "Version 0.9.0"

# 推送标签到远程
git push origin v1.0.0        # 推送单个标签
git push origin --tags        # 推送所有标签

# 删除标签
git tag -d v1.0.0             # 删除本地标签
git push origin --delete v1.0.0  # 删除远程标签

# 检出标签
git checkout v1.0.0           # 进入 detached HEAD 状态
git checkout -b fix-v1.0.0 v1.0.0  # 基于标签创建分支
\`\`\`

### 语义化版本号

\`\`\`
v1.2.3
│ │ │
│ │ └── Patch：Bug 修复（兼容）
│ └──── Minor：新功能（兼容）
└────── Major：重大变更（不兼容）
\`\`\`

## 5.7 git reflog —— 引用日志

reflog 记录 HEAD 的所有移动历史，是恢复误操作的最后防线。

\`\`\`bash
# 查看引用日志
git reflog

# 输出示例：
# a1b2c3d HEAD@{0}: commit: feat: add feature
# d4e5f6g HEAD@{1}: checkout: moving from main to feature
# h7i8j9k HEAD@{2}: commit: fix: resolve bug

# 恢复误删的提交
git reflog                    # 找到误删前的提交哈希
git reset --hard a1b2c3d      # 恢复到该提交

# 恢复误删的分支
git reflog                    # 找到分支指向的提交
git checkout -b recovered-branch a1b2c3d
\`\`\`

> **重要**：reflog 只保留本地操作记录，且默认保留 90 天。它是恢复误操作的利器！