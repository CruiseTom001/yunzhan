import { describe, expect, it } from 'vitest'
import {
  buildClearSessionCookieOptions,
  buildSessionCookieOptions,
  parseLoginRememberInput,
  readSessionTokenFromLoginResponse,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from './auth-session.mjs'

describe('auth session cookie helpers', () => {
  it('defaults remember to true when field is missing', () => {
    expect(parseLoginRememberInput({ username: 'user', password: 'secret' }))
      .toEqual({ ok: true, value: true })
  })

  it('accepts explicit remember boolean', () => {
    expect(parseLoginRememberInput({ remember: false })).toEqual({ ok: true, value: false })
    expect(parseLoginRememberInput({ remember: true })).toEqual({ ok: true, value: true })
  })

  it('rejects invalid remember types', () => {
    expect(parseLoginRememberInput({ remember: 'true' }).ok).toBe(false)
    expect(parseLoginRememberInput({ remember: 1 }).ok).toBe(false)
  })

  it('builds persistent cookie options when remember is true', () => {
    expect(buildSessionCookieOptions(true, { secure: true, sameSite: 'lax' })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_MS,
    })
  })

  it('builds session cookie options without maxAge when remember is false', () => {
    const options = buildSessionCookieOptions(false, { secure: false, sameSite: 'strict' })
    expect(options).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
    })
    expect(options.maxAge).toBeUndefined()
    expect(options.expires).toBeUndefined()
  })

  it('clears cookie with secure attributes only', () => {
    expect(buildClearSessionCookieOptions({ secure: true, sameSite: 'lax' })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    })
  })

  it('detects leaked session token fields in login JSON', () => {
    expect(readSessionTokenFromLoginResponse({ user: { id: '1' }, token: 'x' })).toBeNull()
    expect(readSessionTokenFromLoginResponse({ user: { id: '1' }, sessionToken: 'x' })).toBeNull()
    expect(readSessionTokenFromLoginResponse({ user: { id: '1' } })).toEqual({ user: { id: '1' } })
  })

  it('uses stable session cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('yunzhan_session')
  })
})
