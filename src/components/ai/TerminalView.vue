<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useProgressStore } from '@/stores/progress'
import { executeSandboxCommand, sandboxWelcomeLines } from '@/utils/terminalSandbox'

const terminalEl = ref<HTMLElement | null>(null)
const progressStore = useProgressStore()

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let currentLine = ''
let mounted = true
const pendingTimers: ReturnType<typeof setTimeout>[] = []

function defer(fn: () => void, ms: number) {
  const id = setTimeout(fn, ms)
  pendingTimers.push(id)
  return id
}

function writePrompt() {
  terminal?.write('\x1b[1;32m$\x1b[0m ')
}

function runCommand(cmd: string) {
  if (!cmd || !terminal) return
  const result = executeSandboxCommand(cmd)
  if (result.clear) {
    terminal.clear()
  }
  progressStore.recordCommand(cmd, result.output, 'terminal', result.exitCode ?? 0)
  if (result.output) {
    for (const line of result.output.split('\n')) {
      terminal.writeln(line)
    }
  }
}

function handleData(data: string) {
  if (!terminal) return

  switch (data) {
    case '\r':
      terminal.writeln('')
      runCommand(currentLine.trim())
      currentLine = ''
      writePrompt()
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
}

function handleResize() {
  try {
    fitAddon?.fit()
  } catch {
    // xterm can throw while its container is hidden during route transitions.
  }
}

// 与 FloatingTerminal 一致：双 rAF 等布局稳定再 fit，
// 避免容器尺寸 0 时 fit 把行数算成 0 或留末行被裁。
function scheduleFit() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => handleResize())
  })
}

onMounted(async () => {
  await new Promise(resolve => defer(() => resolve(null), 100))
  // 等待期间组件可能已卸载（用户快速切走路由）
  if (!mounted || !terminalEl.value) return

  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    theme: {
      background: '#0a0a14',
      foreground: '#e0e0e0',
      cursor: '#00f0ff',
      selectionBackground: 'rgba(0, 240, 255, 0.2)',
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
  scheduleFit()

  for (const line of sandboxWelcomeLines) {
    terminal.writeln(line)
  }
  terminal.writeln('')
  writePrompt()
  terminal.onData(handleData)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  mounted = false
  window.removeEventListener('resize', handleResize)
  for (const id of pendingTimers) clearTimeout(id)
  pendingTimers.length = 0
  terminal?.dispose()
  terminal = null
})
</script>

<template>
  <div class="terminal-container">
    <div class="terminal-header">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-red-500"></span>
        <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
        <span class="w-3 h-3 rounded-full bg-green-500"></span>
      </div>
      <span class="text-gray-600 text-xs font-mono">实验终端 - 云栈</span>
      <div></div>
    </div>
    <div ref="terminalEl" class="terminal-body"></div>
  </div>
</template>

<style scoped>
.terminal-container {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
  background: #0a0a14;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}
.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.terminal-body {
  padding: 8px 12px;
  min-height: 280px;
  height: 300px;
  /* xterm 初始化按 24 行默认渲染，DOM 高度可能短暂大于固定 300px，
     overflow:hidden 防止末行被裁（与 FloatingTerminal 一致的处理）。 */
  overflow: hidden;
}
</style>
