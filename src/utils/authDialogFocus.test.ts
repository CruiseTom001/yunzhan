import { describe, expect, it } from 'vitest'
import { resolveTabWrapTarget } from './authDialogFocus'

describe('authDialogFocus tab wrap', () => {
  it('wraps tab from last element to first', () => {
    expect(resolveTabWrapTarget({
      focusableCount: 3,
      activeIsFirst: false,
      activeIsLast: true,
      activeInside: true,
      shiftKey: false,
    })).toBe('first')
  })

  it('wraps shift+tab from first element to last', () => {
    expect(resolveTabWrapTarget({
      focusableCount: 3,
      activeIsFirst: true,
      activeIsLast: false,
      activeInside: true,
      shiftKey: true,
    })).toBe('last')
  })

  it('keeps focus inside dialog for normal tab between elements', () => {
    expect(resolveTabWrapTarget({
      focusableCount: 3,
      activeIsFirst: false,
      activeIsLast: false,
      activeInside: true,
      shiftKey: false,
    })).toBe('none')
  })

  it('focuses first element when dialog has no focusable children', () => {
    expect(resolveTabWrapTarget({
      focusableCount: 0,
      activeIsFirst: false,
      activeIsLast: false,
      activeInside: false,
      shiftKey: false,
    })).toBe('first')
  })
})
