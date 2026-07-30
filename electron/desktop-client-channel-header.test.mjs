import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const mainSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'main.cjs'),
  'utf8',
)

describe('electron desktop client channel header', () => {
  it('injects X-Yunzhan-Client: desktop in main-process API requests', () => {
    expect(mainSource).toContain("'X-Yunzhan-Client': 'desktop'")
    expect(mainSource).toContain('registerDesktopApiHeaders')
    expect(mainSource).toContain("target.pathname.startsWith('/api/')")
  })
})
