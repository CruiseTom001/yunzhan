<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  BarChart3,
  BookOpen,
  Brain,
  Cloud,
  CloudOff,
  Home,
  LoaderCircle,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  MonitorCog,
  Moon,
  PenTool,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Terminal,
  UserRound,
  X,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useProgressStore } from '@/stores/progress'
import { useTheme } from '@/stores/theme'

const router = useRouter()
const route = useRoute()
const mobileMenuOpen = ref(false)
const accountMenuOpen = ref(false)
const accountMenuRoot = ref<HTMLElement | null>(null)
const loggingOut = ref(false)
const { theme, toggleTheme } = useTheme()
const authStore = useAuthStore()
const progressStore = useProgressStore()

const syncLabel = computed(() => {
  if (progressStore.cloudSyncStatus === 'syncing') return '正在同步'
  if (progressStore.cloudSyncStatus === 'synced') return '云端已同步'
  if (progressStore.cloudSyncStatus === 'error') return '同步异常'
  return '等待同步'
})

const syncIcon = computed(() => {
  if (progressStore.cloudSyncStatus === 'syncing') return LoaderCircle
  if (progressStore.cloudSyncStatus === 'error') return CloudOff
  return Cloud
})

const emit = defineEmits<{
  openSearch: []
  toggleTerminal: []
}>()

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/courses', label: '课程', icon: BookOpen },
  { path: '/quiz', label: '问答', icon: PenTool },
  { path: '/review', label: '复习', icon: Brain },
  { path: '/study-notes', label: '记录', icon: ScrollText },
  { path: '/progress', label: '进度', icon: BarChart3 },
  { path: '/terminal', label: '终端', icon: Terminal },
]

function navigate(path: string) {
  mobileMenuOpen.value = false
  accountMenuOpen.value = false
  void router.push(path)
}

async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await progressStore.unbindAccount()
    await authStore.logout()
  } finally {
    loggingOut.value = false
    accountMenuOpen.value = false
    mobileMenuOpen.value = false
    await router.replace('/login')
  }
}

function handleDocumentClick(event: MouseEvent) {
  if (accountMenuRoot.value && event.target instanceof Node && !accountMenuRoot.value.contains(event.target)) {
    accountMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleDocumentClick))
onUnmounted(() => document.removeEventListener('click', handleDocumentClick))
</script>

<template>
  <header class="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-theme/80 border-b border-white/[0.03]">
    <nav class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-2.5 cursor-pointer group" @click="navigate('/')">
        <span class="text-cyan-400 font-mono font-bold text-sm bg-cyan-400/10 px-1.5 py-0.5 rounded border border-cyan-400/20">&gt;_</span>
        <span class="text-white font-semibold tracking-wide text-sm">云栈<span class="text-cyan-400 font-mono">.dev</span></span>
      </div>

      <div class="hidden md:flex items-center gap-0.5">
        <!-- 终端按钮 -->
        <button
          @click="emit('toggleTerminal')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/[0.05] transition-all mr-1 border border-cyan-400/10"
          title="实验终端"
        >
          <Terminal class="w-3.5 h-3.5" />
          <span class="text-cyan-400/50 text-[10px]">终端</span>
        </button>

        <!-- 搜索按钮 -->
        <button
          @click="emit('openSearch')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] transition-all mr-1"
          title="搜索 (Ctrl+K)"
        >
          <Search class="w-3.5 h-3.5" />
          <span class="text-gray-700 border border-white/[0.04] rounded px-1.5 py-0.5 text-[10px]">Ctrl+K</span>
        </button>
        <div class="w-px h-5 bg-white/[0.04] mr-1"></div>
        <!-- 主题切换 -->
        <button
          @click="toggleTheme"
          class="flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] transition-all mr-1"
          :title="theme === 'dark' ? '切换浅色模式' : '切换深色模式'"
        >
          <Sun v-if="theme === 'dark'" class="w-4 h-4" />
          <Moon v-else class="w-4 h-4" />
        </button>
        <div class="w-px h-5 bg-white/[0.04] mr-1"></div>
        <button
          v-for="item in navItems"
          :key="item.path"
          @click="navigate(item.path)"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 font-mono',
            route.path === item.path
              ? 'text-cyan-400 bg-cyan-400/5'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]',
          ]"
        >
          <component :is="item.icon" class="w-3.5 h-3.5" />
          {{ item.label }}
        </button>

        <div ref="accountMenuRoot" class="relative ml-1 pl-2 border-l border-white/[0.04]">
          <button
            type="button"
            class="flex items-center gap-2 h-9 max-w-40 px-2.5 rounded-md text-gray-400 hover:text-white hover:bg-white/[0.03]"
            :aria-expanded="accountMenuOpen"
            aria-haspopup="menu"
            title="账号菜单"
            @click="accountMenuOpen = !accountMenuOpen"
          >
            <UserRound class="w-4 h-4 shrink-0 text-cyan-400" />
            <span class="text-xs truncate">{{ authStore.user?.displayName }}</span>
          </button>

          <div
            v-if="accountMenuOpen"
            class="absolute right-0 mt-2 w-64 rounded-md border border-white/[0.08] bg-[#0c0f18] shadow-2xl overflow-hidden"
            role="menu"
          >
            <div class="px-4 py-3 border-b border-white/[0.06]">
              <div class="text-sm text-gray-200 truncate">{{ authStore.user?.displayName }}</div>
              <div class="text-xs text-gray-600 font-mono truncate mt-0.5">{{ authStore.user?.username }}</div>
              <div class="flex items-center gap-2 mt-2 text-xs" :class="progressStore.cloudSyncStatus === 'error' ? 'text-amber-400' : 'text-emerald-400'">
                <component :is="syncIcon" class="w-3.5 h-3.5" :class="{ 'animate-spin': progressStore.cloudSyncStatus === 'syncing' }" />
                {{ syncLabel }}
              </div>
              <p v-if="progressStore.cloudSyncMessage" class="text-[11px] text-gray-600 mt-1 leading-4">
                {{ progressStore.cloudSyncMessage }}
              </p>
            </div>
            <button
              type="button"
              class="account-menu-item"
              role="menuitem"
              @click="navigate('/account')"
            >
              <Settings class="w-4 h-4" />
              账号设置
            </button>
            <button
              v-if="authStore.isSuperAdmin"
              type="button"
              class="account-menu-item"
              role="menuitem"
              @click="navigate('/admin/users')"
            >
              <ShieldCheck class="w-4 h-4" />
              用户管理
            </button>
            <button
              v-if="authStore.isSuperAdmin"
              type="button"
              class="account-menu-item"
              role="menuitem"
              @click="navigate('/admin/desktop-releases')"
            >
              <MonitorCog class="w-4 h-4" />
              桌面版本管理
            </button>
            <button
              v-if="authStore.isSuperAdmin"
              type="button"
              class="account-menu-item"
              role="menuitem"
              @click="navigate('/admin/audit')"
            >
              <ScrollText class="w-4 h-4" />
              审计日志
            </button>
            <button
              v-if="authStore.isSuperAdmin"
              type="button"
              class="account-menu-item"
              role="menuitem"
              @click="navigate('/admin/feedback')"
            >
              <MessageSquare class="w-4 h-4" />
              反馈管理
            </button>
            <button
              v-if="authStore.isSuperAdmin"
              type="button"
              class="account-menu-item"
              role="menuitem"
              @click="navigate('/admin/announcements')"
            >
              <Megaphone class="w-4 h-4" />
              公告管理
            </button>
            <button type="button" class="account-menu-item text-red-300" role="menuitem" :disabled="loggingOut" @click="logout">
              <LoaderCircle v-if="loggingOut" class="w-4 h-4 animate-spin" />
              <LogOut v-else class="w-4 h-4" />
              退出登录
            </button>
          </div>
        </div>
      </div>

      <button
        class="md:hidden text-gray-500 hover:text-white"
        :aria-expanded="mobileMenuOpen"
        aria-label="打开导航菜单"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <Menu v-if="!mobileMenuOpen" class="w-5 h-5" />
        <X v-else class="w-5 h-5" />
      </button>
    </nav>

    <div
      v-if="mobileMenuOpen"
      class="md:hidden border-t border-white/[0.03] bg-theme/95 backdrop-blur-xl px-6 py-3 flex flex-col gap-1"
    >
      <button
        v-for="item in navItems"
        :key="item.path"
        @click="navigate(item.path)"
        :class="[
          'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-mono transition-all',
          route.path === item.path
            ? 'text-cyan-400 bg-cyan-400/5'
            : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]',
        ]"
      >
        <component :is="item.icon" class="w-4 h-4" />
        {{ item.label }}
      </button>
      <div class="border-t border-white/[0.05] mt-2 pt-3 px-3">
        <div class="flex items-center gap-3 mb-3">
          <UserRound class="w-4 h-4 text-cyan-400" />
          <div class="min-w-0">
            <div class="text-sm text-gray-300 truncate">{{ authStore.user?.displayName }}</div>
            <div class="text-[11px] text-gray-600 font-mono truncate">{{ authStore.user?.username }}</div>
          </div>
        </div>
        <button
          type="button"
          class="mobile-account-action"
          @click="navigate('/account')"
        >
          <Settings class="w-4 h-4" />
          账号设置
        </button>
        <button
          v-if="authStore.isSuperAdmin"
          type="button"
          class="mobile-account-action"
          @click="navigate('/admin/users')"
        >
          <ShieldCheck class="w-4 h-4" />
          用户管理
        </button>
        <button
          v-if="authStore.isSuperAdmin"
          type="button"
          class="mobile-account-action"
          @click="navigate('/admin/desktop-releases')"
        >
          <MonitorCog class="w-4 h-4" />
          桌面版本管理
        </button>
        <button
          v-if="authStore.isSuperAdmin"
          type="button"
          class="mobile-account-action"
          @click="navigate('/admin/audit')"
        >
          <ScrollText class="w-4 h-4" />
          审计日志
        </button>
        <button
          v-if="authStore.isSuperAdmin"
          type="button"
          class="mobile-account-action"
          @click="navigate('/admin/feedback')"
        >
          <MessageSquare class="w-4 h-4" />
          反馈管理
        </button>
        <button
          v-if="authStore.isSuperAdmin"
          type="button"
          class="mobile-account-action"
          @click="navigate('/admin/announcements')"
        >
          <Megaphone class="w-4 h-4" />
          公告管理
        </button>
        <button type="button" class="mobile-account-action text-red-300" :disabled="loggingOut" @click="logout">
          <LoaderCircle v-if="loggingOut" class="w-4 h-4 animate-spin" />
          <LogOut v-else class="w-4 h-4" />
          退出登录
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.account-menu-item {
  @apply w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-400 hover:text-white hover:bg-white/[0.035] disabled:opacity-50;
}

.mobile-account-action {
  @apply w-full flex items-center gap-3 py-2.5 text-sm text-gray-400 disabled:opacity-50;
}
</style>
