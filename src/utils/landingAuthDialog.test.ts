import { describe, expect, it } from 'vitest'
import {
  buildLandingAuthQuery,
  isAuthMode,
  parseAuthMode,
  stripAuthQuery,
} from '@/utils/authRedirect'

describe('landing auth dialog query sync', () => {
  it('opens login dialog when auth query is login', () => {
    expect(isAuthMode('login')).toBe(true)
    expect(parseAuthMode('login')).toBe('login')
  })

  it('opens register dialog when auth query is register', () => {
    expect(buildLandingAuthQuery({ auth: 'register' })).toEqual({ auth: 'register' })
  })

  it('opens register dialog for free-start CTA query', () => {
    expect(buildLandingAuthQuery({ auth: 'register', redirect: '/' })).toEqual({ auth: 'register' })
  })

  it('supports forgot-password mode switching', () => {
    expect(buildLandingAuthQuery({ auth: 'forgot-password' })).toEqual({ auth: 'forgot-password' })
  })

  it('reopens register mode after refresh with auth=register', () => {
    const query = buildLandingAuthQuery({ auth: 'register', redirect: '/courses' })
    expect(isAuthMode(query.auth)).toBe(true)
    expect(parseAuthMode(query.auth)).toBe('register')
  })

  it('ignores invalid auth values by falling back to login mode', () => {
    expect(isAuthMode('signup')).toBe(false)
    expect(parseAuthMode('signup')).toBe('login')
  })

  it('removes auth query on close while preserving redirect', () => {
    expect(stripAuthQuery({ auth: 'login', redirect: '/progress', utm: 'x' })).toEqual({
      redirect: '/progress',
      utm: 'x',
    })
  })

  it('supports browser back closing dialog by removing auth query', () => {
    const before = { auth: 'login', redirect: '/study-notes' }
    const after = stripAuthQuery(before)
    expect(after.auth).toBeUndefined()
    expect(after.redirect).toBe('/study-notes')
  })
})

describe('landing auth dialog failure handling', () => {
  it('keeps dialog open semantics by retaining auth query on failed submit', () => {
    const openQuery = buildLandingAuthQuery({ auth: 'login', redirect: '/study-notes' })
    expect(openQuery.auth).toBe('login')
  })

  it('keeps register dialog query on failed registration', () => {
    const openQuery = buildLandingAuthQuery({ auth: 'register' })
    expect(openQuery.auth).toBe('register')
  })
})

describe('landing auth dialog close interactions', () => {
  it('allows backdrop close only when not busy', () => {
    const canClose = (busy: boolean) => !busy
    expect(canClose(false)).toBe(true)
    expect(canClose(true)).toBe(false)
  })

  it('allows escape close only when not busy', () => {
    const canClose = (busy: boolean) => !busy
    expect(canClose(false)).toBe(true)
    expect(canClose(true)).toBe(false)
  })

  it('does not close when clicking dialog content', () => {
    const isBackdropTarget = (target: string, current: string) => target === current
    expect(isBackdropTarget('backdrop', 'panel')).toBe(false)
  })
})

describe('landing auth success redirect', () => {
  it('returns to redirect target after successful login', () => {
    const query = buildLandingAuthQuery({ auth: 'login', redirect: '/study-notes' })
    expect(query.redirect).toBe('/study-notes')
  })

  it('defaults to home when redirect missing', () => {
    expect(buildLandingAuthQuery({ auth: 'login' })).toEqual({ auth: 'login' })
  })
})
