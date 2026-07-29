export function formatByteSize(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatTransferSpeed(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return '—'
  return `${formatByteSize(value)}/s`
}
