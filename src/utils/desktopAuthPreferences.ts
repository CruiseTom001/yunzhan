export const DESKTOP_AUTO_LOGIN_PERSIST_WARNING = '已登录，但自动登录信息保存失败，请重试。'

export interface DesktopLoginPreferences {
  rememberIdentifier: boolean
  autoLogin: boolean
  identifier: string
  autoLoginAvailable: boolean
  autoLoginDisabledReason: string | null
}

export interface DesktopLoginPreferencesInput {
  rememberIdentifier: boolean
  autoLogin: boolean
  identifier: string
}

export interface DesktopLoginPreferencesClearResult extends DesktopLoginPreferencesSaveResult {
  hadAutoLogin: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readDesktopLoginPreferences(value: unknown): DesktopLoginPreferences | null {
  if (!isRecord(value)) return null
  if (typeof value.rememberIdentifier !== 'boolean' || typeof value.autoLogin !== 'boolean') return null
  if (typeof value.identifier !== 'string') return null
  if (typeof value.autoLoginAvailable !== 'boolean') return null
  if (value.autoLoginDisabledReason !== null && typeof value.autoLoginDisabledReason !== 'string') return null
  return {
    rememberIdentifier: value.rememberIdentifier,
    autoLogin: value.autoLogin,
    identifier: value.identifier,
    autoLoginAvailable: value.autoLoginAvailable,
    autoLoginDisabledReason: typeof value.autoLoginDisabledReason === 'string'
      ? value.autoLoginDisabledReason
      : null,
  }
}

export interface DesktopLoginPreferencesSaveResult extends DesktopLoginPreferences {
  warning: string | null
}

function readDesktopLoginPreferencesSaveResult(value: unknown): DesktopLoginPreferencesSaveResult | null {
  const preferences = readDesktopLoginPreferences(value)
  if (!preferences || !isRecord(value)) return null
  if (value.warning !== null && typeof value.warning !== 'string') return null
  return {
    ...preferences,
    warning: typeof value.warning === 'string' ? value.warning : null,
  }
}

function readDesktopLoginPreferencesClearResult(value: unknown): DesktopLoginPreferencesClearResult | null {
  const saved = readDesktopLoginPreferencesSaveResult(value)
  if (!saved || !isRecord(value) || typeof value.hadAutoLogin !== 'boolean') return null
  return {
    ...saved,
    hadAutoLogin: value.hadAutoLogin,
  }
}

export function isDesktopRuntime() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI)
}

export async function getDesktopLoginPreferences(): Promise<DesktopLoginPreferences | null> {
  if (!window.electronAPI) return null
  const payload = await window.electronAPI.invoke('auth:getDesktopLoginPreferences')
  return readDesktopLoginPreferences(payload)
}

export async function setDesktopLoginPreferences(
  input: DesktopLoginPreferencesInput,
): Promise<DesktopLoginPreferencesSaveResult | null> {
  if (!window.electronAPI) return null
  const payload = await window.electronAPI.invoke('auth:setDesktopLoginPreferences', input)
  return readDesktopLoginPreferencesSaveResult(payload)
}

export function clearDesktopAutoLoginSession(
  options: { keepIdentifier?: boolean } = {},
): Promise<DesktopLoginPreferencesClearResult | null> {
  if (!window.electronAPI) return Promise.resolve(null)
  return window.electronAPI.invoke('auth:clearDesktopAutoLogin', {
    keepIdentifier: options.keepIdentifier === true,
  })
    .then((payload) => readDesktopLoginPreferencesClearResult(payload))
    .catch(() => null)
}

export async function syncDesktopLoginPreferencesAfterLogin(
  input: DesktopLoginPreferencesInput,
): Promise<DesktopLoginPreferencesSaveResult> {
  const result = await setDesktopLoginPreferences(input)
  if (result) return result
  return {
    rememberIdentifier: input.rememberIdentifier,
    autoLogin: false,
    identifier: input.rememberIdentifier ? input.identifier : '',
    autoLoginAvailable: false,
    autoLoginDisabledReason: '当前系统无法安全保存自动登录信息，已禁用自动登录。',
    warning: null,
  }
}
