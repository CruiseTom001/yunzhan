<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-vue-next'
import {
  createAdminAnnouncement,
  deleteAdminAnnouncement,
  listAdminAnnouncements,
  regenerateAdminAnnouncementFromChangelog,
  repolishAdminAnnouncement,
  updateAdminAnnouncement,
  type AdminAnnouncement,
  type AdminAnnouncementInput,
  type AnnouncementCategory,
} from '@/utils/announcementApi'
import PageState from '@/components/common/PageState.vue'

const PAGE_SIZE = 50
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/

const CATEGORY_OPTIONS: Array<{ value: AnnouncementCategory; label: string }> = [
  { value: 'general', label: '公告' },
  { value: 'web_release', label: '网站更新' },
  { value: 'desktop_release', label: '桌面端更新' },
]

interface EditorState {
  title: string
  content: string
  active: boolean
  category: AnnouncementCategory
  version: string
}

const announcements = ref<AdminAnnouncement[]>([])
const total = ref(0)
const offset = ref(0)
const loading = ref(false)
const pageError = ref('')
const actionError = ref('')
const actionBusyId = ref('')

const editorOpen = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editingId = ref('')
const editingEntry = ref<AdminAnnouncement | null>(null)
const editor = ref<EditorState>({ title: '', content: '', active: true, category: 'general', version: '' })
const editorError = ref('')
const editorSubmitting = ref(false)

const displayStart = computed(() => (total.value === 0 ? 0 : offset.value + 1))
const displayEnd = computed(() => Math.min(offset.value + announcements.value.length, total.value))
const canPrev = computed(() => !loading.value && offset.value > 0)
const canNext = computed(() => !loading.value && offset.value + announcements.value.length < total.value)
const editingGenerated = computed(() => Boolean(editingEntry.value?.sourceKey))

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(timestamp)
}

function categoryLabel(category: AnnouncementCategory) {
  return CATEGORY_OPTIONS.find(option => option.value === category)?.label ?? '公告'
}

function resetEditor(entry?: AdminAnnouncement) {
  editor.value = entry
    ? {
      title: entry.title,
      content: entry.content,
      active: entry.active,
      category: entry.category,
      version: entry.version ?? '',
    }
    : { title: '', content: '', active: true, category: 'general', version: '' }
}

async function loadAnnouncements() {
  loading.value = true
  pageError.value = ''
  try {
    const result = await listAdminAnnouncements({ limit: PAGE_SIZE, offset: offset.value })
    announcements.value = result.announcements
    total.value = result.total
  } catch (error: unknown) {
    pageError.value = errorMessage(error, '公告列表加载失败。')
  } finally {
    loading.value = false
  }
}

function openCreateEditor() {
  resetEditor()
  editorMode.value = 'create'
  editingId.value = ''
  editingEntry.value = null
  editorError.value = ''
  editorOpen.value = true
}

function openEditEditor(entry: AdminAnnouncement) {
  resetEditor(entry)
  editorMode.value = 'edit'
  editingId.value = entry.id
  editingEntry.value = entry
  editorError.value = ''
  editorOpen.value = true
}

function closeEditor() {
  if (editorSubmitting.value) return
  editorOpen.value = false
  editorError.value = ''
  editingEntry.value = null
}

function validateEditor() {
  const title = editor.value.title.trim()
  const content = editor.value.content.trim()
  const version = editor.value.version.trim()
  if (title.length < 1 || title.length > 120) return '公告标题需为 1-120 个字符。'
  if (content.length < 1 || content.length > 4000) return '公告内容需为 1-4000 个字符。'
  if (editor.value.category !== 'general' && !VERSION_PATTERN.test(version)) {
    return '更新类公告需要填写 x.y.z 版本号。'
  }
  if (editor.value.category === 'general' && version && !VERSION_PATTERN.test(version)) {
    return '公告版本需为 x.y.z，或留空。'
  }
  return ''
}

function buildEditorInput(): AdminAnnouncementInput {
  const version = editor.value.version.trim()
  return {
    title: editor.value.title.trim(),
    content: editor.value.content.trim(),
    active: editor.value.active,
    category: editor.value.category,
    version: version || null,
  }
}

async function submitEditor() {
  const validationError = validateEditor()
  if (validationError) {
    editorError.value = validationError
    return
  }
  const input = buildEditorInput()
  editorSubmitting.value = true
  editorError.value = ''
  try {
    if (editorMode.value === 'create') {
      await createAdminAnnouncement(input)
    } else {
      await updateAdminAnnouncement(editingId.value, input)
    }
    editorOpen.value = false
    editingEntry.value = null
    await loadAnnouncements()
  } catch (error: unknown) {
    editorError.value = errorMessage(error, '公告保存失败。')
  } finally {
    editorSubmitting.value = false
  }
}

async function runAnnouncementAction(entry: AdminAnnouncement, action: () => Promise<unknown>, fallback: string) {
  actionBusyId.value = entry.id
  actionError.value = ''
  try {
    await action()
    await loadAnnouncements()
  } catch (error: unknown) {
    actionError.value = errorMessage(error, fallback)
  } finally {
    actionBusyId.value = ''
  }
}

async function publishDraft(entry: AdminAnnouncement) {
  if (entry.active || actionBusyId.value) return
  await runAnnouncementAction(
    entry,
    () => updateAdminAnnouncement(entry.id, { active: true }),
    '公告发布失败。',
  )
}

async function takeOffline(entry: AdminAnnouncement) {
  if (!entry.active || actionBusyId.value) return
  await runAnnouncementAction(
    entry,
    () => updateAdminAnnouncement(entry.id, { active: false }),
    '公告下线失败。',
  )
}

async function repolishDraft(entry: AdminAnnouncement) {
  if (entry.active || actionBusyId.value) return
  await runAnnouncementAction(
    entry,
    () => repolishAdminAnnouncement(entry.id),
    '重新润色失败。',
  )
}

function canRegenerateFromChangelog(entry: AdminAnnouncement): boolean {
  return !entry.active
    && (entry.category === 'web_release' || entry.category === 'desktop_release')
    && typeof entry.version === 'string'
    && VERSION_PATTERN.test(entry.version)
}

async function regenerateFromChangelog(entry: AdminAnnouncement) {
  if (!canRegenerateFromChangelog(entry) || actionBusyId.value) return
  const confirmed = window.confirm(
    `确定根据 CHANGELOG 重新生成「${entry.title}」吗？\n这将覆盖当前草稿正文（不会影响已发布公告）。`,
  )
  if (!confirmed) return
  await runAnnouncementAction(
    entry,
    () => regenerateAdminAnnouncementFromChangelog(entry.id),
    '从更新日志重新生成失败。',
  )
}

async function discardDraft(entry: AdminAnnouncement) {
  if (entry.active || actionBusyId.value) return
  const confirmed = window.confirm(`确定放弃草稿「${entry.title}」吗？该操作不可恢复。`)
  if (!confirmed) return
  await runAnnouncementAction(
    entry,
    () => deleteAdminAnnouncement(entry.id),
    '放弃草稿失败。',
  )
}

function prevPage() {
  if (!canPrev.value) return
  offset.value = Math.max(0, offset.value - PAGE_SIZE)
  void loadAnnouncements()
}

function nextPage() {
  if (!canNext.value) return
  offset.value += PAGE_SIZE
  void loadAnnouncements()
}

onMounted(() => {
  void loadAnnouncements()
})
</script>

<template>
  <main class="min-h-screen pt-24 pb-16 px-4 sm:px-6">
    <section class="max-w-7xl mx-auto">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-8">
        <div>
          <div class="flex items-center gap-2 text-cyan-400 font-mono text-xs mb-2">
            <Megaphone class="w-4 h-4" />
            SUPER ADMIN
          </div>
          <h1 class="text-2xl sm:text-3xl font-semibold text-white">公告管理</h1>
          <p class="text-sm text-gray-500 mt-2">
            发布与维护面向所有登录用户的公告；更新类公告发布后由首页公告按钮、公告中心和未读弹窗推送。
          </p>
        </div>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-cyan-400 text-gray-950 text-sm font-semibold hover:bg-cyan-300"
          @click="openCreateEditor"
        >
          <Plus class="w-4 h-4" />
          新建公告
        </button>
      </div>

      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2 text-xs text-gray-600">
          <Megaphone class="w-4 h-4" />
          共 {{ total }} 条公告
        </div>
        <button
          type="button"
          class="inline-flex h-9 items-center justify-center px-3 rounded-md border border-white/[0.08] text-gray-500 hover:text-white hover:bg-white/[0.04] disabled:opacity-60"
          title="刷新公告列表"
          :disabled="loading"
          @click="loadAnnouncements"
        >
          <RefreshCw class="w-4 h-4" />
        </button>
      </div>

      <div v-if="pageError" class="flex items-start gap-2 p-4 mb-4 rounded-md border border-red-400/20 bg-red-400/[0.06] text-sm text-red-300" role="alert">
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />{{ pageError }}
      </div>
      <div v-if="actionError" class="flex items-start gap-2 p-4 mb-4 rounded-md border border-amber-400/20 bg-amber-400/[0.06] text-sm text-amber-300" role="alert">
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />{{ actionError }}
      </div>

      <div class="overflow-x-auto border-y border-white/[0.06] -mx-4 sm:mx-0">
        <table class="w-full min-w-[720px] sm:min-w-[980px] text-left">
          <thead class="text-xs text-gray-600 font-mono uppercase">
            <tr class="border-b border-white/[0.06]">
              <th class="py-3 px-3 font-medium">发布时间</th>
              <th class="py-3 px-3 font-medium">标题</th>
              <th class="py-3 px-3 font-medium">分类 / 版本</th>
              <th class="py-3 px-3 font-medium">状态</th>
              <th class="py-3 px-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.05]">
            <tr v-if="loading || pageError || announcements.length === 0">
              <td colspan="5" class="py-10 text-center">
                <PageState
                  :loading="loading && announcements.length === 0"
                  loading-text="正在加载公告"
                  :error="pageError"
                  error-text="公告列表加载失败，请稍后重试。"
                  :empty="!loading && !pageError && announcements.length === 0"
                  empty-text="还没有公告"
                  empty-hint="发布后用户会在首页看到未读提醒。"
                  show-retry
                  @retry="loadAnnouncements"
                />
              </td>
            </tr>
            <tr v-for="entry in announcements" v-else :key="entry.id" class="hover:bg-white/[0.015]">
              <td class="py-3 px-3 text-xs text-gray-500 font-mono whitespace-nowrap">{{ formatDate(entry.publishedAt) }}</td>
              <td class="py-3 px-3 text-sm text-gray-200">
                <div class="max-w-[320px]">
                  <div class="truncate">{{ entry.title }}</div>
                  <div v-if="entry.sourceKey" class="mt-1 text-[11px] text-gray-600 font-mono truncate">
                    {{ entry.sourceKey }}<span v-if="entry.sourceCommit"> · {{ entry.sourceCommit.slice(0, 7) }}</span>
                  </div>
                  <div v-if="entry.generatedByAi || entry.generationError" class="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                    <span v-if="entry.generatedByAi" class="inline-flex items-center gap-1 text-cyan-300">
                      <Sparkles class="w-3 h-3" />AI 草稿<span v-if="entry.generationProvider"> · {{ entry.generationProvider }}</span>
                    </span>
                    <span v-if="entry.generationError" class="text-amber-400">已降级：{{ entry.generationError }}</span>
                  </div>
                </div>
              </td>
              <td class="py-3 px-3 text-xs text-gray-400 whitespace-nowrap">
                <div>{{ categoryLabel(entry.category) }}</div>
                <div v-if="entry.version" class="mt-1 font-mono text-cyan-400/80">v{{ entry.version }}</div>
              </td>
              <td class="py-3 px-3">
                <button
                  v-if="entry.active"
                  type="button"
                  class="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300"
                  title="点击下线"
                  :disabled="actionBusyId === entry.id"
                  @click="takeOffline(entry)"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  生效中
                </button>
                <span
                  v-else
                  class="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border border-white/[0.08] text-gray-500"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
                  草稿
                </span>
              </td>
              <td class="py-3 px-3">
                <div class="flex items-center justify-end gap-1">
                  <button type="button" class="icon-action" title="预览 / 编辑公告" :disabled="actionBusyId === entry.id" @click="openEditEditor(entry)">
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button
                    v-if="!entry.active"
                    type="button"
                    class="icon-action text-emerald-300"
                    title="发布草稿"
                    :disabled="actionBusyId === entry.id"
                    @click="publishDraft(entry)"
                  >
                    <Send class="w-4 h-4" />
                  </button>
                  <button
                    v-if="!entry.active"
                    type="button"
                    class="icon-action text-cyan-300"
                    title="重新润色"
                    :disabled="actionBusyId === entry.id"
                    @click="repolishDraft(entry)"
                  >
                    <LoaderCircle v-if="actionBusyId === entry.id" class="w-4 h-4 animate-spin" />
                    <Sparkles v-else class="w-4 h-4" />
                  </button>
                  <button
                    v-if="canRegenerateFromChangelog(entry)"
                    type="button"
                    class="icon-action text-amber-300"
                    title="从更新日志重新生成"
                    :disabled="actionBusyId === entry.id"
                    @click="regenerateFromChangelog(entry)"
                  >
                    <FileText class="w-4 h-4" />
                  </button>
                  <button
                    v-if="!entry.active"
                    type="button"
                    class="icon-action text-red-300"
                    title="放弃草稿"
                    :disabled="actionBusyId === entry.id"
                    @click="discardDraft(entry)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="total > 0" class="flex items-center justify-between gap-4 mt-5 text-xs text-gray-500">
        <span>显示 {{ displayStart }}-{{ displayEnd }} / 共 {{ total }} 条</span>
        <div class="flex items-center gap-2">
          <button type="button" class="icon-action" :disabled="!canPrev" title="上一页" @click="prevPage">
            <ChevronLeft class="w-4 h-4" />
          </button>
          <button type="button" class="icon-action" :disabled="!canNext" title="下一页" @click="nextPage">
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="editorOpen" class="modal-backdrop" role="presentation" @click.self="closeEditor">
        <section class="modal-panel max-w-lg" role="dialog" aria-modal="true" :aria-labelledby="`${editorMode}-announcement-title`">
          <div class="modal-header">
            <div>
              <div class="text-xs text-cyan-400 font-mono mb-1">ANNOUNCEMENT</div>
              <h2 :id="`${editorMode}-announcement-title`" class="text-lg font-semibold text-white">
                {{ editorMode === 'create' ? '新建公告' : editingGenerated ? '预览 / 编辑更新草稿' : '编辑公告' }}
              </h2>
            </div>
            <button type="button" class="icon-action" title="关闭" @click="closeEditor"><X class="w-4 h-4" /></button>
          </div>

          <form class="p-5 space-y-4" @submit.prevent="submitEditor">
            <div v-if="editingEntry?.sourceKey" class="rounded-md border border-cyan-400/20 bg-cyan-400/[0.06] p-3 text-xs text-cyan-200">
              <div class="font-mono">source_key：{{ editingEntry.sourceKey }}</div>
              <div v-if="editingEntry.generationProvider" class="mt-1">AI：{{ editingEntry.generationProvider }}</div>
              <div v-if="editingEntry.generationError" class="mt-1 text-amber-300">降级原因：{{ editingEntry.generationError }}</div>
            </div>

            <label class="form-field">
              <span>标题</span>
              <input v-model="editor.title" type="text" maxlength="120" autocomplete="off" required />
              <small>1-120 个字符</small>
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label class="form-field">
                <span>分类</span>
                <select v-model="editor.category">
                  <option v-for="option in CATEGORY_OPTIONS" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <small>普通用户公告中心会展示该分类</small>
              </label>
              <label class="form-field">
                <span>版本号</span>
                <input v-model="editor.version" type="text" maxlength="32" autocomplete="off" placeholder="例如 1.2.5" />
                <small>更新类公告必填；普通公告可留空</small>
              </label>
            </div>

            <label class="form-field">
              <span>内容</span>
              <textarea
                v-model="editor.content"
                rows="7"
                maxlength="4000"
                class="rounded-md border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50 resize-y"
                placeholder="支持换行，纯文本展示，不支持 HTML"
              />
              <small>1-4000 个字符，纯文本展示，不会渲染 HTML</small>
            </label>

            <label class="flex items-center gap-2 text-xs text-gray-400">
              <input v-model="editor.active" type="checkbox" class="accent-cyan-400" />
              <span>
                {{ editorMode === 'create' ? '立即生效（用户登录后会看到该公告）' : editor.active ? '保持生效；取消勾选将下线' : '保存后立即生效（等同于发布草稿）' }}
              </span>
            </label>

            <div v-if="editorError" class="form-error" role="alert">
              <AlertCircle class="w-4 h-4 shrink-0" />{{ editorError }}
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="secondary-button" :disabled="editorSubmitting" @click="closeEditor">取消</button>
              <button type="submit" class="primary-button" :disabled="editorSubmitting">
                <LoaderCircle v-if="editorSubmitting" class="w-4 h-4 animate-spin" />
                {{ editorMode === 'create' ? '发布公告' : '保存修改' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.icon-action {
  @apply inline-flex w-9 h-9 items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed;
}

.modal-backdrop {
  @apply fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4;
}

.modal-panel {
  @apply w-full max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg border border-edge-card bg-surface-tertiary shadow-2xl overflow-y-auto;
}

.modal-header {
  @apply flex items-start justify-between gap-4 px-5 py-4 border-b border-white/[0.06];
}

.form-field {
  @apply flex flex-col gap-1.5 text-xs text-gray-400;
}

.form-field input,
.form-field select {
  @apply h-10 rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white outline-none focus:border-cyan-400/50;
}

.form-field small {
  @apply text-[11px] text-gray-600;
}

.form-error {
  @apply flex items-start gap-2 rounded-md border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-300;
}

.primary-button,
.secondary-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed;
}

.primary-button {
  @apply bg-cyan-400 text-gray-950 hover:bg-cyan-300;
}

.secondary-button {
  @apply border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.04];
}
</style>
