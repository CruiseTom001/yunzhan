<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Home, ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-theme pt-24 flex items-center justify-center px-6">
    <div class="text-center max-w-md">
      <div class="text-8xl font-bold font-mono text-white/[0.06] mb-2">404</div>
      <h1 class="text-xl font-semibold text-white mb-2">页面不存在</h1>
      <p class="text-gray-600 text-sm mb-8">
        你访问的路径不存在，请检查地址或返回首页
      </p>
      <div class="flex items-center justify-center gap-3">
        <button
          @click="router.back()"
          class="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.06] text-gray-400 hover:text-white hover:border-white/[0.12] transition-all text-xs font-mono"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          返回上页
        </button>
        <button
          @click="router.push('/')"
          class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 text-[#06060b] font-bold text-xs font-mono hover:bg-cyan-400 transition-all"
        >
          <Home class="w-3.5 h-3.5" />
          回到首页
        </button>
      </div>
    </div>
  </div>
</template>
