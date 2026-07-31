<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useProgressStore } from '@/stores/progress'
import type { AuthMode } from '@/utils/authRedirect'
import {
  getDesktopLoginPreferences,
  isDesktopRuntime,
  setDesktopLoginPreferences,
} from '@/utils/desktopAuthPreferences'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/
const PASSWORD_HAS_LETTER = /[A-Za-z]/
const PASSWORD_HAS_NUMBER = /\d/

const props = defineProps<{
  initialMode: AuthMode
}>()

const emit = defineEmits<{
  authenticated: []
  modeChange: [mode: AuthMode]
}>()

const authStore = useAuthStore()
const progressStore = useProgressStore()
const isDesktop = isDesktopRuntime()
const mode = ref<AuthMode>(props.initialMode)
const loginIdentifier = ref('')
const loginPassword = ref('')
const rememberWebLogin = ref(true)
const rememberDesktopIdentifier = ref(false)
const autoLoginOnStartup = ref(false)
const autoLoginAvailable = ref(true)
const autoLoginDisabledReason = ref<string | null>(null)
const registrationEmail = ref('')
const registrationCode = ref('')
const registrationUsername = ref('')
const registrationDisplayName = ref('')
const registrationPassword = ref('')
const registrationPasswordConfirmation = ref('')
const resetEmail = ref('')
const resetCode = ref('')
const resetPassword = ref('')
const resetPasswordConfirmation = ref('')
const showLoginPassword = ref(false)
const showRegistrationPassword = ref(false)
const showResetPassword = ref(false)
const submitting = ref(false)
const sendingCode = ref(false)
const cooldownSeconds = ref(0)
const formError = ref('')
const formMessage = ref('')
let countdownTimer: ReturnType<typeof setInterval> | null = null

const isBusy = computed(() => submitting.value || sendingCode.value)

const canSubmitLogin = computed(() => (
  loginIdentifier.value.trim().length >= 3
  && loginPassword.value.length >= 1
  && !submitting.value
))

const canSendCode = computed(() => (
  EMAIL_PATTERN.test(registrationEmail.value.trim())
  && cooldownSeconds.value === 0
  && !sendingCode.value
))

const canSubmitRegistration = computed(() => (
  EMAIL_PATTERN.test(registrationEmail.value.trim())
  && /^\d{6}$/.test(registrationCode.value)
  && USERNAME_PATTERN.test(registrationUsername.value.trim())
  && registrationDisplayName.value.trim().length >= 1
  && registrationPassword.value.length >= 10
  && PASSWORD_HAS_LETTER.test(registrationPassword.value)
  && PASSWORD_HAS_NUMBER.test(registrationPassword.value)
  && registrationPassword.value === registrationPasswordConfirmation.value
  && !submitting.value
))

const canSendResetCode = computed(() => (
  EMAIL_PATTERN.test(resetEmail.value.trim())
  && cooldownSeconds.value === 0
  && !sendingCode.value
))

const canSubmitPasswordReset = computed(() => (
  EMAIL_PATTERN.test(resetEmail.value.trim())
  && /^\d{6}$/.test(resetCode.value)
  && resetPassword.value.length >= 10
  && PASSWORD_HAS_LETTER.test(resetPassword.value)
  && PASSWORD_HAS_NUMBER.test(resetPassword.value)
  && resetPassword.value === resetPasswordConfirmation.value
  && !submitting.value
))

const titleId = computed(() => {
  if (mode.value === 'register') return 'register-title'
  if (mode.value === 'forgot-password') return 'forgot-password-title'
  return 'login-title'
})

watch(() => props.initialMode, (nextMode) => {
  switchMode(nextMode, { emitEvent: false })
})

function switchMode(nextMode: AuthMode, options: { emitEvent?: boolean } = { emitEvent: true }) {
  mode.value = nextMode
  formError.value = ''
  formMessage.value = ''
  clearSensitiveFields()
  if (options.emitEvent !== false) emit('modeChange', nextMode)
}

watch(rememberDesktopIdentifier, (enabled) => {
  if (!enabled) {
    autoLoginOnStartup.value = false
    if (isDesktop) {
      void setDesktopLoginPreferences({
        rememberIdentifier: false,
        autoLogin: false,
        identifier: '',
      })
    }
  }
})

watch(autoLoginOnStartup, (enabled) => {
  if (enabled) {
    rememberDesktopIdentifier.value = true
  }
})

async function loadDesktopLoginPreferences() {
  if (!isDesktop) return
  const preferences = await getDesktopLoginPreferences()
  if (!preferences) return
  rememberDesktopIdentifier.value = preferences.rememberIdentifier
  autoLoginOnStartup.value = preferences.autoLogin
  autoLoginAvailable.value = preferences.autoLoginAvailable
  autoLoginDisabledReason.value = preferences.autoLoginDisabledReason
  if (preferences.identifier) {
    loginIdentifier.value = preferences.identifier
  }
}

onMounted(() => {
  void loadDesktopLoginPreferences()
})

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  cooldownSeconds.value = 0
}

function startCountdown(seconds: number) {
  stopCountdown()
  cooldownSeconds.value = seconds
  countdownTimer = setInterval(() => {
    cooldownSeconds.value = Math.max(0, cooldownSeconds.value - 1)
    if (cooldownSeconds.value === 0) stopCountdown()
  }, 1000)
}

function clearSensitiveFields() {
  loginPassword.value = ''
  registrationCode.value = ''
  registrationPassword.value = ''
  registrationPasswordConfirmation.value = ''
  resetCode.value = ''
  resetPassword.value = ''
  resetPasswordConfirmation.value = ''
}

function normalizeCodeInput(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  registrationCode.value = event.target.value.replace(/\D/g, '').slice(0, 6)
}

function normalizeResetCodeInput(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  resetCode.value = event.target.value.replace(/\D/g, '').slice(0, 6)
}

async function completeAuthentication(userId: string, displayName: string) {
  await progressStore.bindAccount(userId, displayName)
  clearSensitiveFields()
  emit('authenticated')
}

async function submitLogin() {
  if (!canSubmitLogin.value) return
  submitting.value = true
  formError.value = ''
  formMessage.value = ''
  try {
    const identifier = loginIdentifier.value.trim()
    const user = await authStore.login(loginIdentifier.value.trim(), loginPassword.value, {
      remember: rememberWebLogin.value,
      desktopPreferences: isDesktop
        ? {
          rememberIdentifier: rememberDesktopIdentifier.value,
          autoLogin: autoLoginOnStartup.value,
          identifier: rememberDesktopIdentifier.value ? identifier : '',
        }
        : undefined,
    })
    await completeAuthentication(user.id, user.displayName)
  } catch (error: unknown) {
    formError.value = error instanceof Error ? error.message : '登录失败，请重试。'
  } finally {
    submitting.value = false
  }
}

async function sendCode() {
  if (!canSendCode.value) return
  sendingCode.value = true
  formError.value = ''
  formMessage.value = ''
  try {
    const seconds = await authStore.requestRegistrationCode(registrationEmail.value.trim().toLowerCase())
    startCountdown(seconds)
    formMessage.value = '如果该邮箱可用于注册，验证码将发送到邮箱。'
  } catch (error: unknown) {
    formError.value = error instanceof Error ? error.message : '验证码发送失败，请稍后重试。'
  } finally {
    sendingCode.value = false
  }
}

async function submitRegistration() {
  if (!canSubmitRegistration.value) {
    formError.value = '请检查邮箱、验证码、用户名和密码是否符合要求。'
    return
  }
  submitting.value = true
  formError.value = ''
  formMessage.value = ''
  try {
    const user = await authStore.register({
      email: registrationEmail.value.trim().toLowerCase(),
      code: registrationCode.value,
      username: registrationUsername.value.trim(),
      displayName: registrationDisplayName.value.trim(),
      password: registrationPassword.value,
    })
    await completeAuthentication(user.id, user.displayName)
  } catch (error: unknown) {
    formError.value = error instanceof Error ? error.message : '注册失败，请重试。'
  } finally {
    submitting.value = false
  }
}

async function sendResetCode() {
  if (!canSendResetCode.value) return
  sendingCode.value = true
  formError.value = ''
  formMessage.value = ''
  try {
    const seconds = await authStore.requestPasswordResetCode(resetEmail.value.trim().toLowerCase())
    startCountdown(seconds)
    formMessage.value = '如果该邮箱已绑定可用账号，验证码将发送到邮箱。'
  } catch (error: unknown) {
    formError.value = error instanceof Error ? error.message : '验证码发送失败，请稍后重试。'
  } finally {
    sendingCode.value = false
  }
}

async function submitPasswordReset() {
  if (!canSubmitPasswordReset.value) {
    formError.value = '请检查邮箱、验证码和新密码是否符合要求。'
    return
  }
  submitting.value = true
  formError.value = ''
  formMessage.value = ''
  try {
    const email = resetEmail.value.trim().toLowerCase()
    await authStore.resetPassword({
      email,
      code: resetCode.value,
      password: resetPassword.value,
    })
    loginIdentifier.value = email
    loginPassword.value = ''
    switchMode('login')
    formMessage.value = '密码已更新，请使用新密码登录。'
  } catch (error: unknown) {
    formError.value = error instanceof Error ? error.message : '密码重置失败，请重试。'
  } finally {
    submitting.value = false
  }
}

function focusFirstField() {
  const fieldIdByMode: Record<AuthMode, string> = {
    login: 'login-identifier',
    register: 'register-email',
    'forgot-password': 'reset-email',
  }
  const preferred = document.getElementById(fieldIdByMode[mode.value])
  if (preferred instanceof HTMLInputElement) {
    preferred.focus()
    return
  }
  const root = document.getElementById('auth-panel-root')
  if (!root) return
  const firstInput = root.querySelector<HTMLInputElement>('input:not([disabled])')
  firstInput?.focus()
}

onUnmounted(stopCountdown)

defineExpose({
  isBusy: () => isBusy.value,
  focusFirstField,
  stopCountdown,
})
</script>

<template>
  <section
    id="auth-panel-root"
    class="auth-panel"
    :aria-labelledby="titleId"
  >
    <div class="auth-brand" aria-hidden="true">&gt;_</div>
    <p class="auth-kicker">YUNZHAN ACCOUNT</p>

    <div v-if="mode !== 'forgot-password'" class="auth-segments" role="tablist" aria-label="账号操作">
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'login'"
        :class="{ active: mode === 'login' }"
        @click="switchMode('login')"
      >
        登录
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'register'"
        :class="{ active: mode === 'register' }"
        @click="switchMode('register')"
      >
        注册
      </button>
    </div>

    <template v-if="mode === 'login'">
      <h2 :id="titleId" class="auth-title">登录云栈</h2>
      <p class="auth-subtitle">使用用户名或已验证邮箱登录。</p>

      <form class="auth-form" @submit.prevent="submitLogin">
        <label for="login-identifier">用户名或邮箱</label>
        <div class="auth-input-wrap">
          <UserRound class="w-4 h-4" aria-hidden="true" />
          <input
            id="login-identifier"
            v-model="loginIdentifier"
            name="username"
            type="text"
            autocomplete="username"
            maxlength="254"
            placeholder="输入用户名或邮箱"
          />
        </div>

        <label for="login-password">密码</label>
        <div class="auth-input-wrap">
          <LockKeyhole class="w-4 h-4" aria-hidden="true" />
          <input
            id="login-password"
            v-model="loginPassword"
            name="password"
            :type="showLoginPassword ? 'text' : 'password'"
            autocomplete="current-password"
            maxlength="128"
            placeholder="输入密码"
          />
          <button
            type="button"
            class="auth-password-toggle"
            :title="showLoginPassword ? '隐藏密码' : '显示密码'"
            :aria-label="showLoginPassword ? '隐藏密码' : '显示密码'"
            @click="showLoginPassword = !showLoginPassword"
          >
            <EyeOff v-if="showLoginPassword" class="w-4 h-4" />
            <Eye v-else class="w-4 h-4" />
          </button>
        </div>

        <button type="button" class="forgot-password-button" @click="switchMode('forgot-password')">
          忘记密码？
        </button>

        <div v-if="!isDesktop" class="auth-option-row">
          <label class="auth-checkbox-label" for="remember-web-login">
            <input
              id="remember-web-login"
              v-model="rememberWebLogin"
              type="checkbox"
              :disabled="submitting"
            />
            <span>保持登录 7 天</span>
          </label>
          <p class="auth-option-hint">关闭后关闭浏览器即退出登录；密码仍由浏览器密码管理器保存。</p>
        </div>

        <div v-else class="auth-option-row">
          <label class="auth-checkbox-label" for="remember-desktop-identifier">
            <input
              id="remember-desktop-identifier"
              v-model="rememberDesktopIdentifier"
              type="checkbox"
              :disabled="submitting"
            />
            <span>记住账号</span>
          </label>
          <label class="auth-checkbox-label" for="auto-login-on-startup">
            <input
              id="auto-login-on-startup"
              v-model="autoLoginOnStartup"
              type="checkbox"
              :disabled="submitting || !autoLoginAvailable"
            />
            <span>启动时自动登录</span>
          </label>
          <p v-if="autoLoginDisabledReason" class="auth-option-warning" role="status">
            {{ autoLoginDisabledReason }}
          </p>
          <p v-else class="auth-option-hint">仅保存用户名或邮箱，不保存密码；自动登录使用系统安全存储保护会话。</p>
        </div>

        <p v-if="formMessage" class="auth-message" role="status">{{ formMessage }}</p>
        <p v-if="formError" class="auth-error" role="alert">{{ formError }}</p>
        <button class="auth-submit" type="submit" :disabled="!canSubmitLogin">
          <LoaderCircle v-if="submitting" class="w-4 h-4 animate-spin" />
          {{ submitting ? '正在登录...' : '登录' }}
        </button>
      </form>
    </template>

    <template v-else-if="mode === 'register'">
      <h2 :id="titleId" class="auth-title">注册云栈</h2>
      <p class="auth-subtitle">验证邮箱后创建独立学习账号。</p>

      <form class="auth-form" @submit.prevent="submitRegistration">
        <label for="register-email">邮箱</label>
        <div class="auth-input-wrap">
          <Mail class="w-4 h-4" aria-hidden="true" />
          <input
            id="register-email"
            v-model="registrationEmail"
            name="email"
            type="email"
            autocomplete="email"
            maxlength="254"
            placeholder="name@example.com"
          />
        </div>

        <label for="register-code">邮箱验证码</label>
        <div class="auth-input-wrap">
          <KeyRound class="w-4 h-4" aria-hidden="true" />
          <input
            id="register-code"
            :value="registrationCode"
            name="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="6 位验证码"
            @input="normalizeCodeInput"
          />
          <button type="button" class="send-code-button" :disabled="!canSendCode" @click="sendCode">
            <LoaderCircle v-if="sendingCode" class="w-3.5 h-3.5 animate-spin" />
            <span v-else-if="cooldownSeconds > 0">{{ cooldownSeconds }} 秒</span>
            <span v-else>发送验证码</span>
          </button>
        </div>

        <div class="register-grid">
          <div>
            <label for="register-username">用户名</label>
            <div class="auth-input-wrap">
              <UserRound class="w-4 h-4" aria-hidden="true" />
              <input
                id="register-username"
                v-model="registrationUsername"
                name="username"
                type="text"
                autocomplete="username"
                maxlength="32"
                placeholder="3-32 位英文标识，保留大小写"
              />
            </div>
          </div>
          <div>
            <label for="register-display-name">显示名称</label>
            <div class="auth-input-wrap">
              <UserRound class="w-4 h-4" aria-hidden="true" />
              <input
                id="register-display-name"
                v-model="registrationDisplayName"
                name="displayName"
                type="text"
                autocomplete="name"
                maxlength="64"
                placeholder="学习昵称"
              />
            </div>
          </div>
        </div>

        <label for="register-password">密码</label>
        <div class="auth-input-wrap">
          <LockKeyhole class="w-4 h-4" aria-hidden="true" />
          <input
            id="register-password"
            v-model="registrationPassword"
            name="new-password"
            :type="showRegistrationPassword ? 'text' : 'password'"
            autocomplete="new-password"
            maxlength="128"
            placeholder="至少 10 位，包含字母和数字"
          />
          <button
            type="button"
            class="auth-password-toggle"
            :title="showRegistrationPassword ? '隐藏密码' : '显示密码'"
            :aria-label="showRegistrationPassword ? '隐藏密码' : '显示密码'"
            @click="showRegistrationPassword = !showRegistrationPassword"
          >
            <EyeOff v-if="showRegistrationPassword" class="w-4 h-4" />
            <Eye v-else class="w-4 h-4" />
          </button>
        </div>

        <label for="register-password-confirmation">确认密码</label>
        <div class="auth-input-wrap">
          <LockKeyhole class="w-4 h-4" aria-hidden="true" />
          <input
            id="register-password-confirmation"
            v-model="registrationPasswordConfirmation"
            name="new-password-confirmation"
            type="password"
            autocomplete="new-password"
            maxlength="128"
            placeholder="再次输入密码"
          />
        </div>

        <p v-if="formMessage" class="auth-message" role="status">{{ formMessage }}</p>
        <p v-if="formError" class="auth-error" role="alert">{{ formError }}</p>
        <button class="auth-submit" type="submit" :disabled="!canSubmitRegistration">
          <LoaderCircle v-if="submitting" class="w-4 h-4 animate-spin" />
          {{ submitting ? '正在创建账号...' : '创建账号' }}
        </button>
      </form>
    </template>

    <template v-else>
      <button type="button" class="back-to-login-button" @click="switchMode('login')">
        返回登录
      </button>
      <h2 :id="titleId" class="auth-title">找回密码</h2>
      <p class="auth-subtitle">验证账号绑定邮箱后设置新密码。</p>

      <form class="auth-form" @submit.prevent="submitPasswordReset">
        <label for="reset-email">绑定邮箱</label>
        <div class="auth-input-wrap">
          <Mail class="w-4 h-4" aria-hidden="true" />
          <input
            id="reset-email"
            v-model="resetEmail"
            name="email"
            type="email"
            autocomplete="email"
            maxlength="254"
            placeholder="name@example.com"
          />
        </div>

        <label for="reset-code">邮箱验证码</label>
        <div class="auth-input-wrap">
          <KeyRound class="w-4 h-4" aria-hidden="true" />
          <input
            id="reset-code"
            :value="resetCode"
            name="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="6 位验证码"
            @input="normalizeResetCodeInput"
          />
          <button type="button" class="send-code-button" :disabled="!canSendResetCode" @click="sendResetCode">
            <LoaderCircle v-if="sendingCode" class="w-3.5 h-3.5 animate-spin" />
            <span v-else-if="cooldownSeconds > 0">{{ cooldownSeconds }} 秒</span>
            <span v-else>发送验证码</span>
          </button>
        </div>

        <label for="reset-password">新密码</label>
        <div class="auth-input-wrap">
          <LockKeyhole class="w-4 h-4" aria-hidden="true" />
          <input
            id="reset-password"
            v-model="resetPassword"
            name="new-password"
            :type="showResetPassword ? 'text' : 'password'"
            autocomplete="new-password"
            maxlength="128"
            placeholder="至少 10 位，包含字母和数字"
          />
          <button
            type="button"
            class="auth-password-toggle"
            :title="showResetPassword ? '隐藏密码' : '显示密码'"
            :aria-label="showResetPassword ? '隐藏密码' : '显示密码'"
            @click="showResetPassword = !showResetPassword"
          >
            <EyeOff v-if="showResetPassword" class="w-4 h-4" />
            <Eye v-else class="w-4 h-4" />
          </button>
        </div>

        <label for="reset-password-confirmation">确认新密码</label>
        <div class="auth-input-wrap">
          <LockKeyhole class="w-4 h-4" aria-hidden="true" />
          <input
            id="reset-password-confirmation"
            v-model="resetPasswordConfirmation"
            name="new-password-confirmation"
            type="password"
            autocomplete="new-password"
            maxlength="128"
            placeholder="再次输入新密码"
          />
        </div>

        <p v-if="formMessage" class="auth-message" role="status">{{ formMessage }}</p>
        <p v-if="formError" class="auth-error" role="alert">{{ formError }}</p>
        <button class="auth-submit" type="submit" :disabled="!canSubmitPasswordReset">
          <LoaderCircle v-if="submitting" class="w-4 h-4 animate-spin" />
          {{ submitting ? '正在更新密码...' : '更新密码' }}
        </button>
      </form>
    </template>
  </section>
</template>

<style scoped>
.auth-panel {
  width: 100%;
}

.auth-brand {
  display: inline-flex;
  width: 44px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  color: var(--accent-cyan);
  background: var(--bg-elevated);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
}

.auth-kicker {
  margin-top: 18px;
  color: var(--accent-cyan);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
}

.auth-segments {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  margin: 14px 0 20px;
  padding: 3px;
  border: 1px solid var(--border-card);
  border-radius: 6px;
  background: var(--bg-elevated);
}

.auth-segments button {
  min-height: 34px;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 12px;
}

.auth-segments button.active {
  color: var(--text-primary);
  background: var(--bg-card-hover);
}

.auth-title {
  color: var(--text-primary);
  font-size: 26px;
  font-weight: 700;
}

.auth-subtitle {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.7;
}

.auth-form {
  margin-top: 20px;
}

.auth-form label {
  display: block;
  margin: 13px 0 6px;
  color: var(--text-secondary);
  font-size: 12px;
}

.auth-input-wrap {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  color: var(--text-muted);
  background: var(--bg-elevated);
}

.auth-input-wrap:focus-within {
  border-color: var(--border-hover);
  color: var(--accent-cyan);
}

.auth-input-wrap input {
  min-width: 0;
  flex: 1;
  color: var(--text-primary);
  background: transparent;
  font-size: 13px;
  outline: none;
}

.auth-password-toggle {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.auth-password-toggle:hover {
  color: var(--text-primary);
  background: var(--bg-card-hover);
}

.forgot-password-button,
.back-to-login-button {
  color: var(--accent-cyan);
  font-size: 11px;
}

.forgot-password-button {
  display: block;
  margin: 9px 0 0 auto;
}

.back-to-login-button {
  margin: 14px 0 18px;
}

.forgot-password-button:hover,
.back-to-login-button:hover {
  color: var(--accent-cyan);
  text-decoration: underline;
}

.send-code-button {
  display: inline-flex;
  min-width: 88px;
  min-height: 30px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 8px;
  border-left: 1px solid var(--border-light);
  color: var(--accent-cyan);
  font-size: 11px;
}

.send-code-button:disabled {
  cursor: not-allowed;
  color: var(--text-very-dim);
}

.register-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.auth-option-row {
  margin-top: 14px;
  display: grid;
  gap: 8px;
}

.auth-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.auth-checkbox-label input {
  width: 14px;
  height: 14px;
  accent-color: var(--accent-cyan);
}

.auth-checkbox-label input:disabled {
  cursor: not-allowed;
}

.auth-option-hint,
.auth-option-warning {
  font-size: 11px;
  line-height: 1.6;
}

.auth-option-hint {
  color: var(--text-muted);
}

.auth-option-warning {
  color: #f59e0b;
}

.auth-error,
.auth-message {
  margin-top: 12px;
  font-size: 11px;
  line-height: 1.6;
}

.auth-error { color: #ef4444; }
.auth-message { color: var(--accent-emerald); }

.auth-submit {
  display: inline-flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 18px;
  border-radius: 6px;
  color: #061014;
  background: var(--accent-cyan);
  font-size: 13px;
  font-weight: 700;
}

.auth-submit:hover:not(:disabled) { background: var(--accent-cyan); }

.auth-submit:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@media (max-width: 520px) {
  .register-grid { grid-template-columns: 1fr; gap: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .animate-spin { animation: none; }
}
</style>
