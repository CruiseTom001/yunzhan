import { isDesktopRuntime } from '@/utils/desktopAuthPreferences'

export type DesktopCloseBehavior = 'ask' | 'quit' | 'tray'
export type DesktopCloseResolveAction = 'quit' | 'tray' | 'cancel'
export type DesktopCloseResolveReason = 'invalid_payload' | 'installing'

export interface DesktopCloseBehaviorState {
  closeBehavior: DesktopCloseBehavior
}

export interface DesktopCloseResolveInput {
  action: DesktopCloseResolveAction
  remember: boolean
}

export interface DesktopCloseRequestedPayload {
  behavior: DesktopCloseBehavior
}

export type DesktopCloseResolveResult =
  | { ok: true; action?: DesktopCloseResolveAction }
  | { ok: false; reason?: DesktopCloseResolveReason }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isDesktopCloseBehavior(value: unknown): value is DesktopCloseBehavior {
  return value === 'ask' || value === 'quit' || value === 'tray'
}

export function isDesktopCloseResolveAction(value: unknown): value is DesktopCloseResolveAction {
  return value === 'quit' || value === 'tray' || value === 'cancel'
}

export function isDesktopCloseResolveReason(value: unknown): value is DesktopCloseResolveReason {
  return value === 'invalid_payload' || value === 'installing'
}

export function parseCloseRequestedPayload(payload: unknown): DesktopCloseRequestedPayload | null {
  if (!isPlainObject(payload)) return null
  const behavior = payload.behavior
  if (!isDesktopCloseBehavior(behavior)) return null
  return { behavior }
}

export function parseCloseResolveInput(payload: unknown): DesktopCloseResolveInput | null {
  if (!isPlainObject(payload)) return null
  if (!isDesktopCloseResolveAction(payload.action)) return null
  return {
    action: payload.action,
    remember: payload.remember === true,
  }
}

export function parseCloseBehaviorState(payload: unknown): DesktopCloseBehaviorState | null {
  if (!isPlainObject(payload)) return null
  const closeBehavior = payload.closeBehavior
  if (!isDesktopCloseBehavior(closeBehavior)) return null
  return { closeBehavior }
}

export function parseCloseResolveResult(payload: unknown): DesktopCloseResolveResult | null {
  if (!isPlainObject(payload)) return null
  if (typeof payload.ok !== 'boolean') return null

  if (payload.ok) {
    if (payload.action === undefined) {
      return { ok: true }
    }
    if (!isDesktopCloseResolveAction(payload.action)) return null
    return { ok: true, action: payload.action }
  }

  if (payload.reason === undefined) {
    return { ok: false }
  }
  if (!isDesktopCloseResolveReason(payload.reason)) return null
  return { ok: false, reason: payload.reason }
}

export async function getDesktopCloseBehavior(): Promise<DesktopCloseBehaviorState | null> {
  if (!isDesktopRuntime() || !window.electronAPI?.getCloseBehavior) return null
  const payload = await window.electronAPI.getCloseBehavior()
  return parseCloseBehaviorState(payload)
}

export async function setDesktopCloseBehavior(
  closeBehavior: DesktopCloseBehavior,
): Promise<DesktopCloseBehaviorState | null> {
  if (!isDesktopRuntime() || !window.electronAPI?.setCloseBehavior) return null
  const payload = await window.electronAPI.setCloseBehavior({ closeBehavior })
  return parseCloseBehaviorState(payload)
}

export async function resetDesktopCloseBehavior(): Promise<DesktopCloseBehaviorState | null> {
  if (!isDesktopRuntime() || !window.electronAPI?.resetCloseBehavior) return null
  const payload = await window.electronAPI.resetCloseBehavior()
  return parseCloseBehaviorState(payload)
}

export async function resolveDesktopClose(
  input: DesktopCloseResolveInput,
): Promise<DesktopCloseResolveResult | null> {
  if (!isDesktopRuntime() || !window.electronAPI?.resolveDesktopClose) return null
  const payload: unknown = await window.electronAPI.resolveDesktopClose(input)
  return parseCloseResolveResult(payload)
}
