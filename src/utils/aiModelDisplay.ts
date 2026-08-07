const KNOWN_MODEL_LABELS: Record<string, string> = {
  'z-ai/glm-5.2': 'GLM 5.2',
  'minimaxai/minimax-m3': 'MiniMAX M3',
}

function capitalizeWords(value: string): string {
  return value.replace(/(^|[\s-])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
}

/** Convert an internal model identifier into a readable label for user-facing UI. */
export function formatAiModelDisplayName(model: string): string {
  const normalized = model.trim()
  if (!normalized) return '未配置'
  const knownLabel = KNOWN_MODEL_LABELS[normalized.toLowerCase()]
  if (knownLabel) return knownLabel

  const shortName = normalized.split('/').pop() ?? normalized
  return capitalizeWords(shortName.replace(/[-_]+/g, ' '))
}
