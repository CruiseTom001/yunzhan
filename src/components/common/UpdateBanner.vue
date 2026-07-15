<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { AlertCircle, Download, ExternalLink, X } from 'lucide-vue-next'
import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'
import {
  decideUpdateNotice,
  getIgnoredVersion,
  rememberIgnoredVersion,
  shouldShowBanner,
  shouldShowModalAndPersist,
  type UpdateNotice,
} from '@/utils/desktopUpdateCheck'

declare const __APP_VERSION__: string

const state = ref<UpdateNotice | null>(null)
const notesExpanded = ref(false)

function openDownload(url: string) {
  window.open(url, '_blank', 'noopener')
}

function closeBanner() {
  if (!state.value) return
  rememberIgnoredVersion(state.value.remoteVersion)
  state.value = null
}

function closeModal() {
  state.value = null
}

async function checkUpdate() {
  // 仅桌面端启动检查。纯网页端由 Vercel 自动部署,无需此提示。
  if (!window.electronAPI) return
  try {
    const remote = await getDesktopLatestVersion()
    const notice = decideUpdateNotice(__APP_VERSION__, remote)
    if (!notice) return
    if (notice.mode === 'banner') {
      if (!shouldShowBanner(notice, getIgnoredVersion())) return
      state.value = notice
      return
    }
    // modal:同一天至多一次
    if (!shouldShowModalAndPersist(notice)) return
    state.value = notice
  } catch {
    // 静默:版本检查失败不应阻塞用户使用
  }
}

onMounted(() => {
  void checkUpdate()
})
</script>

<template>
  <Teleport to="body">
    <!-- L2 横幅 -->
    <div
      v-if="state?.mode === 'banner'"
      data-testid="update-banner"
      class="update-banner text-amber-900 dark:text-amber-100 border-b border-amber-300 dark:border-amber-700"
    >
      <AlertCircle class="w-4 h-4 flex-shrink-0" />
      <span class="text-sm">发现新版本 v{{ state.remoteVersion }},请前往下载更新</span>
      <button
        v-if="state.releaseNotes"
        type="button"
        class="banner-link"
        title="查看变更"
        @click="notesExpanded = !notesExpanded"
      >
        查看详情
      </button>
      <button
        type="button"
        class="banner-link"
        title="立即下载"
        @click="openDownload(state.downloadUrl)"
      >
        <Download class="w-4 h-4 inline" /> 下载
      </button>
      <div v-if="notesExpanded" class="banner-notes whitespace-pre-wrap">{{ state.releaseNotes }}</div>
      <button
        type="button"
        class="banner-close"
        data-testid="update-banner-close"
        title="关闭"
        @click="closeBanner"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- L3 阻塞弹窗 -->
    <div
      v-if="state?.mode === 'modal'"
      data-testid="update-modal"
      class="modal-backdrop"
      role="presentation"
      @click.self="closeModal"
    >
      <section class="modal-panel max-w-md" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <AlertCircle class="w-5 h-5 text-amber-400" />
            <div>
              <div class="text-xs text-amber-400 font-mono">UPDATE REQUIRED</div>
              <h2 class="text-lg font-semibold text-white mt-0.5">版本已过旧</h2>
            </div>
          </div>
          <button type="button" class="icon-action" title="稍后继续" @click="closeModal">
            <X class="w-4 h-4" />
          </button>
        </div>
        <div class="p-5 space-y-4">
          <p class="text-sm text-gray-300 leading-7">
            您的版本已低于最低兼容版本 v{{ state.minSupported }}。请升级至 v{{ state.remoteVersion }} 后继续。
          </p>
          <div v-if="state.releaseNotes" class="text-sm text-gray-300 leading-7 whitespace-pre-wrap">
            {{ state.releaseNotes }}
          </div>
          <div class="flex justify-between gap-2 pt-2">
            <button type="button" class="ghost-button" @click="closeModal">稍后继续</button>
            <button
              type="button"
              class="primary-button"
              @click="openDownload(state.downloadUrl)"
            >
              <ExternalLink class="w-4 h-4 inline" /> 立即下载
            </button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.update-banner {
  @apply fixed top-0 inset-x-0 z-[90] flex items-center gap-3 px-4 h-12
    bg-amber-50 dark:bg-amber-900/40 text-sm;
}
.banner-link {
  @apply inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-80;
}
.banner-notes {
  @apply absolute top-12 left-0 right-0 px-4 py-2
    bg-white dark:bg-[#0c0f18] dark:text-gray-200
    border-b border-amber-300 dark:border-amber-700 text-sm;
}
.banner-close {
  @apply ml-auto inline-flex w-8 h-8 items-center justify-center rounded-md
    hover:bg-black/10 dark:hover:bg-white/10;
}

.modal-backdrop {
  @apply fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4;
}
.modal-panel {
  @apply w-full max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg
    border border-white/[0.08] bg-[#0c0f18] shadow-2xl;
}
.modal-header {
  @apply flex items-start justify-between gap-4 px-5 py-4 border-b border-white/[0.06];
}
.icon-action {
  @apply inline-flex w-9 h-9 items-center justify-center rounded-md
    text-gray-500 hover:text-white hover:bg-white/[0.04];
}
.primary-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium
    bg-amber-400 text-gray-950 hover:bg-amber-300;
}
.ghost-button {
  @apply inline-flex h-10 items-center justify-center rounded-md px-5 text-sm
    text-gray-300 hover:bg-white/[0.05];
}
</style>
