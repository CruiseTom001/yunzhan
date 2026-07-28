import { describe, expect, it } from 'vitest'
import {
  PARTICLE_BG_BURST_DURATION_MS,
  PARTICLE_BG_CLUSTER_COUNT_THRESHOLD,
  PARTICLE_BG_CLUSTER_RADIUS,
  PARTICLE_BG_GATHER_DURATION_MS,
  PARTICLE_BG_MAX_CONNECTIONS_PER_PARTICLE,
  PARTICLE_BG_MAX_PARTICLE_COUNT_DESKTOP,
  PARTICLE_BG_NEW_PARTICLE_PROTECTION_MS,
  PARTICLE_BG_REGEN_INTERVAL_MS,
  buildParticleConnections,
  countParticlesInRadius,
  createParticleBackgroundEngine,
  detectClusterCandidate,
  resolveTargetParticleCount,
  shouldTriggerClusterBurst,
} from '@/utils/particleBackground'

function clusterParticles(
  engine: ReturnType<typeof createParticleBackgroundEngine>,
  count: number,
  centerX: number,
  centerY: number,
  now: number,
): void {
  const particles = engine.getParticles()
  for (let index = 0; index < particles.length; index++) {
    const particle = particles[index]
    if (index < count) {
      particle.x = centerX + (index % 3) * 4
      particle.y = centerY + Math.floor(index / 3) * 4
    } else {
      const lane = index - count
      particle.x = 500 + (lane % 4) * 100
      particle.y = 500 + Math.floor(lane / 4) * 100
    }
    particle.state = 'normal'
    particle.bornAt = now - PARTICLE_BG_NEW_PARTICLE_PROTECTION_MS - 100
  }
}

describe('particleBackground', () => {
  it('does not trigger burst when cluster count is below threshold', () => {
    const now = 10_000
    const engine = createParticleBackgroundEngine(900, 700)
    clusterParticles(engine, PARTICLE_BG_CLUSTER_COUNT_THRESHOLD - 1, 200, 200, now)

    const candidate = {
      centerX: 200,
      centerY: 200,
      particleIds: Array.from({ length: PARTICLE_BG_CLUSTER_COUNT_THRESHOLD - 1 }, (_, index) => index + 1),
    }
    expect(candidate.particleIds.length).toBeLessThan(PARTICLE_BG_CLUSTER_COUNT_THRESHOLD)
    expect(shouldTriggerClusterBurst(candidate, null, 0, now)).toBe(false)

    engine.tick(now + 500, true)
    expect(engine.hasActiveBurst()).toBe(false)
    engine.dispose()
  })

  it('triggers burst only once when cluster reaches threshold', () => {
    const now = 20_000
    const engine = createParticleBackgroundEngine(900, 700)
    clusterParticles(engine, PARTICLE_BG_CLUSTER_COUNT_THRESHOLD, 260, 260, now)

    const candidate = detectClusterCandidate(engine.getParticles() as never, now)
    expect(candidate?.particleIds.length).toBeGreaterThanOrEqual(PARTICLE_BG_CLUSTER_COUNT_THRESHOLD)

    engine.tick(now + 500, true)
    expect(engine.hasActiveBurst()).toBe(true)

    engine.tick(now + 1000, true)
    expect(engine.hasActiveBurst()).toBe(true)
    engine.dispose()
  })

  it('respects cooldown and prevents immediate re-trigger', () => {
    const now = 30_000
    const engine = createParticleBackgroundEngine(900, 700)
    clusterParticles(engine, PARTICLE_BG_CLUSTER_COUNT_THRESHOLD, 300, 300, now)

    engine.tick(now + 500, true)
    expect(engine.hasActiveBurst()).toBe(true)
    expect(engine.getCooldownUntil()).toBeGreaterThan(now)

    const duringCooldown = engine.getCooldownUntil() - 1000
    clusterParticles(engine, PARTICLE_BG_CLUSTER_COUNT_THRESHOLD, 320, 320, duringCooldown)
    engine.tick(duringCooldown + 500, true)

    const candidate = detectClusterCandidate(engine.getParticles() as never, duringCooldown + 500)
    expect(shouldTriggerClusterBurst(candidate, engine.hasActiveBurst() ? { centerX: 0, centerY: 0, particleIds: [], gatherStartAt: 0 } : null, engine.getCooldownUntil(), duringCooldown + 500)).toBe(false)
    engine.dispose()
  })

  it('removes burst particles after burst lifecycle completes', () => {
    const now = 40_000
    const engine = createParticleBackgroundEngine(900, 700)
    const initialCount = engine.getParticleCount()
    clusterParticles(engine, PARTICLE_BG_CLUSTER_COUNT_THRESHOLD, 360, 360, now)

    engine.tick(now + 500, true)
    const burstIds = new Set(engine.getActiveBurstParticleIds())
    expect(burstIds.size).toBeGreaterThan(0)

    const endAt = now
      + 500
      + PARTICLE_BG_GATHER_DURATION_MS
      + PARTICLE_BG_BURST_DURATION_MS
      + 200

    for (let step = 0; step < 30; step++) {
      engine.tick(endAt + step * 40, true)
    }

    expect(engine.hasActiveBurst()).toBe(false)
    for (const particle of engine.getParticles()) {
      expect(burstIds.has(particle.id)).toBe(false)
    }
    expect(engine.getParticleCount()).toBeLessThan(initialCount)
    expect(engine.getPendingRegenCount()).toBeGreaterThan(0)
    engine.dispose()
  })

  it('regenerates particles gradually instead of instantly refilling', () => {
    const now = 50_000
    const engine = createParticleBackgroundEngine(900, 700)
    clusterParticles(engine, PARTICLE_BG_CLUSTER_COUNT_THRESHOLD, 420, 420, now)

    engine.tick(now + 500, true)
    const endAt = now + 500 + PARTICLE_BG_GATHER_DURATION_MS + PARTICLE_BG_BURST_DURATION_MS + 200
    for (let step = 0; step < 30; step++) {
      engine.tick(endAt + step * 40, true)
    }

    const afterBurstCount = engine.getParticleCount()
    const pending = engine.getPendingRegenCount()
    expect(pending).toBeGreaterThan(0)

    engine.tick(endAt + 1200, true)
    expect(engine.getParticleCount()).toBeLessThanOrEqual(afterBurstCount + 1)
    expect(engine.getParticleCount()).toBeLessThan(PARTICLE_BG_MAX_PARTICLE_COUNT_DESKTOP)

    for (let step = 0; step < pending + 2; step++) {
      engine.tick(endAt + 1200 + step * PARTICLE_BG_REGEN_INTERVAL_MS, true)
    }

    expect(engine.getPendingRegenCount()).toBe(0)
    expect(engine.getParticleCount()).toBe(resolveTargetParticleCount(900, false))
    engine.dispose()
  })

  it('never exceeds configured particle count', () => {
    const engine = createParticleBackgroundEngine(900, 700)
    const target = resolveTargetParticleCount(900, false)
    expect(engine.getParticleCount()).toBe(target)

    const now = 60_000
    for (let step = 0; step < 200; step++) {
      engine.tick(now + step * 50, true)
    }

    expect(engine.getParticleCount()).toBeLessThanOrEqual(target)
    engine.dispose()
  })

  it('limits each particle to the configured maximum connections', () => {
    const particles = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      x: 100 + index * 8,
      y: 100,
      state: 'normal' as const,
    }))

    const connections = buildParticleConnections(
      particles,
      140,
      PARTICLE_BG_MAX_CONNECTIONS_PER_PARTICLE,
    )

    const counts = new Map<number, number>()
    for (const connection of connections) {
      counts.set(connection.aId, (counts.get(connection.aId) ?? 0) + 1)
      counts.set(connection.bId, (counts.get(connection.bId) ?? 0) + 1)
    }

    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(PARTICLE_BG_MAX_CONNECTIONS_PER_PARTICLE)
    }

    const pairKeys = connections.map(connection => `${connection.aId}:${connection.bId}`)
    expect(new Set(pairKeys).size).toBe(pairKeys.length)
  })

  it('disables cluster burst under reduced motion', () => {
    const now = 70_000
    const engine = createParticleBackgroundEngine(900, 700, { reduceMotion: true })
    clusterParticles(engine, PARTICLE_BG_CLUSTER_COUNT_THRESHOLD, 500, 500, now)

    engine.tick(now + 500, true)
    engine.tick(now + 2000, true)

    expect(engine.hasActiveBurst()).toBe(false)
    expect(engine.shouldAnimate()).toBe(false)
    engine.dispose()
  })

  it('pauses animation when page is hidden or viewport is not visible', () => {
    const engine = createParticleBackgroundEngine(900, 700)
    expect(engine.shouldAnimate()).toBe(true)

    engine.setPageHidden(true)
    expect(engine.shouldAnimate()).toBe(false)

    engine.setPageHidden(false)
    engine.setViewportVisible(false)
    expect(engine.shouldAnimate()).toBe(false)

    engine.setViewportVisible(true)
    expect(engine.shouldAnimate()).toBe(true)
    engine.dispose()
  })

  it('cleans up engine state on dispose', () => {
    const engine = createParticleBackgroundEngine(900, 700)
    engine.dispose()

    expect(engine.isDisposed()).toBe(true)
    expect(engine.getParticleCount()).toBe(0)
    expect(engine.shouldAnimate()).toBe(false)
  })

  it('counts particles within cluster radius for detection helpers', () => {
    const now = 80_000
    const particles = [
      { id: 1, x: 100, y: 100, state: 'normal' as const, bornAt: now - 10_000 },
      { id: 2, x: 110, y: 105, state: 'normal' as const, bornAt: now - 10_000 },
      { id: 3, x: 400, y: 400, state: 'normal' as const, bornAt: now - 10_000 },
    ]

    const nearbyIds = countParticlesInRadius(particles, 100, 100, PARTICLE_BG_CLUSTER_RADIUS, now)
    expect(nearbyIds).toEqual([1, 2])
    expect(nearbyIds.length).toBeLessThan(PARTICLE_BG_CLUSTER_COUNT_THRESHOLD)
  })
})
