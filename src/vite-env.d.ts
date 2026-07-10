/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ElectronApi {
  platform: string
  version: string
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
}

interface Window {
  electronAPI?: ElectronApi
}
