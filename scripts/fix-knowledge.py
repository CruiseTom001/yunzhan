"""
Fix knowledge.ts: remove stray comma and add missing findKnowledgeTerms function
"""
path = r'E:\trae_project\运维学习网站\src\utils\knowledge.ts'

with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove stray comma on its own line before ]
text = text.replace('\n,\n\n]\n', '\n\n]\n')

# 2. Add back findKnowledgeTerms before getKnowledgeEntry
missing_func = '''

export interface KnowledgeMatch {
  entry: KnowledgeEntry
  matchedTerm: string
}

const _matchCache = new Map<string, { term: string; kw: string }[]>()

/**
 * 在文本中查找所有匹配的知识点
 */
export function findKnowledgeTerms(text: string): KnowledgeMatch[] {
  if (!text || text.length < 2) return []
  const results: KnowledgeMatch[] = []
  const seen = new Set<string>()

  for (const entry of knowledgeDB) {
    for (const kw of entry.keywords) {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        if (!seen.has(entry.term)) {
          seen.add(entry.term)
          results.push({ entry, matchedTerm: kw })
        }
        break
      }
    }
  }

  return results
}
'''

# Insert before getKnowledgeEntry
text = text.replace('/**\n * 根据术语名称获取完整知识条目', missing_func + '/**\n * 根据术语名称获取完整知识条目')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('✅ 修复完成')

# Verify
with open(path, 'r', encoding='utf-8') as f:
    verify = f.read()
print(f'findKnowledgeTerms 存在: {"findKnowledgeTerms" in verify}')
print(f'KnowledgeMatch 存在: {"KnowledgeMatch" in verify}')
print(f'知识条目数: {verify.count("term:") - 1}')  # -1 for interface field
