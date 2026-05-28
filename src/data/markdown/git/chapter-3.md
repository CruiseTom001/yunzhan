## 4.1 远程仓库管理

\`\`\`bash
# 查看远程仓库
git remote                    # 列出远程仓库名
git remote -v                 # 显示远程仓库 URL
git remote show origin        # 查看远程仓库详细信息

# 添加远程仓库
git remote add origin https://github.com/user/repo.git

# 修改远程仓库 URL
git remote set-url origin https://github.com/user/new-repo.git

# 删除远程仓库
git remote remove origin

# 重命名远程仓库
git remote rename old-name new-name
\`\`\`

### 多远程仓库

\`\`\`bash
# 添加多个远程（如 fork 仓库和上游仓库）
git remote add origin https://github.com/yourname/repo.git    # 你的 fork
git remote add upstream https://github.com/original/repo.git  # 上游仓库

# 从上游拉取更新
git fetch upstream
git merge upstream/main

# 推送到自己的 fork
git push origin feature
\`\`\`

## 4.2 远程分支

\`\`\`bash
# 远程分支命名：remotes/origin/main
# 简写：origin/main

# 查看远程分支
git branch -r                 # 查看远程分支
git branch -a                 # 查看所有分支

# 创建本地分支追踪远程分支
git checkout -b feature origin/feature    # 创建并追踪
git switch -c feature origin/feature      # Git 2.23+

# 推送本地分支到远程
git push -u origin feature    # -u 设置上游跟踪
git push origin feature       # 不设置跟踪

# 删除远程分支
git push origin --delete feature
git push origin :feature      # 旧写法（推送空到远程分支）

# 拉取远程新建的分支
git fetch origin
git checkout -b feature origin/feature
\`\`\`

### 远程跟踪分支

\`\`\`bash
# 远程跟踪分支是本地对远程分支状态的缓存
# 命名格式：origin/main, origin/develop 等
# 只在 git fetch/pull 时更新

# 查看远程跟踪分支的详细信息
git remote show origin

# 清理远程已删除但本地仍存在的远程跟踪分支
git remote prune origin
git fetch --prune              # 拉取时自动清理
\`\`\`

## 4.3 Pull Request 工作流

Pull Request（PR）是代码审查和合并的核心流程。

### PR 工作流程

\`\`\`
1. 从 main 创建 feature 分支
2. 在 feature 分支开发
3. 推送 feature 分支到远程
4. 在 GitHub/GitLab 创建 Pull Request
5. 团队成员 Code Review
6. 修改代码（根据 Review 意见）
7. Review 通过后合并到 main
8. 删除 feature 分支
\`\`\`

### 创建 PR 的步骤

\`\`\`bash
# 1. 创建并切换到功能分支
git checkout -b feature/user-auth

# 2. 开发并提交
git add .
git commit -m "feat: implement user authentication"

# 3. 推送到远程
git push -u origin feature/user-auth

# 4. 在 GitHub/GitLab 网页上创建 Pull Request

# 5. 根据 Review 修改后继续推送（PR 自动更新）
git add .
git commit -m "fix: address review comments"
git push
\`\`\`

### PR 最佳实践

| 实践 | 说明 |
|------|------|
| 小而专注 | 每个 PR 只做一件事，便于 Review |
| 清晰描述 | PR 描述说明目的、变更内容、测试方法 |
| 保持更新 | 定期从 main 合并/变基，减少冲突 |
| 自我 Review | 提交 PR 前先自己 Review 一遍 |
| 响应及时 | 及时回复 Review 意见并修改 |

## 4.4 Code Review

Code Review 是团队协作中保证代码质量的关键环节。

### Review 关注点

| 关注点 | 说明 |
|--------|------|
| 正确性 | 代码逻辑是否正确 |
| 可读性 | 代码是否易于理解 |
| 安全性 | 是否存在安全漏洞 |
| 性能 | 是否有性能问题 |
| 规范 | 是否符合编码规范 |
| 测试 | 是否有充分的测试 |

### Review 常用术语

\`\`\`
LGTM (Looks Good To Me)  — 审查通过
Nit / Nitpick             — 小问题（非阻塞）
Blocking                  — 必须修改才能合并
Suggestion                — 建议性修改
ACK (Acknowledged)        — 确认/同意
NACK                      — 不同意
\`\`\`

### Git 中的 Review 工具

\`\`\`bash
# 查看某次提交的详细修改
git show <commit-hash>

# 查看两个版本之间的差异
git diff main..feature

# 查看某个文件的修改历史
git log -p -- path/to/file

# 查看某行代码的修改历史
git log -L 10,20:path/to/file   # 查看第10-20行的修改历史

# 查看谁修改了某行
git blame file.txt
git blame -L 10,20 file.txt     # 查看指定行范围
\`\`\`

## 4.5 团队协作规范

### 提交规范

\`\`\`bash
# 提交信息格式
<type>(<scope>): <subject>

# 示例
feat(auth): add JWT token refresh
fix(api): handle null response from server
docs(readme): update installation guide
refactor(db): optimize query performance
\`\`\`

### 分支命名规范

\`\`\`bash
feature/JIRA-123-user-auth    # 功能分支
bugfix/JIRA-456-login-error   # 修复分支
hotfix/JIRA-789-crash         # 紧急修复
release/v2.0.0                # 发布分支
\`\`\`

### 代码仓库保护规则

\`\`\`
1. main/develop 分支保护
   - 禁止直接 push
   - 必须通过 PR 合并
   - 至少 1-2 人 Review 通过
   - CI 检查通过

2. 强制签名提交（GPG）

3. 线性历史（禁止 merge commit，只允许 squash/rebase merge）
\`\`\`