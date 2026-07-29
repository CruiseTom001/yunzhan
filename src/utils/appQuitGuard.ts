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
  for (const guard of guards) {
    const result = await guard()
    if (!result) {
      return {
        ok: false,
        message: '检测到未保存的内容，请先保存后再安装更新。',
      }
    }
  }
  return { ok: true }
}

export function resetAppQuitGuardsForTests(): void {
  guards.clear()
}
