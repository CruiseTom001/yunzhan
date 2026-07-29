/// <reference types="vite/client" />

export {}

declare global {
  const __APP_VERSION__: string

  type DesktopUpdaterPublicState = import('@/utils/desktopUpdaterTypes').DesktopUpdaterPublicState

  interface DesktopApiRequestInput {
    path: string
    method?: string
    headers?: Record<string, string>
    body?: string
    timeoutMs?: number
  }

  interface DesktopApiResponse {
    ok: boolean
    status: number
    payload: unknown
  }

  interface ElectronApi {
    platform: string
    version: string
    invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
    getUpdaterState: () => Promise<DesktopUpdaterPublicState>
    checkForDesktopUpdate: () => Promise<DesktopUpdaterPublicState>
    downloadDesktopUpdate: () => Promise<DesktopUpdaterPublicState>
    installDesktopUpdate: () => Promise<DesktopUpdaterPublicState>
    onDesktopUpdaterStateChanged: (listener: (state: DesktopUpdaterPublicState) => void) => () => void
  }

  interface Window {
    electronAPI?: ElectronApi
  }
}
