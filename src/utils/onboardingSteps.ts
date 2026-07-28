import { beginnerPathCourseIds } from '@/data/beginner-path'
import { labTasks } from '@/data/labs'

export const CURRENT_TOUR_VERSION = 1

export type OnboardingStatus = 'pending' | 'skipped' | 'completed'
export type OnboardingStepScope = 'main' | 'page-detail'
export type OnboardingStepAudience = 'quick' | 'detail'
export type OnboardingTourMode = 'quick' | 'full'

export interface OnboardingStepDefinition {
  id: string
  route: string
  anchorId: string
  fallbackAnchorId?: string
  title: string
  description: string
  scope: OnboardingStepScope
  audience: OnboardingStepAudience
  autoNavigate: boolean
  navigationMessage?: string
  skipIfAnchorMissing?: boolean
  missingTitle?: string
  missingDescription?: string
}

const firstBeginnerCourseId = beginnerPathCourseIds[0] ?? 'computer-basics'

export function resolveFirstBeginnerPathLab(): { courseId: string; chapterIndex: number } {
  for (const courseId of beginnerPathCourseIds) {
    const firstLab = labTasks
      .filter(task => task.courseId === courseId)
      .sort((left, right) => left.chapterIndex - right.chapterIndex)[0]
    if (firstLab) {
      return { courseId: firstLab.courseId, chapterIndex: firstLab.chapterIndex }
    }
  }
  return { courseId: 'computer-basics', chapterIndex: 1 }
}

const firstBeginnerPathLab = resolveFirstBeginnerPathLab()
const firstLabCourseId = firstBeginnerPathLab.courseId
const firstLabChapterIndex = firstBeginnerPathLab.chapterIndex
const introChapterRoute = `/course/${firstBeginnerCourseId}/chapter/0`
const labChapterRoute = `/course/${firstLabCourseId}/chapter/${firstLabChapterIndex}`

export const onboardingSteps: readonly OnboardingStepDefinition[] = [
  {
    id: 'welcome',
    route: '/',
    anchorId: 'home-hero',
    title: '欢迎来到云栈',
    description: '云栈帮你把「学课程 → 做实验 → 练命令 → 测验复习 → 记笔记」串成一条学习路径。接下来按推荐路线，从第一门课开始即可。',
    scope: 'main',
    audience: 'quick',
    autoNavigate: true,
  },
  {
    id: 'courses-path',
    route: '/courses',
    anchorId: 'courses-beginner-path-header',
    fallbackAnchorId: 'nav-courses',
    title: '按推荐路线学习',
    description: '新手先看「初学者推荐路线」，按阶段从左到右学，不要跳着选课。',
    scope: 'main',
    audience: 'quick',
    autoNavigate: true,
    navigationMessage: '正在打开课程页…',
  },
  {
    id: 'courses-first',
    route: '/courses',
    anchorId: 'courses-first-course',
    fallbackAnchorId: 'courses-beginner-path-header',
    title: '从第一门课开始',
    description: '点这里进入第一课。建议从路线中的第一门课开始，不要跳过基础阶段。',
    scope: 'page-detail',
    audience: 'quick',
    autoNavigate: false,
  },
  {
    id: 'course-chapters',
    route: introChapterRoute,
    anchorId: 'course-chapter-nav',
    fallbackAnchorId: 'nav-courses',
    title: '用目录切换章节',
    description: '左侧是章节目录。按顺序点章节阅读，完成一章再进入下一章。',
    scope: 'main',
    audience: 'quick',
    autoNavigate: true,
    navigationMessage: '正在打开课程详情…',
  },
  {
    id: 'course-content',
    route: introChapterRoute,
    anchorId: 'course-content-intro',
    fallbackAnchorId: 'course-chapter-nav',
    title: '先读懂知识点',
    description: '先看章节标题和开头内容，理解本章要讲什么，再往下阅读正文。',
    scope: 'page-detail',
    audience: 'quick',
    autoNavigate: false,
  },
  {
    id: 'course-lab',
    route: labChapterRoute,
    anchorId: 'course-lab-section',
    fallbackAnchorId: 'course-content-intro',
    title: '动手做实验',
    description: '这里是交互式实验区。按步骤执行命令，系统会根据真实命令记录判断是否完成。',
    scope: 'page-detail',
    audience: 'detail',
    autoNavigate: true,
    navigationMessage: '正在打开带实验的章节…',
  },
  {
    id: 'course-complete',
    route: introChapterRoute,
    anchorId: 'course-mark-complete',
    fallbackAnchorId: 'course-content-intro',
    title: '标记本章已学完',
    description: '读完并做完练习后，点「标记已学完」，进度会同步到学习面板。',
    scope: 'page-detail',
    audience: 'quick',
    autoNavigate: false,
  },
  {
    id: 'terminal-console',
    route: '/terminal',
    anchorId: 'terminal-console',
    fallbackAnchorId: 'nav-terminal',
    title: '在这里练 Linux 命令',
    description: '在下方终端输入命令并回车执行。不用自备 Linux 环境，边学边敲，熟悉命令行手感。',
    scope: 'main',
    audience: 'quick',
    autoNavigate: true,
    navigationMessage: '正在打开终端…',
  },
  {
    id: 'quiz-categories',
    route: '/quiz',
    anchorId: 'quiz-categories',
    fallbackAnchorId: 'nav-quiz',
    title: '选分类开始答题',
    description: '学完一节后，来这里选对应分类做题。先选题目分类，再开始答题自检。',
    scope: 'main',
    audience: 'quick',
    autoNavigate: true,
    navigationMessage: '正在打开问答页…',
  },
  {
    id: 'quiz-question',
    route: '/quiz',
    anchorId: 'quiz-question-panel',
    fallbackAnchorId: 'quiz-categories',
    title: '答题并看解析',
    description: '点击选项提交答案，系统会立刻显示对错和解析。错题会自动进入复习中心。',
    scope: 'page-detail',
    audience: 'detail',
    autoNavigate: false,
  },
  {
    id: 'review-filters',
    route: '/review',
    anchorId: 'review-filters',
    fallbackAnchorId: 'nav-review',
    title: '回收错题和薄弱点',
    description: '这里是复习中心，不是新课程入口。用「今日到期」「历史错题」筛选需要巩固的内容。',
    scope: 'main',
    audience: 'quick',
    autoNavigate: true,
    navigationMessage: '正在打开复习页…',
  },
  {
    id: 'review-practice',
    route: '/review',
    anchorId: 'review-practice',
    fallbackAnchorId: 'review-filters',
    title: '重新练习错题',
    description: '先点「显示答案」核对，再选「还不熟」或「已掌握」，系统会安排下次复习时间。',
    scope: 'page-detail',
    audience: 'detail',
    autoNavigate: false,
  },
  {
    id: 'study-notes-editor',
    route: '/study-notes',
    anchorId: 'study-notes-editor',
    fallbackAnchorId: 'nav-notes',
    title: '记录今天学了什么',
    description: '学完一节后，把你今天理解的内容用自己的话写在这里。不必追求文采，先把要点记下来。',
    scope: 'main',
    audience: 'quick',
    autoNavigate: true,
    navigationMessage: '正在打开学习笔记…',
  },
  {
    id: 'study-notes-model',
    route: '/study-notes',
    anchorId: 'study-notes-model',
    fallbackAnchorId: 'study-notes-editor',
    title: '选择润色模型',
    description: '润色前可以在这里选择 AI 模型。网页端由云栈统一配置，无需自行填写 API Key。',
    scope: 'page-detail',
    audience: 'detail',
    autoNavigate: false,
  },
  {
    id: 'study-notes-polish',
    route: '/study-notes',
    anchorId: 'study-notes-polish',
    fallbackAnchorId: 'study-notes-editor',
    title: '用 AI 整理笔记',
    description: '先写下今天学到的要点，再点击「AI 润色」，让 AI 帮你整理成更清楚的复习笔记。',
    scope: 'page-detail',
    audience: 'detail',
    autoNavigate: false,
  },
  {
    id: 'study-notes-save',
    route: '/study-notes',
    anchorId: 'study-notes-save',
    fallbackAnchorId: 'study-notes-editor',
    title: '保存当天笔记',
    description: '满意后点「保存」，笔记会按日期存档。以后可以导出或继续润色修改。',
    scope: 'page-detail',
    audience: 'detail',
    autoNavigate: false,
  },
  {
    id: 'progress-stats',
    route: '/progress',
    anchorId: 'progress-stats',
    fallbackAnchorId: 'nav-progress',
    title: '查看学习完成度',
    description: '这里汇总课程、章节、测验和实验进度。定期查看，知道自己学到哪一步了。',
    scope: 'main',
    audience: 'quick',
    autoNavigate: true,
    navigationMessage: '正在打开进度页…',
  },
  {
    id: 'progress-sync',
    route: '/progress',
    anchorId: 'progress-sync-panel',
    fallbackAnchorId: 'progress-stats',
    title: '进度可云同步',
    description: '登录后学习进度会同步到云端，换设备登录也不会丢。也可以导出备份到本地。',
    scope: 'page-detail',
    audience: 'detail',
    autoNavigate: false,
  },
  {
    id: 'finish',
    route: '/',
    anchorId: 'home-start-learning',
    fallbackAnchorId: 'home-tutorial-button',
    title: '去开始第一门课',
    description: '新手教程就到这里。点「开始学习」进入推荐路线第一课；以后可在首页或账号设置重新打开完整教程。',
    scope: 'main',
    audience: 'quick',
    autoNavigate: true,
    navigationMessage: '正在返回首页…',
  },
] as const

export function resolveOnboardingStepRoute(
  step: OnboardingStepDefinition,
  mode: OnboardingTourMode,
): string {
  if (step.id === 'course-complete' && mode === 'full') {
    return labChapterRoute
  }
  return step.route
}

export function getOnboardingStepsForMode(mode: OnboardingTourMode): OnboardingStepDefinition[] {
  if (mode === 'full') return [...onboardingSteps]
  return onboardingSteps.filter(step => step.audience === 'quick')
}

export function getOnboardingStepIndex(
  stepId: string | null | undefined,
  mode: OnboardingTourMode = 'full',
): number {
  const steps = getOnboardingStepsForMode(mode)
  if (!stepId) return 0
  const index = steps.findIndex(step => step.id === stepId)
  return index >= 0 ? index : 0
}

export function getOnboardingStep(
  stepId: string | null | undefined,
  mode: OnboardingTourMode = 'full',
): OnboardingStepDefinition {
  const steps = getOnboardingStepsForMode(mode)
  return steps[getOnboardingStepIndex(stepId, mode)] ?? steps[0]
}

export function matchesOnboardingRoute(stepRoute: string, currentFullPath: string): boolean {
  const target = stepRoute.split('?')[0].replace(/\/$/, '') || '/'
  const current = currentFullPath.split('?')[0].replace(/\/$/, '') || '/'
  if (current === target) return true
  if (/\/chapter\/\d+$/.test(target)) return false
  const coursePrefix = /^\/course\/[^/]+/.exec(target)
  if (coursePrefix && current.startsWith(coursePrefix[0])) return true
  return false
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
