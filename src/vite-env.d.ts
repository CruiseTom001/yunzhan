/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ElectronApi {
  platform: string
  version: string
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
}

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

interface Window {
  electronAPI?: ElectronApi
}
