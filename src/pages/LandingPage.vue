<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  BookOpen,
  BarChart3,
  Cloud,
  Download,
  Lock,
  PenTool,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-vue-next'
import { courseIndex } from '@/data/courses/index'
import ParticleBg from '@/components/common/ParticleBg.vue'
import { useAuthStore } from '@/stores/auth'
import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'

const appVersion = __APP_VERSION__
const router = useRouter()
const authStore = useAuthStore()
const pageRoot = ref<HTMLElement | null>(null)
const typedText = ref('')
const fullText = '从入门到高级，系统化掌握运维全栈技能'
const desktopDownloadUrl = ref<string | null>(null)

async function loadDesktopDownloadUrl() {
  try {
    const latest = await getDesktopLatestVersion()
    if (typeof latest.downloadUrl === 'string' && /^https?:\/\//.test(latest.downloadUrl)) {
      desktopDownloadUrl.value = latest.downloadUrl
    }
  } catch {
    // 静默:落地页不应因版本服务异常影响主流程
  }
}

function openDesktopDownload() {
  if (desktopDownloadUrl.value) {
    window.open(desktopDownloadUrl.value, '_blank', 'noopener')
  }
}

let typeTimer: ReturnType<typeof setInterval> | null = null
let revealObserver: IntersectionObserver | null = null

function goToLogin() {
  void router.push({ name: 'login', query: { redirect: '/' } })
}

function goToRegister() {
  void router.push({ name: 'login', query: { mode: 'register', redirect: '/' } })
}

function goToHome() {
  void router.push({ name: 'home' })
}

function startTyping() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    typedText.value = fullText
    return
  }
  let i = 0
  typeTimer = setInterval(() => {
    if (i <= fullText.length) {
      typedText.value = fullText.slice(0, i)
      i++
    } else if (typeTimer) {
      clearInterval(typeTimer)
      typeTimer = null
    }
  }, 54)
}

function setupReveal() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const revealElements = pageRoot.value?.querySelectorAll<HTMLElement>('[data-reveal]') ?? []
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealElements.forEach((element) => element.classList.add('is-visible'))
    return
  }
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      revealObserver?.unobserve(entry.target)
    })
  }, { threshold: 0.12, rootMargin: '0px 0px -48px' })
  revealElements.forEach((element) => revealObserver?.observe(element))
}

onMounted(() => {
  void loadDesktopDownloadUrl()
  startTyping()
  setupReveal()
})

onUnmounted(() => {
  if (typeTimer) {
    clearInterval(typeTimer)
    typeTimer = null
  }
  if (revealObserver) {
    revealObserver.disconnect()
    revealObserver = null
  }
})

const features = [
  { icon: BookOpen, title: '系统化课程', desc: '20 门课程覆盖 Git、Docker、Kubernetes、CI/CD、监控、DevOps 等运维全栈技能。' },
  { icon: Terminal, title: '模拟终端', desc: '页面内 Linux 训练沙箱，支持命令行实操，不用搭建环境也能练习。' },
  { icon: PenTool, title: '测验与复习', desc: '题库自动判分，错题生成复习卡片，按艾宾浩斯曲线安排间隔复习。' },
  { icon: Zap, title: '严格实验判题', desc: '实验只认开始后真实执行的命令，不靠预写历史，学到的就是会用的。' },
  { icon: BarChart3, title: '进度与证书', desc: '多设备云端同步学习进度，章节、学习日历、成就与通关证书一站式。' },
  { icon: ShieldCheck, title: '安全账号体系', desc: '邮箱验证码注册、HttpOnly 会话、本地进度备份，多端学习数据不丢失。' },
]

const stats = [
  { value: '20', label: '门课程' },
  { value: '300+', label: '章节内容' },
  { value: '6', label: '类核心技能' },
  { value: '∞', label: '练习次数' },
]
</script>

<template>
  <div ref="pageRoot" class="landing-root min-h-screen bg-theme text-ink-secondary antialiased">
    <ParticleBg />

    <!-- 落地页自带 Header -->
    <header class="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-theme/80 border-b border-white/[0.03]">
      <nav class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2.5 cursor-pointer group" @click="goToHome">
          <span class="text-cyan-400 font-mono font-bold text-sm bg-cyan-400/10 px-1.5 py-0.5 rounded border border-cyan-400/20">>_</span>
          <span class="text-white font-semibold tracking-wide text-sm">云栈<span class="text-cyan-400 font-mono">.dev</span></span>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="desktopDownloadUrl"
            type="button"
            class="inline-flex h-9 items-center justify-center gap-1.5 px-3 rounded-md border border-white/[0.08] text-gray-300 hover:text-white hover:bg-white/[0.04] text-sm"
            title="下载桌面端"
            @click="openDesktopDownload"
          >
            <Download class="w-4 h-4" />
            下载桌面端
          </button>
          <template v-if="authStore.isAuthenticated">
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center gap-2 px-4 rounded-md bg-cyan-400 text-gray-950 text-sm font-semibold hover:bg-cyan-300"
              @click="goToHome"
            >
              进入控制台
              <ArrowRight class="w-4 h-4" />
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center px-4 rounded-md border border-white/[0.08] text-gray-300 hover:text-white hover:bg-white/[0.04] text-sm"
              @click="goToLogin"
            >
              登录
            </button>
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center gap-2 px-4 rounded-md bg-cyan-400 text-gray-950 text-sm font-semibold hover:bg-cyan-300"
              @click="goToRegister"
            >
              注册
              <ArrowRight class="w-4 h-4" />
            </button>
          </template>
        </div>
      </nav>
    </header>

    <!-- Hero 区 -->
    <section class="relative pt-16 flex items-center justify-center min-h-screen px-6">
      <div class="max-w-4xl text-center">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] text-xs text-cyan-300 font-mono mb-6" data-reveal>
          <Lock class="w-3 h-3" />
          运维学习平台 · 在线实训
        </div>
        <h1 class="text-4xl sm:text-6xl font-bold text-white leading-tight mb-6" data-reveal>
          让运维学习<br />
          <span class="text-cyan-400 font-mono">像写代码一样</span>有节奏
        </h1>
        <p class="text-base sm:text-lg text-gray-400 mb-10 min-h-7" data-reveal>
          <span class="inline-block">{{ typedText }}<span v-if="typedText.length < fullText.length" class="typing-caret">_</span></span>
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16" data-reveal>
          <button
            type="button"
            class="inline-flex h-12 items-center justify-center gap-2 px-8 rounded-md bg-cyan-400 text-gray-950 text-base font-semibold hover:bg-cyan-300 transition-all"
            @click="goToRegister"
          >
            免费开始学习
            <ArrowRight class="w-5 h-5" />
          </button>
          <button
            type="button"
            class="inline-flex h-12 items-center justify-center px-6 rounded-md border border-white/[0.08] text-gray-300 hover:text-white hover:bg-white/[0.04] text-base"
            @click="goToLogin"
          >
            我已有账号
          </button>
        </div>

        <!-- 数据统计 -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] border border-white/[0.06] rounded-md overflow-hidden max-w-2xl mx-auto" data-reveal>
          <div v-for="(item, idx) in stats" :key="idx" class="bg-[#0c0f18] p-5 flex flex-col items-center justify-center">
            <div class="text-2xl font-bold text-cyan-400 font-mono">{{ item.value }}</div>
            <div class="text-xs text-gray-500 mt-1">{{ item.label }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 功能特性区 -->
    <section class="relative max-w-7xl mx-auto px-6 py-20">
      <div class="text-center mb-14" data-reveal>
        <div class="flex items-center justify-center gap-2 text-cyan-400 font-mono text-xs mb-2">
          <Zap class="w-4 h-4" />
          FEATURES
        </div>
        <h2 class="text-2xl sm:text-3xl font-semibold text-white">六项核心能力，覆盖运维学习全流程</h2>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="(feature, idx) in features"
          :key="idx"
          class="feature-card p-6 rounded-lg border border-white/[0.08] bg-white/[0.015] hover:border-cyan-400/20 hover:bg-cyan-400/[0.02] transition-all"
          data-reveal
        >
          <span class="inline-flex w-10 h-10 items-center justify-center rounded-md border border-cyan-400/15 bg-cyan-400/[0.05] text-cyan-400 mb-4">
            <component :is="feature.icon" class="w-5 h-5" />
          </span>
          <h3 class="text-base font-semibold text-white mb-2">{{ feature.title }}</h3>
          <p class="text-sm text-gray-500 leading-6">{{ feature.desc }}</p>
        </div>
      </div>
    </section>

    <!-- 课程预览 -->
    <section class="relative max-w-7xl mx-auto px-6 py-20">
      <div class="text-center mb-14" data-reveal>
        <div class="flex items-center justify-center gap-2 text-cyan-400 font-mono text-xs mb-2">
          <BookOpen class="w-4 h-4" />
          COURSES
        </div>
        <h2 class="text-2xl sm:text-3xl font-semibold text-white">从基础到实战的 20 门课程</h2>
        <p class="text-sm text-gray-500 mt-3">课程体系按学习路径组织，循序渐进，每章都配备可执行的实验与题目。</p>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div
          v-for="course in courseIndex.slice(0, 10)"
          :key="course.id"
          class="course-pill px-4 py-3 rounded-md border border-white/[0.06] bg-white/[0.015] text-center hover:border-cyan-400/20 transition-all"
          data-reveal
        >
          <div class="text-sm text-gray-200 truncate">{{ course.title }}</div>
          <div class="text-[11px] text-gray-600 font-mono mt-1">{{ course.id }}</div>
        </div>
      </div>

      <div class="text-center mt-8" data-reveal>
        <button
          type="button"
          class="inline-flex h-11 items-center justify-center gap-2 px-6 rounded-md bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-sm font-mono hover:bg-cyan-400/20"
          @click="goToRegister"
        >
          注册后查看全部 20 门课程
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>
    </section>

    <!-- CTA 区 -->
    <section class="relative max-w-4xl mx-auto px-6 py-24 text-center">
      <div class="p-10 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.03]" data-reveal>
        <Cloud class="w-10 h-10 text-cyan-400 mx-auto mb-5" />
        <h2 class="text-2xl sm:text-3xl font-semibold text-white mb-4">现在开始，免费注册</h2>
        <p class="text-sm text-gray-400 leading-7 mb-7">注册账号后即可访问全部课程、实验、测验与云端进度同步。本地数据自动备份，多设备学习无缝衔接。</p>
        <button
          type="button"
          class="inline-flex h-12 items-center justify-center gap-2 px-8 rounded-md bg-cyan-400 text-gray-950 text-base font-semibold hover:bg-cyan-300"
          @click="goToRegister"
        >
          立即注册
          <ArrowRight class="w-5 h-5" />
        </button>
      </div>
    </section>

    <!-- Footer -->
    <footer class="relative border-t border-white/[0.04] py-8 px-6">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
        <div class="flex items-center gap-2">
          <span class="text-cyan-400 font-mono">>_</span>
          <span class="text-gray-400">云栈 YUNZHAN</span>
          <span class="font-mono text-gray-700">v{{ appVersion }}</span>
        </div>
        <div class="flex items-center gap-4">
          <button type="button" class="hover:text-gray-300" @click="goToLogin">登录</button>
          <button type="button" class="hover:text-gray-300" @click="goToRegister">注册</button>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing-root [data-reveal] {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.55s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.landing-root [data-reveal].is-visible {
  opacity: 1;
  transform: translateY(0);
}

.typing-caret {
  display: inline-block;
  color: #22d3ee;
  animation: caret-blink 1s steps(1, end) infinite;
}

@keyframes caret-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .landing-root [data-reveal] {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .typing-caret {
    animation: none;
    opacity: 0;
  }
}
</style>
