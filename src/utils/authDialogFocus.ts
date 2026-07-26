const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

let bodyScrollLockCount = 0
let previousBodyOverflow = ''

export type TabWrapTarget = 'first' | 'last' | 'none'

export function resolveTabWrapTarget(options: {
  focusableCount: number
  activeIsFirst: boolean
  activeIsLast: boolean
  activeInside: boolean
  shiftKey: boolean
}): TabWrapTarget {
  if (options.focusableCount === 0) return 'first'
  if (options.shiftKey) {
    if (!options.activeInside || options.activeIsFirst) return 'last'
    return 'none'
  }
  if (options.activeIsLast) return 'first'
  return 'none'
}

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1 && element.offsetParent !== null)
}

export function trapFocus(root: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return
  const focusable = getFocusableElements(root)
  if (focusable.length === 0) {
    event.preventDefault()
    root.focus()
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  const wrapTarget = resolveTabWrapTarget({
    focusableCount: focusable.length,
    activeIsFirst: active === first,
    activeIsLast: active === last,
    activeInside: active instanceof Node ? root.contains(active) : false,
    shiftKey: event.shiftKey,
  })
  if (wrapTarget === 'none') return
  event.preventDefault()
  ;(wrapTarget === 'first' ? first : last).focus()
}

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return
  if (bodyScrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  bodyScrollLockCount += 1
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return
  if (bodyScrollLockCount === 0) return
  bodyScrollLockCount -= 1
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow
    previousBodyOverflow = ''
  }
}

export function resetBodyScrollLockForTests(): void {
  bodyScrollLockCount = 0
  previousBodyOverflow = ''
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
}
