<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { renderMarkdown, onHighlighterReady } from '@/utils/markdown'
import { lookupCommand, extractCommand, getDemoUrl, type CommandExplanation } from '@/utils/explainer'
import { findKnowledgeTerms } from '@/utils/knowledge'

const props = defineProps<{
  content: string
}>()

const proseRef = ref<HTMLElement | null>(null)
// shiki highlighter 异步就绪后递增，驱动 :key 重渲染与代码块工具栏重绑
const highlightTick = ref(0)


interface ActiveExplain {
  codeBlock: HTMLElement
  command: string
  explanation: CommandExplanation
  panelEl: HTMLElement | null
}

const activeExplain = ref<ActiveExplain | null>(null)

function extractRunnableCommands(codeText: string): string {
  return codeText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.replace(/^[$#>]\s*/, ''))
    .filter(line => line && !line.startsWith('//'))
    .join('\n')
}

/**
 * 在正文文本中标注知识点术语
 * 将已知的技术术语用 <span class="knowledge-term"> 包裹，使其可悬停查看讲解
 */
function annotateKnowledgeTerms() {
  if (!proseRef.value) return
  if (proseRef.value.dataset.annotated) return
  proseRef.value.dataset.annotated = 'true'

  // 文本节点遍历器
  const walker = document.createTreeWalker(
    proseRef.value,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // 跳过代码块内部
        const parent = node.parentElement
        if (parent?.closest('pre, code, .code-toolbar, .explain-panel, .knowledge-term')) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    }
  )

  const textNodes: Text[] = []
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text)
  }

  // 从后往前处理，避免 offset 偏移
  for (let i = textNodes.length - 1; i >= 0; i--) {
    const node = textNodes[i]
    const text = node.textContent || ''

    // 检查是否包含已知术语
    const matches = findKnowledgeTerms(text)
    if (matches.length === 0) continue

    // 按匹配位置排序，从后往前替换
    const termRanges: { start: number; end: number; term: string; core: boolean }[] = []

    for (const match of matches) {
      const kw = match.matchedTerm.toLowerCase()
      let idx = text.toLowerCase().indexOf(kw)
      while (idx !== -1) {
        termRanges.push({ start: idx, end: idx + kw.length, term: match.entry.term, core: Boolean(match.entry.core) })
        idx = text.toLowerCase().indexOf(kw, idx + kw.length)
      }
    }

    // 去重并排序（从后往前）
    termRanges.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start
      if ((b.end - b.start) !== (a.end - a.start)) return (b.end - b.start) - (a.end - a.start)
      return Number(b.core) - Number(a.core)
    })
    const unique: typeof termRanges = []
    for (const r of termRanges) {
      if (!unique.some((u) => r.start < u.end && r.end > u.start)) {
        unique.push(r)
      }
    }

    // 替换文本节点为带标记的 HTML
    const fragment = document.createDocumentFragment()
    let lastEnd = 0

    for (const range of unique) {
      if (lastEnd < range.start) {
        fragment.appendChild(document.createTextNode(text.slice(lastEnd, range.start)))
      }
      const span = document.createElement('span')
      span.className = range.core ? 'knowledge-term knowledge-term-core' : 'knowledge-term'
      span.dataset.term = range.term
      span.dataset.testid = 'knowledge-term'
      span.setAttribute('role', 'button')
      span.setAttribute('tabindex', '0')
      span.setAttribute('aria-label', `查看知识点：${range.term}`)
      if (range.core) {
        span.dataset.core = 'true'
        span.title = '必修知识点'
      } else {
        span.title = `查看知识点：${range.term}`
      }
      span.textContent = text.slice(range.start, range.end)
      fragment.appendChild(span)
      lastEnd = range.end
    }
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastEnd)))
    }

    node.parentNode?.replaceChild(fragment, node)
  }
}

function enhanceTables() {
  if (!proseRef.value) return

  proseRef.value.querySelectorAll('table').forEach((table) => {
    const parent = table.parentElement
    if (parent?.classList.contains('table-scroll-wrap')) return

    const wrap = document.createElement('div')
    wrap.className = 'table-scroll-wrap'
    table.parentNode?.insertBefore(wrap, table)
    wrap.appendChild(table)
  })
}

function enhanceCodeBlocks() {
  if (!proseRef.value) return

  const preBlocks = proseRef.value.querySelectorAll('pre')
  preBlocks.forEach((pre) => {
    // 避免重复增强
    if (pre.dataset.enhanced) return
    pre.dataset.enhanced = 'true'

    const code = pre.querySelector('code')
    if (!code) return

    const codeText = code.textContent || ''
    const lang = pre.className
      .split(/\s+/)
      .find(className => className.startsWith('language-'))
      ?.replace('language-', '') || ''

    // 从代码中提取命令
    const cmdName = extractCommand(codeText, lang)
    const explanation = cmdName ? lookupCommand(cmdName) : null
    const demo = cmdName ? getDemoUrl(cmdName) : null

    // 检测是否为命令行代码（bash/sh/shell 或包含 $/# 前缀）
    const isCommandBlock = lang === 'bash' || lang === 'sh' || lang === 'shell' || /^[$#]/.test(codeText.trim())

    // 创建代码块工具栏
    const toolbar = document.createElement('div')
    toolbar.className = 'code-toolbar'

    // 左侧：语言标签
    const langBadge = document.createElement('span')
    langBadge.className = 'code-lang-badge'
    langBadge.textContent = lang || (isCommandBlock ? 'bash' : 'code')

    toolbar.appendChild(langBadge)

    // 右侧按钮组
    const btnGroup = document.createElement('div')
    btnGroup.className = 'code-btn-group'

    // 复制按钮
    const copyBtn = document.createElement('button')
    copyBtn.className = 'code-btn code-btn-copy'
    copyBtn.textContent = '📋 复制'
    copyBtn.title = '复制代码'
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      navigator.clipboard.writeText(codeText).then(() => {
        copyBtn.textContent = '✅ 已复制'
        setTimeout(() => { copyBtn.textContent = '📋 复制' }, 2000)
      })
    })
    btnGroup.appendChild(copyBtn)

    // 运行按钮：把课程里的命令送到实验终端，形成阅读 -> 操作闭环
    if (isCommandBlock) {
      const runBtn = document.createElement('button')
      runBtn.className = 'code-btn code-btn-run'
      runBtn.textContent = '▶ 运行'
      runBtn.title = '发送到实验终端'
      runBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const command = extractRunnableCommands(codeText)
        if (!command) return
        window.dispatchEvent(new CustomEvent('yunzhan:run-command', {
          detail: { command, source: 'course' },
        }))
        runBtn.textContent = '已发送'
        setTimeout(() => { runBtn.textContent = '▶ 运行' }, 1600)
      })
      btnGroup.appendChild(runBtn)
    }

    // 讲解按钮
    if (explanation) {
      const explainBtn = document.createElement('button')
      explainBtn.className = 'code-btn code-btn-explain'
      explainBtn.textContent = '💡 讲解'
      explainBtn.title = `查看 ${cmdName} 命令详解`
      explainBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        toggleExplain(pre, cmdName!, explanation)
      })
      btnGroup.appendChild(explainBtn)
    }

    // 演示按钮
    if (cmdName && demo) {
      const demoBtn = document.createElement('button')
      demoBtn.className = 'code-btn code-btn-demo'
      demoBtn.textContent = '▶ 演示'
      demoBtn.title = demo.title
      demoBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        window.open(demo.url, '_blank', 'noopener,noreferrer')
      })
      btnGroup.appendChild(demoBtn)
    }

    toolbar.appendChild(btnGroup)

    // 将工具栏插入到 <pre> 前面
    pre.parentNode?.insertBefore(toolbar, pre)
  })
}

function toggleExplain(pre: HTMLElement, command: string, explanation: CommandExplanation) {
  // 如果点击的是同一个，关闭
  if (activeExplain.value?.codeBlock === pre) {
    closeExplain()
    return
  }

  // 关闭之前的
  closeExplain()

  // 创建讲解面板
  const panel = document.createElement('div')
  panel.className = 'explain-panel'

  // 标题
  const title = document.createElement('div')
  title.className = 'explain-title'
  title.textContent = `💡 ${command} — ${explanation.summary}`
  panel.appendChild(title)

  // 详细说明
  const desc = document.createElement('div')
  desc.className = 'explain-desc'
  desc.textContent = explanation.description
  panel.appendChild(desc)

  // 常用选项
  if (explanation.options && Object.keys(explanation.options).length > 0) {
    const optTitle = document.createElement('div')
    optTitle.className = 'explain-section-title'
    optTitle.textContent = '📌 常用选项'
    panel.appendChild(optTitle)

    const optTable = document.createElement('table')
    optTable.className = 'explain-options-table'
    const optHeader = optTable.createTHead()
    const headerRow = optHeader.insertRow()
    const h1 = document.createElement('th')
    h1.textContent = '选项'
    const h2 = document.createElement('th')
    h2.textContent = '说明'
    headerRow.appendChild(h1)
    headerRow.appendChild(h2)

    const optBody = optTable.createTBody()
    for (const [opt, descText] of Object.entries(explanation.options)) {
      const row = optBody.insertRow()
      const c1 = row.insertCell()
      c1.textContent = opt
      c1.className = 'explain-opt-name'
      const c2 = row.insertCell()
      c2.textContent = descText
    }
    panel.appendChild(optTable)
  }

  // 实战示例
  if (explanation.examples && explanation.examples.length > 0) {
    const exTitle = document.createElement('div')
    exTitle.className = 'explain-section-title'
    exTitle.textContent = '🔧 实战示例'
    panel.appendChild(exTitle)

    for (const ex of explanation.examples) {
      const exCode = document.createElement('pre')
      exCode.className = 'explain-example-code'
      exCode.textContent = ex
      panel.appendChild(exCode)
    }
  }

  // 插入到 <pre> 后面
  pre.parentNode?.insertBefore(panel, pre.nextSibling)
  panel.style.maxHeight = '0px'
  // 触发动画
  requestAnimationFrame(() => {
    panel.style.maxHeight = panel.scrollHeight + 80 + 'px'
    panel.style.opacity = '1'
  })

  activeExplain.value = { codeBlock: pre, command, explanation, panelEl: panel }
}

function closeExplain() {
  if (activeExplain.value?.panelEl) {
    const panel = activeExplain.value.panelEl
    panel.style.maxHeight = '0px'
    panel.style.opacity = '0'
    setTimeout(() => {
      panel.remove()
    }, 300)
  }
  activeExplain.value = null
}

// 点击其他区域关闭讲解面板
function handleClickOutside(e: MouseEvent) {
  if (!activeExplain.value) return
  const target = e.target as HTMLElement
  const panel = activeExplain.value.panelEl
  const btn = activeExplain.value.codeBlock.parentNode?.querySelector('.code-btn-explain')
  if (panel && !panel.contains(target) && !btn?.contains(target)) {
    closeExplain()
  }
}

onMounted(() => {
  enhanceCodeBlocks()
  enhanceTables()
  annotateKnowledgeTerms()
  document.addEventListener('click', handleClickOutside)
})

// 监听 shiki highlighter 异步就绪：若首屏渲染时尚未加载完成，
// 待就绪后再次触发 v-html 重计算，让 pending 代码块补上语法高亮。
let cancelReady: (() => void) | null = null
cancelReady = onHighlighterReady(() => {
  highlightTick.value++
})

// 内容变化时重新处理（支持异步加载的内容）
watch(() => props.content, (newVal) => {
  if (!newVal || !proseRef.value) return
  delete proseRef.value.dataset.annotated
  nextTick(() => {
    enhanceCodeBlocks()
    enhanceTables()
    annotateKnowledgeTerms()
  })
})

// highlighter 就绪 / tick 变化后重新增强代码块工具栏
watch(highlightTick, () => {
  nextTick(() => {
    if (!proseRef.value) return
    // 清除旧 enhanced 标记，让工具栏在重渲染后重新绑定
    proseRef.value.querySelectorAll('pre[data-enhanced]').forEach((el) => {
      delete (el as HTMLElement).dataset.enhanced
    })
    enhanceCodeBlocks()
    enhanceTables()
    annotateKnowledgeTerms()
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  cancelReady?.()
})
</script>

<template>
  <div ref="proseRef" class="prose-content min-w-0 max-w-full overflow-x-hidden" :key="highlightTick" v-html="renderMarkdown(content)"></div>
</template>

<style scoped>
.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5em 1em;
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  margin-top: 1em;
}

.code-toolbar + pre {
  margin-top: 0;
  border-radius: 0 0 12px 12px;
  border-top: none;
}

.code-lang-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: var(--text-dim);
  background: var(--bg-elevated);
  padding: 0.2em 0.6em;
  border-radius: 4px;
  text-transform: lowercase;
}

.code-btn-group {
  display: flex;
  gap: 0.4em;
}

.code-btn {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 0.75rem;
  padding: 0.25em 0.65em;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.4;
}

.code-btn:hover {
  background: var(--bg-card-hover);
  color: var(--text-secondary);
}

.code-btn-copy:hover {
  border-color: color-mix(in srgb, var(--accent-cyan) 35%, transparent);
  color: var(--accent-cyan);
}

.code-btn-run:hover {
  border-color: color-mix(in srgb, var(--accent-emerald) 40%, transparent);
  color: var(--accent-emerald);
}

.code-btn-explain:hover {
  border-color: color-mix(in srgb, var(--accent-purple) 35%, transparent);
  color: var(--accent-purple);
}

.code-btn-demo:hover {
  border-color: color-mix(in srgb, var(--accent-amber) 35%, transparent);
  color: var(--accent-amber);
}

/* 讲解面板 */
.explain-panel {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent-purple) 8%, transparent),
    color-mix(in srgb, var(--accent-cyan) 5%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--accent-purple) 18%, transparent);
  border-top: none;
  border-radius: 0 0 12px 12px;
  padding: 1em 1.5em;
  margin-bottom: 1.5em;
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.3s ease;
  opacity: 0;
}

.explain-title {
  font-family: 'JetBrains Mono', 'Noto Sans SC', monospace;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--accent-purple);
  margin-bottom: 0.6em;
}

.explain-desc {
  font-size: 0.88rem;
  color: var(--text-muted);
  line-height: 1.7;
  margin-bottom: 0.8em;
}

.explain-section-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--accent-emerald);
  margin: 0.8em 0 0.4em;
  font-family: 'JetBrains Mono', monospace;
}

.explain-options-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  margin-bottom: 0.5em;
}

.explain-options-table th {
  background: color-mix(in srgb, var(--accent-purple) 10%, transparent);
  color: var(--accent-purple);
  font-weight: 600;
  padding: 0.4em 0.8em;
  text-align: left;
  font-size: 0.8rem;
  border-bottom: 1px solid color-mix(in srgb, var(--accent-purple) 18%, transparent);
}

.explain-options-table td {
  padding: 0.35em 0.8em;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-muted);
}

.explain-opt-name {
  font-family: 'JetBrains Mono', monospace;
  color: var(--accent-amber);
  white-space: nowrap;
  width: 1%;
}

.explain-example-code {
  background: var(--bg-code) !important;
  border: 1px solid var(--border-light) !important;
  border-radius: 8px !important;
  padding: 0.6em 1em !important;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem !important;
  color: var(--text-secondary) !important;
  margin: 0.3em 0 0.5em !important;
  overflow-x: auto;
}
</style>
