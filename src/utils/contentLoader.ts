/**
 * Markdown 内容加载器
 *
 * 使用 Vite 的 import.meta.glob 自动扫描 src/data/markdown 下所有 .md 文件，
 * 构建为 `courseId/chapter-N.md` → 内容 的索引表。
 *
 * 优点（相比手工维护 import + 索引表）：
 * - 新增章节 .md 文件零配置，无需改 loader、courses/*.ts、chapterCounts 三处
 * - 章节数统计直接从 glob 派生，杜绝 chapterCounts 与实际文件数不一致
 */

const markdownModules = import.meta.glob('../data/markdown/**/chapter-*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** 去掉路径前缀和 `.md` 后缀，得到 `courseId/chapter-N` 形式的 key */
function normalizeKey(globPath: string): string {
  // globPath 形如 '../data/markdown/linux-basics/chapter-0.md'
  const match = globPath.match(/markdown\/([^/]+)\/(chapter-\d+)\.md$/)
  return match ? `${match[1]}/${match[2]}` : ''
}

/** `courseId/chapter-N.md` → 内容 的索引表 */
const contentIndex: Record<string, string> = {}
for (const [globPath, content] of Object.entries(markdownModules)) {
  const key = normalizeKey(globPath)
  if (!key) continue
  contentIndex[`${key}.md`] = content
}

/**
 * 加载指定课程指定章节的 Markdown 内容
 */
export async function loadChapterContent(courseId: string, chapterIndex: number): Promise<string> {
  const key = `${courseId}/chapter-${chapterIndex}.md`
  const content = contentIndex[key]
  if (!content) {
    console.warn(`[content-loader] 未找到: ${key}`)
    return ''
  }
  return content
}
