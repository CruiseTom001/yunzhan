<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { getKnowledgeEntry, type KnowledgeEntry } from '@/utils/knowledge'

defineOptions({ inheritAttrs: false })

interface PopoverState {
  entry: KnowledgeEntry
  x: number
  y: number
}

const popover = ref<PopoverState | null>(null)
const popoverEl = ref<HTMLElement | null>(null)
const hoverTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const closeTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const activeTarget = ref<HTMLElement | null>(null)

function clearTimers() {
  if (hoverTimer.value) {
    clearTimeout(hoverTimer.value)
    hoverTimer.value = null
  }
  if (closeTimer.value) {
    clearTimeout(closeTimer.value)
    closeTimer.value = null
  }
}

function showPopover(target: HTMLElement) {
  const term = target.dataset.term
  if (!term) return

  const entry = getKnowledgeEntry(term)
  if (!entry) return

  activeTarget.value = target
  const rect = target.getBoundingClientRect()
  popover.value = {
    entry,
    x: rect.left + rect.width / 2,
    y: rect.bottom + 8,
  }

  nextTick(() => {
    if (!popoverEl.value || !popover.value) return
    const pr = popoverEl.value.getBoundingClientRect()
    let x = popover.value.x
    let y = popover.value.y

    if (pr.right > window.innerWidth - 16) {
      x = window.innerWidth - pr.width / 2 - 16
    }
    if (pr.left < 16) {
      x = pr.width / 2 + 16
    }
    if (pr.bottom > window.innerHeight - 16) {
      y = Math.max(16, rect.top - pr.height - 8)
    }

    popover.value = { ...popover.value, x, y }
    requestAnimationFrame(() => {
      popoverEl.value?.classList.add('visible')
    })
  })
}

function scheduleClose(delay = 120) {
  if (closeTimer.value) clearTimeout(closeTimer.value)
  closeTimer.value = setTimeout(() => closePopover(), delay)
}

function handleMouseOver(e: MouseEvent) {
  const rawTarget = e.target as HTMLElement
  if (rawTarget.closest('.knowledge-popover')) {
    clearTimers()
    return
  }

  const target = rawTarget.closest('.knowledge-term') as HTMLElement | null
  if (!target) return

  clearTimers()
  hoverTimer.value = setTimeout(() => {
    showPopover(target)
  }, 180)
}

function handleMouseOut(e: MouseEvent) {
  const rawTarget = e.target as HTMLElement
  const fromTerm = rawTarget.closest('.knowledge-term')
  const fromPopover = rawTarget.closest('.knowledge-popover')
  const related = e.relatedTarget as HTMLElement | null

  if (fromTerm || fromPopover) {
    const movingToSafeArea = related?.closest?.('.knowledge-term, .knowledge-popover')
    if (!movingToSafeArea) scheduleClose()
  }
}

function handleFocusIn(e: FocusEvent) {
  const target = (e.target as HTMLElement).closest('.knowledge-term') as HTMLElement | null
  if (target) showPopover(target)
}

function handleClick(e: MouseEvent) {
  const rawTarget = e.target as HTMLElement
  const target = rawTarget.closest('.knowledge-term') as HTMLElement | null
  const insidePopover = rawTarget.closest('.knowledge-popover')

  if (target) {
    e.preventDefault()
    e.stopPropagation()
    clearTimers()
    if (activeTarget.value === target && popover.value) {
      closePopover()
    } else {
      showPopover(target)
    }
    return
  }

  if (!insidePopover && popover.value) {
    closePopover()
  }
}

function handleKeydown(e: KeyboardEvent) {
  const target = (e.target as HTMLElement).closest('.knowledge-term') as HTMLElement | null
  if (target && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault()
    showPopover(target)
    return
  }
  if (e.key === 'Escape' && popover.value) {
    closePopover()
  }
}

function handlePopoverMouseEnter() {
  clearTimers()
}

function handlePopoverMouseLeave(e: MouseEvent) {
  const related = e.relatedTarget as HTMLElement | null
  if (!related?.closest?.('.knowledge-term')) {
    scheduleClose()
  }
}

function handleScroll() {
  if (!popover.value || !activeTarget.value) return
  const rect = activeTarget.value.getBoundingClientRect()
  const stillVisible = rect.bottom >= 0 && rect.top <= window.innerHeight
  if (!stillVisible) {
    closePopover()
    return
  }
  showPopover(activeTarget.value)
}

function handleResize() {
  if (activeTarget.value && popover.value) {
    showPopover(activeTarget.value)
  }
}

function closePopover() {
  clearTimers()
  popover.value = null
  activeTarget.value = null
}

function getLevelText(level?: string): string {
  switch (level) {
    case 'beginner': return '入门'
    case 'intermediate': return '进阶'
    case 'advanced': return '高级'
    default: return ''
  }
}

function getLevelColor(level?: string): string {
  switch (level) {
    case 'beginner': return '#34d399'
    case 'intermediate': return '#fbbf24'
    case 'advanced': return '#f472b6'
    default: return '#6b7280'
  }
}

onMounted(() => {
  document.addEventListener('mouseover', handleMouseOver)
  document.addEventListener('mouseout', handleMouseOut)
  document.addEventListener('focusin', handleFocusIn)
  document.addEventListener('click', handleClick, true)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('scroll', handleScroll, true)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  document.removeEventListener('mouseover', handleMouseOver)
  document.removeEventListener('mouseout', handleMouseOut)
  document.removeEventListener('focusin', handleFocusIn)
  document.removeEventListener('click', handleClick, true)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('resize', handleResize)
  closePopover()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="popover"
      ref="popoverEl"
      class="knowledge-popover"
      :style="{
        left: popover.x + 'px',
        top: popover.y + 'px',
      }"
      data-testid="knowledge-popover"
      @mouseenter="handlePopoverMouseEnter"
      @mouseleave="handlePopoverMouseLeave"
    >
      <!-- 标题 -->
      <div class="popover-header">
        <span class="popover-term">{{ popover.entry.term }}</span>
        <span
          v-if="popover.entry.level"
          class="popover-level"
          :style="{ color: getLevelColor(popover.entry.level) }"
        >
          {{ getLevelText(popover.entry.level) }}
        </span>
        <span
          v-if="popover.entry.core"
          class="popover-core"
        >⭐ 必修</span>
        <span class="popover-category">{{ popover.entry.category }}</span>
      </div>

      <!-- 摘要 -->
      <div class="popover-summary">{{ popover.entry.summary }}</div>

      <!-- 详细说明 -->
      <div class="popover-desc" v-html="popover.entry.description.replace(/\n/g, '<br>')"></div>

      <!-- 实操提示 -->
      <div v-if="popover.entry.tips" class="popover-tips">
        💡 {{ popover.entry.tips }}
      </div>

      <!-- 代码示例 -->
      <div v-if="popover.entry.example" class="popover-example">
        <pre><code>{{ popover.entry.example }}</code></pre>
      </div>

      <!-- 相关概念 -->
      <div v-if="popover.entry.related && popover.entry.related.length" class="popover-related">
        <span class="related-label">关联知识点：</span>
        <span
          v-for="(r, i) in popover.entry.related"
          :key="r"
          class="related-tag"
        >{{ r }}{{ i < popover.entry.related!.length - 1 ? '' : '' }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.knowledge-popover {
  position: fixed;
  transform: translateX(-50%);
  z-index: 99999;
  width: 380px;
  max-width: min(420px, calc(100vw - 32px));
  max-height: min(500px, calc(100vh - 100px));
  overflow-y: auto;
  background: #1a1a2e;
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 12px;
  padding: 1em 1.2em;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(167, 139, 250, 0.1);
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  transform: translateX(-50%) translateY(-4px);
}

.knowledge-popover.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.popover-header {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin-bottom: 0.5em;
  flex-wrap: wrap;
}

.popover-term {
  font-family: 'JetBrains Mono', 'Noto Sans SC', monospace;
  font-size: 1rem;
  font-weight: 700;
  color: #a78bfa;
}

.popover-level {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15em 0.5em;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid currentColor;
}

.popover-core {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15em 0.5em;
  border-radius: 4px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.15));
  border: 1px solid rgba(251, 191, 36, 0.4);
  color: #fbbf24;
}

.popover-category {
  font-size: 0.7rem;
  color: #6b7280;
  background: rgba(255, 255, 255, 0.04);
  padding: 0.15em 0.5em;
  border-radius: 4px;
}

.popover-summary {
  font-size: 0.85rem;
  color: #e2e8f0;
  line-height: 1.5;
  margin-bottom: 0.6em;
  padding: 0.4em 0.6em;
  background: rgba(0, 240, 255, 0.05);
  border-left: 2px solid #00f0ff;
  border-radius: 0 4px 4px 0;
}

.popover-desc {
  font-size: 0.8rem;
  color: #cbd5e1;
  line-height: 1.65;
  margin-bottom: 0.6em;
}

.popover-desc :deep(code) {
  background: rgba(0, 240, 255, 0.1);
  color: #00f0ff;
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85em;
}

.popover-tips {
  font-size: 0.8rem;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.06);
  border: 1px solid rgba(251, 191, 36, 0.15);
  border-radius: 6px;
  padding: 0.5em 0.7em;
  margin-bottom: 0.5em;
  line-height: 1.5;
}

.popover-example {
  margin-bottom: 0.5em;
}

.popover-example pre {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 0.6em 0.8em;
  overflow-x: auto;
  margin: 0.3em 0;
}

.popover-example code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #e2e8f0;
  white-space: pre;
}

.popover-related {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em;
  align-items: center;
  margin-top: 0.5em;
  padding-top: 0.5em;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.related-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.related-tag {
  font-size: 0.72rem;
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
  padding: 0.15em 0.5em;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
}
</style>
