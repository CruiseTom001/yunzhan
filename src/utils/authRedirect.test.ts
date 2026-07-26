import { describe, expect, it } from 'vitest'
import {
  buildLandingAuthQuery,
  buildLoginCompatRedirect,
  buildUnauthenticatedGuardRedirect,
  parseAuthMode,
  readSafeRedirect,
  stripAuthQuery,
} from './authRedirect'

describe('authRedirect', () => {
  it('parses valid auth modes', () => {
    expect(parseAuthMode('login')).toBe('login')
    expect(parseAuthMode('register')).toBe('register')
    expect(parseAuthMode('forgot-password')).toBe('forgot-password')
  })

  it('falls back invalid auth values to login', () => {
    expect(parseAuthMode('signup')).toBe('login')
    expect(parseAuthMode('')).toBe('login')
    expect(parseAuthMode(null)).toBe('login')
  })

  it('accepts safe internal redirect paths', () => {
    expect(readSafeRedirect('/study-notes')).toBe('/study-notes')
    expect(readSafeRedirect('/progress')).toBe('/progress')
  })

  it('rejects protocol-relative redirect paths', () => {
    expect(readSafeRedirect('//evil.example')).toBe('/')
  })

  it('rejects javascript protocol redirects', () => {
    expect(readSafeRedirect('javascript:alert(1)')).toBe('/')
  })

  it('rejects external URL redirects', () => {
    expect(readSafeRedirect('https://evil.example')).toBe('/')
  })

  it('rejects login route redirect loops', () => {
    expect(readSafeRedirect('/login')).toBe('/')
    expect(readSafeRedirect('/login?mode=register')).toBe('/')
  })

  it('rejects auth query redirect loops', () => {
    expect(readSafeRedirect('/landing?auth=login')).toBe('/')
  })

  it('builds landing auth query with redirect', () => {
    expect(buildLandingAuthQuery({ auth: 'login', redirect: '/study-notes' })).toEqual({
      auth: 'login',
      redirect: '/study-notes',
    })
  })

  it('omits default redirect from landing auth query', () => {
    expect(buildLandingAuthQuery({ auth: 'register', redirect: '/' })).toEqual({
      auth: 'register',
    })
  })

  it('converts /login compat redirect with register mode', () => {
    expect(buildLoginCompatRedirect({ mode: 'register', redirect: '/study-notes' })).toEqual({
      name: 'landing',
      query: { auth: 'register', redirect: '/study-notes' },
    })
  })

  it('converts /login compat redirect without mode to login', () => {
    expect(buildLoginCompatRedirect({ redirect: '/progress' })).toEqual({
      name: 'landing',
      query: { auth: 'login', redirect: '/progress' },
    })
  })

  it('converts forgot-password compat mode', () => {
    expect(buildLoginCompatRedirect({ mode: 'forgot-password' })).toEqual({
      name: 'landing',
      query: { auth: 'forgot-password' },
    })
  })

  it('strips auth query while preserving redirect', () => {
    expect(stripAuthQuery({ auth: 'login', redirect: '/study-notes', foo: 'bar' })).toEqual({
      redirect: '/study-notes',
      foo: 'bar',
    })
  })

  it('sends unauthenticated home visits to landing without login dialog', () => {
    expect(buildUnauthenticatedGuardRedirect('/')).toEqual({ name: 'landing' })
  })

  it('sends unauthenticated learning route visits to landing login dialog', () => {
    expect(buildUnauthenticatedGuardRedirect('/courses')).toEqual({
      name: 'landing',
      query: { auth: 'login', redirect: '/courses' },
    })
    expect(buildUnauthenticatedGuardRedirect('/course/linux-basics')).toEqual({
      name: 'landing',
      query: { auth: 'login', redirect: '/course/linux-basics' },
    })
  })
})
