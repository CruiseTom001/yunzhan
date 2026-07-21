const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
const API_TIMEOUT_MS = 15_000
let apiBaseUrlPromise: Promise<string> | null = null

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number
}

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readErrorMessage(value: unknown) {
  return isRecord(value) && typeof value.error === 'string' ? value.error : '请求失败，请稍后重试。'
}

function normalizeApiBaseUrl(value: unknown) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null
  if (value.startsWith('/') && !value.startsWith('//')) return value.replace(/\/$/, '')
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' && !(import.meta.env.DEV && parsed.protocol === 'http:')) return null
    return parsed.origin
  } catch {
    return null
  }
}

function resolveApiBaseUrl() {
  if (apiBaseUrlPromise) return apiBaseUrlPromise
  apiBaseUrlPromise = window.electronAPI
    ? window.electronAPI.invoke('app:getApiBaseUrl').then((value) => {
      const normalized = normalizeApiBaseUrl(value)
      if (!normalized) throw new ApiError('桌面端尚未配置云栈账号服务地址。', 0, null)
      return `${normalized}/api`
    })
    : Promise.resolve(normalizeApiBaseUrl(configuredApiBaseUrl) ?? '/api')
  return apiBaseUrlPromise
}

export async function apiRequest(path: string, options: ApiRequestOptions = {}): Promise<unknown> {
  const { timeoutMs = API_TIMEOUT_MS, ...fetchOptions } = options
  const apiBaseUrl = await resolveApiBaseUrl()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const headers = new Headers(fetchOptions.headers)
  headers.set('Accept', 'application/json')
  if (fetchOptions.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (window.electronAPI) {
    headers.set('X-Yunzhan-Client', 'desktop')
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      signal: controller.signal,
    })
    const contentType = response.headers.get('content-type') ?? ''
    const payload: unknown = contentType.includes('application/json')
      ? await response.json()
      : null
    if (!response.ok) {
      throw new ApiError(readErrorMessage(payload), response.status, payload)
    }
    return payload
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('服务器响应超时。', 0, null)
    }
    throw new ApiError('无法连接云栈账号服务。', 0, null)
  } finally {
    clearTimeout(timeoutId)
  }
}
