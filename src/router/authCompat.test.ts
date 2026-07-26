import { describe, expect, it } from 'vitest'
import { buildLoginCompatRedirect } from '@/utils/authRedirect'

describe('router login compat redirect', () => {
  it('redirects /login to landing login dialog', () => {
    expect(buildLoginCompatRedirect({})).toEqual({
      name: 'landing',
      query: { auth: 'login' },
    })
  })

  it('redirects /login?mode=register to landing register dialog', () => {
    expect(buildLoginCompatRedirect({ mode: 'register' })).toEqual({
      name: 'landing',
      query: { auth: 'register' },
    })
  })

  it('preserves redirect when converting legacy login links', () => {
    expect(buildLoginCompatRedirect({ mode: 'register', redirect: '/study-notes' })).toEqual({
      name: 'landing',
      query: { auth: 'register', redirect: '/study-notes' },
    })
  })

  it('rejects malicious redirect in legacy login links', () => {
    expect(buildLoginCompatRedirect({ redirect: '//evil.example' })).toEqual({
      name: 'landing',
      query: { auth: 'login' },
    })
  })
})

describe('landing auth guard query', () => {
  it('builds protected-route login query for study notes', () => {
    expect({
      name: 'landing',
      query: { auth: 'login', redirect: '/study-notes' },
    }).toEqual({
      name: 'landing',
      query: { auth: 'login', redirect: '/study-notes' },
    })
  })
})
