<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertCircle,
  Download,
  KeyRound,
  LoaderCircle,
  Mail,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useProgressStore } from '@/stores/progress'
import {
  changeAccountPassword,
  deleteAccount,
  exportAccountData,
  listAccountSessions,
  requestEmailChangeCode,
  revokeAccountSession,
  revokeOtherAccountSessions,
  type AccountSession,
} from '@/utils/accountApi'

const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/
const PASSWORD_HAS_LETTER = /[A-Za-z]/
const PASSWORD_HAS_NUMBER = /\d/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const router = useRouter()
const authStore = useAuthStore()
const progressStore = useProgressStore()

// 资料编辑
const profileEditor = ref({ username: '', displayName: '' })
const profileEditing = ref(false)
const profileSubmitting = ref(false)
const profileError = ref('')
const profileSuccess = ref('')

// 修改密码
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordSubmitting = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

// 邮箱变更
const emailForm = ref({ email: '', currentPassword: '', code: '' })
const emailCooldown = ref(0)
const emailSubmitting = ref(false)
const emailError = ref('')
const emailSuccess = ref('')
let cooldownTimer: ReturnType<typeof setInterval> | null = null

// 会话管理
const sessions = ref<AccountSession[]>([])
const sessionsLoading = ref(false)
const sessionsError = ref('')
const sessionsSuccess = ref('')

// 注销账号
const deleteDialogOpen = ref(false)
const deleteForm = ref({ currentPassword: '', confirmation: '' })
const deleteSubmitting = ref(false)
const deleteError = ref('')

const currentUser = computed(() => authStore.user)
const roleLabel = computed(() => (currentUser.value?.role === 'super_admin' ? '超级管理员' : '学习用户'))

const newPasswordValid = computed(() => {
  const pwd = passwordForm.value.newPassword
  return pwd.length >= 10 && pwd.length <= 128 && PASSWORD_HAS_LETTER.test(pwd) && PASSWORD_HAS_NUMBER.test(pwd)
})

const canSubmitEmailCode = computed(() => (
  !emailSubmitting.value
  && emailCooldown.value === 0
  && EMAIL_PATTERN.test(emailForm.value.email)
  && emailForm.value.currentPassword.length > 0
))

const canConfirmEmail = computed(() => (
  !emailSubmitting.value
  && EMAIL_PATTERN.test(emailForm.value.email)
  && emailForm.value.code.trim().length > 0
  && emailForm.value.currentPassword.length > 0
))

const canConfirmDelete = computed(() => (
  !deleteSubmitting.value
  && deleteForm.value.currentPassword.length > 0
  && deleteForm.value.confirmation === currentUser.value?.username
))

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

function parseUserAgent(ua: string) {
  if (!ua) return '未知设备'
  if (/Windows/i.test(ua)) return 'Windows 设备'
  if (/Mac/i.test(ua)) return 'Mac 设备'
  if (/Linux/i.test(ua)) return 'Linux 设备'
  if (/Android/i.test(ua)) return 'Android 设备'
  if (/iPhone|iPad/i.test(ua)) return 'iOS 设备'
  return ua.slice(0, 60)
}

// 资料编辑
function startEditProfile() {
  profileEditor.value.username = currentUser.value?.username ?? ''
  profileEditor.value.displayName = currentUser.value?.displayName ?? ''
  profileEditing.value = true
  profileError.value = ''
  profileSuccess.value = ''
}

function cancelEditProfile() {
  if (profileSubmitting.value) return
  profileEditing.value = false
  profileError.value = ''
}

async function submitProfile() {
  const username = profileEditor.value.username.trim()
  const displayName = profileEditor.value.displayName.trim()
  if (!USERNAME_PATTERN.test(username)) {
    profileError.value = '用户名需为 3-32 位字母、数字、点、下划线或连字符。'
    return
  }
  if (displayName.length < 1 || displayName.length > 50) {
    profileError.value = '显示名称需为 1-50 个字符。'
    return
  }
  profileSubmitting.value = true
  profileError.value = ''
  try {
    await authStore.updateProfile({ username, displayName })
    profileEditing.value = false
    profileSuccess.value = '资料已更新。'
  } catch (error: unknown) {
    profileError.value = errorMessage(error, '资料保存失败。')
  } finally {
    profileSubmitting.value = false
  }
}

// 修改密码
async function submitPassword() {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordError.value = '两次输入的新密码不一致。'
    return
  }
  if (!newPasswordValid.value) {
    passwordError.value = '新密码需为 10-128 位，并同时包含字母和数字。'
    return
  }
  passwordSubmitting.value = true
  passwordError.value = ''
  passwordSuccess.value = ''
  try {
    await changeAccountPassword({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    })
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
    passwordSuccess.value = '密码已更新。其他设备会话已撤销，本机登录状态保留。'
  } catch (error: unknown) {
    passwordError.value = errorMessage(error, '密码修改失败。')
  } finally {
    passwordSubmitting.value = false
  }
}

// 邮箱变更
function startEmailCooldown(seconds: number) {
  emailCooldown.value = seconds
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    if (emailCooldown.value > 0) emailCooldown.value -= 1
    if (emailCooldown.value === 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

async function sendEmailCode() {
  if (!canSubmitEmailCode.value) return
  emailSubmitting.value = true
  emailError.value = ''
  emailSuccess.value = ''
  try {
    const cooldownSeconds = await requestEmailChangeCode({
      email: emailForm.value.email.trim(),
      currentPassword: emailForm.value.currentPassword,
    })
    startEmailCooldown(cooldownSeconds)
    emailSuccess.value = '验证码已发送到新邮箱，10 分钟内有效。'
  } catch (error: unknown) {
    emailError.value = errorMessage(error, '验证码发送失败。')
  } finally {
    emailSubmitting.value = false
  }
}

async function confirmEmail() {
  if (!canConfirmEmail.value) return
  emailSubmitting.value = true
  emailError.value = ''
  emailSuccess.value = ''
  try {
    await authStore.changeEmail({
      email: emailForm.value.email.trim(),
      code: emailForm.value.code.trim(),
      currentPassword: emailForm.value.currentPassword,
    })
    emailForm.value = { email: '', currentPassword: '', code: '' }
    emailSuccess.value = '邮箱已更换。'
  } catch (error: unknown) {
    emailError.value = errorMessage(error, '邮箱变更失败。')
  } finally {
    emailSubmitting.value = false
  }
}

// 会话管理
async function loadSessions() {
  sessionsLoading.value = true
  sessionsError.value = ''
  sessionsSuccess.value = ''
  try {
    sessions.value = await listAccountSessions()
  } catch (error: unknown) {
    sessionsError.value = errorMessage(error, '会话列表加载失败。')
  } finally {
    sessionsLoading.value = false
  }
}

async function revokeSession(session: AccountSession) {
  sessionsSuccess.value = ''
  sessionsError.value = ''
  try {
    await revokeAccountSession(session.id)
    if (session.current) {
      // 撤销当前会话等同于退出登录
      await progressStore.unbindAccount()
      authStore.clearLocalSession()
      await router.replace('/login')
      return
    }
    sessionsSuccess.value = '已撤销该会话。'
    await loadSessions()
  } catch (error: unknown) {
    sessionsError.value = errorMessage(error, '撤销会话失败。')
  }
}

async function revokeOthers() {
  sessionsSuccess.value = ''
  sessionsError.value = ''
  try {
    await revokeOtherAccountSessions()
    sessionsSuccess.value = '已撤销其他所有设备会话。'
    await loadSessions()
  } catch (error: unknown) {
    sessionsError.value = errorMessage(error, '撤销其他会话失败。')
  }
}

// 数据导出
async function exportData() {
  try {
    const data = await exportAccountData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const stamp = new Date(data.exportedAt).toISOString().slice(0, 10)
    link.download = `yunzhan-account-${stamp}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error: unknown) {
    profileError.value = errorMessage(error, '数据导出失败。')
  }
}

// 注销账号
function openDeleteDialog() {
  deleteForm.value = { currentPassword: '', confirmation: '' }
  deleteError.value = ''
  deleteDialogOpen.value = true
}

function closeDeleteDialog() {
  if (deleteSubmitting.value) return
  deleteDialogOpen.value = false
  deleteForm.value = { currentPassword: '', confirmation: '' }
  deleteError.value = ''
}

async function confirmDeleteAccount() {
  if (!canConfirmDelete.value) return
  deleteSubmitting.value = true
  deleteError.value = ''
  try {
    await deleteAccount({
      currentPassword: deleteForm.value.currentPassword,
      confirmation: deleteForm.value.confirmation,
    })
    // 复刻 AppHeader logout 顺序
    await progressStore.unbindAccount()
    authStore.clearLocalSession()
    await router.replace('/login')
  } catch (error: unknown) {
    deleteError.value = errorMessage(error, '账号注销失败。')
  } finally {
    deleteSubmitting.value = false
  }
}

onMounted(() => {
  void loadSessions()
})

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>

<template>
  <main class="min-h-screen pt-24 pb-16 px-4 sm:px-6">
    <section class="max-w-4xl mx-auto">
      <div class="mb-8">
        <div class="flex items-center gap-2 text-cyan-400 font-mono text-xs mb-2">
          <UserRound class="w-4 h-4" />
          ACCOUNT
        </div>
        <h1 class="text-2xl sm:text-3xl font-semibold text-white">账号设置</h1>
        <p class="text-sm text-gray-500 mt-2">管理个人资料、密码、邮箱、登录会话和数据。</p>
      </div>

      <!-- 资料卡片 -->
      <div class="card p-5 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-gray-200 flex items-center gap-2">
            <UserRound class="w-4 h-4 text-cyan-400" />
            个人资料
          </h2>
          <button v-if="!profileEditing" type="button" class="secondary-button h-9" @click="startEditProfile">编辑</button>
        </div>

        <div v-if="!profileEditing" class="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><span class="text-gray-600 text-xs">用户名</span><div class="text-gray-200 font-mono mt-0.5">{{ currentUser?.username }}</div></div>
          <div><span class="text-gray-600 text-xs">显示名称</span><div class="text-gray-200 mt-0.5">{{ currentUser?.displayName }}</div></div>
          <div><span class="text-gray-600 text-xs">邮箱</span><div class="text-gray-200 font-mono mt-0.5">{{ currentUser?.email ?? '未绑定' }}</div></div>
          <div><span class="text-gray-600 text-xs">角色</span><div class="text-gray-200 mt-0.5">{{ roleLabel }}</div></div>
          <div><span class="text-gray-600 text-xs">注册时间</span><div class="text-gray-200 mt-0.5">{{ formatDate(currentUser?.createdAt ?? null) }}</div></div>
          <div><span class="text-gray-600 text-xs">最近登录</span><div class="text-gray-200 mt-0.5">{{ formatDate(currentUser?.lastLoginAt ?? null) }}</div></div>
        </div>

        <form v-else class="space-y-4" @submit.prevent="submitProfile">
          <label class="form-field">
            <span>用户名</span>
            <input v-model="profileEditor.username" type="text" maxlength="32" autocomplete="off" required />
            <small>3-32 位字母、数字、点、下划线或连字符</small>
          </label>
          <label class="form-field">
            <span>显示名称</span>
            <input v-model="profileEditor.displayName" type="text" maxlength="50" autocomplete="off" required />
          </label>
          <div v-if="profileError" class="form-error" role="alert">
            <AlertCircle class="w-4 h-4 shrink-0" />{{ profileError }}
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" class="secondary-button" :disabled="profileSubmitting" @click="cancelEditProfile">取消</button>
            <button type="submit" class="primary-button" :disabled="profileSubmitting">
              <LoaderCircle v-if="profileSubmitting" class="w-4 h-4 animate-spin" />
              保存
            </button>
          </div>
        </form>

        <p v-if="profileSuccess && !profileEditing" class="text-xs text-emerald-400 mt-3">{{ profileSuccess }}</p>
      </div>

      <!-- 修改密码 -->
      <div class="card p-5 mb-6">
        <h2 class="text-sm font-medium text-gray-200 flex items-center gap-2 mb-4">
          <KeyRound class="w-4 h-4 text-cyan-400" />
          修改密码
        </h2>
        <form class="space-y-4" @submit.prevent="submitPassword">
          <label class="form-field">
            <span>当前密码</span>
            <input v-model="passwordForm.currentPassword" type="password" maxlength="128" autocomplete="current-password" required />
          </label>
          <label class="form-field">
            <span>新密码</span>
            <input v-model="passwordForm.newPassword" type="password" maxlength="128" autocomplete="new-password" required />
            <small>至少 10 位，并同时包含字母和数字</small>
          </label>
          <label class="form-field">
            <span>确认新密码</span>
            <input v-model="passwordForm.confirmPassword" type="password" maxlength="128" autocomplete="new-password" required />
          </label>
          <div v-if="passwordError" class="form-error" role="alert">
            <AlertCircle class="w-4 h-4 shrink-0" />{{ passwordError }}
          </div>
          <p v-if="passwordSuccess" class="text-xs text-emerald-400">{{ passwordSuccess }}</p>
          <div class="flex justify-end">
            <button type="submit" class="primary-button" :disabled="passwordSubmitting">
              <LoaderCircle v-if="passwordSubmitting" class="w-4 h-4 animate-spin" />
              更新密码
            </button>
          </div>
        </form>
      </div>

      <!-- 邮箱变更 -->
      <div class="card p-5 mb-6">
        <h2 class="text-sm font-medium text-gray-200 flex items-center gap-2 mb-4">
          <Mail class="w-4 h-4 text-cyan-400" />
          更换邮箱
        </h2>
        <div class="space-y-4">
          <label class="form-field">
            <span>当前密码</span>
            <input v-model="emailForm.currentPassword" type="password" maxlength="128" autocomplete="current-password" />
          </label>
          <label class="form-field">
            <span>新邮箱</span>
            <input v-model="emailForm.email" type="email" maxlength="128" autocomplete="off" />
          </label>
          <div class="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              class="secondary-button"
              :disabled="!canSubmitEmailCode"
              @click="sendEmailCode"
            >
              <LoaderCircle v-if="emailSubmitting" class="w-4 h-4 animate-spin" />
              <span v-if="emailCooldown > 0">{{ emailCooldown }}s 后可重发</span>
              <span v-else>发送验证码</span>
            </button>
          </div>
          <label class="form-field">
            <span>验证码</span>
            <input v-model="emailForm.code" type="text" maxlength="10" autocomplete="off" />
          </label>
          <div v-if="emailError" class="form-error" role="alert">
            <AlertCircle class="w-4 h-4 shrink-0" />{{ emailError }}
          </div>
          <p v-if="emailSuccess" class="text-xs text-emerald-400">{{ emailSuccess }}</p>
          <div class="flex justify-end">
            <button type="button" class="primary-button" :disabled="!canConfirmEmail" @click="confirmEmail">
              <LoaderCircle v-if="emailSubmitting" class="w-4 h-4 animate-spin" />
              确认更换邮箱
            </button>
          </div>
        </div>
      </div>

      <!-- 会话管理 -->
      <div class="card p-5 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-gray-200 flex items-center gap-2">
            <MonitorSmartphone class="w-4 h-4 text-cyan-400" />
            登录会话
          </h2>
          <div class="flex items-center gap-2">
            <button type="button" class="icon-action" title="刷新会话列表" :disabled="sessionsLoading" @click="loadSessions">
              <RefreshCw class="w-4 h-4" />
            </button>
            <button
              v-if="sessions.some(s => !s.current)"
              type="button"
              class="secondary-button h-9"
              @click="revokeOthers"
            >
              撤销其他会话
            </button>
          </div>
        </div>

        <div v-if="sessionsLoading && sessions.length === 0" class="py-10 text-center text-sm text-gray-600">
          <LoaderCircle class="w-5 h-5 animate-spin mx-auto mb-3" />正在加载会话
        </div>
        <div v-else-if="sessionsError" class="form-error" role="alert">
          <AlertCircle class="w-4 h-4 shrink-0" />{{ sessionsError }}
        </div>
        <div v-else-if="sessions.length === 0" class="py-8 text-center text-sm text-gray-600">
          没有活跃会话
        </div>
        <ul v-else class="divide-y divide-white/[0.05]">
          <li v-for="session in sessions" :key="session.id" class="py-3 flex items-center justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="text-sm text-gray-200 flex items-center gap-2">
                {{ parseUserAgent(session.userAgent) }}
                <span v-if="session.current" class="text-[10px] text-cyan-400 border border-cyan-400/20 rounded px-1.5 py-0.5">当前</span>
              </div>
              <div class="text-xs text-gray-600 font-mono mt-1">
                创建：{{ formatDate(session.createdAt) }} · 最后使用：{{ formatDate(session.lastUsedAt) }} · 过期：{{ formatDate(session.expiresAt) }}
              </div>
            </div>
            <button
              type="button"
              class="icon-action hover:!text-red-300"
              :title="session.current ? '退出当前会话' : '撤销该会话'"
              @click="revokeSession(session)"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </li>
        </ul>
        <p v-if="sessionsSuccess" class="text-xs text-emerald-400 mt-3">{{ sessionsSuccess }}</p>
      </div>

      <!-- 数据导出 -->
      <div class="card p-5 mb-6">
        <h2 class="text-sm font-medium text-gray-200 flex items-center gap-2 mb-3">
          <Download class="w-4 h-4 text-cyan-400" />
          数据导出
        </h2>
        <p class="text-xs text-gray-500 leading-5 mb-4">下载账号信息和学习进度的 JSON 文件，仅包含当前账号数据。</p>
        <button type="button" class="secondary-button" @click="exportData">
          <Download class="w-4 h-4" />
          导出账号数据
        </button>
      </div>

      <!-- 注销账号 -->
      <div class="card p-5 border-red-400/20">
        <h2 class="text-sm font-medium text-red-300 flex items-center gap-2 mb-3">
          <ShieldAlert class="w-4 h-4" />
          注销账号
        </h2>
        <p class="text-xs text-gray-500 leading-5 mb-4">
          注销将永久删除账号和学习进度。服务器会在删除前创建可恢复备份。
          <strong class="text-red-300">最后一个超级管理员不能注销自己。</strong>
        </p>
        <button type="button" class="danger-button" @click="openDeleteDialog">
          <Trash2 class="w-4 h-4" />
          注销账号
        </button>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="deleteDialogOpen" class="modal-backdrop" role="presentation" @click.self="closeDeleteDialog">
        <section class="modal-panel max-w-md" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
          <div class="modal-header">
            <h2 id="delete-account-title" class="text-lg font-semibold text-white">注销账号</h2>
            <button type="button" class="icon-action" title="关闭" @click="closeDeleteDialog"><X class="w-4 h-4" /></button>
          </div>
          <div class="p-5">
            <p class="text-sm text-gray-400 leading-6">
              此操作不可恢复。请输入当前密码并确认用户名
              <strong class="text-white font-mono">{{ currentUser?.username }}</strong>
              以继续。
            </p>
            <label class="form-field mt-4">
              <span>当前密码</span>
              <input v-model="deleteForm.currentPassword" type="password" maxlength="128" autocomplete="current-password" />
            </label>
            <label class="form-field mt-4">
              <span>确认用户名</span>
              <input v-model="deleteForm.confirmation" type="text" autocomplete="off" />
            </label>
            <div v-if="deleteError" class="form-error mt-4" role="alert">
              <AlertCircle class="w-4 h-4 shrink-0" />{{ deleteError }}
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button type="button" class="secondary-button" :disabled="deleteSubmitting" @click="closeDeleteDialog">取消</button>
              <button type="button" class="danger-button" :disabled="!canConfirmDelete" @click="confirmDeleteAccount">
                <LoaderCircle v-if="deleteSubmitting" class="w-4 h-4 animate-spin" />
                确认注销
              </button>
            </div>
          </div>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.card {
  @apply rounded-lg border border-white/[0.08] bg-white/[0.015];
}

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
</style>
