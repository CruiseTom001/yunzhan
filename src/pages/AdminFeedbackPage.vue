<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  X,
} from 'lucide-vue-next'
import {
  listAdminFeedback,
  updateFeedbackStatus,
  type AdminFeedback,
  type FeedbackStatus,
} from '@/utils/feedbackApi'

const PAGE_SIZE = 50
const STATUS_FILTERS: { value: '' | FeedbackStatus; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'open', label: '待处理 open' },
  { value: 'seen', label: '已查看 seen' },
  { value: 'resolved', label: '已处理 resolved' },
]

const feedbacks = ref<AdminFeedback[]>([])
const total = ref(0)
const offset = ref(0)
const statusFilter = ref<'' | FeedbackStatus>('')
const loading = ref(false)
const pageError = ref('')

const detailEntry = ref<AdminFeedback | null>(null)
const updatingStatus = ref(false)
const detailError = ref('')

const displayStart = computed(() => (total.value === 0 ? 0 : offset.value + 1))
const displayEnd = computed(() => Math.min(offset.value + feedbacks.value.length, total.value))
const canPrev = computed(() => !loading.value && offset.value > 0)
const canNext = computed(() => !loading.value && offset.value + feedbacks.value.length < total.value)

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function formatDate(timestamp: number | null) {
  if (!timestamp) return '暂无'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(timestamp)
}

function categoryLabel(category: string) {
  if (category === 'bug') return 'Bug 反馈'
  if (category === 'suggestion') return '功能建议'
  return '其他'
}

function statusLabel(status: FeedbackStatus) {
  if (status === 'seen') return '已查看'
  if (status === 'resolved') return '已处理'
  return '待处理'
}

function statusClass(status: FeedbackStatus) {
  if (status === 'open') return 'text-amber-400'
  if (status === 'resolved') return 'text-emerald-400'
  return 'text-gray-500'
}

async function loadFeedbacks() {
  loading.value = true
  pageError.value = ''
  try {
    const result = await listAdminFeedback({
      status: statusFilter.value,
      limit: PAGE_SIZE,
      offset: offset.value,
    })
    feedbacks.value = result.feedbacks
    total.value = result.total
  } catch (error: unknown) {
    pageError.value = errorMessage(error, '反馈列表加载失败。')
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  offset.value = 0
  void loadFeedbacks()
}

function prevPage() {
  if (!canPrev.value) return
  offset.value = Math.max(0, offset.value - PAGE_SIZE)
  void loadFeedbacks()
}

function nextPage() {
  if (!canNext.value) return
  offset.value += PAGE_SIZE
  void loadFeedbacks()
}

function showDetail(entry: AdminFeedback) {
  detailEntry.value = entry
  detailError.value = ''
}

function closeDetail() {
  detailEntry.value = null
  detailError.value = ''
}

async function changeStatus(status: FeedbackStatus) {
  if (!detailEntry.value || updatingStatus.value) return
  if (detailEntry.value.status === status) return
  updatingStatus.value = true
  detailError.value = ''
  try {
    await updateFeedbackStatus(detailEntry.value.id, status)
    detailEntry.value = { ...detailEntry.value, status }
    await loadFeedbacks()
  } catch (error: unknown) {
    detailError.value = errorMessage(error, '状态更新失败。')
  } finally {
    updatingStatus.value = false
  }
}

function actorLabel(entry: AdminFeedback) {
  if (!entry.user) return '未知用户'
  return entry.user.displayName || entry.user.username
}

onMounted(() => {
  void loadFeedbacks()
})
</script>

<template>
  <main class="min-h-screen pt-24 pb-16 px-4 sm:px-6">
    <section class="max-w-7xl mx-auto">
      <div class="mb-8">
        <div class="flex items-center gap-2 text-cyan-400 font-mono text-xs mb-2">
          <MessageSquare class="w-4 h-4" />
          SUPER ADMIN
        </div>
        <h1 class="text-2xl sm:text-3xl font-semibold text-white">意见反馈</h1>
        <p class="text-sm text-gray-500 mt-2">查看用户反馈并更新处理状态。不展示用户邮箱、密码等敏感信息。</p>
      </div>

      <form class="flex flex-col sm:flex-row gap-3 mb-5" @submit.prevent="applyFilter">
        <select
          v-model="statusFilter"
          class="h-10 rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white outline-none focus:border-cyan-400/50"
          @change="applyFilter"
        >
          <option v-for="option in STATUS_FILTERS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <button
          type="submit"
          class="inline-flex h-10 items-center justify-center gap-2 px-4 rounded-md border border-white/[0.08] text-sm text-gray-300 hover:text-white hover:bg-white/[0.04] disabled:opacity-60"
          :disabled="loading"
        >
          <LoaderCircle v-if="loading" class="w-4 h-4 animate-spin" />
          查询
        </button>
        <button
          type="button"
          class="inline-flex h-10 items-center justify-center px-3 rounded-md border border-white/[0.08] text-gray-500 hover:text-white hover:bg-white/[0.04] disabled:opacity-60"
          title="刷新反馈列表"
          :disabled="loading"
          @click="loadFeedbacks"
        >
          <RefreshCw class="w-4 h-4" />
        </button>
      </form>

      <div class="flex items-center gap-2 text-xs text-gray-600 mb-3">
        <MessageSquare class="w-4 h-4" />
        共 {{ total }} 条反馈
      </div>

      <div v-if="pageError" class="flex items-start gap-2 p-4 mb-4 rounded-md border border-red-400/20 bg-red-400/[0.06] text-sm text-red-300" role="alert">
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />{{ pageError }}
      </div>

      <div class="overflow-x-auto border-y border-white/[0.06]">
        <table class="w-full min-w-[860px] text-left">
          <thead class="text-xs text-gray-600 font-mono uppercase">
            <tr class="border-b border-white/[0.06]">
              <th class="py-3 px-3 font-medium">时间</th>
              <th class="py-3 px-3 font-medium">用户</th>
              <th class="py-3 px-3 font-medium">类别</th>
              <th class="py-3 px-3 font-medium">状态</th>
              <th class="py-3 px-3 font-medium">内容预览</th>
              <th class="py-3 px-3 font-medium text-right">详情</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.05]">
            <tr v-if="loading && feedbacks.length === 0">
              <td colspan="6" class="py-16 text-center text-sm text-gray-600">
                <LoaderCircle class="w-5 h-5 animate-spin mx-auto mb-3" />
                正在加载反馈
              </td>
            </tr>
            <tr v-else-if="feedbacks.length === 0">
              <td colspan="6" class="py-16 text-center text-sm text-gray-600">没有符合条件的反馈</td>
            </tr>
            <tr v-for="entry in feedbacks" v-else :key="entry.id" class="hover:bg-white/[0.015]">
              <td class="py-3 px-3 text-xs text-gray-500 font-mono whitespace-nowrap">{{ formatDate(entry.createdAt) }}</td>
              <td class="py-3 px-3 text-sm text-gray-200">{{ actorLabel(entry) }}</td>
              <td class="py-3 px-3 text-xs text-cyan-300">{{ categoryLabel(entry.category) }}</td>
              <td class="py-3 px-3 text-xs" :class="statusClass(entry.status)">{{ statusLabel(entry.status) }}</td>
              <td class="py-3 px-3 text-sm text-gray-400 max-w-md truncate">{{ entry.content }}</td>
              <td class="py-3 px-3 text-right">
                <button type="button" class="icon-action" title="查看详情" @click="showDetail(entry)">
                  <Eye class="w-4 h-4" />
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
      <div v-if="detailEntry" class="modal-backdrop" role="presentation" @click.self="closeDetail">
        <section class="modal-panel max-w-lg" role="dialog" aria-modal="true" aria-labelledby="feedback-detail-title">
          <div class="modal-header">
            <div>
              <div class="text-xs text-cyan-400 font-mono mb-1">FEEDBACK</div>
              <h2 id="feedback-detail-title" class="text-lg font-semibold text-white">{{ categoryLabel(detailEntry.category) }}</h2>
            </div>
            <button type="button" class="icon-action" title="关闭" @click="closeDetail"><X class="w-4 h-4" /></button>
          </div>
          <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><span class="text-gray-600 text-xs">提交时间</span><div class="text-gray-200 font-mono mt-0.5">{{ formatDate(detailEntry.createdAt) }}</div></div>
              <div>
                <span class="text-gray-600 text-xs">状态</span>
                <div class="mt-0.5" :class="statusClass(detailEntry.status)">{{ statusLabel(detailEntry.status) }}</div>
              </div>
              <div>
                <span class="text-gray-600 text-xs">用户</span>
                <div v-if="detailEntry.user" class="text-gray-200 mt-0.5">
                  {{ detailEntry.user.displayName }}
                  <span class="text-xs text-gray-600 font-mono ml-1">{{ detailEntry.user.username }}</span>
                </div>
                <div v-else class="text-gray-500 mt-0.5">未知用户</div>
              </div>
              <div v-if="detailEntry.seenAt">
                <span class="text-gray-600 text-xs">查看时间</span>
                <div class="text-gray-200 font-mono mt-0.5">{{ formatDate(detailEntry.seenAt) }}</div>
              </div>
              <div v-if="detailEntry.contact" class="col-span-2">
                <span class="text-gray-600 text-xs">联系方式</span>
                <div class="text-gray-200 mt-0.5 break-all">{{ detailEntry.contact }}</div>
              </div>
            </div>
            <div>
              <h3 class="text-xs text-gray-600 mb-2">反馈内容</h3>
              <p class="text-sm text-gray-200 whitespace-pre-wrap border-y border-white/[0.05] py-3 leading-6">{{ detailEntry.content }}</p>
            </div>
            <div>
              <h3 class="text-xs text-gray-600 mb-2">更新状态</h3>
              <div class="flex items-center gap-2">
                <button
                  v-for="option in (['open', 'seen', 'resolved'] as FeedbackStatus[])"
                  :key="option"
                  type="button"
                  class="px-3 h-9 rounded-md border text-xs font-medium disabled:opacity-50"
                  :class="detailEntry.status === option
                    ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
                    : 'border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.04]'"
                  :disabled="updatingStatus"
                  @click="changeStatus(option)"
                >
                  {{ statusLabel(option) }}
                </button>
              </div>
            </div>
            <div v-if="detailError" class="form-error" role="alert">
              <AlertCircle class="w-4 h-4 shrink-0" />{{ detailError }}
            </div>
          </div>
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

.form-error {
  @apply flex items-start gap-2 rounded-md border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-300;
}

select {
  color-scheme: dark;
}

select option {
  color: #ffffff;
  background-color: #0c0f18;
}
</style>
