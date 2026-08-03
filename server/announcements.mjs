import {
  ANNOUNCEMENT_CLIENT_CHANNEL_DESKTOP,
  ANNOUNCEMENT_CLIENT_CHANNEL_WEB,
} from './announcement-client-channel.mjs'

export const ANNOUNCEMENT_CATEGORIES = new Set(['general', 'web_release', 'desktop_release'])
export const RELEASE_ANNOUNCEMENT_CATEGORIES = new Set(['web_release', 'desktop_release'])

const WEB_VISIBLE_ANNOUNCEMENT_CATEGORIES = ['general', 'web_release']
const DESKTOP_VISIBLE_ANNOUNCEMENT_CATEGORIES = ['general', 'desktop_release']

export function getVisibleAnnouncementCategoriesForChannel(channel) {
  if (channel === ANNOUNCEMENT_CLIENT_CHANNEL_DESKTOP) {
    return DESKTOP_VISIBLE_ANNOUNCEMENT_CATEGORIES
  }
  return WEB_VISIBLE_ANNOUNCEMENT_CATEGORIES
}

export const DEFAULT_ANNOUNCEMENT_CATEGORY = 'general'
export const ANNOUNCEMENT_VERSION_PATTERN = /^\d+\.\d+\.\d+$/
export const ANNOUNCEMENT_SOURCE_KEY_PATTERN = /^[a-z0-9][a-z0-9:._-]{2,159}$/i
export const ANNOUNCEMENT_COMMIT_PATTERN = /^[0-9a-f]{7,64}$/i

export function parseAnnouncementCategory(value) {
  if (typeof value !== 'string' || !ANNOUNCEMENT_CATEGORIES.has(value)) {
    return DEFAULT_ANNOUNCEMENT_CATEGORY
  }
  return value
}

export function readAnnouncementCategoryInput(value) {
  if (value === undefined) return { ok: true, value: undefined }
  if (typeof value !== 'string' || !ANNOUNCEMENT_CATEGORIES.has(value.trim())) {
    return { ok: false, value: null }
  }
  return { ok: true, value: value.trim() }
}

export function readAnnouncementVersionInput(value) {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, value: null }
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: null }
  if (trimmed.length > 32 || !ANNOUNCEMENT_VERSION_PATTERN.test(trimmed)) {
    return { ok: false, value: null }
  }
  return { ok: true, value: trimmed }
}

export function readAnnouncementSourceKeyInput(value) {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, value: null }
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: null }
  if (!ANNOUNCEMENT_SOURCE_KEY_PATTERN.test(trimmed)) return { ok: false, value: null }
  return { ok: true, value: trimmed }
}

export function readAnnouncementCommitInput(value) {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, value: null }
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: null }
  if (!ANNOUNCEMENT_COMMIT_PATTERN.test(trimmed)) return { ok: false, value: null }
  return { ok: true, value: trimmed.toLowerCase() }
}

function readNullableBoundedString(value, maxLength) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length >= 1 && trimmed.length <= maxLength ? trimmed : null
}

export function mapPublicAnnouncementRow(row) {
  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    publishedAt: new Date(row.published_at).getTime(),
    read: row.read === true,
    category: parseAnnouncementCategory(row.category),
    version: readNullableBoundedString(row.version, 32),
  }
}

export function mapAdminAnnouncementRow(row) {
  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    publishedAt: new Date(row.published_at).getTime(),
    active: row.active === true,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    category: parseAnnouncementCategory(row.category),
    version: readNullableBoundedString(row.version, 32),
    sourceKey: readNullableBoundedString(row.source_key, 160),
    sourceCommit: readNullableBoundedString(row.source_commit, 64),
    generatedByAi: row.generated_by_ai === true,
    generationProvider: readNullableBoundedString(row.generation_provider, 120),
    generationError: readNullableBoundedString(row.generation_error, 4000),
  }
}

export async function countVisibleAnnouncements(client, channel = ANNOUNCEMENT_CLIENT_CHANNEL_WEB) {
  const categories = getVisibleAnnouncementCategoriesForChannel(channel)
  const result = await client.query(
    `SELECT COUNT(*)::INTEGER AS count
       FROM announcements a
      WHERE a.active = true
        AND a.published_at <= NOW()
        AND a.category = ANY($1::text[])`,
    [categories],
  )
  return result.rows[0]?.count ?? 0
}

export async function countUnreadAnnouncements(
  client,
  userId,
  channel = ANNOUNCEMENT_CLIENT_CHANNEL_WEB,
) {
  const categories = getVisibleAnnouncementCategoriesForChannel(channel)
  const result = await client.query(
    `SELECT COUNT(*)::INTEGER AS count
       FROM announcements a
       LEFT JOIN announcement_reads r
         ON r.announcement_id = a.id AND r.user_id = $1
      WHERE a.active = true
        AND a.published_at <= NOW()
        AND r.user_id IS NULL
        AND a.category = ANY($2::text[])`,
    [userId, categories],
  )
  return result.rows[0]?.count ?? 0
}

export async function listVisibleAnnouncements(
  client,
  userId,
  pagination,
  channel = ANNOUNCEMENT_CLIENT_CHANNEL_WEB,
) {
  const { limit, offset } = pagination
  const categories = getVisibleAnnouncementCategoriesForChannel(channel)
  const [listResult, total, unreadTotal] = await Promise.all([
    client.query(
      `SELECT a.id, a.title, a.content, a.published_at, a.category, a.version,
              (r.user_id IS NOT NULL) AS read
         FROM announcements a
         LEFT JOIN announcement_reads r
           ON r.announcement_id = a.id AND r.user_id = $1
        WHERE a.active = true
          AND a.published_at <= NOW()
          AND a.category = ANY($4::text[])
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset, categories],
    ),
    countVisibleAnnouncements(client, channel),
    countUnreadAnnouncements(client, userId, channel),
  ])

  return {
    announcements: listResult.rows.map((row) => mapPublicAnnouncementRow(row)),
    total,
    unreadTotal,
    limit,
    offset,
  }
}

export async function findVisibleAnnouncement(
  client,
  announcementId,
  channel = ANNOUNCEMENT_CLIENT_CHANNEL_WEB,
) {
  const categories = getVisibleAnnouncementCategoriesForChannel(channel)
  const result = await client.query(
    `SELECT id
       FROM announcements
      WHERE id = $1
        AND active = true
        AND published_at <= NOW()
        AND category = ANY($2::text[])`,
    [announcementId, categories],
  )
  return result.rows[0] ?? null
}

export async function findLatestUnreadVisibleAnnouncement(
  client,
  userId,
  channel = ANNOUNCEMENT_CLIENT_CHANNEL_WEB,
) {
  const categories = getVisibleAnnouncementCategoriesForChannel(channel)
  const result = await client.query(
    `SELECT a.id, a.title, a.content, a.published_at
       FROM announcements a
       LEFT JOIN announcement_reads r
         ON r.announcement_id = a.id AND r.user_id = $1
      WHERE a.active = true
        AND a.published_at <= NOW()
        AND r.user_id IS NULL
        AND a.category = ANY($2::text[])
      ORDER BY a.published_at DESC, a.id DESC
      LIMIT 1`,
    [userId, categories],
  )
  return result.rows[0] ?? null
}

export async function markVisibleAnnouncementRead(
  client,
  userId,
  announcementId,
  channel = ANNOUNCEMENT_CLIENT_CHANNEL_WEB,
) {
  const visible = await findVisibleAnnouncement(client, announcementId, channel)
  if (!visible) return false

  await client.query(
    `INSERT INTO announcement_reads (user_id, announcement_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, announcement_id) DO NOTHING`,
    [userId, announcementId],
  )
  return true
}

export async function markAllVisibleAnnouncementsRead(
  client,
  userId,
  channel = ANNOUNCEMENT_CLIENT_CHANNEL_WEB,
) {
  // 按渠道可见类别批量标记已读：幂等（NOT EXISTS + ON CONFLICT DO NOTHING），
  // 返回本次实际新增的已读行数。
  const categories = getVisibleAnnouncementCategoriesForChannel(channel)
  const result = await client.query(
    `INSERT INTO announcement_reads (user_id, announcement_id)
     SELECT $1, a.id
       FROM announcements a
      WHERE a.active = true
        AND a.published_at <= NOW()
        AND a.category = ANY($2::text[])
        AND NOT EXISTS (
          SELECT 1 FROM announcement_reads r
           WHERE r.announcement_id = a.id AND r.user_id = $1
        )
     ON CONFLICT (user_id, announcement_id) DO NOTHING`,
    [userId, categories],
  )
  return result.rowCount ?? 0
}
