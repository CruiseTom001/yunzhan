import type { DesktopUpdaterStatus } from '@/utils/desktopUpdaterTypes'
import type {
  DesktopCloseBehavior,
  DesktopCloseResolveAction,
} from '@/utils/desktopCloseBehavior'

export function shouldBlockCloseForUpdate(status: DesktopUpdaterStatus): boolean {
  return status === 'installing'
}

export function shouldShowCloseDialog(behavior: DesktopCloseBehavior): boolean {
  return behavior === 'ask'
}

export function resolveBehaviorToAction(behavior: DesktopCloseBehavior): DesktopCloseResolveAction | null {
  if (behavior === 'quit') return 'quit'
  if (behavior === 'tray') return 'tray'
  return null
}
