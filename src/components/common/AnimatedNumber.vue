<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  value: number
  duration?: number
}>(), {
  duration: 700,
})

const displayedValue = ref(0)
let animationFrameId: number | null = null

function stopAnimation() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

function animateTo(targetValue: number) {
  stopAnimation()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    displayedValue.value = targetValue
    return
  }

  const startValue = displayedValue.value
  const valueDelta = targetValue - startValue
  const startedAt = performance.now()

  function updateFrame(currentTime: number) {
    const elapsed = currentTime - startedAt
    const progress = Math.min(elapsed / props.duration, 1)
    const easedProgress = 1 - Math.pow(1 - progress, 3)
    displayedValue.value = Math.round(startValue + valueDelta * easedProgress)

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(updateFrame)
    } else {
      animationFrameId = null
    }
  }

  animationFrameId = requestAnimationFrame(updateFrame)
}

watch(() => props.value, animateTo)

onMounted(() => animateTo(props.value))
onUnmounted(stopAnimation)
</script>

<template>
  <span>{{ displayedValue }}</span>
</template>
