import { describe, expect, it } from 'vitest'
import {
  parseCloseBehaviorState,
  parseCloseRequestedPayload,
  parseCloseResolveInput,
  parseCloseResolveResult,
} from '@/utils/desktopCloseBehavior'
import {
  resolveBehaviorToAction,
  shouldBlockCloseForUpdate,
  shouldShowCloseDialog,
} from '@/utils/desktopCloseFlow'

describe('desktopCloseFlow', () => {
  it('blocks close while update is installing', () => {
    expect(shouldBlockCloseForUpdate('installing')).toBe(true)
    expect(shouldBlockCloseForUpdate('downloaded')).toBe(false)
  })

  it('shows dialog only for ask behavior', () => {
    expect(shouldShowCloseDialog('ask')).toBe(true)
    expect(shouldShowCloseDialog('quit')).toBe(false)
    expect(shouldShowCloseDialog('tray')).toBe(false)
  })

  it('maps remembered behavior to resolve action', () => {
    expect(resolveBehaviorToAction('quit')).toBe('quit')
    expect(resolveBehaviorToAction('tray')).toBe('tray')
    expect(resolveBehaviorToAction('ask')).toBeNull()
  })
})

describe('desktopCloseBehavior parsers', () => {
  it('parses close requested payload', () => {
    expect(parseCloseRequestedPayload({ behavior: 'tray' })).toEqual({ behavior: 'tray' })
    expect(parseCloseRequestedPayload({ behavior: 'hide' })).toBeNull()
  })

  it('parses resolve input with remember flag', () => {
    expect(parseCloseResolveInput({ action: 'quit', remember: true })).toEqual({
      action: 'quit',
      remember: true,
    })
    expect(parseCloseResolveInput({ action: 'quit', remember: 'yes' })).toEqual({
      action: 'quit',
      remember: false,
    })
  })

  it('parses close behavior state', () => {
    expect(parseCloseBehaviorState({ closeBehavior: 'ask' })).toEqual({ closeBehavior: 'ask' })
    expect(parseCloseBehaviorState({ closeBehavior: 'unknown' })).toBeNull()
  })

  it('parses successful resolve results with known actions', () => {
    expect(parseCloseResolveResult({ ok: true, action: 'quit' })).toEqual({
      ok: true,
      action: 'quit',
    })
    expect(parseCloseResolveResult({ ok: true, action: 'tray' })).toEqual({
      ok: true,
      action: 'tray',
    })
  })

  it('parses failed resolve results with known reasons', () => {
    expect(parseCloseResolveResult({ ok: false, reason: 'installing' })).toEqual({
      ok: false,
      reason: 'installing',
    })
  })

  it('rejects unknown action or reason values', () => {
    expect(parseCloseResolveResult({ ok: true, action: 'unknown' })).toBeNull()
    expect(parseCloseResolveResult({ ok: false, reason: 'unknown' })).toBeNull()
  })

  it('rejects missing or non-boolean ok', () => {
    expect(parseCloseResolveResult({})).toBeNull()
    expect(parseCloseResolveResult({ ok: 'true' })).toBeNull()
  })

  it('rejects null, arrays, and strings as resolve results', () => {
    expect(parseCloseResolveResult(null)).toBeNull()
    expect(parseCloseResolveResult([{ ok: true }])).toBeNull()
    expect(parseCloseResolveResult('ok')).toBeNull()
  })
})
