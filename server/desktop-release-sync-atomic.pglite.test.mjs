import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import {
  applyTrackedMigrationsUpTo,
} from '../scripts/verify-announcement-phase2-lib.mjs'
import { createDisabledDesktopReleaseRecord } from './desktop-release-sync.mjs'

const DOWNLOAD_URL = 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.7/yunzhan-setup-1.2.7.exe'

describe('desktop release create atomicity (PGLite)', () => {
  /** @type {PGlite | null} */
  let db = null

  beforeEach(async () => {
    db = new PGlite()
    await applyTrackedMigrationsUpTo(db, '012_announcement_release_generation.sql')
  })

  afterEach(async () => {
    if (db) {
      await db.close()
      db = null
    }
  })

  it('creates disabled release with system audit atomically', async () => {
    const result = await createDisabledDesktopReleaseRecord(db, {
      version: '1.2.7',
      minSupported: '1.2.5',
      downloadUrl: DOWNLOAD_URL,
      releaseNotes: '修复桌面端更新失败后无法正确重试的问题。',
      audit: {
        action: 'desktop_release.sync_from_github',
        actorUserId: null,
        targetUserId: null,
        metadata: {
          deliveryId: '11111111-1111-4111-8111-111111111111',
          repository: 'CruiseTom001/yunzhan',
          releaseId: '99',
          tag: 'v1.2.7',
          source: 'github_webhook',
        },
      },
    })

    expect(result.created).toBe(true)
    expect(result.release.enabled).toBe(false)

    const releases = await db.query('SELECT version, enabled FROM desktop_releases WHERE version = $1', ['1.2.7'])
    const audits = await db.query(
      `SELECT action, actor_user_id, metadata FROM audit_logs WHERE action = 'desktop_release.sync_from_github'`,
    )
    expect(releases.rows).toHaveLength(1)
    expect(releases.rows[0].enabled).toBe(0)
    expect(audits.rows).toHaveLength(1)
    expect(audits.rows[0].actor_user_id).toBeNull()
    expect(audits.rows[0].metadata.version).toBe('1.2.7')
    expect(JSON.stringify(audits.rows[0].metadata)).not.toContain(DOWNLOAD_URL)
  })

  it('rolls back release when audit insert fails', async () => {
    await db.exec(`
      ALTER TABLE audit_logs
        ADD CONSTRAINT audit_logs_deny_desktop_sync_fail
        CHECK (action <> 'desktop_release.sync_from_github_fail')
    `)

    let caught = null
    try {
      await createDisabledDesktopReleaseRecord(db, {
        version: '1.2.7',
        minSupported: '1.2.5',
        downloadUrl: DOWNLOAD_URL,
        releaseNotes: '修复桌面端更新失败后无法正确重试的问题。',
        audit: {
          action: 'desktop_release.sync_from_github_fail',
          actorUserId: null,
          targetUserId: null,
          metadata: {
            deliveryId: '11111111-1111-4111-8111-111111111111',
            repository: 'CruiseTom001/yunzhan',
            releaseId: '99',
            tag: 'v1.2.7',
            source: 'github_webhook',
          },
        },
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeTruthy()
    const releases = await db.query('SELECT id FROM desktop_releases WHERE version = $1', ['1.2.7'])
    const audits = await db.query(`SELECT id FROM audit_logs WHERE action LIKE 'desktop_release.sync%'`)
    expect(releases.rows).toHaveLength(0)
    expect(audits.rows).toHaveLength(0)
  })

  it('does not overwrite existing version and writes no second audit', async () => {
    await createDisabledDesktopReleaseRecord(db, {
      version: '1.2.7',
      minSupported: '1.2.5',
      downloadUrl: DOWNLOAD_URL,
      releaseNotes: '原说明',
      audit: {
        action: 'desktop_release.sync_from_github',
        actorUserId: null,
        targetUserId: null,
        metadata: {
          deliveryId: '11111111-1111-4111-8111-111111111111',
          repository: 'CruiseTom001/yunzhan',
          releaseId: '99',
          tag: 'v1.2.7',
          source: 'github_webhook',
        },
      },
    })

    const second = await createDisabledDesktopReleaseRecord(db, {
      version: '1.2.7',
      minSupported: '1.2.0',
      downloadUrl: DOWNLOAD_URL,
      releaseNotes: '新说明不应覆盖',
      audit: {
        action: 'desktop_release.sync_from_github',
        actorUserId: null,
        targetUserId: null,
        metadata: {
          deliveryId: '22222222-2222-4222-8222-222222222222',
          repository: 'CruiseTom001/yunzhan',
          releaseId: '100',
          tag: 'v1.2.7',
          source: 'github_webhook',
        },
      },
    })

    expect(second.created).toBe(false)
    expect(second.alreadyExists).toBe(true)
    expect(second.release.releaseNotes).toBe('原说明')
    expect(second.release.minSupported).toBe('1.2.5')

    const releases = await db.query('SELECT id FROM desktop_releases WHERE version = $1', ['1.2.7'])
    const audits = await db.query(
      `SELECT id FROM audit_logs WHERE action = 'desktop_release.sync_from_github'`,
    )
    expect(releases.rows).toHaveLength(1)
    expect(audits.rows).toHaveLength(1)
  })

  it('concurrent creates yield one release and one audit', async () => {
    const options = {
      version: '1.2.7',
      minSupported: '1.2.5',
      downloadUrl: DOWNLOAD_URL,
      releaseNotes: '修复桌面端更新失败后无法正确重试的问题。',
      audit: {
        action: 'desktop_release.sync_from_github',
        actorUserId: null,
        targetUserId: null,
        metadata: {
          deliveryId: '11111111-1111-4111-8111-111111111111',
          repository: 'CruiseTom001/yunzhan',
          releaseId: '99',
          tag: 'v1.2.7',
          source: 'github_webhook',
        },
      },
    }

    const [first, second] = await Promise.all([
      createDisabledDesktopReleaseRecord(db, options),
      createDisabledDesktopReleaseRecord(db, options),
    ])
    expect([first, second].filter(item => item.created)).toHaveLength(1)
    expect([first, second].filter(item => item.alreadyExists)).toHaveLength(1)

    const releases = await db.query('SELECT id FROM desktop_releases WHERE version = $1', ['1.2.7'])
    const audits = await db.query(
      `SELECT id FROM audit_logs WHERE action = 'desktop_release.sync_from_github'`,
    )
    expect(releases.rows).toHaveLength(1)
    expect(audits.rows).toHaveLength(1)
  })
})
