<script setup lang="ts">
import TerminalView from '@/components/ai/TerminalView.vue'
</script>

<template>
  <div class="min-h-screen bg-surface-primary pt-20 pb-10 px-6">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold text-white mb-2">🧪 实验终端</h1>
      <p class="text-gray-600 text-sm mb-6">在模拟 Linux 环境中练习命令，输入 <code class="text-cyan-400 bg-cyan-400/5 px-1 rounded">help</code> 查看可用命令</p>
      <TerminalView />
    </div>
  </div>
</template>
