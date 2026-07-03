/**
 * Markdown 内容加载器
 *
 * 使用 Vite 的 import.meta.glob 扫描 src/data/markdown 下所有 .md 文件，
 * 用 lazy（eager:false）模式：每个章节只在首次访问时按需异步加载，
 * 避免所有 .md 全文被打进主 bundle（132 个章节约 470KB 内容）。
 *
 * 与 courses/index.ts 的 chapterCounts 手工表 + scripts/check-chapter-counts.cjs
 * 构建期校验配合，二者各自独立、互不污染首屏 bundle：
 *   - chapterCounts：编译期常量，给路由/进度校验/章节列表用，零运行时成本
 *   - contentLoader：按章节按需取内容，不进首屏 chunk
 */

const markdownLoaders = import.meta.glob('../data/markdown/**/chapter-*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

/** 去掉路径前缀和 `.md` 后缀，得到 `courseId/chapter-N` 形式的 key */
function normalizeKey(globPath: string): string {
  const match = globPath.match(/markdown\/([^/]+)\/(chapter-\d+)\.md$/)
  return match ? `${match[1]}/${match[2]}` : ''
}

/** `courseId/chapter-N.md` → 异步加载函数 的索引表 */
const loaderIndex: Record<string, () => Promise<string>> = {}
for (const [globPath, loader] of Object.entries(markdownLoaders)) {
  const key = normalizeKey(globPath)
  if (!key) continue
  loaderIndex[`${key}.md`] = loader
}

/**
 * 加载指定课程指定章节的 Markdown 内容（按需异步）
 */
export async function loadChapterContent(courseId: string, chapterIndex: number): Promise<string> {
  const key = `${courseId}/chapter-${chapterIndex}.md`
  const loader = loaderIndex[key]
  if (!loader) {
    console.warn(`[content-loader] 未找到: ${key}`)
    return ''
  }
  try {
    return await loader()
  } catch (e) {
    console.error(`[content-loader] 加载失败 ${key}:`, e)
    return ''
  }
}
