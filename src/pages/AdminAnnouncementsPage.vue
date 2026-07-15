<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from 'lucide-vue-next'
import {
  createAdminAnnouncement,
  listAdminAnnouncements,
  updateAdminAnnouncement,
  type AdminAnnouncement,
  type AdminAnnouncementInput,
} from '@/utils/announcementApi'

const PAGE_SIZE = 50

const announcements = ref<AdminAnnouncement[]>([])
const total = ref(0)
const offset = ref(0)
const loading = ref(false)
const pageError = ref('')

const editorOpen = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editingId = ref('')
const editor = ref({ title: '', content: '', active: true })
const editorError = ref('')
const editorSubmitting = ref(false)

const displayStart = computed(() => (total.value === 0 ? 0 : offset.value + 1))
const displayEnd = computed(() => Math.min(offset.value + announcements.value.length, total.value))
const canPrev = computed(() => !loading.value && offset.value > 0)
const canNext = computed(() => !loading.value && offset.value + announcements.value.length < total.value)

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(timestamp)
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
  editor.value = { title: '', content: '', active: true }
  editorMode.value = 'create'
  editingId.value = ''
  editorError.value = ''
  editorOpen.value = true
}

function openEditEditor(entry: AdminAnnouncement) {
  editor.value = { title: entry.title, content: entry.content, active: entry.active }
  editorMode.value = 'edit'
  editingId.value = entry.id
  editorError.value = ''
  editorOpen.value = true
}

function closeEditor() {
  if (editorSubmitting.value) return
  editorOpen.value = false
  editorError.value = ''
}

function validateEditor() {
  const title = editor.value.title.trim()
  const content = editor.value.content.trim()
  if (title.length < 1 || title.length > 120) return '公告标题需为 1-120 个字符。'
  if (content.length < 1 || content.length > 4000) return '公告内容需为 1-4000 个字符。'
  return ''
}

async function submitEditor() {
  const validationError = validateEditor()
  if (validationError) {
    editorError.value = validationError
    return
  }
  const input: AdminAnnouncementInput = {
    title: editor.value.title.trim(),
    content: editor.value.content.trim(),
    active: editor.value.active,
  }
  editorSubmitting.value = true
  editorError.value = ''
  try {
    if (editorMode.value === 'create') {
      await createAdminAnnouncement(input)
    } else {
      await updateAdminAnnouncement(editingId.value, input)
    }
    editorOpen.value = false
    await loadAnnouncements()
  } catch (error: unknown) {
    editorError.value = errorMessage(error, '公告保存失败。')
  } finally {
    editorSubmitting.value = false
  }
}

async function toggleActive(entry: AdminAnnouncement) {
  try {
    await updateAdminAnnouncement(entry.id, { active: !entry.active })
    await loadAnnouncements()
  } catch (error: unknown) {
    pageError.value = errorMessage(error, '公告状态切换失败。')
  }
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
          <p class="text-sm text-gray-500 mt-2">发布与维护面向所有登录用户的公告，用户登录后会自动弹窗展示未读公告。</p>
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

      <div class="overflow-x-auto border-y border-white/[0.06]">
        <table class="w-full min-w-[760px] text-left">
          <thead class="text-xs text-gray-600 font-mono uppercase">
            <tr class="border-b border-white/[0.06]">
              <th class="py-3 px-3 font-medium">发布时间</th>
              <th class="py-3 px-3 font-medium">标题</th>
              <th class="py-3 px-3 font-medium">状态</th>
              <th class="py-3 px-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.05]">
            <tr v-if="loading && announcements.length === 0">
              <td colspan="4" class="py-16 text-center text-sm text-gray-600">
                <LoaderCircle class="w-5 h-5 animate-spin mx-auto mb-3" />
                正在加载公告
              </td>
            </tr>
            <tr v-else-if="announcements.length === 0">
              <td colspan="4" class="py-16 text-center text-sm text-gray-600">还没有公告</td>
            </tr>
            <tr v-for="entry in announcements" v-else :key="entry.id" class="hover:bg-white/[0.015]">
              <td class="py-3 px-3 text-xs text-gray-500 font-mono whitespace-nowrap">{{ formatDate(entry.publishedAt) }}</td>
              <td class="py-3 px-3 text-sm text-gray-200 truncate">{{ entry.title }}</td>
              <td class="py-3 px-3">
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border"
                  :class="entry.active
                    ? 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300'
                    : 'border-white/[0.08] text-gray-500 hover:text-white hover:bg-white/[0.04]'"
                  :title="entry.active ? '点击下线' : '点击上线'"
                  @click="toggleActive(entry)"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="entry.active ? 'bg-emerald-400' : 'bg-gray-600'"></span>
                  {{ entry.active ? '生效中' : '已下线' }}
                </button>
              </td>
              <td class="py-3 px-3 text-right">
                <button type="button" class="icon-action" title="编辑公告" @click="openEditEditor(entry)">
                  <Pencil class="w-4 h-4" />
                </button>
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
                {{ editorMode === 'create' ? '新建公告' : '编辑公告' }}
              </h2>
            </div>
            <button type="button" class="icon-action" title="关闭" @click="closeEditor"><X class="w-4 h-4" /></button>
          </div>

          <form class="p-5 space-y-4" @submit.prevent="submitEditor">
            <label class="form-field">
              <span>标题</span>
              <input v-model="editor.title" type="text" maxlength="120" autocomplete="off" required />
              <small>1-120 个字符</small>
            </label>
            <label class="form-field">
              <span>内容</span>
              <textarea
                v-model="editor.content"
                rows="6"
                maxlength="4000"
                class="rounded-md border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50 resize-y"
                placeholder="支持换行，纯文本展示，不支持 HTML"
              />
              <small>1-4000 个字符，纯文本展示，不会渲染 HTML</small>
            </label>
            <label class="flex items-center gap-2 text-xs text-gray-400">
              <input v-model="editor.active" type="checkbox" class="accent-cyan-400" />
              <span>立即生效（用户登录后会看到该公告）</span>
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
  @apply w-full max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg border border-white/[0.08] bg-[#0c0f18] shadow-2xl;
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
