<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { AlertTriangle, Bot, Code, FileText, Key, Loader2, MessageSquare, Send, User, X } from 'lucide-vue-next'
import { analyzeError, analyzeYAML, explainCommand, setApiKey, streamAsk } from '@/utils/ai-service'
import { renderMarkdown } from '@/utils/markdown'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  visible: boolean
  initialPrompt?: string
  initialMode?: 'qa' | 'command' | 'error' | 'yaml'
}>()

const emit = defineEmits<{
  close: []
}>()

const messages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([
  {
    role: 'assistant',
    content: [
      '我是云栈 AI 助教，可以帮你处理这些任务：',
      '',
      '- 解释 Linux、Docker、Kubernetes 命令',
      '- 分析报错日志并给出排查路径',
      '- 检查 YAML、Docker Compose、K8s 配置',
      '- 回答云计算、运维、DevOps 学习问题',
    ].join('\n'),
  },
])
const input = ref(props.initialPrompt ?? '')
const loading = ref(false)
const apiKeyInput = ref('')
const showApiConfig = ref(false)
const mode = ref<'qa' | 'command' | 'error' | 'yaml'>(props.initialMode || 'qa')
const chatRef = ref<HTMLElement | null>(null)

const modeOptions = [
  { id: 'qa', icon: MessageSquare, label: '问答' },
  { id: 'command', icon: Code, label: '命令' },
  { id: 'error', icon: AlertTriangle, label: '报错' },
  { id: 'yaml', icon: FileText, label: 'YAML' },
] as const

function setMode(m: 'qa' | 'command' | 'error' | 'yaml') {
  mode.value = m
}

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', content: text })
  input.value = ''
  loading.value = true

  try {
    let result = ''

    switch (mode.value) {
      case 'command': {
        const response = await explainCommand(text)
        result = response.error || response.content
        break
      }
      case 'error': {
        const response = await analyzeError(text)
        result = response.error || response.content
        break
      }
      case 'yaml': {
        const response = await analyzeYAML(text)
        result = response.error || response.content
        break
      }
      default: {
        messages.value.push({ role: 'assistant', content: '' })
        const aiMessageIndex = messages.value.length - 1
        for await (const chunk of streamAsk(text)) {
          result += chunk
          messages.value[aiMessageIndex].content = result
        }
      }
    }

    if (result && mode.value !== 'qa') {
      messages.value.push({ role: 'assistant', content: result })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    messages.value.push({ role: 'assistant', content: `出错了：${message}` })
  } finally {
    loading.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function saveApiKey() {
  const key = apiKeyInput.value.trim()
  if (!key) {
    messages.value.push({ role: 'assistant', content: '请输入有效的 API Key。' })
    return
  }
  setApiKey(key)
  apiKeyInput.value = ''
  showApiConfig.value = false
  messages.value.push({
    role: 'assistant',
    content: 'API Key 仅保存在当前会话内，不会写入磁盘。现在可以使用在线 AI 分析能力。',
  })
}

function renderAIContent(content: string): string {
  return renderMarkdown(content)
}

watch(messages, () => {
  nextTick(() => {
    if (chatRef.value) {
      chatRef.value.scrollTop = chatRef.value.scrollHeight
    }
  })
}, { deep: true })
</script>

<template>
  <Teleport to="body">
    <Transition name="ai-panel">
      <div v-if="visible" class="ai-panel">
        <div class="ai-header">
          <div class="ai-header-left">
            <Bot class="w-5 h-5 text-cyan-400" />
            <span class="ai-title">AI 助教</span>
            <span class="ai-beta">DeepSeek</span>
          </div>
          <div class="ai-header-right">
            <button class="ai-header-btn" title="API 设置" @click="showApiConfig = !showApiConfig">
              <Key class="w-4 h-4" />
            </button>
            <button class="ai-header-btn" title="关闭" @click="emit('close')">
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div v-if="showApiConfig" class="ai-api-config">
          <p class="text-xs text-gray-500 mb-2">
            输入 DeepSeek API Key，仅当前会话有效，不会写入磁盘（<a href="https://platform.deepseek.com" target="_blank" rel="noreferrer" class="text-cyan-400">获取 Key</a>）
          </p>
          <div class="flex gap-2">
            <input
              v-model="apiKeyInput"
              type="password"
              placeholder="sk-..."
              class="ai-input flex-1"
            />
            <button class="ai-btn-primary" @click="saveApiKey">保存</button>
          </div>
        </div>

        <div class="ai-modes">
          <button
            v-for="m in modeOptions"
            :key="m.id"
            class="ai-mode-btn"
            :class="{ active: mode === m.id }"
            @click="setMode(m.id)"
          >
            <component :is="m.icon" class="w-3.5 h-3.5" />
            <span>{{ m.label }}</span>
          </button>
        </div>

        <div ref="chatRef" class="ai-messages">
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="ai-message"
            :class="msg.role"
          >
            <div class="ai-avatar">
              <Bot v-if="msg.role === 'assistant'" class="w-4 h-4" />
              <User v-else class="w-4 h-4" />
            </div>
            <div class="ai-content" v-html="renderAIContent(msg.content)"></div>
          </div>
          <div v-if="loading" class="ai-message assistant">
            <div class="ai-avatar"><Bot class="w-4 h-4" /></div>
            <div class="ai-content"><Loader2 class="w-4 h-4 animate-spin inline" /> 思考中...</div>
          </div>
        </div>

        <div class="ai-input-area">
          <textarea
            v-model="input"
            :placeholder="{
              qa: '问我任何云计算或运维问题...',
              command: '粘贴命令，例如 docker run -d -p 8080:80 nginx',
              error: '粘贴错误日志或报错信息...',
              yaml: '粘贴 YAML、Compose 或 K8s 配置...',
            }[mode]"
            class="ai-textarea"
            rows="2"
            @keydown="onKeydown"
          ></textarea>
          <button
            class="ai-send-btn"
            :disabled="loading || !input.trim()"
            @click="send"
          >
            <Send class="w-4 h-4" />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ai-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 420px;
  max-width: calc(100vw - 32px);
  height: 550px;
  max-height: calc(100vh - 100px);
  background: #0c0c14;
  border: 1px solid rgba(0, 240, 255, 0.1);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  z-index: 9999;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 240, 255, 0.05);
}
.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  flex-shrink: 0;
}
.ai-header-left { display: flex; align-items: center; gap: 8px; }
.ai-title { font-size: 14px; font-weight: 700; color: #fff; }
.ai-beta { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(0, 240, 255, 0.1); color: #00f0ff; }
.ai-header-right { display: flex; gap: 4px; }
.ai-header-btn { padding: 4px; border-radius: 6px; color: #666; transition: all 0.2s; }
.ai-header-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
.ai-api-config { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); background: rgba(0,240,255,0.02); flex-shrink: 0; }
.ai-modes { display: flex; gap: 4px; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); flex-shrink: 0; }
.ai-mode-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 8px; font-size: 11px;
  color: #666; transition: all 0.2s;
}
.ai-mode-btn:hover { color: #fff; background: rgba(255,255,255,0.03); }
.ai-mode-btn.active { color: #00f0ff; background: rgba(0, 240, 255, 0.08); }
.ai-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.ai-message { display: flex; gap: 8px; }
.ai-avatar { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ai-message.assistant .ai-avatar { background: rgba(0, 240, 255, 0.1); color: #00f0ff; }
.ai-message.user .ai-avatar { background: rgba(167, 139, 250, 0.1); color: #a78bfa; }
.ai-content {
  flex: 1; font-size: 12px; line-height: 1.6; color: #d4d4d8;
  background: rgba(255, 255, 255, 0.02); border-radius: 10px; padding: 8px 12px;
}
.ai-content :deep(p) { margin: 0 0 0.55em; }
.ai-content :deep(p:last-child) { margin-bottom: 0; }
.ai-content :deep(h1), .ai-content :deep(h2), .ai-content :deep(h3) {
  color: #e5e7eb;
  font-weight: 700;
  margin: 0.75em 0 0.35em;
  font-size: 0.82rem;
}
.ai-content :deep(ul), .ai-content :deep(ol) {
  margin: 0.35em 0 0.55em 1.1em;
}
.ai-content :deep(li) { margin: 0.2em 0; }
.ai-content :deep(blockquote) {
  border-left: 2px solid rgba(0, 240, 255, 0.35);
  padding-left: 0.75em;
  color: #9ca3af;
}
.ai-content :deep(code) { background: rgba(0,240,255,0.08); padding: 1px 4px; border-radius: 3px; font-size: 11px; }
.ai-content :deep(strong) { color: #00f0ff; }
.ai-input-area { display: flex; gap: 8px; padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.03); flex-shrink: 0; }
.ai-textarea {
  flex: 1; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04);
  border-radius: 10px; padding: 8px 12px; color: #fff; font-size: 12px;
  resize: none; outline: none; font-family: 'JetBrains Mono', monospace;
}
.ai-textarea:focus { border-color: rgba(0,240,255,0.2); }
.ai-send-btn {
  width: 36px; height: 36px; border-radius: 10px; background: rgba(0,240,255,0.08);
  color: #00f0ff; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; flex-shrink: 0;
}
.ai-send-btn:hover:not(:disabled) { background: rgba(0, 240, 255, 0.2); }
.ai-send-btn:disabled { opacity: 0.3; }
.ai-input, .ai-btn-primary { padding: 6px 12px; border-radius: 8px; font-size: 12px; }
.ai-input { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); color: #fff; outline: none; }
.ai-btn-primary { background: #00f0ff; color: #0c0c14; font-weight: 600; white-space: nowrap; }

.ai-panel-enter-active, .ai-panel-leave-active { transition: all 0.3s ease; }
.ai-panel-enter-from, .ai-panel-leave-to { opacity: 0; transform: translateY(20px) scale(0.95); }
</style>
