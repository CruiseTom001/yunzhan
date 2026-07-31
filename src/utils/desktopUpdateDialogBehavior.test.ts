import { describe, expect, it } from 'vitest'
import {
  canCloseUpdateDialog,
  isUpdateDialogBackdropClick,
  pickFocusRestoreTarget,
  resolveUpdateDialogCloseAction,
  shouldHandleUpdateDialogEscape,
} from './desktopUpdateDialogBehavior'
import { lockBodyScroll, resetBodyScrollLockForTests, unlockBodyScroll } from './authDialogFocus'

describe('desktopUpdateDialogBehavior', () => {
  it('allows optional downloads to close while required downloads stay blocked', () => {
    expect(canCloseUpdateDialog('optional', 'downloading')).toBe(true)
    expect(canCloseUpdateDialog('required', 'downloading')).toBe(false)
    expect(canCloseUpdateDialog('optional', 'installing')).toBe(false)
    expect(canCloseUpdateDialog('required', 'installing')).toBe(false)
    expect(canCloseUpdateDialog('optional', 'available')).toBe(true)
  })

  it('blocks closing for downloaded updates in both required and optional modes', () => {
    expect(canCloseUpdateDialog('optional', 'downloaded')).toBe(false)
    expect(canCloseUpdateDialog('required', 'downloaded')).toBe(false)
    expect(canCloseUpdateDialog(null, 'downloaded')).toBe(false)
  })

  it('dismisses optional notices and closes required notices on escape', () => {
    expect(resolveUpdateDialogCloseAction('optional')).toBe('dismiss')
    expect(resolveUpdateDialogCloseAction('required')).toBe('close')
    expect(resolveUpdateDialogCloseAction(null)).toBe('dismiss')
  })

  it('handles escape only while dialog is rendered', () => {
    expect(shouldHandleUpdateDialogEscape('Escape', true)).toBe(true)
    expect(shouldHandleUpdateDialogEscape('Escape', false)).toBe(false)
    expect(shouldHandleUpdateDialogEscape('Enter', true)).toBe(false)
  })

  it('closes only when backdrop itself is clicked', () => {
    const backdrop = {} as EventTarget
    const panel = {} as EventTarget
    expect(isUpdateDialogBackdropClick(backdrop, backdrop)).toBe(true)
    expect(isUpdateDialogBackdropClick(panel, backdrop)).toBe(false)
  })

  it('restores focus to the previous trigger when still connected', () => {
    const trigger = { id: 'trigger' } as HTMLElement
    expect(pickFocusRestoreTarget(trigger, () => true)).toBe(trigger)
    expect(pickFocusRestoreTarget(trigger, () => false)).toBeNull()
    expect(pickFocusRestoreTarget(null)).toBeNull()
  })

  it('locks body scroll while dialog is visible and unlocks after close', () => {
    resetBodyScrollLockForTests()
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'auto'
    }

    lockBodyScroll()
    if (typeof document !== 'undefined') {
      expect(document.body.style.overflow).toBe('hidden')
    }

    unlockBodyScroll()
    if (typeof document !== 'undefined') {
      expect(document.body.style.overflow).toBe('auto')
    }
  })
})
