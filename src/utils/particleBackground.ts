export const PARTICLE_BG_MAX_PARTICLE_COUNT_DESKTOP = 42
export const PARTICLE_BG_MAX_PARTICLE_COUNT_MOBILE = 23
export const PARTICLE_BG_MOBILE_BREAKPOINT = 640
export const PARTICLE_BG_CLUSTER_RADIUS = 85
export const PARTICLE_BG_CLUSTER_COUNT_THRESHOLD = 7
export const PARTICLE_BG_BURST_RADIUS = 90
export const PARTICLE_BG_BURST_DURATION_MS = 650
export const PARTICLE_BG_GATHER_DURATION_MS = 275
export const PARTICLE_BG_REGION_COOLDOWN_MS = 11000
export const PARTICLE_BG_MAX_CONNECTION_DISTANCE = 118
export const PARTICLE_BG_MAX_CONNECTIONS_PER_PARTICLE = 3
export const PARTICLE_BG_NEW_PARTICLE_PROTECTION_MS = 4500
export const PARTICLE_BG_REGEN_INTERVAL_MS = 350
export const PARTICLE_BG_REGEN_FADE_IN_MS = 700
export const PARTICLE_BG_MIN_REPULSION_DISTANCE = 14
export const PARTICLE_BG_CLUSTER_CHECK_INTERVAL_MS = 400
export const PARTICLE_BG_MAX_DEVICE_PIXEL_RATIO = 1.75
export const PARTICLE_BG_REDUCED_MOTION_COUNT = 20
export const PARTICLE_BG_MIN_SPAWN_DISTANCE = 48

export type ParticleLifecycleState =
  | 'normal'
  | 'gathering'
  | 'bursting'
  | 'fading'
  | 'regenerating'

export interface ParticleRecord {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  baseAlpha: number
  color: string
  state: ParticleLifecycleState
  bornAt: number
  gatherStartAt: number
  burstStartAt: number
  burstCenterX: number
  burstCenterY: number
  burstAngle: number
  fadeStartAt: number
  regenStartAt: number
}

export interface ParticleConnection {
  aId: number
  bId: number
  distance: number
}

export interface ClusterCandidate {
  centerX: number
  centerY: number
  particleIds: number[]
}

export interface PointerState {
  x: number
  y: number
  active: boolean
}

export interface PulseRecord {
  x: number
  y: number
  radius: number
  alpha: number
}

interface ActiveBurst {
  centerX: number
  centerY: number
  particleIds: number[]
  gatherStartAt: number
}

const PARTICLE_COLORS_DARK = ['0, 240, 255', '52, 211, 153', '167, 139, 250'] as const
const PARTICLE_COLORS_LIGHT = ['14, 116, 144', '5, 150, 105', '109, 40, 217'] as const

let nextParticleId = 1

function createParticle(
  x: number,
  y: number,
  color: string,
  now: number,
  state: ParticleLifecycleState = 'normal',
): ParticleRecord {
  return {
    id: nextParticleId++,
    x,
    y,
    vx: (Math.random() - 0.5) * 0.34,
    vy: (Math.random() - 0.5) * 0.34,
    size: Math.random() * 1.8 + 0.6,
    alpha: state === 'regenerating' ? 0 : Math.random() * 0.45 + 0.18,
    baseAlpha: Math.random() * 0.45 + 0.18,
    color,
    state,
    bornAt: now,
    gatherStartAt: 0,
    burstStartAt: 0,
    burstCenterX: 0,
    burstCenterY: 0,
    burstAngle: 0,
    fadeStartAt: 0,
    regenStartAt: state === 'regenerating' ? now : 0,
  }
}

export function resolveTargetParticleCount(
  width: number,
  reduceMotion: boolean,
): number {
  if (reduceMotion) return PARTICLE_BG_REDUCED_MOTION_COUNT
  const isMobile = width < PARTICLE_BG_MOBILE_BREAKPOINT
  return isMobile
    ? PARTICLE_BG_MAX_PARTICLE_COUNT_MOBILE
    : PARTICLE_BG_MAX_PARTICLE_COUNT_DESKTOP
}

export function isParticleEligibleForCluster(
  particle: Pick<ParticleRecord, 'state' | 'bornAt'>,
  now: number,
): boolean {
  return (
    particle.state === 'normal'
    && now - particle.bornAt >= PARTICLE_BG_NEW_PARTICLE_PROTECTION_MS
  )
}

export function countParticlesInRadius(
  particles: ReadonlyArray<Pick<ParticleRecord, 'id' | 'x' | 'y' | 'state' | 'bornAt'>>,
  centerX: number,
  centerY: number,
  radius: number,
  now: number,
): number[] {
  const radiusSquared = radius * radius
  const ids: number[] = []
  for (const particle of particles) {
    if (!isParticleEligibleForCluster(particle, now)) continue
    const dx = particle.x - centerX
    const dy = particle.y - centerY
    if (dx * dx + dy * dy <= radiusSquared) {
      ids.push(particle.id)
    }
  }
  return ids
}

export function detectClusterCandidate(
  particles: ReadonlyArray<ParticleRecord>,
  now: number,
): ClusterCandidate | null {
  const eligible = particles.filter(particle => isParticleEligibleForCluster(particle, now))
  if (eligible.length < PARTICLE_BG_CLUSTER_COUNT_THRESHOLD) return null

  const cellSize = PARTICLE_BG_CLUSTER_RADIUS
  const grid = new Map<string, ParticleRecord[]>()

  for (const particle of eligible) {
    const cellX = Math.floor(particle.x / cellSize)
    const cellY = Math.floor(particle.y / cellSize)
    const key = `${cellX}:${cellY}`
    const bucket = grid.get(key)
    if (bucket) bucket.push(particle)
    else grid.set(key, [particle])
  }

  let best: ClusterCandidate | null = null

  for (const seed of eligible) {
    const cellX = Math.floor(seed.x / cellSize)
    const cellY = Math.floor(seed.y / cellSize)
    const nearby: ParticleRecord[] = []

    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        const bucket = grid.get(`${cellX + offsetX}:${cellY + offsetY}`)
        if (bucket) nearby.push(...bucket)
      }
    }

    const ids = countParticlesInRadius(nearby, seed.x, seed.y, PARTICLE_BG_CLUSTER_RADIUS, now)
    if (ids.length < PARTICLE_BG_CLUSTER_COUNT_THRESHOLD) continue

    const clusterParticles = nearby.filter(particle => ids.includes(particle.id))
    const centerX = clusterParticles.reduce((sum, particle) => sum + particle.x, 0) / clusterParticles.length
    const centerY = clusterParticles.reduce((sum, particle) => sum + particle.y, 0) / clusterParticles.length

    if (!best || ids.length > best.particleIds.length) {
      best = { centerX, centerY, particleIds: ids }
    }
  }

  return best
}

export function shouldTriggerClusterBurst(
  candidate: ClusterCandidate | null,
  activeBurst: ActiveBurst | null,
  cooldownUntil: number,
  now: number,
): boolean {
  if (!candidate) return false
  if (activeBurst) return false
  if (now < cooldownUntil) return false
  return candidate.particleIds.length >= PARTICLE_BG_CLUSTER_COUNT_THRESHOLD
}

export function buildParticleConnections(
  particles: ReadonlyArray<Pick<ParticleRecord, 'id' | 'x' | 'y' | 'state'>>,
  maxDistance: number = PARTICLE_BG_MAX_CONNECTION_DISTANCE,
  maxPerParticle: number = PARTICLE_BG_MAX_CONNECTIONS_PER_PARTICLE,
): ParticleConnection[] {
  const maxDistanceSquared = maxDistance * maxDistance
  const connectionCounts = new Map<number, number>()
  const connections: ParticleConnection[] = []
  const drawnPairs = new Set<string>()

  for (const particle of particles) {
    if (particle.state === 'fading') continue

    const neighbors: Array<{ id: number; distance: number }> = []
    for (const other of particles) {
      if (other.id === particle.id || other.state === 'fading') continue
      const dx = particle.x - other.x
      const dy = particle.y - other.y
      const distanceSquared = dx * dx + dy * dy
      if (distanceSquared > maxDistanceSquared) continue
      neighbors.push({ id: other.id, distance: Math.sqrt(distanceSquared) })
    }

    neighbors.sort((left, right) => left.distance - right.distance)

    const currentCount = connectionCounts.get(particle.id) ?? 0
    const remaining = maxPerParticle - currentCount
    if (remaining <= 0) continue

    for (const neighbor of neighbors.slice(0, remaining)) {
      const pairKey = particle.id < neighbor.id
        ? `${particle.id}:${neighbor.id}`
        : `${neighbor.id}:${particle.id}`
      if (drawnPairs.has(pairKey)) continue

      const otherCount = connectionCounts.get(neighbor.id) ?? 0
      if (otherCount >= maxPerParticle) continue

      drawnPairs.add(pairKey)
      connections.push({ aId: particle.id, bId: neighbor.id, distance: neighbor.distance })
      connectionCounts.set(particle.id, (connectionCounts.get(particle.id) ?? 0) + 1)
      connectionCounts.set(neighbor.id, otherCount + 1)
    }
  }

  return connections
}

function easeOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return 1 - (1 - clamped) ** 3
}

function getThemeColors(theme: 'light' | 'dark'): readonly string[] {
  return theme === 'light' ? PARTICLE_COLORS_LIGHT : PARTICLE_COLORS_DARK
}

function getAlphaMultiplier(theme: 'light' | 'dark'): number {
  return theme === 'light' ? 0.62 : 1
}

function getConnectionStateMultiplier(state: ParticleLifecycleState): number {
  switch (state) {
    case 'gathering':
      return 0.45
    case 'bursting':
      return 0.2
    case 'fading':
      return 0
    case 'regenerating':
      return 0.7
    default:
      return 1
  }
}

export class ParticleBackgroundEngine {
  private width = 0
  private height = 0
  private particles: ParticleRecord[] = []
  private pulses: PulseRecord[] = []
  private pointer: PointerState = { x: 0, y: 0, active: false }
  private activeBurst: ActiveBurst | null = null
  private cooldownUntil = 0
  private lastClusterCheckAt = 0
  private pendingRegenCount = 0
  private lastRegenAt = 0
  private lastSpawnX = -9999
  private lastSpawnY = -9999
  private reduceMotion = false
  private theme: 'light' | 'dark' = 'dark'
  private pageHidden = false
  private viewportVisible = true
  private targetCount = PARTICLE_BG_MAX_PARTICLE_COUNT_DESKTOP
  private disposed = false
  private colorIndex = 0

  constructor(width: number, height: number, options?: { reduceMotion?: boolean; theme?: 'light' | 'dark' }) {
    this.reduceMotion = options?.reduceMotion ?? false
    this.theme = options?.theme ?? 'dark'
    this.resize(width, height)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.targetCount = resolveTargetParticleCount(width, this.reduceMotion)
    if (this.particles.length > this.targetCount) {
      this.particles.length = this.targetCount
    }
    while (this.particles.length < this.targetCount) {
      this.particles.push(this.createRandomParticle(performance.now(), 'normal'))
    }
  }

  setReduceMotion(enabled: boolean): void {
    this.reduceMotion = enabled
    this.targetCount = resolveTargetParticleCount(this.width, enabled)
    if (enabled) {
      this.activeBurst = null
      this.pendingRegenCount = 0
      this.cooldownUntil = Number.POSITIVE_INFINITY
      for (const particle of this.particles) {
        particle.state = 'normal'
        particle.vx *= 0.2
        particle.vy *= 0.2
      }
      if (this.particles.length > this.targetCount) {
        this.particles.length = this.targetCount
      }
    } else {
      this.cooldownUntil = 0
      this.resize(this.width, this.height)
    }
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme
    const colors = getThemeColors(theme)
    this.particles.forEach((particle, index) => {
      particle.color = colors[index % colors.length]
    })
  }

  setPageHidden(hidden: boolean): void {
    this.pageHidden = hidden
  }

  setViewportVisible(visible: boolean): void {
    this.viewportVisible = visible
  }

  shouldAnimate(): boolean {
    return !this.disposed && !this.pageHidden && this.viewportVisible && !this.reduceMotion
  }

  handlePointerMove(x: number, y: number): void {
    this.pointer.x = x
    this.pointer.y = y
    this.pointer.active = true
  }

  handlePointerLeave(): void {
    this.pointer.active = false
  }

  handlePointerDown(x: number, y: number): void {
    if (this.reduceMotion || y > this.height) return
    this.pulses.push({ x, y, radius: 8, alpha: 0.35 })
  }

  tick(now: number, advance: boolean): void {
    if (!advance) return

    if (!this.reduceMotion) {
      this.updateBurstLifecycle(now)
      this.maybeDetectCluster(now)
      this.regenerateParticles(now)
    }

    this.updateParticles(now, advance)
    this.updatePulses()
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const alphaMultiplier = getAlphaMultiplier(this.theme)
    ctx.clearRect(0, 0, this.width, this.height)

    for (const particle of this.particles) {
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${particle.color}, ${particle.alpha * alphaMultiplier})`
      ctx.fill()
    }

    const particleById = new Map(this.particles.map(particle => [particle.id, particle]))
    const connections = buildParticleConnections(this.particles)

    for (const connection of connections) {
      const particleA = particleById.get(connection.aId)
      const particleB = particleById.get(connection.bId)
      if (!particleA || !particleB) continue

      const stateMultiplier = Math.min(
        getConnectionStateMultiplier(particleA.state),
        getConnectionStateMultiplier(particleB.state),
      )
      if (stateMultiplier <= 0) continue

      const distanceRatio = 1 - connection.distance / PARTICLE_BG_MAX_CONNECTION_DISTANCE
      const lineAlpha = 0.12 * distanceRatio * stateMultiplier * alphaMultiplier
      if (lineAlpha <= 0.005) continue

      ctx.beginPath()
      ctx.moveTo(particleA.x, particleA.y)
      ctx.lineTo(particleB.x, particleB.y)
      ctx.strokeStyle = `rgba(${particleA.color}, ${lineAlpha})`
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    if (this.pointer.active && !this.reduceMotion) {
      for (const particle of this.particles) {
        if (particle.state !== 'normal' && particle.state !== 'regenerating') continue
        const dx = particle.x - this.pointer.x
        const dy = particle.y - this.pointer.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance < 170) {
          ctx.beginPath()
          ctx.moveTo(particle.x, particle.y)
          ctx.lineTo(this.pointer.x, this.pointer.y)
          ctx.strokeStyle = `rgba(${particle.color}, ${0.18 * (1 - distance / 170) * alphaMultiplier})`
          ctx.lineWidth = 0.7
          ctx.stroke()
        }
      }
    }

    for (const pulse of this.pulses) {
      ctx.beginPath()
      ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(0, 240, 255, ${pulse.alpha * alphaMultiplier})`
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  dispose(): void {
    this.disposed = true
    this.particles = []
    this.pulses = []
    this.activeBurst = null
    this.pendingRegenCount = 0
  }

  getParticles(): readonly ParticleRecord[] {
    return this.particles
  }

  getParticleCount(): number {
    return this.particles.length
  }

  getPendingRegenCount(): number {
    return this.pendingRegenCount
  }

  getCooldownUntil(): number {
    return this.cooldownUntil
  }

  getActiveBurstParticleIds(): number[] {
    return this.activeBurst?.particleIds ?? []
  }

  hasActiveBurst(): boolean {
    return this.activeBurst !== null
  }

  isDisposed(): boolean {
    return this.disposed
  }

  private createRandomParticle(now: number, state: ParticleLifecycleState): ParticleRecord {
    const colors = getThemeColors(this.theme)
    const color = colors[this.colorIndex % colors.length]
    this.colorIndex += 1
    return createParticle(
      Math.random() * this.width,
      Math.random() * this.height,
      color,
      now,
      state,
    )
  }

  private createEdgeParticle(now: number): ParticleRecord {
    const colors = getThemeColors(this.theme)
    const color = colors[this.colorIndex % colors.length]
    this.colorIndex += 1

    const margin = 20
    const centerX = this.width / 2
    const centerY = this.height * 0.28
    const avoidRadius = Math.min(this.width, this.height) * 0.22

    for (let attempt = 0; attempt < 10; attempt++) {
      const side = Math.floor(Math.random() * 4)
      let x = 0
      let y = 0
      switch (side) {
        case 0:
          x = Math.random() * this.width
          y = margin
          break
        case 1:
          x = this.width - margin
          y = Math.random() * this.height
          break
        case 2:
          x = Math.random() * this.width
          y = this.height - margin
          break
        default:
          x = margin
          y = Math.random() * this.height
          break
      }

      const dxCenter = x - centerX
      const dyCenter = y - centerY
      const dxLast = x - this.lastSpawnX
      const dyLast = y - this.lastSpawnY
      if (dxCenter * dxCenter + dyCenter * dyCenter < avoidRadius * avoidRadius) continue
      if (dxLast * dxLast + dyLast * dyLast < PARTICLE_BG_MIN_SPAWN_DISTANCE * PARTICLE_BG_MIN_SPAWN_DISTANCE) continue

      this.lastSpawnX = x
      this.lastSpawnY = y
      return createParticle(x, y, color, now, 'regenerating')
    }

    return createParticle(margin, margin, color, now, 'regenerating')
  }

  private maybeDetectCluster(now: number): void {
    if (this.activeBurst || now - this.lastClusterCheckAt < PARTICLE_BG_CLUSTER_CHECK_INTERVAL_MS) return
    this.lastClusterCheckAt = now

    const candidate = detectClusterCandidate(this.particles, now)
    if (!shouldTriggerClusterBurst(candidate, this.activeBurst, this.cooldownUntil, now)) return

    const burst = candidate!
    this.activeBurst = {
      centerX: burst.centerX,
      centerY: burst.centerY,
      particleIds: [...burst.particleIds],
      gatherStartAt: now,
    }
    this.cooldownUntil = now + PARTICLE_BG_REGION_COOLDOWN_MS

    for (const particle of this.particles) {
      if (!burst.particleIds.includes(particle.id)) continue
      particle.state = 'gathering'
      particle.gatherStartAt = now
      particle.burstCenterX = burst.centerX
      particle.burstCenterY = burst.centerY
    }
  }

  private updateBurstLifecycle(now: number): void {
    if (!this.activeBurst) return

    const gatherEndAt = this.activeBurst.gatherStartAt + PARTICLE_BG_GATHER_DURATION_MS
    const gatherElapsed = now - this.activeBurst.gatherStartAt
    if (gatherElapsed < PARTICLE_BG_GATHER_DURATION_MS) return

    for (const particle of this.particles) {
      if (!this.activeBurst.particleIds.includes(particle.id)) continue
      if (particle.state !== 'gathering') continue
      particle.state = 'bursting'
      particle.burstStartAt = gatherEndAt
      const dx = particle.x - this.activeBurst.centerX
      const dy = particle.y - this.activeBurst.centerY
      particle.burstAngle = Math.atan2(dy || Math.random() - 0.5, dx || Math.random() - 0.5)
    }

    const burstElapsed = now - gatherEndAt
    const burstProgress = burstElapsed / PARTICLE_BG_BURST_DURATION_MS
    let removableCount = 0

    for (const particle of this.particles) {
      if (!this.activeBurst.particleIds.includes(particle.id)) continue

      if (particle.state === 'bursting') {
        if (burstProgress >= 1) {
          particle.state = 'fading'
          particle.fadeStartAt = now
          particle.alpha = Math.max(0.02, particle.alpha)
        }
        continue
      }

      if (particle.state === 'fading') {
        const fadeElapsed = now - particle.fadeStartAt
        particle.alpha = Math.max(0, particle.alpha * 0.82)
        if (fadeElapsed >= 120 || particle.alpha <= 0.01) {
          removableCount += 1
        }
      }
    }

    if (removableCount < this.activeBurst.particleIds.length) return

    const removedIds = new Set(this.activeBurst.particleIds)
    this.particles = this.particles.filter(particle => !removedIds.has(particle.id))
    this.pendingRegenCount += removedIds.size
    this.activeBurst = null
    this.lastRegenAt = now - PARTICLE_BG_REGEN_INTERVAL_MS
  }

  private regenerateParticles(now: number): void {
    if (this.pendingRegenCount <= 0) return
    if (this.particles.length >= this.targetCount) {
      this.pendingRegenCount = 0
      return
    }
    if (now - this.lastRegenAt < PARTICLE_BG_REGEN_INTERVAL_MS) return

    this.particles.push(this.createEdgeParticle(now))
    this.pendingRegenCount -= 1
    this.lastRegenAt = now
  }

  private updateParticles(now: number, advance: boolean): void {
    if (!advance) return

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i]

      if (particle.state === 'gathering' && this.activeBurst) {
        const progress = Math.min(1, (now - particle.gatherStartAt) / PARTICLE_BG_GATHER_DURATION_MS)
        const pull = 0.08 + progress * 0.12
        particle.x += (particle.burstCenterX - particle.x) * pull
        particle.y += (particle.burstCenterY - particle.y) * pull
        particle.vx *= 0.8
        particle.vy *= 0.8
        continue
      }

      if (particle.state === 'bursting') {
        const elapsed = now - particle.burstStartAt
        const progress = Math.min(1, elapsed / PARTICLE_BG_BURST_DURATION_MS)
        const eased = easeOutCubic(progress)
        const speed = (1 - eased) * 2.4 + 0.15
        particle.x += Math.cos(particle.burstAngle) * speed
        particle.y += Math.sin(particle.burstAngle) * speed
        particle.alpha = particle.baseAlpha * (1 - progress * 0.95)
        continue
      }

      if (particle.state === 'regenerating') {
        const elapsed = now - particle.regenStartAt
        const progress = Math.min(1, elapsed / PARTICLE_BG_REGEN_FADE_IN_MS)
        particle.alpha = particle.baseAlpha * progress
        if (progress >= 1) {
          particle.state = 'normal'
          particle.bornAt = now
        }
      }

      if (particle.state !== 'normal' && particle.state !== 'regenerating') continue

      if (!this.reduceMotion && this.pointer.active) {
        const dx = this.pointer.x - particle.x
        const dy = this.pointer.y - particle.y
        const distanceSquared = dx * dx + dy * dy
        if (distanceSquared > 196 && distanceSquared < 48400) {
          const attraction = 0.012 / Math.sqrt(distanceSquared)
          particle.vx += dx * attraction
          particle.vy += dy * attraction
        }
      }

      const damping = this.reduceMotion ? 0.998 : 0.992
      const speedScale = this.reduceMotion ? 0.25 : 1
      particle.vx *= damping
      particle.vy *= damping
      particle.x += particle.vx * speedScale
      particle.y += particle.vy * speedScale

      if (particle.x < -8) particle.x = this.width + 8
      if (particle.x > this.width + 8) particle.x = -8
      if (particle.y < -8) particle.y = this.height + 8
      if (particle.y > this.height + 8) particle.y = -8
    }

    if (!this.reduceMotion) {
      this.applyRepulsion()
    }
  }

  private applyRepulsion(): void {
    const minDistance = PARTICLE_BG_MIN_REPULSION_DISTANCE
    const minDistanceSquared = minDistance * minDistance

    for (let i = 0; i < this.particles.length; i++) {
      const particleA = this.particles[i]
      if (particleA.state !== 'normal' && particleA.state !== 'regenerating') continue

      for (let j = i + 1; j < this.particles.length; j++) {
        const particleB = this.particles[j]
        if (particleB.state !== 'normal' && particleB.state !== 'regenerating') continue

        const dx = particleB.x - particleA.x
        const dy = particleB.y - particleA.y
        const distanceSquared = dx * dx + dy * dy
        if (distanceSquared >= minDistanceSquared || distanceSquared === 0) continue

        const distance = Math.sqrt(distanceSquared)
        const overlap = (minDistance - distance) / distance
        const pushX = dx * overlap * 0.02
        const pushY = dy * overlap * 0.02
        particleA.x -= pushX
        particleA.y -= pushY
        particleB.x += pushX
        particleB.y += pushY
      }
    }
  }

  private updatePulses(): void {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pulse = this.pulses[i]
      pulse.radius += 2.4
      pulse.alpha *= 0.955
      if (pulse.alpha < 0.015) this.pulses.splice(i, 1)
    }
  }
}

export function createParticleBackgroundEngine(
  width: number,
  height: number,
  options?: { reduceMotion?: boolean; theme?: 'light' | 'dark' },
): ParticleBackgroundEngine {
  return new ParticleBackgroundEngine(width, height, options)
}
