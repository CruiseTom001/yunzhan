<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  CalendarDays,
  Check,
  FileText,
  Loader2,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-vue-next'
import {
  type AiProviderFormat,
  type StudyNote,
  deleteStudyNote,
  listStudyNotes,
  saveStudyNote,
} from '@/utils/studyNotesApi'
import {
  loadLocalAiProvider,
  polishStudyNoteLocally,
  saveLocalAiProvider,
  testAiProviderLocally,
} from '@/utils/localAiProvider'

const notes = ref<StudyNote[]>([])
const selectedDate = ref(formatLocalDate(new Date()))
const content = ref('')
const polishedContent = ref('')
const currentAiProviderName = ref<string | null>(null)
const currentAiModel = ref<string | null>(null)
const loading = ref(false)
const saving = ref(false)
const polishing = ref(false)
const deleting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showAiConfig = ref(false)
const modelDraft = ref('')
const configured = ref(false)
const testingProvider = ref(false)
const providerTestMessage = ref('')
const providerTestOk = ref(false)
const desktopLocalAi = computed(() => typeof window !== 'undefined' && Boolean(window.electronAPI))

const provider = reactive({
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  format: 'chat_completions' as AiProviderFormat,
  model: 'deepseek-chat',
})
const modelList = ref(['deepseek-chat'])

const formatOptions: Array<{ value: AiProviderFormat; label: string }> = [
  { value: 'anthropic_messages', label: 'Anthropic Messages (/v1/messages)' },
  { value: 'chat_completions', label: 'Chat Completions (/chat/completions)' },
  { value: 'responses', label: 'Responses (/responses)' },
]

const sortedNotes = computed(() => [...notes.value].sort((a, b) => b.date.localeCompare(a.date)))
const selectedNote = computed(() => notes.value.find(note => note.date === selectedDate.value) ?? null)
const hasPolishedContent = computed(() => polishedContent.value.trim().length > 0)
const aiReady = computed(() => desktopLocalAi.value ? configured.value : true)
const canPolish = computed(() => content.value.trim().length > 0 && aiReady.value && !polishing.value)
const displayProviderName = computed(() => {
  if (currentAiProviderName.value) return currentAiProviderName.value
  if (!desktopLocalAi.value) return '云栈服务端 AI'
  return configured.value ? provider.name.trim() : null
})
const displayModel = computed(() => {
  if (currentAiModel.value) return currentAiModel.value
  if (!desktopLocalAi.value) return '服务端配置'
  return configured.value ? provider.model.trim() : null
})

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatUpdatedAt(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function setTransientMessage(message: string) {
  successMessage.value = message
  window.setTimeout(() => {
    if (successMessage.value === message) successMessage.value = ''
  }, 2400)
}

function loadEditor(note: StudyNote | null) {
  content.value = note?.content ?? ''
  polishedContent.value = note?.polishedContent ?? ''
  currentAiProviderName.value = note?.aiProviderName ?? null
  currentAiModel.value = note?.aiModel ?? null
}

async function loadNotes() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await listStudyNotes({ limit: 90, offset: 0 })
    notes.value = result.notes
    loadEditor(selectedNote.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '学习记录加载失败。'
  } finally {
    loading.value = false
  }
}

async function loadAiProvider() {
  if (!desktopLocalAi.value) {
    return
  }
  try {
    const stored = await loadLocalAiProvider()
    if (!stored) return
    provider.name = stored.name
    provider.baseUrl = stored.baseUrl
    provider.apiKey = stored.apiKey
    provider.format = stored.format
    provider.model = stored.model
    if (!modelList.value.includes(stored.model)) modelList.value.push(stored.model)
    configured.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '本地 AI 配置读取失败。'
  }
}

function selectDate(date: string) {
  selectedDate.value = date
  loadEditor(selectedNote.value)
  errorMessage.value = ''
  successMessage.value = ''
}

function selectToday() {
  selectDate(formatLocalDate(new Date()))
}

async function saveCurrentNote() {
  const text = content.value.trim()
  if (!text) {
    errorMessage.value = '请先写下今天学了什么。'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const note = await saveStudyNote({
      date: selectedDate.value,
      content: text,
      polishedContent: polishedContent.value.trim(),
      aiProviderName: currentAiProviderName.value,
      aiModel: currentAiModel.value,
    })
    const index = notes.value.findIndex(item => item.date === note.date)
    if (index >= 0) notes.value.splice(index, 1, note)
    else notes.value.unshift(note)
    loadEditor(note)
    setTransientMessage('学习记录已保存。')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '学习记录保存失败。'
  } finally {
    saving.value = false
  }
}

async function deleteCurrentNote() {
  if (!selectedNote.value || deleting.value) return
  const confirmed = window.confirm(`确认删除 ${selectedDate.value} 的学习记录？`)
  if (!confirmed) return
  deleting.value = true
  errorMessage.value = ''
  try {
    await deleteStudyNote(selectedDate.value)
    notes.value = notes.value.filter(note => note.date !== selectedDate.value)
    loadEditor(null)
    setTransientMessage('学习记录已删除。')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '学习记录删除失败。'
  } finally {
    deleting.value = false
  }
}

function addModel() {
  const model = modelDraft.value.trim()
  if (!model || model.length > 128) return
  if (!modelList.value.includes(model)) modelList.value.push(model)
  provider.model = model
  modelDraft.value = ''
}

async function saveAiConfig() {
  if (!desktopLocalAi.value) {
    showAiConfig.value = false
    return
  }
  if (!provider.name.trim() || !provider.baseUrl.trim() || !provider.apiKey.trim() || !provider.model.trim()) {
    errorMessage.value = '请补全 AI 供应商配置。'
    return
  }
  errorMessage.value = ''
  try {
    await saveLocalAiProvider({
      name: provider.name.trim(),
      baseUrl: provider.baseUrl.trim(),
      apiKey: provider.apiKey.trim(),
      format: provider.format,
      model: provider.model.trim(),
    })
    configured.value = true
    showAiConfig.value = false
    setTransientMessage('AI 配置已保存到本地。')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '本地 AI 配置保存失败。'
  }
}

function readProviderInput() {
  return {
    name: provider.name.trim(),
    baseUrl: provider.baseUrl.trim(),
    apiKey: provider.apiKey.trim(),
    format: provider.format,
    model: provider.model.trim(),
  }
}

async function testAiConfig() {
  testingProvider.value = true
  providerTestMessage.value = ''
  providerTestOk.value = false
  errorMessage.value = ''
  try {
    const result = desktopLocalAi.value
      ? await testAiProviderLocally(readProviderInput())
      : await testAiProviderLocally()
    providerTestOk.value = true
    providerTestMessage.value = `连接成功：${result.providerName} / ${result.model}`
  } catch (error) {
    providerTestOk.value = false
    providerTestMessage.value = error instanceof Error ? error.message : 'AI 连接测试失败。'
  } finally {
    testingProvider.value = false
  }
}

async function polishCurrentNote() {
  const text = content.value.trim()
  if (!text) {
    errorMessage.value = '请先写下需要润色的学习记录。'
    return
  }
  if (!aiReady.value) {
    showAiConfig.value = true
    errorMessage.value = '请先配置 AI 供应商。'
    return
  }
  polishing.value = true
  errorMessage.value = ''
  try {
    const result = await polishStudyNoteLocally({
      content: text,
      provider: desktopLocalAi.value ? readProviderInput() : undefined,
    })
    polishedContent.value = result.content
    currentAiProviderName.value = result.providerName
    currentAiModel.value = result.model
    setTransientMessage('AI 润色已生成，确认后可保存。')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'AI 润色失败。'
  } finally {
    polishing.value = false
  }
}

function applyPolishedContent() {
  if (!hasPolishedContent.value) return
  content.value = polishedContent.value
  setTransientMessage('已把润色结果应用到正文。')
}

onMounted(() => {
  void loadNotes()
  void loadAiProvider()
})
</script>

<template>
  <div class="min-h-screen bg-theme-secondary pt-24 pb-16 px-4 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-7xl">
      <div class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div class="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-400/15 bg-cyan-400/5 px-3 py-1 text-xs font-mono text-cyan-400">
            <CalendarDays class="h-3.5 w-3.5" />
            Daily Notes
          </div>
          <h1 class="text-3xl font-bold text-theme">每日学习记录</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-theme-muted">
            记录每天学到的内容，用自己的话留下复盘材料；需要时可以用 AI 润色表达。
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-md border border-white/[0.08] px-3 py-2 text-sm text-gray-400 hover:bg-white/[0.03] hover:text-white"
            @click="showAiConfig = true"
          >
            <Settings class="h-4 w-4" />
            AI 配置
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-400 hover:bg-cyan-400/15"
            @click="selectToday"
          >
            <Plus class="h-4 w-4" />
            今天
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="mb-4 rounded-md border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="mb-4 flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
        <Check class="h-4 w-4" />
        {{ successMessage }}
      </div>

      <div class="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside class="rounded-md border border-theme-card bg-theme-card">
          <div class="flex items-center justify-between border-b border-theme-subtle px-4 py-3">
            <div class="flex items-center gap-2 text-sm font-semibold text-theme">
              <FileText class="h-4 w-4 text-cyan-400" />
              记录列表
            </div>
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin text-cyan-400" />
          </div>
          <div class="border-b border-theme-subtle p-4">
            <label class="mb-2 block text-xs text-theme-muted" for="study-note-date">选择日期</label>
            <input
              id="study-note-date"
              v-model="selectedDate"
              type="date"
              class="w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-theme outline-none focus:border-cyan-400/40"
              @change="loadEditor(selectedNote)"
            />
          </div>
          <div class="max-h-[520px] overflow-y-auto p-2">
            <button
              v-for="note in sortedNotes"
              :key="note.id"
              type="button"
              class="w-full rounded-md px-3 py-3 text-left transition hover:bg-white/[0.03]"
              :class="note.date === selectedDate ? 'bg-cyan-400/10' : ''"
              @click="selectDate(note.date)"
            >
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm font-semibold text-theme">{{ formatDateLabel(note.date) }}</span>
                <span class="text-[11px] font-mono text-theme-dim">{{ note.date }}</span>
              </div>
              <p class="mt-1 line-clamp-2 text-xs leading-5 text-theme-muted">
                {{ note.content }}
              </p>
              <p class="mt-2 text-[11px] text-theme-dim">
                更新 {{ formatUpdatedAt(note.updatedAt) }}
              </p>
            </button>
            <div v-if="!loading && notes.length === 0" class="px-3 py-10 text-center text-sm text-theme-muted">
              暂无学习记录。
            </div>
          </div>
        </aside>

        <main class="min-w-0 rounded-md border border-theme-card bg-theme-card">
          <div class="flex flex-col gap-3 border-b border-theme-subtle px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-theme">{{ selectedDate }} 学习记录</h2>
              <p class="mt-1 text-xs text-theme-muted">
                {{ selectedNote ? `上次更新 ${formatUpdatedAt(selectedNote.updatedAt)}` : '这一天还没有保存记录。' }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-md border border-purple-400/20 bg-purple-400/10 px-3 py-2 text-sm text-purple-300 hover:bg-purple-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canPolish"
                @click="polishCurrentNote"
              >
                <Loader2 v-if="polishing" class="h-4 w-4 animate-spin" />
                <Wand2 v-else class="h-4 w-4" />
                AI 润色
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="saving || !content.trim()"
                @click="saveCurrentNote"
              >
                <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
                <Save v-else class="h-4 w-4" />
                保存
              </button>
              <button
                v-if="selectedNote"
                type="button"
                title="删除当前日期记录"
                class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-400/20 text-red-300 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="deleting"
                @click="deleteCurrentNote"
              >
                <Loader2 v-if="deleting" class="h-4 w-4 animate-spin" />
                <Trash2 v-else class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div class="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section class="min-w-0 border-b border-theme-subtle p-5 xl:border-b-0 xl:border-r">
              <label class="mb-3 block text-sm font-semibold text-theme" for="study-note-content">今天学了什么</label>
              <textarea
                id="study-note-content"
                v-model="content"
                class="min-h-[520px] w-full resize-y rounded-md border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-7 text-theme outline-none focus:border-cyan-400/40"
                maxlength="20000"
                placeholder="例如：今天学习了 Docker 网络模式，理解了 bridge、host 和容器端口映射的区别..."
              ></textarea>
              <div class="mt-2 flex justify-between text-xs text-theme-dim">
                <span>建议用自己的话写，不要求正式，先把事实记录下来。</span>
                <span>{{ content.length }}/20000</span>
              </div>
            </section>

            <section class="min-w-0 p-5">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2 text-sm font-semibold text-theme">
                  <Sparkles class="h-4 w-4 text-purple-300" />
                  润色结果
                </div>
                <button
                  type="button"
                  class="rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-gray-400 hover:bg-white/[0.03] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!hasPolishedContent"
                  @click="applyPolishedContent"
                >
                  应用到正文
                </button>
              </div>
              <textarea
                v-model="polishedContent"
                class="min-h-[360px] w-full resize-y rounded-md border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-7 text-theme outline-none focus:border-purple-400/40"
                maxlength="30000"
                placeholder="AI 润色后会显示在这里，你可以继续修改，再保存。"
              ></textarea>
              <div class="mt-3 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs leading-5 text-theme-muted">
                <div>
                  AI Key：{{ desktopLocalAi ? '桌面端只保存在本机 IndexedDB。' : '网页端使用云栈后端统一配置，浏览器不可见。' }}
                </div>
                <div>当前供应商：{{ displayProviderName || '未配置' }}</div>
                <div>当前模型：{{ displayModel || '未配置' }}</div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>

    <div v-if="showAiConfig" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 py-6">
      <div class="w-full max-w-2xl rounded-lg border border-white/[0.1] bg-[#252525] p-5 shadow-2xl">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-bold text-white">添加模型供应商</h3>
            <p class="mt-1 text-sm text-gray-400">配置一个完全自定义的 API 端点和初始模型。</p>
          </div>
          <button
            type="button"
            title="关闭 AI 配置"
            class="rounded-md p-1 text-gray-400 hover:bg-white/10 hover:text-white"
            @click="showAiConfig = false"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <div v-if="!desktopLocalAi" class="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm leading-6 text-cyan-100">
          网页端使用云栈后端统一配置的 AI Key。前端只把学习记录内容发给云栈后端，由后端调用 AI 供应商后返回结果；浏览器不会看到 API Key。
        </div>

        <div v-else class="space-y-4">
          <div>
            <label class="mb-2 block text-sm text-gray-300" for="ai-provider-name">名称</label>
            <input
              id="ai-provider-name"
              v-model="provider.name"
              class="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
              maxlength="80"
              placeholder="如：智谱 GLM"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm text-gray-300" for="ai-provider-base-url">Base URL</label>
            <input
              id="ai-provider-base-url"
              v-model="provider.baseUrl"
              class="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
              maxlength="2048"
              placeholder="https://api.example.com/v1"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm text-gray-300" for="ai-provider-key">API Key</label>
            <input
              id="ai-provider-key"
              v-model="provider.apiKey"
              type="password"
              class="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
              maxlength="4096"
              placeholder="输入 API Key"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm text-gray-300" for="ai-provider-format">API 格式</label>
            <select
              id="ai-provider-format"
              v-model="provider.format"
              class="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
            >
              <option v-for="option in formatOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <div>
            <label class="mb-2 block text-sm text-gray-300" for="ai-provider-model">模型列表</label>
            <select
              id="ai-provider-model"
              v-model="provider.model"
              class="mb-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
            >
              <option v-for="model in modelList" :key="model" :value="model">{{ model }}</option>
            </select>
            <div class="flex gap-2">
              <input
                v-model="modelDraft"
                class="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                maxlength="128"
                placeholder="添加模型名称"
                @keydown.enter.prevent="addModel"
              />
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
                @click="addModel"
              >
                <Plus class="h-4 w-4" />
                添加模型
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="providerTestMessage"
          class="mt-4 rounded-md border px-3 py-2 text-sm"
          :class="providerTestOk ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-red-400/30 bg-red-400/10 text-red-200'"
        >
          {{ providerTestMessage }}
        </div>

        <div class="mt-6 flex items-center justify-between gap-3">
          <p class="text-xs leading-5 text-gray-500">
            {{ desktopLocalAi ? '桌面端测试与润色走本机 IPC，API Key 保存到本机 IndexedDB。' : '网页端测试与润色走云栈后端代理，API Key 保存在服务端环境变量。' }}
          </p>
          <div class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="testingProvider"
              @click="testAiConfig"
            >
              <Loader2 v-if="testingProvider" class="h-4 w-4 animate-spin" />
              <Check v-else class="h-4 w-4" />
              测试连接
            </button>
            <button
              v-if="desktopLocalAi"
              type="button"
              class="rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0c0c14] hover:bg-cyan-300"
              @click="saveAiConfig"
            >
              添加供应商
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
