<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)
let animId = 0
let resizeHandler: (() => void) | null = null
let pointerMoveHandler: ((event: PointerEvent) => void) | null = null
let pointerLeaveHandler: (() => void) | null = null
let pointerDownHandler: ((event: PointerEvent) => void) | null = null
let visibilityHandler: (() => void) | null = null

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  color: string
}

interface Pulse {
  x: number
  y: number
  radius: number
  alpha: number
}

onMounted(() => {
  const c = canvas.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const pointer = { x: 0, y: 0, active: false }
  const pulses: Pulse[] = []
  let cssWidth = 0
  let cssHeight = 0

  resizeHandler = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    cssWidth = window.innerWidth
    cssHeight = window.innerHeight
    c.width = Math.floor(cssWidth * pixelRatio)
    c.height = Math.floor(cssHeight * pixelRatio)
    c.style.width = `${cssWidth}px`
    c.style.height = `${cssHeight}px`
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }
  resizeHandler()
  window.addEventListener('resize', resizeHandler)

  const colors = ['0, 240, 255', '52, 211, 153', '167, 139, 250']
  const particleCount = reduceMotion ? 36 : Math.min(96, Math.max(54, Math.floor(cssWidth / 15)))
  const particles: Particle[] = []
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * cssWidth,
      y: Math.random() * cssHeight,
      vx: (Math.random() - 0.5) * 0.34,
      vy: (Math.random() - 0.5) * 0.34,
      size: Math.random() * 1.8 + 0.6,
      alpha: Math.random() * 0.45 + 0.18,
      color: colors[i % colors.length],
    })
  }

  function drawFrame(advance: boolean) {
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      if (advance) {
        if (pointer.active) {
          const dx = pointer.x - p.x
          const dy = pointer.y - p.y
          const distanceSquared = dx * dx + dy * dy
          if (distanceSquared > 196 && distanceSquared < 48400) {
            const attraction = 0.012 / Math.sqrt(distanceSquared)
            p.vx += dx * attraction
            p.vy += dy * attraction
          }
        }

        p.vx *= 0.992
        p.vy *= 0.992
        p.x += p.vx
        p.y += p.vy
        if (p.x < -8) p.x = cssWidth + 8
        if (p.x > cssWidth + 8) p.x = -8
        if (p.y < -8) p.y = cssHeight + 8
        if (p.y > cssHeight + 8) p.y = -8
      }

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`
      ctx.fill()
    }

    const connectionDistance = cssWidth < 640 ? 92 : 126
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance < connectionDistance) {
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.strokeStyle = `rgba(${particles[i].color}, ${0.12 * (1 - distance / connectionDistance)})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }

      if (pointer.active) {
        const dx = particles[i].x - pointer.x
        const dy = particles[i].y - pointer.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance < 170) {
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(pointer.x, pointer.y)
          ctx.strokeStyle = `rgba(${particles[i].color}, ${0.24 * (1 - distance / 170)})`
          ctx.lineWidth = 0.7
          ctx.stroke()
        }
      }
    }

    for (let i = pulses.length - 1; i >= 0; i--) {
      const pulse = pulses[i]
      ctx.beginPath()
      ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(0, 240, 255, ${pulse.alpha})`
      ctx.lineWidth = 1
      ctx.stroke()
      if (advance) {
        pulse.radius += 2.8
        pulse.alpha *= 0.955
        if (pulse.alpha < 0.015) pulses.splice(i, 1)
      }
    }
  }

  function draw() {
    drawFrame(true)
    animId = requestAnimationFrame(draw)
  }

  pointerMoveHandler = (event) => {
    pointer.x = event.clientX
    pointer.y = event.clientY
    pointer.active = true
  }
  pointerLeaveHandler = () => {
    pointer.active = false
  }
  pointerDownHandler = (event) => {
    if (event.clientY > cssHeight || reduceMotion) return
    pulses.push({ x: event.clientX, y: event.clientY, radius: 8, alpha: 0.55 })
  }
  visibilityHandler = () => {
    cancelAnimationFrame(animId)
    if (!document.hidden && !reduceMotion) animId = requestAnimationFrame(draw)
  }

  if (reduceMotion) {
    drawFrame(false)
  } else {
    window.addEventListener('pointermove', pointerMoveHandler, { passive: true })
    document.documentElement.addEventListener('pointerleave', pointerLeaveHandler)
    window.addEventListener('pointerdown', pointerDownHandler, { passive: true })
    document.addEventListener('visibilitychange', visibilityHandler)
    draw()
  }
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
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
})
</script>

<template>
  <canvas ref="canvas" class="absolute inset-0 pointer-events-none"></canvas>
</template>
