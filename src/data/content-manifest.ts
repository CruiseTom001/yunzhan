import { chapterCounts, courseIndex } from '@/data/courses/index'
import { labTasks } from '@/data/labs'

export const contentManifest = {
  version: 1,
  source: 'bundled',
  generatedAt: 'local-build',
  courses: courseIndex.map(course => ({
    id: course.id,
    title: course.title,
    category: course.category,
    difficulty: course.difficulty,
    chapters: chapterCounts[course.id] ?? 0,
    markdownRoot: `src/data/markdown/${course.id}`,
  })),
  labs: labTasks.map(lab => ({
    id: lab.id,
    courseId: lab.courseId,
    chapterIndex: lab.chapterIndex,
    checks: lab.checks.length,
  })),
}

export function getContentStats() {
  return {
    courses: contentManifest.courses.length,
    chapters: contentManifest.courses.reduce((sum, course) => sum + course.chapters, 0),
    labs: contentManifest.labs.length,
  }
}
