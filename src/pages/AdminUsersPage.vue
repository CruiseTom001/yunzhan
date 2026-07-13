<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AlertCircle,
  BookOpenCheck,
  Clock3,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-vue-next'
import { chapterCounts, courseIndex } from '@/data/courses'
import { useAuthStore } from '@/stores/auth'
import type { AdminUser, UserRole, UserStatus } from '@/types/auth'
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  loadAdminUserProgress,
  updateAdminUser,
  type AdminProgressDetail,
  type AdminUserInput,
} from '@/utils/adminApi'

type EditorMode = 'create' | 'edit'

interface UserEditorState {
  username: string
  displayName: string
  password: string
  role: UserRole
  status: UserStatus
}

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/
const PASSWORD_HAS_LETTER = /[A-Za-z]/
const PASSWORD_HAS_NUMBER = /\d/

const authStore = useAuthStore()
const users = ref<AdminUser[]>([])
const total = ref(0)
const searchQuery = ref('')
const loading = ref(false)
const pageError = ref('')

const editorMode = ref<EditorMode | null>(null)
const editingUserId = ref('')
const editor = ref<UserEditorState>(createEmptyEditor())
const editorError = ref('')
const editorSubmitting = ref(false)

const deletingUser = ref<AdminUser | null>(null)
const deleteConfirmation = ref('')
const deleteError = ref('')
const deleteSubmitting = ref(false)

const progressDetail = ref<AdminProgressDetail | null>(null)
const progressTarget = ref<AdminUser | null>(null)
const progressLoading = ref(false)
const progressError = ref('')

const progressRows = computed(() => {
  const completed = progressDetail.value?.progress?.completedChapters ?? {}
  return courseIndex
    .map((course) => {
      const chapterTotal = chapterCounts[course.id] ?? 0
      const completedCount = new Set(completed[course.id] ?? []).size
      return {
        id: course.id,
        title: course.title,
        completedCount,
        chapterTotal,
        percent: chapterTotal === 0 ? 0 : Math.min(100, Math.round((completedCount / chapterTotal) * 100)),
      }
    })
    .filter(row => row.completedCount > 0)
})

const canConfirmDelete = computed(() => (
  deletingUser.value !== null
  && deleteConfirmation.value === deletingUser.value.username
  && !deleteSubmitting.value
))

function createEmptyEditor(): UserEditorState {
  return {
    username: '',
    displayName: '',
    password: '',
    role: 'user',
    status: 'active',
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function formatDate(timestamp: number | null) {
  if (!timestamp) return '暂无'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function formatDuration(seconds: number) {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`
}

function roleLabel(role: UserRole) {
  return role === 'super_admin' ? '超级管理员' : '学习用户'
}

function statusLabel(status: UserStatus) {
  return status === 'active' ? '正常' : '已停用'
}

async function loadUsers() {
  loading.value = true
  pageError.value = ''
  try {
    const result = await listAdminUsers(searchQuery.value.trim())
    users.value = result.users
    total.value = result.total
  } catch (error: unknown) {
    pageError.value = errorMessage(error, '用户列表加载失败。')
  } finally {
    loading.value = false
  }
}

function openCreateEditor() {
  editor.value = createEmptyEditor()
  editingUserId.value = ''
  editorError.value = ''
  editorMode.value = 'create'
}

function openEditEditor(user: AdminUser) {
  editor.value = {
    username: user.username,
    displayName: user.displayName,
    password: '',
    role: user.role,
    status: user.status,
  }
  editingUserId.value = user.id
  editorError.value = ''
  editorMode.value = 'edit'
}

function closeEditor() {
  if (editorSubmitting.value) return
  editorMode.value = null
  editorError.value = ''
}

function validateEditor() {
  const username = editor.value.username.trim().toLowerCase()
  const displayName = editor.value.displayName.trim()
  const password = editor.value.password
  if (!USERNAME_PATTERN.test(username)) return '用户名需为 3-32 位小写字母、数字、点、下划线或连字符。'
  if (displayName.length < 1 || displayName.length > 50) return '显示名称需为 1-50 个字符。'
  const passwordRequired = editorMode.value === 'create'
  if (passwordRequired || password.length > 0) {
    if (password.length < 10 || password.length > 128 || !PASSWORD_HAS_LETTER.test(password) || !PASSWORD_HAS_NUMBER.test(password)) {
      return '密码需为 10-128 位，并同时包含字母和数字。'
    }
  }
  return ''
}

async function submitEditor() {
  const validationError = validateEditor()
  if (validationError) {
    editorError.value = validationError
    return
  }

  const input: AdminUserInput = {
    username: editor.value.username.trim().toLowerCase(),
    displayName: editor.value.displayName.trim(),
    role: editor.value.role,
    status: editor.value.status,
  }
  if (editor.value.password) input.password = editor.value.password

  editorSubmitting.value = true
  editorError.value = ''
  try {
    if (editorMode.value === 'create') {
      await createAdminUser(input)
    } else {
      await updateAdminUser(editingUserId.value, input)
    }
    editorMode.value = null
    await loadUsers()
  } catch (error: unknown) {
    editorError.value = errorMessage(error, '用户保存失败。')
  } finally {
    editorSubmitting.value = false
  }
}

function openDeleteDialog(user: AdminUser) {
  deletingUser.value = user
  deleteConfirmation.value = ''
  deleteError.value = ''
}

function closeDeleteDialog() {
  if (deleteSubmitting.value) return
  deletingUser.value = null
  deleteConfirmation.value = ''
  deleteError.value = ''
}

async function confirmDelete() {
  if (!deletingUser.value || !canConfirmDelete.value) return
  deleteSubmitting.value = true
  deleteError.value = ''
  try {
    await deleteAdminUser(deletingUser.value.id)
    deletingUser.value = null
    deleteConfirmation.value = ''
    await loadUsers()
  } catch (error: unknown) {
    deleteError.value = errorMessage(error, '删除用户失败。')
  } finally {
    deleteSubmitting.value = false
  }
}

async function openProgress(user: AdminUser) {
  progressTarget.value = user
  progressDetail.value = null
  progressError.value = ''
  progressLoading.value = true
  try {
    progressDetail.value = await loadAdminUserProgress(user.id)
  } catch (error: unknown) {
    progressError.value = errorMessage(error, '学习进度加载失败。')
  } finally {
    progressLoading.value = false
  }
}

function closeProgress() {
  progressTarget.value = null
  progressDetail.value = null
  progressError.value = ''
}

onMounted(() => {
  void loadUsers()
})
</script>

<template>
  <main class="min-h-screen pt-24 pb-16 px-4 sm:px-6">
    <section class="max-w-7xl mx-auto">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-8">
        <div>
          <div class="flex items-center gap-2 text-cyan-400 font-mono text-xs mb-2">
            <ShieldCheck class="w-4 h-4" />
            SUPER ADMIN
          </div>
          <h1 class="text-2xl sm:text-3xl font-semibold text-white">用户与学习进度</h1>
          <p class="text-sm text-gray-500 mt-2">管理云端账号，并查看每位用户的课程学习情况。</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-cyan-400 text-gray-950 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-60"
          @click="openCreateEditor"
        >
          <Plus class="w-4 h-4" />
          新建用户
        </button>
      </div>

      <form class="flex flex-col sm:flex-row gap-3 mb-5" @submit.prevent="loadUsers">
        <label class="relative flex-1 max-w-xl">
          <span class="sr-only">搜索用户</span>
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            v-model="searchQuery"
            type="search"
            maxlength="50"
            autocomplete="off"
            placeholder="搜索用户名或显示名称"
            class="w-full h-10 pl-10 pr-3 rounded-md border border-white/[0.08] bg-white/[0.025] text-sm text-white outline-none focus:border-cyan-400/50"
          />
        </label>
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
          title="刷新用户列表"
          :disabled="loading"
          @click="loadUsers"
        >
          <RefreshCw class="w-4 h-4" />
        </button>
      </form>

      <div class="flex items-center gap-2 text-xs text-gray-600 mb-3">
        <Users class="w-4 h-4" />
        共 {{ total }} 个账号
      </div>

      <div v-if="pageError" class="flex items-start gap-2 p-4 mb-4 rounded-md border border-red-400/20 bg-red-400/[0.06] text-sm text-red-300" role="alert">
        <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
        {{ pageError }}
      </div>

      <div class="overflow-x-auto border-y border-white/[0.06]">
        <table class="w-full min-w-[980px] text-left">
          <thead class="text-xs text-gray-600 font-mono uppercase">
            <tr class="border-b border-white/[0.06]">
              <th class="py-3 px-3 font-medium">用户</th>
              <th class="py-3 px-3 font-medium">权限 / 状态</th>
              <th class="py-3 px-3 font-medium">完成章节</th>
              <th class="py-3 px-3 font-medium">学习时长</th>
              <th class="py-3 px-3 font-medium">最后登录</th>
              <th class="py-3 px-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.05]">
            <tr v-if="loading && users.length === 0">
              <td colspan="6" class="py-16 text-center text-sm text-gray-600">
                <LoaderCircle class="w-5 h-5 animate-spin mx-auto mb-3" />
                正在加载用户列表
              </td>
            </tr>
            <tr v-else-if="users.length === 0">
              <td colspan="6" class="py-16 text-center text-sm text-gray-600">没有符合条件的用户</td>
            </tr>
            <tr v-for="user in users" v-else :key="user.id" class="hover:bg-white/[0.015]">
              <td class="py-4 px-3">
                <div class="flex items-center gap-3">
                  <span class="w-9 h-9 shrink-0 rounded-md border border-cyan-400/15 bg-cyan-400/[0.05] flex items-center justify-center text-cyan-400">
                    <UserRound class="w-4 h-4" />
                  </span>
                  <div class="min-w-0">
                    <div class="text-sm text-gray-200 truncate">
                      {{ user.displayName }}
                      <span v-if="user.id === authStore.user?.id" class="text-[10px] text-cyan-400 ml-1">当前账号</span>
                    </div>
                    <div class="text-xs text-gray-600 font-mono truncate">{{ user.username }}</div>
                    <div v-if="user.email" class="text-[11px] text-gray-600 truncate">{{ user.email }}</div>
                  </div>
                </div>
              </td>
              <td class="py-4 px-3">
                <div class="text-xs text-gray-300">{{ roleLabel(user.role) }}</div>
                <div class="text-xs mt-1" :class="user.status === 'active' ? 'text-emerald-400' : 'text-amber-400'">
                  {{ statusLabel(user.status) }}
                </div>
              </td>
              <td class="py-4 px-3 text-sm text-gray-300">
                {{ user.progressSummary.completedChapters }}
                <span class="text-xs text-gray-600">章</span>
              </td>
              <td class="py-4 px-3 text-sm text-gray-400">{{ formatDuration(user.progressSummary.totalTimeSpent) }}</td>
              <td class="py-4 px-3 text-xs text-gray-500">{{ formatDate(user.lastLoginAt) }}</td>
              <td class="py-4 px-3">
                <div class="flex items-center justify-end gap-1">
                  <button type="button" class="icon-action" title="查看学习进度" @click="openProgress(user)">
                    <Eye class="w-4 h-4" />
                  </button>
                  <button type="button" class="icon-action" title="编辑用户" @click="openEditEditor(user)">
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    class="icon-action hover:!text-red-300"
                    title="删除用户"
                    :disabled="user.id === authStore.user?.id"
                    @click="openDeleteDialog(user)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="editorMode" class="modal-backdrop" role="presentation" @click.self="closeEditor">
        <section class="modal-panel max-w-lg" role="dialog" aria-modal="true" :aria-labelledby="`${editorMode}-user-title`">
          <div class="modal-header">
            <div>
              <div class="text-xs text-cyan-400 font-mono mb-1">ACCOUNT</div>
              <h2 :id="`${editorMode}-user-title`" class="text-lg font-semibold text-white">
                {{ editorMode === 'create' ? '新建用户' : '编辑用户' }}
              </h2>
            </div>
            <button type="button" class="icon-action" title="关闭" @click="closeEditor"><X class="w-4 h-4" /></button>
          </div>

          <form class="p-5 space-y-4" @submit.prevent="submitEditor">
            <label class="form-field">
              <span>用户名</span>
              <input v-model="editor.username" type="text" maxlength="32" autocomplete="off" required />
              <small>3-32 位小写字母、数字、点、下划线或连字符</small>
            </label>
            <label class="form-field">
              <span>显示名称</span>
              <input v-model="editor.displayName" type="text" maxlength="50" autocomplete="off" required />
            </label>
            <label class="form-field">
              <span>{{ editorMode === 'create' ? '初始密码' : '新密码（留空则不修改）' }}</span>
              <input
                v-model="editor.password"
                type="password"
                maxlength="128"
                :autocomplete="editorMode === 'create' ? 'new-password' : 'off'"
                :required="editorMode === 'create'"
              />
              <small>至少 10 位，并同时包含字母和数字</small>
            </label>
            <div class="grid sm:grid-cols-2 gap-4">
              <label class="form-field">
                <span>角色</span>
                <select v-model="editor.role" :disabled="editingUserId === authStore.user?.id">
                  <option value="user">学习用户</option>
                  <option value="super_admin">超级管理员</option>
                </select>
              </label>
              <label class="form-field">
                <span>状态</span>
                <select v-model="editor.status" :disabled="editingUserId === authStore.user?.id">
                  <option value="active">正常</option>
                  <option value="disabled">停用</option>
                </select>
              </label>
            </div>

            <div v-if="editorError" class="form-error" role="alert">
              <AlertCircle class="w-4 h-4 shrink-0" />
              {{ editorError }}
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="secondary-button" :disabled="editorSubmitting" @click="closeEditor">取消</button>
              <button type="submit" class="primary-button" :disabled="editorSubmitting">
                <LoaderCircle v-if="editorSubmitting" class="w-4 h-4 animate-spin" />
                {{ editorMode === 'create' ? '创建账号' : '保存修改' }}
              </button>
            </div>
          </form>
        </section>
      </div>

      <div v-if="deletingUser" class="modal-backdrop" role="presentation" @click.self="closeDeleteDialog">
        <section class="modal-panel max-w-md" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
          <div class="modal-header">
            <h2 id="delete-user-title" class="text-lg font-semibold text-white">删除用户</h2>
            <button type="button" class="icon-action" title="关闭" @click="closeDeleteDialog"><X class="w-4 h-4" /></button>
          </div>
          <div class="p-5">
            <p class="text-sm text-gray-400 leading-6">
              删除前服务器会备份账号与学习进度。请输入用户名
              <strong class="text-white font-mono">{{ deletingUser.username }}</strong>
              进行确认。
            </p>
            <label class="form-field mt-4">
              <span>确认用户名</span>
              <input v-model="deleteConfirmation" type="text" autocomplete="off" />
            </label>
            <div v-if="deleteError" class="form-error mt-4" role="alert">
              <AlertCircle class="w-4 h-4 shrink-0" />
              {{ deleteError }}
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button type="button" class="secondary-button" :disabled="deleteSubmitting" @click="closeDeleteDialog">取消</button>
              <button type="button" class="danger-button" :disabled="!canConfirmDelete" @click="confirmDelete">
                <LoaderCircle v-if="deleteSubmitting" class="w-4 h-4 animate-spin" />
                确认删除
              </button>
            </div>
          </div>
        </section>
      </div>

      <div v-if="progressTarget" class="modal-backdrop" role="presentation" @click.self="closeProgress">
        <section class="modal-panel max-w-3xl" role="dialog" aria-modal="true" aria-labelledby="user-progress-title">
          <div class="modal-header">
            <div>
              <div class="text-xs text-cyan-400 font-mono mb-1">LEARNING PROGRESS</div>
              <h2 id="user-progress-title" class="text-lg font-semibold text-white">{{ progressTarget.displayName }}</h2>
              <p class="text-xs text-gray-600 font-mono mt-1">{{ progressTarget.username }}</p>
            </div>
            <button type="button" class="icon-action" title="关闭" @click="closeProgress"><X class="w-4 h-4" /></button>
          </div>

          <div class="p-5 max-h-[70vh] overflow-y-auto">
            <div v-if="progressLoading" class="py-16 text-center text-sm text-gray-600">
              <LoaderCircle class="w-5 h-5 animate-spin mx-auto mb-3" />
              正在读取云端进度
            </div>
            <div v-else-if="progressError" class="form-error" role="alert">
              <AlertCircle class="w-4 h-4 shrink-0" />
              {{ progressError }}
            </div>
            <template v-else-if="progressDetail">
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] border border-white/[0.06] rounded-md overflow-hidden mb-6">
                <div class="metric-cell"><BookOpenCheck /><strong>{{ progressDetail.summary.completedChapters }}</strong><span>完成章节</span></div>
                <div class="metric-cell"><Clock3 /><strong>{{ formatDuration(progressDetail.summary.totalTimeSpent) }}</strong><span>学习时长</span></div>
                <div class="metric-cell"><UserRound /><strong>{{ progressDetail.summary.studyDays }}</strong><span>学习天数</span></div>
                <div class="metric-cell"><ShieldCheck /><strong>{{ progressDetail.summary.quizAnswers }}</strong><span>答题数量</span></div>
              </div>

              <div class="flex justify-between gap-4 mb-3">
                <h3 class="text-sm font-medium text-gray-200">课程明细</h3>
                <span class="text-xs text-gray-600">云端更新：{{ formatDate(progressDetail.updatedAt) }}</span>
              </div>
              <div v-if="progressRows.length === 0" class="py-10 text-center text-sm text-gray-600 border-y border-white/[0.05]">
                该用户还没有完成任何课程章节
              </div>
              <div v-else class="divide-y divide-white/[0.05] border-y border-white/[0.05]">
                <div v-for="row in progressRows" :key="row.id" class="py-4">
                  <div class="flex justify-between gap-4 mb-2 text-sm">
                    <span class="text-gray-300 truncate">{{ row.title }}</span>
                    <span class="text-gray-500 shrink-0">{{ row.completedCount }} / {{ row.chapterTotal }} 章</span>
                  </div>
                  <div class="h-1.5 bg-white/[0.04] rounded-full overflow-hidden" role="progressbar" :aria-valuenow="row.percent" aria-valuemin="0" aria-valuemax="100">
                    <div class="h-full bg-cyan-400 transition-[width] duration-300" :style="{ width: `${row.percent}%` }"></div>
                  </div>
                </div>
              </div>
            </template>
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

.form-field {
  @apply flex flex-col gap-1.5 text-xs text-gray-400;
}

.form-field input,
.form-field select {
  @apply h-10 rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white outline-none focus:border-cyan-400/50 disabled:opacity-50;
}

.form-field small {
  @apply text-[11px] text-gray-600;
}

.form-error {
  @apply flex items-start gap-2 rounded-md border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-300;
}

.primary-button,
.secondary-button,
.danger-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed;
}

.primary-button {
  @apply bg-cyan-400 text-gray-950 hover:bg-cyan-300;
}

.secondary-button {
  @apply border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.04];
}

.danger-button {
  @apply bg-red-500 text-white hover:bg-red-400;
}

.metric-cell {
  @apply min-h-24 bg-[#0c0f18] p-4 flex flex-col justify-center;
}

.metric-cell :deep(svg) {
  @apply w-4 h-4 text-cyan-400 mb-2;
}

.metric-cell strong {
  @apply text-sm text-gray-100 font-medium;
}

.metric-cell span {
  @apply text-[11px] text-gray-600 mt-1;
}
</style>
