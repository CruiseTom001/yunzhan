/**
 * 课程图标名（对应 lucide-vue-next 的图标组件名）
 *
 * 收窄为联合类型：新增课程时若用了未登记的图标名，TS 会编译报错，
 * 提醒同步更新 src/data/courseIcons.ts 的映射表，避免静默回退到兜底符号。
 */
export type CourseIcon =
  | 'Monitor'
  | 'GitBranch'
  | 'Code'
  | 'Layers'
  | 'Terminal'
  | 'Network'
  | 'Server'
  | 'Database'
  | 'Zap'
  | 'Box'
  | 'Ship'
  | 'Eye'
  | 'Cog'
  | 'FileText'
  | 'Shield'
  | 'Cloud'
  | 'CloudLightning'
  | 'RefreshCw'
  | 'Rocket'

export interface Course {
  id: string
  title: string
  description: string
  icon: CourseIcon
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category: string
  chapters: Chapter[]
  prerequisites: string[]
  estimatedHours: number
}

export interface Chapter {
  index: number
  title: string
  content: string
  contentFile?: string  // 从 .md 文件按需加载（替代内联 content）
  keyConcepts: string[]
}

export interface QuizQuestion {
  id: string
  categoryId: string
  type: 'single' | 'multiple' | 'truefalse'
  question: string
  options: QuizOption[]
  explanation: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export interface QuizOption {
  id: string
  text: string
  isCorrect: boolean
}

export interface Bookmark {
  courseId: string
  chapterIndex: number
  note?: string
  createdAt: number
}

export interface CommandHistoryItem {
  command: string
  output: string
  exitCode: number
  source: 'terminal' | 'course' | 'lab'
  createdAt: number
}

export interface LabCheck {
  id: string
  label: string
  type: 'command_in_history' | 'command_exact' | 'output_contains' | 'output_from_command' | 'manual'
  target: string
  command?: string
}

export interface LabStep {
  title: string
  command?: string
  description: string
}

export interface LabTask {
  id: string
  courseId: string
  chapterIndex: number
  title: string
  description: string
  estimatedMinutes: number
  difficulty: Difficulty
  steps: LabStep[]
  checks: LabCheck[]
  hints: string[]
}

export interface LabRecord {
  labId: string
  status: 'not_started' | 'in_progress' | 'passed'
  startedAt?: number
  completedAt?: number
  checkResults: Record<string, boolean>
  checkMessages?: Record<string, string>
  lastCheckedAt?: number
}

export interface ReviewCard {
  id: string
  sourceType: 'quiz' | 'concept' | 'lab'
  sourceId: string
  categoryId: string
  prompt: string
  answer: string
  nextReviewAt: number
  intervalDays: number
  ease: number
  repetitions: number
  lapses: number
  updatedAt: number
}

export interface SyncSnapshot {
  id: string
  createdAt: number
  deviceName: string
  checksum: string
}

export interface UserProfile {
  id: string
  name: string
  targetRole: string
  level: number
  createdAt: number
}

export interface LearningProgress {
  completedChapters: Record<string, number[]>
  quizRecords: Record<string, QuizRecord>
  achievements: string[]
  lastVisited: string
  lastRoute: string
  totalTimeSpent: number
  bookmarks: Bookmark[]
  studyDays: string[]
  commandHistory: CommandHistoryItem[]
  labRecords: Record<string, LabRecord>
  reviewCards: Record<string, ReviewCard>
  syncSnapshots: SyncSnapshot[]
  communityDrafts: CommunityDraft[]
  userProfile: UserProfile
}

export interface QuizRecord {
  answeredAt: number
  isCorrect: boolean
  attempts: number
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  condition: AchievementCondition
}

export interface AchievementCondition {
  type: 'complete_course' | 'quiz_score' | 'quiz_streak' | 'total_courses'
  value: number
  categoryId?: string
}

export interface CommunityDraft {
  id: string
  type: 'lab-note' | 'yaml' | 'command'
  title: string
  content: string
  tags: string[]
  createdAt: number
}

export interface AppNotification {
  id: string
  title: string
  message: string
  type: 'achievement' | 'info' | 'success'
  createdAt: number
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
}

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  beginner: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  intermediate: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  advanced: 'text-rose-400 border-rose-400/30 bg-rose-400/10',
}
