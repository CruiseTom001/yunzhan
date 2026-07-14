<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  X,
} from 'lucide-vue-next'
import { listAuditLogs, type AuditLogEntry } from '@/utils/auditApi'

const PAGE_SIZE = 50
const ACTION_FILTERS = [
  { value: '', label: '全部动作' },
  { value: 'auth.login', label: '登录 auth.login' },
  { value: 'auth.logout', label: '退出 auth.logout' },
  { value: 'user.create', label: '创建用户 user.create' },
  { value: 'user.update', label: '修改用户 user.update' },
  { value: 'user.delete', label: '删除用户 user.delete' },
  { value: 'account.profile.update', label: '改资料 account.profile.update' },
  { value: 'account.password.update', label: '改密码 account.password.update' },
  { value: 'account.email.update', label: '改邮箱 account.email.update' },
  { value: 'account.sessions.revoke_others', label: '撤销其他会话 account.sessions.revoke_others' },
  { value: 'account.session.revoke', label: '撤销会话 account.session.revoke' },
  { value: 'account.delete', label: '注销账号 account.delete' },
]

const logs = ref<AuditLogEntry[]>([])
const total = ref(0)
const offset = ref(0)
const actionFilter = ref('')
const query = ref('')
const loading = ref(false)
const pageError = ref('')

const detailEntry = ref<AuditLogEntry | null>(null)

const displayStart = computed(() => (total.value === 0 ? 0 : offset.value + 1))
const displayEnd = computed(() => Math.min(offset.value + logs.value.length, total.value))
const canPrev = computed(() => !loading.value && offset.value > 0)
const canNext = computed(() => !loading.value && offset.value + logs.value.length < total.value)

const metadataRows = computed(() => {
  if (!detailEntry.value) return []
  return Object.entries(detailEntry.value.metadata)
    .filter(([key]) => !['password', 'token', 'code', 'secret'].includes(key.toLowerCase()))
    .map(([key, value]) => ({ key, value: formatMetadataValue(value) }))
})

function formatMetadataValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function formatDate(timestamp: number | null) {
  if (!timestamp) return '暂无'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(timestamp)
}

async function loadLogs() {
  loading.value = true
  pageError.value = ''
  try {
    const result = await listAuditLogs({
      query: query.value.trim(),
      action: actionFilter.value,
      limit: PAGE_SIZE,
      offset: offset.value,
    })
    logs.value = result.logs
    total.value = result.total
  } catch (error: unknown) {
    pageError.value = errorMessage(error, '审计日志加载失败。')
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  offset.value = 0
  void loadLogs()
}

function prevPage() {
  if (!canPrev.value) return
  offset.value = Math.max(0, offset.value - PAGE_SIZE)
  void loadLogs()
}

function nextPage() {
  if (!canNext.value) return
  offset.value += PAGE_SIZE
  void loadLogs()
}

function showDetail(entry: AuditLogEntry) {
  detailEntry.value = entry
}

function closeDetail() {
  detailEntry.value = null
}

function actorLabel(entry: AuditLogEntry) {
  if (!entry.actor) return '系统'
  return entry.actor.displayName || entry.actor.username
}

function targetLabel(entry: AuditLogEntry) {
  if (!entry.target) return '—'
  return entry.target.displayName || entry.target.username
}

onMounted(() => {
  void loadLogs()
})
</script>

<template>
  <main class="min-h-screen pt-24 pb-16 px-4 sm:px-6">
    <section class="max-w-7xl mx-auto">
      <div class="mb-8">
        <div class="flex items-center gap-2 text-cyan-400 font-mono text-xs mb-2">
          <ShieldCheck class="w-4 h-4" />
          SUPER ADMIN
        </div>
        <h1 class="text-2xl sm:text-3xl font-semibold text-white">审计日志</h1>
        <p class="text-sm text-gray-500 mt-2">追踪登录、用户管理和账号安全操作。不展示密码、Token、验证码等敏感字段。</p>
      </div>

      <!-- 筛选栏 -->
      <form class="flex flex-col sm:flex-row gap-3 mb-5" @submit.prevent="applyFilter">
        <div class="flex-1 max-w-xl">
          <label class="relative block">
            <span class="sr-only">搜索关键字</span>
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              v-model="query"
              type="search"
              maxlength="64"
              autocomplete="off"
              placeholder="搜索动作、用户名或显示名称"
              class="w-full h-10 pl-10 pr-3 rounded-md border border-white/[0.08] bg-white/[0.025] text-sm text-white outline-none focus:border-cyan-400/50"
            />
          </label>
        </div>
        <select
          v-model="actionFilter"
          class="h-10 rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white outline-none focus:border-cyan-400/50"
          @change="applyFilter"
        >
          <option v-for="option in ACTION_FILTERS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <button
          type="submit"
          class="inline-flex h-10 items-center justify-center gap-2 px-4 rounded-md border border-white/[0.08] text-sm text-gray-300 hover:text-white hover:bg-white/[0.04] disabled:opacity-60"
          :disabled="loading"
        >
          <LoaderCircle v-if="loading" class="w-4 h-4 animate-spin" />
          <Search v-else class="w-4 h-4" />
          查询
        </button>
        <button
          type="button"
          class="inline-flex h-10 items-center justify-center px-3 rounded-md border border-white/[0.08] text-gray-500 hover:text-white hover:bg-white/[0.04] disabled:opacity-60"
          title="刷新日志"
          :disabled="loading"
          @click="loadLogs"
        >
          <RefreshCw class="w-4 h-4" />
        </button>
      </form>

      <div class="flex items-center gap-2 text-xs text-gray-600 mb-3">
        <ScrollText class="w-4 h-4" />
        共 {{ total }} 条记录
      </div>

      <div v-if="pageError" class="flex items-start gap-2 p-4 mb-4 rounded-md border border-red-400/20 bg-red-400/[0.06] text-sm text-red-300" role="alert">
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />{{ pageError }}
      </div>

      <div class="overflow-x-auto border-y border-white/[0.06]">
        <table class="w-full min-w-[860px] text-left">
          <thead class="text-xs text-gray-600 font-mono uppercase">
            <tr class="border-b border-white/[0.06]">
              <th class="py-3 px-3 font-medium">时间</th>
              <th class="py-3 px-3 font-medium">动作</th>
              <th class="py-3 px-3 font-medium">操作者</th>
              <th class="py-3 px-3 font-medium">目标</th>
              <th class="py-3 px-3 font-medium text-right">详情</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.05]">
            <tr v-if="loading && logs.length === 0">
              <td colspan="5" class="py-16 text-center text-sm text-gray-600">
                <LoaderCircle class="w-5 h-5 animate-spin mx-auto mb-3" />
                正在加载审计日志
              </td>
            </tr>
            <tr v-else-if="logs.length === 0">
              <td colspan="5" class="py-16 text-center text-sm text-gray-600">没有符合条件的记录</td>
            </tr>
            <tr v-for="entry in logs" v-else :key="entry.id" class="hover:bg-white/[0.015]">
              <td class="py-3 px-3 text-xs text-gray-500 font-mono whitespace-nowrap">{{ formatDate(entry.createdAt) }}</td>
              <td class="py-3 px-3 text-xs text-cyan-300 font-mono">{{ entry.action }}</td>
              <td class="py-3 px-3 text-sm text-gray-200">{{ actorLabel(entry) }}</td>
              <td class="py-3 px-3 text-sm text-gray-300">{{ targetLabel(entry) }}</td>
              <td class="py-3 px-3 text-right">
                <button type="button" class="icon-action" title="查看详情" @click="showDetail(entry)">
                  <Eye class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
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

    <!-- 详情抽屉 -->
    <Teleport to="body">
      <div v-if="detailEntry" class="modal-backdrop" role="presentation" @click.self="closeDetail">
        <section class="modal-panel max-w-lg" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
          <div class="modal-header">
            <div>
              <div class="text-xs text-cyan-400 font-mono mb-1">AUDIT LOG</div>
              <h2 id="audit-detail-title" class="text-lg font-semibold text-white">{{ detailEntry.action }}</h2>
            </div>
            <button type="button" class="icon-action" title="关闭" @click="closeDetail"><X class="w-4 h-4" /></button>
          </div>
          <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><span class="text-gray-600 text-xs">时间</span><div class="text-gray-200 font-mono mt-0.5">{{ formatDate(detailEntry.createdAt) }}</div></div>
              <div><span class="text-gray-600 text-xs">动作</span><div class="text-cyan-300 font-mono mt-0.5">{{ detailEntry.action }}</div></div>
              <div>
                <span class="text-gray-600 text-xs">操作者</span>
                <div v-if="detailEntry.actor" class="text-gray-200 mt-0.5">
                  {{ detailEntry.actor.displayName }}
                  <span class="text-xs text-gray-600 font-mono ml-1">{{ detailEntry.actor.username }}</span>
                </div>
                <div v-else class="text-gray-500 mt-0.5">系统</div>
              </div>
              <div>
                <span class="text-gray-600 text-xs">目标用户</span>
                <div v-if="detailEntry.target" class="text-gray-200 mt-0.5">
                  {{ detailEntry.target.displayName }}
                  <span class="text-xs text-gray-600 font-mono ml-1">{{ detailEntry.target.username }}</span>
                </div>
                <div v-else class="text-gray-500 mt-0.5">—</div>
              </div>
            </div>
            <div>
              <h3 class="text-xs text-gray-600 mb-2">元数据</h3>
              <div v-if="metadataRows.length === 0" class="text-sm text-gray-600 py-3 border-y border-white/[0.05]">无可展示的安全摘要</div>
              <dl v-else class="divide-y divide-white/[0.05] border-y border-white/[0.05]">
                <div v-for="row in metadataRows" :key="row.key" class="py-2.5 grid grid-cols-[auto,1fr] gap-3">
                  <dt class="text-xs text-gray-500 font-mono">{{ row.key }}</dt>
                  <dd class="text-sm text-gray-200 break-all">{{ row.value }}</dd>
                </div>
              </dl>
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

select {
  color-scheme: dark;
}

select option {
  color: #ffffff;
  background-color: #0c0f18;
}
</style>
