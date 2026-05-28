export interface SandboxResult {
  output: string
  clear?: boolean
}

export const sandboxWelcomeLines = [
  '\x1b[1;36m云栈 DevOps 实验终端\x1b[0m',
  '\x1b[2m输入 help 查看可用模拟命令；命令会用于实验判定与进度记录。\x1b[0m',
]

function includesAny(value: string, words: string[]): boolean {
  return words.some(word => value.includes(word))
}

export function executeSandboxCommand(command: string): SandboxResult {
  const fullCmd = command.trim()
  const [main = ''] = fullCmd.split(/\s+/)

  switch (main.toLowerCase()) {
    case 'help':
      return {
        output: [
          '\x1b[1;36m可用命令：\x1b[0m',
          '  ls  pwd  whoami  clear  date  uname  uptime  df  free  ps',
          '  echo  cat  env  hostname  grep  curl  ping  ss',
          '  docker  git  kubectl  systemctl  journalctl',
          '',
          '\x1b[2m这是浏览器内的训练沙箱，可放心运行课程和实验命令。\x1b[0m',
        ].join('\n'),
      }

    case 'ls':
      if (fullCmd.includes('-l')) {
        return {
          output: [
            'drwxr-xr-x   2 root root  4096 Jan 15 10:30 bin',
            'drwxr-xr-x  27 root root  4096 Jan 15 10:30 etc',
            'drwxr-xr-x   3 user user  4096 Jan 15 10:30 home',
            'drwxr-xr-x   9 root root  4096 Jan 15 10:30 usr',
            'drwxr-xr-x   8 root root  4096 Jan 15 10:30 var',
            'drwxrwxrwt   6 root root  4096 Jan 15 11:00 tmp',
            'drwxr-xr-x  14 root root  3800 Jan 15 10:30 dev',
            'dr-xr-xr-x 120 root root     0 Jan 15 10:30 proc',
          ].join('\n'),
        }
      }
      return { output: '\x1b[1;34mbin\x1b[0m  \x1b[1;34metc\x1b[0m  \x1b[1;34mhome\x1b[0m  \x1b[1;34musr\x1b[0m  \x1b[1;34mvar\x1b[0m  \x1b[1;34mtmp\x1b[0m  \x1b[1;36mdev\x1b[0m  \x1b[1;36mproc\x1b[0m' }

    case 'pwd':
      return { output: '/home/user/devops-lab' }

    case 'whoami':
      return { output: 'user' }

    case 'clear':
      return { output: '', clear: true }

    case 'date':
      return { output: new Date().toString() }

    case 'uname':
      return { output: 'Linux devops-server 5.15.0 x86_64 GNU/Linux' }

    case 'uptime':
      return { output: ' 10:30:00 up 7 days, 2 users, load average: 0.15, 0.10, 0.08' }

    case 'df':
      return { output: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   15G   33G  32% /\n/dev/sdb1       100G   45G   55G  45% /data' }

    case 'free':
      return { output: '              total        used        free      shared  buff/cache   available\nMem:          7.8G        2.3G        3.1G        256M        2.4G        5.0G\nSwap:         2.0G          0B        2.0G' }

    case 'ps':
      return { output: 'PID  %CPU %MEM  COMMAND\n  1   0.0  0.1  init\n342   0.0  0.3  nginx\n567   0.1  1.2  docker\n891   0.2  0.8  node' }

    case 'echo':
      return { output: fullCmd.slice(5).trim() }

    case 'cat':
      return { output: `模拟文件：${fullCmd.slice(4).trim() || '/etc/os-release'}\nNAME="Yunzhan Training Linux"\nVERSION="2026 Lab"` }

    case 'env':
      return { output: 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin\nHOME=/home/user\nUSER=user\nSHELL=/bin/bash' }

    case 'hostname':
      return { output: 'devops-server' }

    case 'grep':
      return { output: includesAny(fullCmd, ['error', 'ERROR']) ? '2026-05-27 10:31:22 ERROR nginx upstream timeout\n2026-05-27 10:31:45 ERROR api 502 bad gateway' : 'grep: simulated match line from /var/log/app.log' }

    case 'curl':
      if (fullCmd.includes('-I')) {
        return { output: 'HTTP/1.1 200 OK\nServer: nginx\nContent-Type: text/html\nCache-Control: max-age=300' }
      }
      return { output: '{"status":"ok","service":"yunzhan-demo","latency_ms":18}' }

    case 'ping':
      return { output: 'PING gateway (10.0.0.1): 56 data bytes\n64 bytes from 10.0.0.1: icmp_seq=0 ttl=64 time=0.42 ms\n64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.39 ms' }

    case 'ss':
    case 'netstat':
      return { output: 'State   Local Address:Port   Peer Address:Port   Process\nLISTEN  0.0.0.0:80           0.0.0.0:*           nginx\nLISTEN  0.0.0.0:22           0.0.0.0:*           sshd\nESTAB   10.0.0.8:443         10.0.0.21:51844     nginx' }

    case 'docker':
      if (fullCmd.includes('ps')) {
        return { output: 'CONTAINER ID   IMAGE          STATUS          PORTS                  NAMES\nabc123def456   nginx:alpine   Up 2 hours      0.0.0.0:80->80/tcp     nginx-demo\nf0e1d2c3b4a5   redis:7        Up 15 minutes   6379/tcp               redis-cache' }
      }
      if (fullCmd.includes('images')) {
        return { output: 'REPOSITORY      TAG       IMAGE ID       SIZE\nnginx           alpine    8f34d1a2c9b7   48MB\nredis           7         eca1379fe8b5   117MB\nnode            20        3f19c2a15a9b   352MB' }
      }
      if (fullCmd.includes('logs')) {
        return { output: 'nginx-demo | 10.0.0.21 - - "GET / HTTP/1.1" 200 612\nnginx-demo | upstream response time 0.018' }
      }
      return { output: 'Docker 沙箱已就绪。可尝试：docker ps、docker images、docker logs nginx-demo' }

    case 'git':
      if (fullCmd.includes('status')) {
        return { output: 'On branch main\nYour branch is up to date with origin/main.\n\nChanges not staged for commit:\n  modified: src/App.vue\n\nno changes added to commit' }
      }
      if (fullCmd.includes('log')) {
        return { output: 'a1b2c3d feat: add lab workflow\nf6e5d4c fix: improve course navigation\nc9b8a7d docs: update deployment notes' }
      }
      return { output: 'main\nfeature/lab-sandbox\nrelease/2026-q2' }

    case 'kubectl':
      if (fullCmd.includes('nodes')) {
        return { output: 'NAME       STATUS   ROLES           VERSION\nmaster-1   Ready    control-plane   v1.30.0\nworker-1   Ready    worker          v1.30.0' }
      }
      if (fullCmd.includes('svc') || fullCmd.includes('services')) {
        return { output: 'NAME         TYPE        CLUSTER-IP      PORT(S)\nkubernetes   ClusterIP   10.96.0.1       443/TCP\nweb          ClusterIP   10.96.12.34     80/TCP' }
      }
      return { output: 'NAME                         READY   STATUS    RESTARTS   AGE\nweb-6f8c7c9d8c-n4z7q       1/1     Running   0          2h\nredis-7b9d6b9f7f-vm2qd     1/1     Running   0          45m' }

    case 'systemctl':
      if (fullCmd.includes('status')) {
        return { output: 'nginx.service - Nginx Web Server\n   Loaded: loaded (/usr/lib/systemd/system/nginx.service)\n   Active: active (running) since Wed 2026-05-27 09:00:00 CST' }
      }
      return { output: 'UNIT              LOAD   ACTIVE SUB     DESCRIPTION\nnginx.service     loaded active running Nginx Web Server\ndocker.service    loaded active running Docker Engine\nssh.service       loaded active running OpenSSH Server' }

    case 'journalctl':
      return { output: 'May 27 10:30:01 devops-server nginx[342]: request completed status=200\nMay 27 10:31:22 devops-server nginx[342]: upstream timeout recovered' }

    default:
      return { output: `\x1b[1;33m未找到命令：${main || '(空命令)'}\x1b[0m\n输入 \x1b[1;36mhelp\x1b[0m 查看可用模拟命令。` }
  }
}
