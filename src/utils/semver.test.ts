import { describe, expect, it } from 'vitest'
import { compareVersions, isSemver } from './semver'

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0)
  })
  it('returns -1 when left lower (patch)', () => {
    expect(compareVersions('1.2.0', '1.2.1')).toBe(-1)
  })
  it('returns 1 when left higher (minor)', () => {
    expect(compareVersions('1.10.0', '1.2.5')).toBe(1)
  })
  it('compares major first', () => {
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1)
    expect(compareVersions('1.99.99', '2.0.0')).toBe(-1)
  })
  it('throws on malformed version', () => {
    expect(() => compareVersions('1.2', '1.2.0')).toThrow()
    expect(() => compareVersions('1.2.0', 'v1.2.0')).toThrow()
  })
})

describe('isSemver', () => {
  it('accepts x.y.z digits only', () => {
    expect(isSemver('1.2.0')).toBe(true)
    expect(isSemver('0.0.0')).toBe(true)
    expect(isSemver('12.345.6')).toBe(true)
  })
  it('rejects malformed', () => {
    expect(isSemver('1.2')).toBe(false)
    expect(isSemver('v1.2.0')).toBe(false)
    expect(isSemver('1.2.0-beta')).toBe(false)
    expect(isSemver('')).toBe(false)
  })
})
