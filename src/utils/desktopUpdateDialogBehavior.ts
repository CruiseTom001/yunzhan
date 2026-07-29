import type { DesktopUpdaterStatus } from '@/utils/desktopUpdaterTypes'

export type UpdateDialogCloseAction = 'close' | 'dismiss'

export function canCloseUpdateDialog(
  noticeMode: 'optional' | 'required' | null,
  status: DesktopUpdaterStatus,
): boolean {
  if (status === 'installing') return false
  if (status === 'downloading' && noticeMode === 'required') return false
  return true
}

export function resolveUpdateDialogCloseAction(
  noticeMode: 'optional' | 'required' | null,
): UpdateDialogCloseAction {
  return noticeMode === 'required' ? 'close' : 'dismiss'
}

export function shouldHandleUpdateDialogEscape(
  key: string,
  dialogRendered: boolean,
): boolean {
  return dialogRendered && key === 'Escape'
}

export function isUpdateDialogBackdropClick(
  target: EventTarget | null,
  currentTarget: EventTarget | null,
): boolean {
  return target !== null && target === currentTarget
}

export function pickFocusRestoreTarget(
  lastTrigger: HTMLElement | null,
  contains: (node: HTMLElement) => boolean = (node) => document.contains(node),
): HTMLElement | null {
  if (!lastTrigger) return null
  return contains(lastTrigger) ? lastTrigger : null
}
