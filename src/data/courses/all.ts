/**
 * 课程懒加载模块
 * 只在需要时导入具体课程数据，大幅减小首屏 JS 体积
 */

import type { Course } from '@/types'

// 课程懒加载注册表
const courseLoaders: Record<string, () => Promise<{ course: Course }>> = {
  'computer-basics': () => import('./computer-basics'),
  git: () => import('./git'),
  'python-ops': () => import('./python-ops'),
  virtualization: () => import('./virtualization'),
  'linux-basics': () => import('./linux-basics'),
  networking: () => import('./networking'),
  'web-server': () => import('./web-server'),
  database: () => import('./database'),
  'cache-queue': () => import('./cache-queue'),
  docker: () => import('./docker'),
  kubernetes: () => import('./kubernetes'),
  cicd: () => import('./cicd'),
  monitoring: () => import('./monitoring'),
  automation: () => import('./automation'),
  logging: () => import('./logging'),
  security: () => import('./security'),
  'high-availability': () => import('./high-availability'),
  'cloud-ops': () => import('./cloud-ops'),
  'devops-sre': () => import('./devops-sre'),
  'devops-project': () => import('./devops-project'),
}

/**
 * 懒加载单个课程（按需加载）
 * 只在需要时 import 对应的 .ts 文件，Vite 会自动拆分 chunk
 */
export async function getCourse(id: string): Promise<Course | undefined> {
  const loader = courseLoaders[id]
  if (!loader) return undefined
  try {
    const mod = await loader()
    return mod.course
  } catch {
    return undefined
  }
}

/**
 * 预加载多个课程（后续导航时可加速）
 */
export function preloadCourses(ids: string[]) {
  for (const id of ids) {
    if (courseLoaders[id]) {
      courseLoaders[id]()
    }
  }
}

/**
 * 获取所有课程 ID 列表
 */
export function getAllCourseIds(): string[] {
  return Object.keys(courseLoaders)
}

export { courseIndex } from './index'
