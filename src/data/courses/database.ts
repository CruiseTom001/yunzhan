import type { Course } from '@/types'

export const course: Course = {
  id: 'database',
  title: '数据库运维',
  description: 'MySQL/PostgreSQL 安装配置、备份恢复、主从复制与性能调优',
  icon: 'Database',
  difficulty: 'intermediate',
  category: 'database',
  chapters: [
    {
      index: 0,
      title: '第1章：MySQL 安装与初始配置',
      contentFile: 'database/chapter-0.md',
      content: '',
      keyConcepts: ['MySQL安装', 'my.cnf', 'innodb_buffer_pool_size', '慢查询日志', 'binlog', 'utf8mb4', 'mysql_secure_installation']
    },
    {
      index: 1,
      title: '第2章：用户权限管理',
      contentFile: 'database/chapter-1.md',
      content: '',
      keyConcepts: ['GRANT', 'REVOKE', '权限层级', 'mysql.user', 'mysql.db', '最小权限原则', 'WITH GRANT OPTION', 'FLUSH PRIVILEGES']
    },
    {
      index: 2,
      title: '第3章：备份与恢复',
      contentFile: 'database/chapter-2.md',
      content: '',
      keyConcepts: ['mysqldump', 'xtrabackup', 'xtrabackup', '全量备份', '增量备份', 'binlog恢复', '--single-transaction', 'PITR', '备份脚本']
    },
    {
      index: 3,
      title: '第4章：主从复制原理与配置',
      contentFile: 'database/chapter-3.md',
      content: '',
      keyConcepts: ['主从复制', 'binlog', 'relay log', 'GTID', 'I/O Thread', 'SQL Thread', 'Seconds_Behind_Master', '半同步复制', '延迟复制', 'ROW格式']
    },
    {
      index: 4,
      title: '第5章：慢查询分析与优化',
      contentFile: 'database/chapter-4.md',
      content: '',
      keyConcepts: ['慢查询日志', 'mysqldumpslow', 'pt-query-digest', 'EXPLAIN', '执行计划', '索引优化', '最左前缀原则', '覆盖索引', 'type字段', 'Using filesort']
    },
    {
      index: 5,
      title: '第6章：高可用方案',
      contentFile: 'database/chapter-5.md',
      content: '',
      keyConcepts: ['MHA', 'MGR', 'Group Replication', 'ProxySQL', 'MySQL Router', '读写分离', '故障切换', '高可用', 'Paxos', 'InnoDB Cluster']
    },
    {
      index: 6,
      title: '第7章：日常巡检与监控指标',
      contentFile: 'database/chapter-6.md',
      content: '',
      keyConcepts: ['日常巡检', 'QPS', 'TPS', '缓存命中率', 'Performance Schema', '主从延迟监控', '锁等待', '连接数监控', 'pt-mysql-summary', 'PMM']
    }
  ],
  prerequisites: ['linux-basics'],
  estimatedHours: 18,
}
