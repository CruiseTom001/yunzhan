type QuitGuard = () => boolean | Promise<boolean>

const guards = new Set<QuitGuard>()

export function createContentDirtyGuard(
  getContent: () => string,
  getLastSavedContent: () => string,
): QuitGuard {
  return () => getContent().trim() === getLastSavedContent().trim()
}

export function registerAppQuitGuard(guard: QuitGuard): () => void {
  guards.add(guard)
  return () => {
    guards.delete(guard)
  }
}

export async function canQuitAppForUpdate(): Promise<{ ok: true } | { ok: false; message: string }> {
  return evaluateAppQuitGuards('检测到未保存的内容，请先保存后再安装更新。')
}

export async function canProceedWithAppClose(): Promise<{ ok: true } | { ok: false; message: string }> {
  return evaluateAppQuitGuards('检测到未保存的内容，关闭前请先保存或确认放弃更改。')
}

async function evaluateAppQuitGuards(
  blockedMessage: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (const guard of guards) {
    const result = await guard()
    if (!result) {
      return {
        ok: false,
        message: blockedMessage,
      }
    }
  }
  return { ok: true }
}

export function resetAppQuitGuardsForTests(): void {
  guards.clear()
}
