<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { GripHorizontal, Minimize2, X } from 'lucide-vue-next'
import { useProgressStore } from '@/stores/progress'
import { executeSandboxCommand, sandboxWelcomeLines } from '@/utils/terminalSandbox'

defineOptions({ inheritAttrs: false })

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()
const progressStore = useProgressStore()

const terminalEl = ref<HTMLElement | null>(null)
const minimized = ref(false)
const dragging = ref(false)
const pos = ref({ x: Math.max(window.innerWidth - 620, 12), y: Math.max(window.innerHeight - 420, 72) })
const dragStart = ref({ x: 0, y: 0 })
const size = ref({ w: 580, h: 380 })

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let currentLine = ''

function clampPosition() {
  const visibleWidth = Math.min(size.value.w, Math.max(window.innerWidth - 24, 280))
  const visibleHeight = Math.min(size.value.h, Math.max(window.innerHeight - 84, 220))
  pos.value = {
    x: Math.min(Math.max(pos.value.x, 12), Math.max(window.innerWidth - visibleWidth - 12, 12)),
    y: Math.min(Math.max(pos.value.y, 64), Math.max(window.innerHeight - visibleHeight - 12, 64)),
  }
}

function startDrag(e: MouseEvent) {
  dragging.value = true
  dragStart.value = { x: e.clientX - pos.value.x, y: e.clientY - pos.value.y }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  pos.value = { x: e.clientX - dragStart.value.x, y: e.clientY - dragStart.value.y }
  clampPosition()
}

function stopDrag() {
  dragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function writePrompt() {
  terminal?.write('\x1b[1;32m$\x1b[0m ')
}

function initTerminal() {
  if (terminal || !terminalEl.value) return

  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    theme: {
      background: '#0a0a14',
      foreground: '#e0e0e0',
      cursor: '#00f0ff',
      black: '#1a1a2e',
      red: '#ff6b6b',
      green: '#00d8a0',
      yellow: '#fbbf24',
      blue: '#00b4d8',
      magenta: '#a78bfa',
      cyan: '#00f0ff',
      white: '#e0e0e0',
      brightBlack: '#404040',
      brightRed: '#ff8787',
      brightGreen: '#00ffb4',
      brightYellow: '#ffd43b',
      brightBlue: '#4dabf7',
      brightMagenta: '#c4b5fd',
      brightCyan: '#67e8f9',
      brightWhite: '#ffffff',
    },
    allowProposedApi: true,
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(terminalEl.value)
  // 两次 rAF 等待布局稳定再 fit：Terminal.open() 后 DOM 行高 width cache 一次，
  // 首次 fit 在 layout 完成前调用会算出错误的行数，导致末行被裁或留白。
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try { fitAddon?.fit() } catch { /* 容器尚未稳定时 fit 会抛异常，忽略重试 */ }
    })
  })

  for (const line of sandboxWelcomeLines) {
    terminal.writeln(line)
  }
  terminal.writeln('')
  writePrompt()
  terminal.focus()

  terminal.onData((data) => {
    if (!terminal) return
    switch (data) {
      case '\r':
        runCurrentLine()
        break
      case '\x7f':
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1)
          terminal.write('\b \b')
        }
        break
      case '\x03':
        terminal.writeln('^C')
        currentLine = ''
        writePrompt()
        break
      default:
        if (data >= ' ' && data <= '~') {
          currentLine += data
          terminal.write(data)
        }
    }
  })
}

function runCurrentLine() {
  if (!terminal) return
  terminal.writeln('')
  runCommand(currentLine.trim())
  currentLine = ''
  writePrompt()
}

function runCommand(cmd: string, source: 'terminal' | 'course' | 'lab' = 'terminal') {
  if (!cmd || !terminal) return
  const result = executeSandboxCommand(cmd)
  if (result.clear) {
    terminal.clear()
  }
  progressStore.recordCommand(cmd, result.output, source, result.exitCode ?? 0)
  if (result.output) {
    for (const line of result.output.split('\n')) {
      terminal.writeln(line)
    }
  }
}

function handleRunCommand(event: Event) {
  const detail = (event as CustomEvent<{ command?: string; source?: 'course' | 'lab' }>).detail
  const command = detail?.command
  const source = detail?.source ?? 'course'
  if (!command) return

  minimized.value = false
  nextTick(() => {
    initTerminal()
    const commands = command
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)

    for (const cmd of commands) {
      if (!terminal) continue
      if (currentLine) {
        terminal.writeln('')
        currentLine = ''
      }
      terminal.write(cmd)
      terminal.writeln('')
      runCommand(cmd, source)
      writePrompt()
    }
    terminal?.focus()
  })
}

function handleResize() {
  clampPosition()
  setTimeout(() => fitAddon?.fit(), 50)
}

onMounted(() => {
  nextTick(initTerminal)
  window.addEventListener('yunzhan:run-command', handleRunCommand)
  window.addEventListener('resize', handleResize)
})

watch(minimized, (val) => {
  if (!val) {
    setTimeout(() => {
      fitAddon?.fit()
      terminal?.focus()
    }, 150)
  }
})

// 浮窗从隐藏切到显示时（首次打开 / 重新打开）也要 fit，
// 否则 xterm 仍保留上次按旧尺寸算的行数，末行会被裁切。
watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => {
      requestAnimationFrame(() => {
        try { fitAddon?.fit() } catch { /* 容器还没好 */ }
        terminal?.focus()
      })
    })
  }
}, { flush: 'post' })

onUnmounted(() => {
  window.removeEventListener('yunzhan:run-command', handleRunCommand)
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  terminal?.dispose()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-show="visible && !minimized"
      class="floating-terminal"
      :style="{ left: pos.x + 'px', top: pos.y + 'px', width: size.w + 'px', height: size.h + 'px' }"
    >
      <div class="ft-header" @mousedown="startDrag">
        <GripHorizontal class="w-3 h-3 text-gray-600 mr-2" />
        <span class="text-xs text-gray-400 font-mono flex-1">实验终端</span>
        <button class="ft-btn" title="最小化" @click="minimized = true">
          <Minimize2 class="w-3 h-3" />
        </button>
        <button class="ft-btn ft-btn-close" title="关闭" @click="emit('close')">
          <X class="w-3 h-3" />
        </button>
      </div>
      <div ref="terminalEl" class="ft-body" @click="() => terminal?.focus()"></div>
    </div>

    <Transition name="fade">
      <button
        v-show="visible && minimized"
        class="fixed bottom-6 right-6 z-[9999] px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-400 text-sm font-mono hover:bg-cyan-500/30 transition-all shadow-lg"
        @click="minimized = false"
      >
        终端
      </button>
    </Transition>
  </Teleport>
</template>

<style scoped>
.floating-terminal {
  position: fixed;
  z-index: 9998;
  border: 1px solid rgba(0, 240, 255, 0.2);
  border-radius: 12px;
  overflow: hidden;
  background: #0a0a14;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 240, 255, 0.05);
  display: flex;
  flex-direction: column;
  resize: both;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 76px);
  min-width: min(360px, calc(100vw - 24px));
  min-height: 220px;
}
.ft-header {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  cursor: move;
  user-select: none;
}
.ft-btn {
  padding: 2px 4px;
  border-radius: 4px;
  color: #666;
  transition: all 0.2s;
  margin-left: 2px;
}
.ft-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
.ft-btn-close:hover { color: #ff6b6b; background: rgba(255,107,107,0.1); }
.ft-body {
  flex: 1;
  padding: 6px 8px;
  min-height: 0;
  /* xterm 初始化时默认按 24 行渲染，DOM 高度可能短暂大于父容器，
     导致末行被裁切。overflow:hidden 防止 xterm 内部 dom 撑高父容器，
     让 fit() 能正确算出实际可用行数。 */
  overflow: hidden;
}
.fade-enter-active, .fade-leave-active { transition: all 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px); }
</style>
