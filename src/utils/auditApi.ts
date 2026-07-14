import { apiRequest } from '@/utils/apiClient'

export interface AuditUserReference {
  id: string
  username: string
  displayName: string
}

export interface AuditLogEntry {
  id: string
  action: string
  metadata: Record<string, unknown>
  createdAt: number
  actor: AuditUserReference | null
  target: AuditUserReference | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function readUserReference(value: unknown): AuditUserReference | null {
  if (value === null) return null
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.username !== 'string'
    || typeof value.displayName !== 'string'
  ) return null
  return { id: value.id, username: value.username, displayName: value.displayName }
}

function readAuditLog(value: unknown): AuditLogEntry | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.action !== 'string'
    || !isRecord(value.metadata)
    || !isTimestamp(value.createdAt)
  ) return null
  const actor = readUserReference(value.actor)
  const target = readUserReference(value.target)
  if ((value.actor !== null && actor === null) || (value.target !== null && target === null)) return null
  return {
    id: value.id,
    action: value.action,
    metadata: value.metadata,
    createdAt: value.createdAt,
    actor,
    target,
  }
}

export async function listAuditLogs(input: { query?: string; action?: string; limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams({
    query: input.query ?? '',
    action: input.action ?? '',
    limit: String(input.limit ?? 50),
    offset: String(input.offset ?? 0),
  })
  const payload = await apiRequest(`/admin/audit-logs?${params.toString()}`)
  if (!isRecord(payload) || !Array.isArray(payload.logs) || !Number.isInteger(payload.total)) {
    throw new Error('账号服务返回了无效审计日志。')
  }
  const logs = payload.logs.map(readAuditLog)
  if (logs.some(log => log === null)) throw new Error('审计日志包含无效数据。')
  return {
    logs: logs.filter((log): log is AuditLogEntry => log !== null),
    total: payload.total as number,
  }
}
