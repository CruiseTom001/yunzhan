import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const mainSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'main.cjs'),
  'utf8',
)
const preloadSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'preload.cjs'),
  'utf8',
)

describe('electron auth security wiring', () => {
  it('keeps hardened BrowserWindow settings', () => {
    expect(mainSource).toContain('contextIsolation: true')
    expect(mainSource).toContain('nodeIntegration: false')
    expect(mainSource).toContain('sandbox: true')
  })

  it('restores encrypted session before creating the window', () => {
    expect(mainSource).toContain('restoreAutoLoginSessionToCookies')
    expect(mainSource).toMatch(/finally[\s\S]*createWindow\(/)
  })

  it('does not persist auto login from Set-Cookie handler', () => {
    expect(mainSource).not.toMatch(/updateDesktopApiCookies[\s\S]*persistAutoLogin/)
  })

  it('does not expose session token IPC channels in preload', () => {
    expect(preloadSource).toContain('auth:getDesktopLoginPreferences')
    expect(preloadSource).toContain('auth:setDesktopLoginPreferences')
    expect(preloadSource).toContain('auth:clearDesktopAutoLogin')
    expect(preloadSource).not.toContain('getSessionToken')
    expect(preloadSource).not.toContain('readSession')
  })
})
