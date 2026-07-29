<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useDesktopUpdateStore } from '@/stores/desktopUpdate'
import DesktopUpdateDialog from '@/components/common/DesktopUpdateDialog.vue'

const store = useDesktopUpdateStore()

onMounted(() => {
  store.initialize()
})

onUnmounted(() => {
  store.dispose()
})
</script>

<template>
  <DesktopUpdateDialog />
</template>
