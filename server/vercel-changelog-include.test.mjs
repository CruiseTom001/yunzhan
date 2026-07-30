import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('vercel function changelog packaging', () => {
  it('includes CHANGELOG.md for api/index.mjs without changing maxDuration', () => {
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
    expect(config.functions['api/index.mjs'].maxDuration).toBe(60)
    expect(config.functions['api/index.mjs'].includeFiles).toBe('CHANGELOG.md')
    expect(config.outputDirectory).toBe('dist')
    expect(Array.isArray(config.rewrites)).toBe(true)
  })
})
