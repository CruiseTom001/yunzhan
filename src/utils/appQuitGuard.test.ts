import { afterEach, describe, expect, it } from 'vitest'
import {
  canProceedWithAppClose,
  canQuitAppForUpdate,
  createContentDirtyGuard,
  registerAppQuitGuard,
  resetAppQuitGuardsForTests,
} from '@/utils/appQuitGuard'

afterEach(() => {
  resetAppQuitGuardsForTests()
})

describe('appQuitGuard', () => {
  it('allows install when content matches last saved state', async () => {
    const draft = { content: 'saved note', lastSaved: 'saved note' }
    registerAppQuitGuard(createContentDirtyGuard(() => draft.content, () => draft.lastSaved))
    await expect(canQuitAppForUpdate()).resolves.toEqual({ ok: true })
  })

  it('blocks install when content was edited but not saved', async () => {
    const draft = { content: 'edited note', lastSaved: 'saved note' }
    registerAppQuitGuard(createContentDirtyGuard(() => draft.content, () => draft.lastSaved))
    const result = await canQuitAppForUpdate()
    expect(result).toEqual({
      ok: false,
      message: '检测到未保存的内容，请先保存后再安装更新。',
    })
  })

  it('allows install after save syncs last saved content', async () => {
    const draft = { content: 'saved note', lastSaved: 'draft note' }
    registerAppQuitGuard(createContentDirtyGuard(() => draft.content, () => draft.lastSaved))
    draft.lastSaved = draft.content
    await expect(canQuitAppForUpdate()).resolves.toEqual({ ok: true })
  })

  it('unregisters guard after cleanup callback runs', async () => {
    const unregister = registerAppQuitGuard(() => false)
    unregister()
    await expect(canQuitAppForUpdate()).resolves.toEqual({ ok: true })
  })

  it('blocks install when any registered guard returns false', async () => {
    registerAppQuitGuard(() => true)
    registerAppQuitGuard(() => false)
    const result = await canQuitAppForUpdate()
    expect(result.ok).toBe(false)
  })

  it('treats blank new note as clean', async () => {
    registerAppQuitGuard(createContentDirtyGuard(() => '', () => ''))
    await expect(canQuitAppForUpdate()).resolves.toEqual({ ok: true })
  })

  it('blocks app close when content was edited but not saved', async () => {
    const draft = { content: 'edited note', lastSaved: 'saved note' }
    registerAppQuitGuard(createContentDirtyGuard(() => draft.content, () => draft.lastSaved))
    const result = await canProceedWithAppClose()
    expect(result).toEqual({
      ok: false,
      message: '检测到未保存的内容，关闭前请先保存或确认放弃更改。',
    })
  })
})
