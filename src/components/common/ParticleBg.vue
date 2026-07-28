<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useTheme } from '@/stores/theme'
import {
  createParticleBackgroundEngine,
  PARTICLE_BG_MAX_DEVICE_PIXEL_RATIO,
  type ParticleBackgroundEngine,
} from '@/utils/particleBackground'

const { theme } = useTheme()
const canvas = ref<HTMLCanvasElement | null>(null)

let engine: ParticleBackgroundEngine | null = null
let animId = 0
let resizeHandler: (() => void) | null = null
let pointerMoveHandler: ((event: PointerEvent) => void) | null = null
let pointerLeaveHandler: (() => void) | null = null
let pointerDownHandler: ((event: PointerEvent) => void) | null = null
let visibilityHandler: (() => void) | null = null
let reduceMotionMedia: MediaQueryList | null = null
let reduceMotionHandler: (() => void) | null = null
let intersectionObserver: IntersectionObserver | null = null

function stopAnimation(): void {
  cancelAnimationFrame(animId)
  animId = 0
}

function startAnimation(): void {
  stopAnimation()
  if (!engine?.shouldAnimate()) return

  const draw = (now: number) => {
    if (!engine || !canvas.value) return
    const ctx = canvas.value.getContext('2d')
    if (!ctx) return

    engine.tick(now, true)
    engine.draw(ctx)
    animId = requestAnimationFrame(draw)
  }

  animId = requestAnimationFrame(draw)
}

function drawStaticFrame(): void {
  if (!engine || !canvas.value) return
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return
  engine.tick(performance.now(), false)
  engine.draw(ctx)
}

function attachInteractionListeners(): void {
  if (!pointerMoveHandler || !pointerLeaveHandler || !pointerDownHandler) return
  window.addEventListener('pointermove', pointerMoveHandler, { passive: true })
  document.documentElement.addEventListener('pointerleave', pointerLeaveHandler)
  window.addEventListener('pointerdown', pointerDownHandler, { passive: true })
}

function detachInteractionListeners(): void {
  if (pointerMoveHandler) window.removeEventListener('pointermove', pointerMoveHandler)
  if (pointerLeaveHandler) document.documentElement.removeEventListener('pointerleave', pointerLeaveHandler)
  if (pointerDownHandler) window.removeEventListener('pointerdown', pointerDownHandler)
}

function syncReduceMotion(): void {
  if (!engine || !reduceMotionMedia) return
  const reduceMotion = reduceMotionMedia.matches
  engine.setReduceMotion(reduceMotion)
  if (reduceMotion) {
    detachInteractionListeners()
    stopAnimation()
    drawStaticFrame()
  } else {
    attachInteractionListeners()
    startAnimation()
  }
}

onMounted(() => {
  const canvasElement = canvas.value
  if (!canvasElement) return
  const ctx = canvasElement.getContext('2d')
  if (!ctx) return

  reduceMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  const initialReduceMotion = reduceMotionMedia.matches

  resizeHandler = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, PARTICLE_BG_MAX_DEVICE_PIXEL_RATIO)
    const cssWidth = window.innerWidth
    const cssHeight = window.innerHeight
    canvasElement.width = Math.floor(cssWidth * pixelRatio)
    canvasElement.height = Math.floor(cssHeight * pixelRatio)
    canvasElement.style.width = `${cssWidth}px`
    canvasElement.style.height = `${cssHeight}px`
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    engine?.resize(cssWidth, cssHeight)
  }
  resizeHandler()

  engine = createParticleBackgroundEngine(window.innerWidth, window.innerHeight, {
    reduceMotion: initialReduceMotion,
    theme: theme.value,
  })

  window.addEventListener('resize', resizeHandler)

  pointerMoveHandler = (event) => {
    engine?.handlePointerMove(event.clientX, event.clientY)
  }
  pointerLeaveHandler = () => {
    engine?.handlePointerLeave()
  }
  pointerDownHandler = (event) => {
    engine?.handlePointerDown(event.clientX, event.clientY)
  }
  visibilityHandler = () => {
    const hidden = document.hidden
    engine?.setPageHidden(hidden)
    if (hidden) {
      stopAnimation()
      return
    }
    startAnimation()
  }

  reduceMotionHandler = () => {
    syncReduceMotion()
  }

  if (!initialReduceMotion) {
    attachInteractionListeners()
    document.addEventListener('visibilitychange', visibilityHandler)
    reduceMotionMedia.addEventListener('change', reduceMotionHandler)
  }

  intersectionObserver = new IntersectionObserver((entries) => {
    const visible = entries.some(entry => entry.isIntersecting)
    engine?.setViewportVisible(visible)
    if (!visible) {
      stopAnimation()
      return
    }
    if (!document.hidden && !reduceMotionMedia?.matches) {
      startAnimation()
    }
  }, { threshold: 0.05 })
  intersectionObserver.observe(canvasElement)

  if (initialReduceMotion) {
    drawStaticFrame()
  } else {
    startAnimation()
  }
})

watch(theme, (nextTheme) => {
  engine?.setTheme(nextTheme)
  if (!engine?.shouldAnimate()) {
    drawStaticFrame()
  }
})

onUnmounted(() => {
  stopAnimation()
  intersectionObserver?.disconnect()
  intersectionObserver = null

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    resizeHandler = null
  }
  if (pointerMoveHandler) {
    window.removeEventListener('pointermove', pointerMoveHandler)
    pointerMoveHandler = null
  }
  if (pointerLeaveHandler) {
    document.documentElement.removeEventListener('pointerleave', pointerLeaveHandler)
    pointerLeaveHandler = null
  }
  if (pointerDownHandler) {
    window.removeEventListener('pointerdown', pointerDownHandler)
    pointerDownHandler = null
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  if (reduceMotionMedia && reduceMotionHandler) {
    reduceMotionMedia.removeEventListener('change', reduceMotionHandler)
    reduceMotionHandler = null
    reduceMotionMedia = null
  }

  engine?.dispose()
  engine = null
})
</script>

<template>
  <canvas
    ref="canvas"
    class="absolute inset-0 pointer-events-none transition-opacity duration-300"
    :class="theme === 'light' ? 'opacity-35' : 'opacity-100'"
  ></canvas>
</template>
