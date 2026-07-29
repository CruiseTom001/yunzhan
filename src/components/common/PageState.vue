<script setup lang="ts">
import { LoaderCircle, Inbox, AlertCircle, RefreshCw } from 'lucide-vue-next'

withDefaults(defineProps<{
  loading?: boolean
  error?: string
  empty?: boolean
  loadingText?: string
  emptyText?: string
  emptyHint?: string
  errorText?: string
  showRetry?: boolean
  centered?: boolean
}>(), {
  loading: false,
  error: '',
  empty: false,
  loadingText: '正在加载',
  emptyText: '暂无数据。',
  emptyHint: '',
  errorText: '',
  showRetry: true,
  centered: true,
})

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    v-if="loading"
    class="py-12 text-sm text-gray-600"
    :class="centered ? 'text-center' : ''"
    role="status"
    aria-live="polite"
  >
    <LoaderCircle class="w-5 h-5 animate-spin mb-3" :class="centered ? 'mx-auto' : ''" />
    {{ loadingText }}
  </div>

  <div
    v-else-if="error"
    class="flex flex-col items-start gap-3 p-4 rounded-md border border-red-400/20 bg-red-400/[0.06] text-sm text-red-300"
    role="alert"
  >
    <div class="flex items-start gap-2">
      <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
      <span>{{ errorText || error }}</span>
    </div>
    <button
      v-if="showRetry"
      type="button"
      class="inline-flex items-center gap-2 rounded-md border border-red-400/30 px-3 py-1.5 text-xs text-red-200 hover:bg-red-400/[0.08] transition-colors"
      @click="emit('retry')"
    >
      <RefreshCw class="w-3.5 h-3.5" />
      重试
    </button>
  </div>

  <div
    v-else-if="empty"
    class="py-10 text-sm text-gray-600"
    :class="centered ? 'text-center' : ''"
  >
    <Inbox class="w-6 h-6 mb-3 text-gray-700" :class="centered ? 'mx-auto' : ''" />
    <p>{{ emptyText }}</p>
    <p v-if="emptyHint" class="mt-1 text-xs text-gray-700">{{ emptyHint }}</p>
  </div>

  <slot v-else />
</template>
