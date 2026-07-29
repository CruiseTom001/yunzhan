import { DESKTOP_UPDATE_CHECK_INTERVAL_MS } from './desktopUpdateCheck'

export function computeNextPeriodicCheckDelay(
  lastCheckedAt: number | null,
  now: number,
  intervalMs: number = DESKTOP_UPDATE_CHECK_INTERVAL_MS,
): number {
  if (lastCheckedAt === null) return intervalMs
  return Math.max(0, lastCheckedAt + intervalMs - now)
}
