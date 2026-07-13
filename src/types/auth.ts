export type UserRole = 'user' | 'super_admin'
export type UserStatus = 'active' | 'disabled'

export interface AuthUser {
  id: string
  username: string
  displayName: string
  email: string | null
  emailVerifiedAt: number | null
  role: UserRole
  status: UserStatus
  createdAt: number
  updatedAt: number
  lastLoginAt: number | null
}

export interface AdminProgressSummary {
  completedChapters: number
  quizAnswers: number
  studyDays: number
  totalTimeSpent: number
}

export interface AdminUser extends AuthUser {
  progressSummary: AdminProgressSummary
  progressUpdatedAt: number | null
}
