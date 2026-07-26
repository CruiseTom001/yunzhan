import { beginnerPathCourseIds } from '@/data/beginner-path'

export interface ContinueTarget {
  courseId: string
  chapterIndex: number
}

export interface ResolveContinueInput {
  chapterCounts: Record<string, number>
  completedChapters: Record<string, number[]>
  lastVisited: string | null
  lastRoute: string | null
}

/** 返回下一未完成章节索引；全部完成时返回 null */
export function nextIncompleteChapter(
  completed: readonly number[],
  chapterCount: number,
): number | null {
  if (chapterCount <= 0) return null
  for (let index = 0; index < chapterCount; index += 1) {
    if (!completed.includes(index)) return index
  }
  return null
}

export function isCourseComplete(
  courseId: string,
  chapterCounts: Record<string, number>,
  completedChapters: Record<string, number[]>,
): boolean {
  const total = chapterCounts[courseId] ?? 0
  if (total <= 0) return false
  const completed = completedChapters[courseId]?.length ?? 0
  return completed >= total
}

export function parseCourseRoute(route: string): { courseId: string; chapterIndex: number | null } | null {
  const match = route.match(/^\/course\/([^/?#]+)(?:\/chapter\/(\d+))?/)
  if (!match?.[1]) return null
  const chapterRaw = match[2]
  const chapterIndex = chapterRaw !== undefined ? Number(chapterRaw) : null
  if (chapterIndex !== null && (!Number.isInteger(chapterIndex) || chapterIndex < 0)) return null
  return { courseId: match[1], chapterIndex }
}

function findNextIncompleteCourse(
  chapterCounts: Record<string, number>,
  completedChapters: Record<string, number[]>,
  courseIds: readonly string[] = beginnerPathCourseIds,
): string | null {
  for (const courseId of courseIds) {
    if (!isCourseComplete(courseId, chapterCounts, completedChapters)) {
      return courseId
    }
  }
  return null
}

function resolveCourseChapter(
  courseId: string,
  chapterCounts: Record<string, number>,
  completedChapters: Record<string, number[]>,
  preferredChapter: number | null = null,
): ContinueTarget | null {
  const chapterCount = chapterCounts[courseId] ?? 0
  if (chapterCount <= 0) return null
  if (isCourseComplete(courseId, chapterCounts, completedChapters)) return null

  const completed = completedChapters[courseId] ?? []
  if (
    preferredChapter !== null
    && preferredChapter >= 0
    && preferredChapter < chapterCount
    && !completed.includes(preferredChapter)
  ) {
    return { courseId, chapterIndex: preferredChapter }
  }

  const chapterIndex = nextIncompleteChapter(completed, chapterCount)
  if (chapterIndex === null) return null
  return { courseId, chapterIndex }
}

/**
 * 解析首页「继续学习」目标：
 * 1. lastVisited 未完成 → 继续该课
 * 2. lastRoute 对应课程未完成 → 继续该课（含指定章节）
 * 3. 推荐路线下一门未完成
 * 4. 全部完成 → null
 */
export function resolveContinueTarget(input: ResolveContinueInput): ContinueTarget | null {
  const { chapterCounts, completedChapters, lastVisited, lastRoute } = input

  if (lastVisited && chapterCounts[lastVisited] !== undefined) {
    const fromVisited = resolveCourseChapter(lastVisited, chapterCounts, completedChapters)
    if (fromVisited) return fromVisited
  }

  if (lastRoute) {
    const parsed = parseCourseRoute(lastRoute)
    if (parsed && chapterCounts[parsed.courseId] !== undefined) {
      const fromRoute = resolveCourseChapter(
        parsed.courseId,
        chapterCounts,
        completedChapters,
        parsed.chapterIndex,
      )
      if (fromRoute) return fromRoute
    }
  }

  const nextCourseId = findNextIncompleteCourse(chapterCounts, completedChapters)
  if (!nextCourseId) return null
  return resolveCourseChapter(nextCourseId, chapterCounts, completedChapters)
}

export function isBeginnerPathComplete(
  chapterCounts: Record<string, number>,
  completedChapters: Record<string, number[]>,
): boolean {
  return findNextIncompleteCourse(chapterCounts, completedChapters) === null
}
