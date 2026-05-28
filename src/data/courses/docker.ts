import type { Course } from '@/types'

export const course: Course = {
  id: 'docker',
  title: '容器技术',
  description: 'Docker 核心概念、Dockerfile 编写、Compose 编排与镜像仓库管理',
  icon: 'Box',
  difficulty: 'intermediate',
  category: 'container',
  prerequisites: ['linux-basics'],
  estimatedHours: 16,
  chapters: [
    {
      index: 0,
      title: 'Docker 核心概念',
            contentFile: 'docker/chapter-0.md',
      content: '',
      keyConcepts: ['镜像', '容器', '仓库', '分层存储', 'UnionFS', 'Docker Daemon']
    },
    {
      index: 1,
      title: 'Docker 安装与基础命令',
            contentFile: 'docker/chapter-1.md',
      content: '',
      keyConcepts: ['docker run', 'docker ps', 'docker stop', 'docker rm', 'docker exec', 'docker logs', '端口映射', '资源限制']
    },
    {
      index: 2,
      title: 'Dockerfile 编写指南',
            contentFile: 'docker/chapter-2.md',
      content: '',
      keyConcepts: ['FROM', 'RUN', 'COPY', 'ADD', 'CMD', 'ENTRYPOINT', 'ENV', 'WORKDIR', 'EXPOSE', '多阶段构建', '.dockerignore']
    },
    {
      index: 3,
      title: '多阶段构建与镜像优化',
            contentFile: 'docker/chapter-3.md',
      content: '',
      keyConcepts: ['多阶段构建', '基础镜像选择', '层优化', '镜像体积', 'scratch', 'distroless', 'dive', 'Trivy']
    },
    {
      index: 4,
      title: 'Docker Compose 编排',
            contentFile: 'docker/chapter-4.md',
      content: '',
      keyConcepts: ['Compose', 'services', 'networks', 'volumes', 'depends_on', 'healthcheck', '环境变量', 'secrets', 'profiles']
    },
    {
      index: 5,
      title: '数据卷与网络',
            contentFile: 'docker/chapter-5.md',
      content: '',
      keyConcepts: ['Volume', 'Bind Mount', 'tmpfs', 'Bridge 网络', 'Host 网络', 'Overlay', '自定义网络', 'DNS']
    },
    {
      index: 6,
      title: '私有镜像仓库搭建（Harbor）',
            contentFile: 'docker/chapter-6.md',
      content: '',
      keyConcepts: ['Harbor', '私有仓库', '镜像管理', '安全扫描', '垃圾回收', '内容信任', '代理缓存']
    }
  ]
}
