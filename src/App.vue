<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import ConceptPopover from '@/components/common/ConceptPopover.vue'
import GlobalSearch from '@/components/common/GlobalSearch.vue'
import AIChatPanel from '@/components/ai/AIChatPanel.vue'
import FloatingTerminal from '@/components/ai/FloatingTerminal.vue'

const globalSearch = ref<InstanceType<typeof GlobalSearch> | null>(null)
const showAI = ref(false)
const showTerminal = ref(false)

function openSearch() {
  globalSearch.value?.open()
}

function toggleAI() {
  showAI.value = !showAI.value
}

function toggleTerminal() {
  showTerminal.value = !showTerminal.value
}

function openTerminalForCommand() {
  showTerminal.value = true
}

onMounted(() => {
  window.addEventListener('yunzhan:run-command', openTerminalForCommand)
})

onUnmounted(() => {
  window.removeEventListener('yunzhan:run-command', openTerminalForCommand)
})
</script>

<template>
  <div class="min-h-screen bg-surface-secondary text-ink-secondary antialiased">
    <AppHeader @open-search="openSearch" @toggle-ai="toggleAI" @toggle-terminal="toggleTerminal" />
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <ConceptPopover />
    <GlobalSearch ref="globalSearch" />
    <AIChatPanel :visible="showAI" @close="showAI = false" />
    <FloatingTerminal :visible="showTerminal" @close="showTerminal = false" />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
