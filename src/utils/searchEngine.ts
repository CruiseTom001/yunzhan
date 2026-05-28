/**
 * 升级版搜索引擎 — 中文分词 + 倒排索引 + 相关性排序
 * 
 * 替代原来简单的字符串 indexOf 匹配，支持：
 * 1. 中文 bigram 分词
 * 2. 英文单词分词
 * 3. 倒排索引快速查找
 * 4. TF-IDF 相关性排序
 * 5. 模糊匹配容错
 */

interface SearchDoc {
  id: string
  title: string
  text: string
  url: string
}

interface SearchResult {
  doc: SearchDoc
  score: number
  matchTerms: string[]
}

// 中文 bigram 分词
function tokenizeChinese(text: string): string[] {
  const tokens: string[] = []
  const cleaned = text.replace(/[^\u4e00-\u9fff]/g, '')
  for (let i = 0; i < cleaned.length - 1; i++) {
    tokens.push(cleaned.slice(i, i + 2))
  }
  if (cleaned.length === 1) tokens.push(cleaned)
  return tokens
}

// 英文分词
function tokenizeEnglish(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1)
}

// 混合分词
function tokenize(text: string): string[] {
  const cn = tokenizeChinese(text)
  const en = tokenizeEnglish(text)
  // 也加单字中文 token
  const singleCn = text.match(/[\u4e00-\u9fff]/g) || []
  return [...new Set([...cn, ...en, ...singleCn])]
}

// 倒排索引
class InvertedIndex {
  private index = new Map<string, Map<string, number>>()

  addDoc(id: string, text: string) {
    const tokens = tokenize(text)
    for (const token of tokens) {
      if (!this.index.has(token)) {
        this.index.set(token, new Map())
      }
      const docMap = this.index.get(token)!
      docMap.set(id, (docMap.get(id) || 0) + 1)
    }
  }

  search(query: string, topK: number = 20): Array<{ id: string; score: number }> {
    const queryTokens = tokenize(query)
    if (queryTokens.length === 0) return []

    const scores = new Map<string, number>()
    const queryTokenSet = new Set(queryTokens)

    for (const token of queryTokenSet) {
      const docMap = this.index.get(token)
      if (!docMap) continue
      // IDF: 包含此 token 的文档数越少，权重越高
      const idf = Math.log(1 + 1 / docMap.size)
      for (const [docId, tf] of docMap) {
        scores.set(docId, (scores.get(docId) || 0) + tf * idf)
      }
    }

    // 额外加分：精确子串匹配
    const queryLower = query.toLowerCase()
    for (const [docId, score] of scores) {
      const docText = (this._docTexts?.get(docId) || '').toLowerCase()
      if (docText.includes(queryLower)) {
        scores.set(docId, score * 2.5)
      }
      // 标题匹配加分更多
      const docTitle = (this._docTitles?.get(docId) || '').toLowerCase()
      if (docTitle.includes(queryLower)) {
        scores.set(docId, score * 3.5)
      }
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([id, score]) => ({ id, score }))
  }

  // 用于精确匹配加分的文本缓存
  private _docTexts = new Map<string, string>()
  private _docTitles = new Map<string, string>()

  addDocText(id: string, title: string, text: string) {
    this._docTexts.set(id, text)
    this._docTitles.set(id, title)
  }
}

// ===== 全局搜索引擎实例 =====

let searchIndex: InvertedIndex | null = null
let allDocs: SearchDoc[] = []

export function buildIndex(docs: SearchDoc[]) {
  allDocs = docs
  searchIndex = new InvertedIndex()
  for (const doc of docs) {
    searchIndex.addDoc(doc.id, doc.title + ' ' + doc.text)
    searchIndex.addDocText(doc.id, doc.title, doc.text)
  }
}

export function search(query: string, topK: number = 15): SearchResult[] {
  if (!searchIndex) return []

  const results = searchIndex.search(query, topK)
  const docMap = new Map(allDocs.map(d => [d.id, d]))
  const queryTokens = tokenize(query)

  return results.map(r => {
    const doc = docMap.get(r.id)!
    return {
      doc,
      score: r.score,
      matchTerms: queryTokens.filter(t => doc.title.includes(t) || doc.text.includes(t)),
    }
  })
}

// 模糊搜索：对于短查询尝试常见 typos
const TYPO_MAP: Record<string, string[]> = {
  'linux': ['linux', 'Linux'],
  'nginx': ['nginx', 'Nginx', 'NGINX'],
  'docker': ['docker', 'Docker'],
  'kubernetes': ['kubernetes', 'k8s', 'Kubernetes', 'K8S'],
  'k8s': ['k8s', 'kubernetes', 'Kubernetes'],
  'prometheus': ['prometheus', 'Prometheus'],
  'grafana': ['grafana', 'Grafana'],
  'mysql': ['mysql', 'MySQL', 'MySQL'],
  'redis': ['redis', 'Redis'],
  'wordpress': ['wordpress', 'WordPress'],
}

export function fuzzySearch(query: string): SearchResult[] {
  // 先精确搜索
  const exact = search(query)
  if (exact.length >= 5) return exact

  // 尝试 typo 变体
  const variants = TYPO_MAP[query.toLowerCase()]
  if (variants) {
    const expanded = search(variants.join(' '))
    return expanded
  }

  return exact
}
