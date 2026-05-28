## 3.1 Linux 权限模型

Linux 系统中，每个文件和目录都有三组权限，分别对应三类用户：

| 类型 | 字符 | 数值 |
|------|------|------|
| 读 (read) | r | 4 |
| 写 (write) | w | 2 |
| 执行 (execute) | x | 1 |

| 用户类别 | 说明 |
|----------|------|
| Owner (u) | 文件所有者 |
| Group (g) | 所属组 |
| Others (o) | 其他人 |

### 解读权限字符串

\`\`\`
-rwxr-xr--  1  alice  dev  4096  May 20 10:00  script.sh
 └┬┘└┬┘└┬┘
  │  │  └── Others: r-- (4+0+0=4)
  │  └───── Group:  r-x (4+0+1=5)
  └──────── Owner:  rwx (4+2+1=7)
\`\`\`

### 权限数值对照表

| 数值 | 权限 | 含义 |
|------|------|------|
| 7 | rwx | 读+写+执行 |
| 6 | rw- | 读+写 |
| 5 | r-x | 读+执行 |
| 4 | r-- | 只读 |
| 3 | -wx | 写+执行 |
| 2 | -w- | 只写 |
| 1 | --x | 仅执行 |
| 0 | --- | 无权限 |

**常用权限组合：**
- \`755\`：目录默认权限（rwxr-xr-x）
- \`644\`：文件默认权限（rw-r--r--）
- \`700\`：私密目录（仅所有者可访问）
- \`600\`：私密文件（如 SSH 私钥）
- \`777\`：完全开放（**危险，不推荐**）

## 3.2 chmod —— 修改权限

### 符号模式

\`\`\`bash
chmod u+x script.sh       # 给所有者添加执行权限
chmod g-w file.txt        # 移除组的写权限
chmod o= file.txt         # 清空其他人的所有权限
chmod a+r file.txt        # 所有人添加读权限（a = u+g+o）
chmod u=rwx,g=rx,o= script.sh   # 精确设置权限
\`\`\`

### 数字模式（推荐）

\`\`\`bash
chmod 755 script.sh       # rwxr-xr-x
chmod 644 config.ini      # rw-r--r--
chmod 600 ~/.ssh/id_rsa   # rw-------
chmod -R 755 /app/public  # 递归修改目录下所有文件
\`\`\`

## 3.3 chown —— 修改所有者

\`\`\`bash
chown alice file.txt                # 修改文件所有者
chown alice:dev file.txt            # 同时修改所有者和组
chown :dev file.txt                 # 只修改组
chown -R alice:dev /app/data        # 递归修改目录
\`\`\`

## 3.4 chgrp —— 修改所属组

\`\`\`bash
chgrp dev file.txt
chgrp -R dev /app/shared
\`\`\`

## 3.5 umask —— 默认权限掩码

\`umask\` 决定了新建文件和目录的默认权限。

\`\`\`bash
umask           # 查看当前 umask（通常是 0022）
umask 027       # 设置为 027
\`\`\`

### 计算规则

- 文件默认权限 = 666 - umask
- 目录默认权限 = 777 - umask
- umask 0022 → 文件 644，目录 755
- umask 0077 → 文件 600，目录 700

## 3.6 su / sudo —— 切换用户

\`\`\`bash
su - username           # 切换用户并加载环境变量
su -                    # 切换到 root
su -c "command" user    # 以指定用户执行命令

sudo command            # 以 root 权限执行命令
sudo -u alice command   # 以指定用户权限执行命令
sudo -i                 # 切换到 root 交互环境
sudo !!                 # 以 sudo 重新执行上一条命令
\`\`\`

### /etc/sudoers 配置

\`\`\`bash
# 使用 visudo 编辑（不要直接编辑文件！）
sudo visudo

# 配置示例
alice   ALL=(ALL)       ALL           # alice 可以执行所有命令
bob     ALL=(ALL)       NOPASSWD: /usr/bin/systemctl restart nginx  # 免密码执行指定命令
%dev    ALL=(ALL)       ALL           # dev 组的所有用户
\`\`\`

## 3.7 用户管理命令

\`\`\`bash
# 添加用户
useradd -m -s /bin/bash alice        # -m 创建家目录，-s 指定 shell
useradd -g dev -G docker alice       # -g 主组，-G 附加组

# 设置/修改密码
passwd alice

# 修改用户
usermod -aG docker alice             # 追加附加组（切记加 -a）
usermod -s /bin/zsh alice            # 修改默认 shell
usermod -L alice / usermod -U alice  # 锁定/解锁账户

# 删除用户
userdel alice                         # 只删除用户
userdel -r alice                      # 同时删除家目录和邮件

# 用户信息查看
id alice                              # 查看 UID、GID、所属组
whoami                                # 查看当前用户
who / w                               # 查看登录用户
last                                  # 查看登录历史
\`\`\`

## 3.8 组管理命令

\`\`\`bash
groupadd dev                          # 创建组
groupmod -n developers dev            # 重命名组
groupdel dev                          # 删除组
groups alice                          # 查看用户所属组
\`\`\`

## 3.9 特殊权限

| 权限 | 字符 | 数值 | 说明 |
|------|------|------|------|
| SUID | s (owner x 位) | 4 | 以文件所有者的身份执行（如 /usr/bin/passwd） |
| SGID | s (group x 位) | 2 | 以文件所属组的身份执行；目录内新建文件继承目录组 |
| Sticky | t (others x 位) | 1 | 只有文件所有者能删除（如 /tmp 目录） |

\`\`\`bash
chmod u+s /path/to/binary    # 设置 SUID
chmod g+s /shared/dir        # 设置 SGID（目录）
chmod +t /tmp                # 设置粘滞位
# 数字模式：chmod 4755 (SUID), chmod 2755 (SGID), chmod 1777 (Sticky)
\`\`\`