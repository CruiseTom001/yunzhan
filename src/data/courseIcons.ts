import type { CourseIcon } from '@/types'

/**
 * 课程图标到展示文字的映射（单一数据源）
 *
 * Course.icon 字段存的是 lucide 图标名，但课程卡片/首页"继续学习"模块
 * 出于审美一致性用单色字符方块呈现（非彩色 lucide 图标）。
 *
 * 此表集中维护"图标名 → 字符"的映射，避免在多个组件里重复定义导致缺漏
 * （曾经 devops-project 用 Rocket，两处 iconMap 都漏了，静默回退到兜底符号）。
 *
 * 新增课程图标后：希望该课程卡片显示专属字符时，在此表加一行；
 * 不加则回退到 DEFAULT_COURSE_ICON。
 */
export const courseIconMap: Record<CourseIcon, string> = {
  Monitor: '⊞',
  GitBranch: '⎇',
  Code: '</>',
  Layers: '▤',
  Terminal: '>_',
  Network: '#',
  Server: '@',
  Database: 'DB',
  Zap: '⚡',
  Box: '⬡',
  Ship: '☸',
  Eye: '◎',
  Cog: '⚙',
  FileText: '¶',
  Shield: '♦',
  Cloud: '☁',
  CloudLightning: '☈',
  RefreshCw: '↻',
  Rocket: '🚀',
}

/** 兜底字符：未在 courseIconMap 中登记的图标使用此默认值 */
export const DEFAULT_COURSE_ICON = '>_'

/** 获取课程图标的展示字符 */
export function getCourseIconChar(icon: string): string {
  return (courseIconMap as Record<string, string>)[icon] ?? DEFAULT_COURSE_ICON
}
