<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ChevronLeft, ChevronRight, LoaderCircle, MonitorCog, Pencil, Plus,
  RefreshCw, Trash2, X,
} from 'lucide-vue-next'
import {
  createAdminDesktopRelease,
  deleteAdminDesktopRelease,
  listAdminDesktopReleases,
  updateAdminDesktopRelease,
  type DesktopReleaseInput,
  type DesktopReleaseRecord,
} from '@/utils/desktopVersionApi'

const PAGE_SIZE = 50
const releases = ref<DesktopReleaseRecord[]>([])
const total = ref(0)
const offset = ref(0)
const loading = ref(false)
const pageError = ref('')

const editorOpen = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const editor = ref<DesktopReleaseInput>({
  version: '', minSupported: '1.1.0', downloadUrl: '', releaseNotes: '', enabled: true,
})
const editorError = ref('')
const editorSubmitting = ref(false)
const deleteTarget = ref<DesktopReleaseRecord | null>(null)
const deleting = ref(false)

const displayStart = computed(() => (total.value === 0 ? 0 : offset.value + 1))
const displayEnd = computed(() => Math.min(offset.value + releases.value.length, total.value))
const canPrev = computed(() => !loading.value && offset.value > 0)
const canNext = computed(() => !loading.value && offset.value + releases.value.length < total.value)

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(timestamp)
}

async function loadReleases() {
  loading.value = true
  pageError.value = ''
  try {
    const result = await listAdminDesktopReleases({ limit: PAGE_SIZE, offset: offset.value })
    releases.value = result.releases
    total.value = result.total
  } catch (error: unknown) {
    pageError.value = errorMessage(error, '版本记录加载失败。')
  } finally {
    loading.value = false
  }
}

function openCreateEditor() {
  editor.value = { version: '', minSupported: '1.1.0', downloadUrl: '', releaseNotes: '', enabled: true }
  editorMode.value = 'create'
  editingId.value = null
  editorError.value = ''
  editorOpen.value = true
}

function openEditEditor(entry: DesktopReleaseRecord) {
  editor.value = {
    version: entry.version,
    minSupported: entry.minSupported,
    downloadUrl: entry.downloadUrl,
    releaseNotes: entry.releaseNotes,
    enabled: entry.enabled,
  }
  editorMode.value = 'edit'
  editingId.value = entry.id
  editorError.value = ''
  editorOpen.value = true
}

async function submitEditor() {
  editorError.value = ''
  if (editorMode.value === 'create') {
    if (!editor.value.version || !editor.value.minSupported || !editor.value.downloadUrl) {
      editorError.value = '版本号、最低兼容版本、下载地址不可为空。'
      return
    }
  }
  editorSubmitting.value = true
  try {
    if (editorMode.value === 'create') {
      await createAdminDesktopRelease(editor.value)
    } else if (editingId.value !== null) {
      const { version: _version, ...patch } = editor.value
      void _version
      await updateAdminDesktopRelease(editingId.value, patch)
    }
    editorOpen.value = false
    await loadReleases()
  } catch (error: unknown) {
    editorError.value = errorMessage(error, '保存失败。')
  } finally {
    editorSubmitting.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value || deleting.value) return
  deleting.value = true
  try {
    await deleteAdminDesktopRelease(deleteTarget.value.id)
    deleteTarget.value = null
    await loadReleases()
  } catch (error: unknown) {
    pageError.value = errorMessage(error, '删除失败。')
  } finally {
    deleting.value = false
  }
}

function gotoPrev() {
  if (!canPrev.value) return
  offset.value = Math.max(0, offset.value - PAGE_SIZE)
  void loadReleases()
}
function gotoNext() {
  if (!canNext.value) return
  offset.value = offset.value + PAGE_SIZE
  void loadReleases()
}

onMounted(() => {
  void loadReleases()
})
</script>

<template>
  <main class="mx-auto min-h-screen max-w-5xl pt-24 pb-16 px-4 sm:px-6 text-white">
    <div class="flex items-center gap-3 mb-6">
      <MonitorCog class="w-7 h-7 text-cyan-400" />
      <h1 class="text-2xl font-semibold">桌面端版本管理</h1>
      <button type="button" class="ml-auto primary-button" @click="openCreateEditor">
        <Plus class="w-4 h-4 inline" /> 新建版本
      </button>
      <button type="button" class="ghost-button" title="刷新" :disabled="loading" @click="loadReleases">
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <p v-if="pageError" class="text-red-400 text-sm mb-4">{{ pageError }}</p>

    <div v-if="loading && releases.length === 0" class="text-gray-500 flex items-center gap-2">
      <LoaderCircle class="w-4 h-4 animate-spin" /> 加载中...
    </div>

    <table v-else class="w-full text-sm">
      <thead class="text-gray-400 border-b border-white/[0.06]">
        <tr>
          <th class="px-3 py-2 text-left">版本</th>
          <th class="px-3 py-2 text-left">最低兼容</th>
          <th class="px-3 py-2 text-left">下载地址</th>
          <th class="px-3 py-2 text-left">启用</th>
          <th class="px-3 py-2 text-left">创建时间</th>
          <th class="px-3 py-2 text-right">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in releases" :key="entry.id" class="border-b border-white/[0.04]">
          <td class="px-3 py-2 font-mono">{{ entry.version }}</td>
          <td class="px-3 py-2 font-mono">{{ entry.minSupported }}</td>
          <td class="px-3 py-2 max-w-[16rem] truncate" :title="entry.downloadUrl">{{ entry.downloadUrl }}</td>
          <td class="px-3 py-2">
            <span :class="entry.enabled ? 'text-green-400' : 'text-gray-500'">
              {{ entry.enabled ? '启用' : '停用' }}
            </span>
          </td>
          <td class="px-3 py-2 text-gray-500">{{ formatDate(entry.createdAt) }}</td>
          <td class="px-3 py-2 text-right space-x-2">
            <button type="button" class="icon-action" title="编辑" @click="openEditEditor(entry)">
              <Pencil class="w-4 h-4" />
            </button>
            <button type="button" class="icon-action" title="删除" @click="deleteTarget = entry">
              <Trash2 class="w-4 h-4" />
            </button>
          </td>
        </tr>
        <tr v-if="releases.length === 0">
          <td colspan="6" class="px-3 py-8 text-center text-gray-500">暂无桌面端版本记录。</td>
        </tr>
      </tbody>
    </table>

    <div v-if="total > PAGE_SIZE" class="flex items-center justify-between mt-4 text-sm text-gray-400">
      <span>{{ displayStart }}-{{ displayEnd }} / {{ total }}</span>
      <div class="flex gap-2">
        <button type="button" class="ghost-button" :disabled="!canPrev" @click="gotoPrev">
          <ChevronLeft class="w-4 h-4" />
        </button>
        <button type="button" class="ghost-button" :disabled="!canNext" @click="gotoNext">
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- 编辑器抽屉 -->
    <Teleport to="body">
      <div v-if="editorOpen" class="modal-backdrop" role="presentation" @click.self="editorOpen = false">
        <section class="modal-panel max-w-lg" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h2 class="text-lg font-semibold">{{ editorMode === 'create' ? '新建版本' : '编辑版本' }}</h2>
            <button type="button" class="icon-action" title="关闭" @click="editorOpen = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="p-5 space-y-4">
            <label class="block">
              <span class="text-sm text-gray-300">版本号 (x.y.z)</span>
              <input
                v-model="editor.version"
                type="text"
                class="text-input"
                :disabled="editorMode === 'edit'"
                placeholder="1.2.0"
              />
            </label>
            <label class="block">
              <span class="text-sm text-gray-300">最低兼容版本 (x.y.z)</span>
              <input v-model="editor.minSupported" type="text" class="text-input" placeholder="1.1.0" />
            </label>
            <label class="block">
              <span class="text-sm text-gray-300">下载地址 (http(s)://)</span>
              <input v-model="editor.downloadUrl" type="text" class="text-input" placeholder="https://..." />
            </label>
            <label class="block">
              <span class="text-sm text-gray-300">发布说明</span>
              <textarea v-model="editor.releaseNotes" rows="5" class="text-input" maxlength="2000"></textarea>
            </label>
            <label class="flex items-center gap-2">
              <input v-model="editor.enabled" type="checkbox" />
              <span class="text-sm text-gray-300">启用</span>
            </label>
            <p v-if="editorError" class="text-red-400 text-sm">{{ editorError }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" class="ghost-button" :disabled="editorSubmitting" @click="editorOpen = false">取消</button>
              <button type="button" class="primary-button" :disabled="editorSubmitting" @click="submitEditor">
                <LoaderCircle v-if="editorSubmitting" class="w-4 h-4 animate-spin" /> 保存
              </button>
            </div>
          </div>
        </section>
      </div>
    </Teleport>

    <!-- 删除确认 -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal-backdrop" role="presentation" @click.self="deleteTarget = null">
        <section class="modal-panel max-w-sm" role="dialog" aria-modal="true">
          <div class="p-5 space-y-4">
            <h3 class="text-base font-semibold">确认删除版本 v{{ deleteTarget.version }}?</h3>
            <p class="text-sm text-gray-400">删除后无法恢复,且桌面端将不再提示此版本。</p>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" class="ghost-button" :disabled="deleting" @click="deleteTarget = null">取消</button>
              <button type="button" class="danger-button" :disabled="deleting" @click="confirmDelete">
                <LoaderCircle v-if="deleting" class="w-4 h-4 animate-spin" /> 删除
              </button>
            </div>
          </div>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.modal-backdrop {
  @apply fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4;
}
.modal-panel {
  @apply w-full max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg
    border border-white/[0.08] bg-[#0c0f18] shadow-2xl;
}
.modal-header {
  @apply flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.06];
}
.icon-action {
  @apply inline-flex w-9 h-9 items-center justify-center rounded-md
    text-gray-500 hover:text-white hover:bg-white/[0.04];
}
.primary-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium
    bg-cyan-400 text-gray-950 hover:bg-cyan-300 disabled:opacity-50;
}
.ghost-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm
    text-gray-300 hover:bg-white/[0.05] disabled:opacity-50;
}
.danger-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium
    bg-red-500 text-white hover:bg-red-400 disabled:opacity-50;
}
.text-input {
  @apply mt-1 w-full rounded-md bg-white/[0.04] border border-white/[0.08]
    px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none
    focus:border-cyan-400 disabled:opacity-60;
}
</style>
