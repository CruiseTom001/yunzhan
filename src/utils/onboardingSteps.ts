import { beginnerPathCourseIds } from '@/data/beginner-path'

export const CURRENT_TOUR_VERSION = 1

export type OnboardingStatus = 'pending' | 'skipped' | 'completed'

export interface OnboardingStepDefinition {
  id: string
  route: string
  anchorId: string
  fallbackAnchorId?: string
  title: string
  description: string
  isCore: boolean
  autoNavigate: boolean
}

const firstBeginnerCourseId = beginnerPathCourseIds[0] ?? 'computer-basics'

export const onboardingSteps: readonly OnboardingStepDefinition[] = [
  {
    id: 'welcome',
    route: '/',
    anchorId: 'home-hero',
    title: '欢迎进入云栈',
    description: '云栈把课程学习、模拟终端、测验复习、每日笔记和学习进度串成一条运维学习闭环。接下来带你快速熟悉主入口。',
    isCore: true,
    autoNavigate: true,
  },
  {
    id: 'courses',
    route: '/courses',
    anchorId: 'courses-beginner-path',
    fallbackAnchorId: 'nav-courses',
    title: '从推荐路线开始',
    description: '不知道先学什么时，优先按「初学者推荐路线」推进。路线按阶段组织，避免盲目跳课。',
    isCore: true,
    autoNavigate: true,
  },
  {
    id: 'course-detail',
    route: `/course/${firstBeginnerCourseId}/chapter/0`,
    anchorId: 'course-chapter-nav',
    fallbackAnchorId: 'nav-courses',
    title: '在课程里完成学习',
    description: '课程详情页集中完成章节阅读、交互实验和章节测验。实验按真实命令判定，不支持的能力会明确提示为模拟。',
    isCore: true,
    autoNavigate: true,
  },
  {
    id: 'terminal',
    route: '/terminal',
    anchorId: 'terminal-panel',
    fallbackAnchorId: 'nav-terminal',
    title: '模拟终端随时练命令',
    description: '不必自备 Linux 环境。终端是训练沙箱，语义贴近真实命令，适合边学边练。',
    isCore: true,
    autoNavigate: true,
  },
  {
    id: 'quiz',
    route: '/quiz',
    anchorId: 'nav-quiz',
    title: '用问答检查掌握',
    description: '学完一节后做测验，及时发现盲点，比只看文档更扎实。',
    isCore: false,
    autoNavigate: true,
  },
  {
    id: 'review',
    route: '/review',
    anchorId: 'nav-review',
    title: '错题与薄弱点回收',
    description: '复习页回收错题和薄弱知识，形成「学—测—复」闭环。',
    isCore: false,
    autoNavigate: true,
  },
  {
    id: 'study-notes',
    route: '/study-notes',
    anchorId: 'study-notes-editor',
    fallbackAnchorId: 'nav-notes',
    title: '每日学习笔记',
    description: '记录每天学了什么，可用 AI 润色整理。网页端走服务端 AI，桌面端可配置本地供应商。',
    isCore: true,
    autoNavigate: true,
  },
  {
    id: 'progress',
    route: '/progress',
    anchorId: 'progress-sync-panel',
    fallbackAnchorId: 'nav-progress',
    title: '进度与云同步',
    description: '在这里查看完成度与学习路径。登录后进度可云同步，换设备不丢。',
    isCore: true,
    autoNavigate: true,
  },
  {
    id: 'finish',
    route: '/',
    anchorId: 'home-continue-learning',
    fallbackAnchorId: 'home-hero',
    title: '开始你的第一门课',
    description: '建议从推荐路线第一门课开始。以后可在账号设置或首页重新打开本导览。',
    isCore: true,
    autoNavigate: true,
  },
] as const

export function getOnboardingStepIndex(stepId: string | null | undefined): number {
  if (!stepId) return 0
  const index = onboardingSteps.findIndex(step => step.id === stepId)
  return index >= 0 ? index : 0
}

export function getOnboardingStep(stepId: string | null | undefined): OnboardingStepDefinition {
  return onboardingSteps[getOnboardingStepIndex(stepId)]
}

export function shouldAutoStartOnboarding(input: {
  status: OnboardingStatus
  version: number
  isAuthenticated: boolean
  routeName?: string | symbol | null
}): boolean {
  if (!input.isAuthenticated) return false
  if (input.status !== 'pending') return false
  if (input.version >= CURRENT_TOUR_VERSION) return false
  if (input.routeName === 'landing') return false
  if (input.routeName === 'adminUsers'
    || input.routeName === 'adminAudit'
    || input.routeName === 'adminFeedback'
    || input.routeName === 'adminAnnouncements'
    || input.routeName === 'adminDesktopReleases') {
    return false
  }
  return true
}

export function isOnboardingBlockingAnnouncements(input: {
  isRunning: boolean
  status: OnboardingStatus
  version: number
}): boolean {
  if (input.isRunning) return true
  return input.status === 'pending' && input.version < CURRENT_TOUR_VERSION
}
