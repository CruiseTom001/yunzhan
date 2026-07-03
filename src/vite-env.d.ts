/// <reference types="vite/client" />

interface ElectronApi {
  platform: string
  version: string
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
}

interface Window {
  electronAPI?: ElectronApi
}
