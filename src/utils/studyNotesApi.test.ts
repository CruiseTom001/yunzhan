import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/apiClient', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '@/utils/apiClient'
import {
  deleteStudyNote,
  listStudyNotes,
  polishStudyNoteViaServer,
  saveStudyNote,
  testServerAiProvider,
} from './studyNotesApi'

const mockedApiRequest = vi.mocked(apiRequest)

const VALID_NOTE = {
  id: '1',
  date: '2026-07-21',
  content: '今天学了 Docker 网络。',
  polishedContent: '',
  aiProviderName: null,
  aiModel: null,
  createdAt: 1784563200000,
  updatedAt: 1784563200000,
}

function mockResponse(payload: unknown): ReturnType<typeof apiRequest> {
  return Promise.resolve(payload)
}

beforeEach(() => {
  mockedApiRequest.mockReset()
})

describe('studyNotesApi type guards', () => {
  it('parses note list', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ notes: [VALID_NOTE], total: 1, limit: 60, offset: 0 }))
    const result = await listStudyNotes()
    expect(result.total).toBe(1)
    expect(result.notes[0].date).toBe('2026-07-21')
  })

  it('rejects note list with invalid date', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ notes: [{ ...VALID_NOTE, date: 'bad' }], total: 1 }))
    await expect(listStudyNotes()).rejects.toThrow('包含无效数据')
  })

  it('saves note and parses returned note', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ note: { ...VALID_NOTE, polishedContent: '整理后内容' } }))
    const result = await saveStudyNote({
      date: '2026-07-21',
      content: '今天学了 Docker 网络。',
      polishedContent: '整理后内容',
      aiProviderName: '智谱 GLM',
      aiModel: 'glm-4',
    })
    expect(result.polishedContent).toBe('整理后内容')
    const body = JSON.parse(mockedApiRequest.mock.calls[0]?.[1]?.body as string)
    expect(body.aiProviderName).toBe('智谱 GLM')
  })

  it('rejects invalid save response', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(saveStudyNote({ date: '2026-07-21', content: '内容' })).rejects.toThrow('无效学习记录')
  })

  it('deletes note with ok payload', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(deleteStudyNote('2026-07-21')).resolves.toBeUndefined()
  })

  it('tests server AI provider and parses response', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      content: '连接成功',
      providerName: '云栈 AI',
      model: 'deepseek-chat',
    }))
    const result = await testServerAiProvider()
    expect(result.providerName).toBe('云栈 AI')
    expect(mockedApiRequest).toHaveBeenCalledWith('/study-notes/ai/test', expect.objectContaining({
      method: 'POST',
      timeoutMs: 65_000,
    }))
  })

  it('polishes through server AI endpoint', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      content: '今天系统学习了 Docker 网络。',
      providerName: '云栈 AI',
      model: 'deepseek-chat',
    }))
    const result = await polishStudyNoteViaServer('学了 Docker 网络')
    expect(result.content).toContain('Docker')
    expect(mockedApiRequest).toHaveBeenCalledWith('/study-notes/ai/polish', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ content: '学了 Docker 网络' }),
      timeoutMs: 65_000,
    }))
  })

  it('rejects invalid server AI response', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(testServerAiProvider()).rejects.toThrow('无效 AI 测试结果')
  })
})
