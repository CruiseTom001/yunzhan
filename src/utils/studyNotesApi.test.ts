import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/apiClient', () => ({
  apiRequest: vi.fn(),
  resolveApiOrigin: vi.fn(() => 'https://yunzhan.vercel.app'),
}))

import { apiRequest, resolveApiOrigin } from '@/utils/apiClient'
import {
  deleteStudyNote,
  exportStudyNotesAsWord,
  listServerAiProviders,
  listStudyNotes,
  polishStudyNoteViaServer,
  polishStudyNoteViaServerStream,
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
  vi.mocked(resolveApiOrigin).mockReturnValue('https://yunzhan.vercel.app')
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
    const result = await testServerAiProvider('deepseek')
    expect(result.providerName).toBe('云栈 AI')
    expect(mockedApiRequest).toHaveBeenCalledWith('/study-notes/ai/test', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ providerId: 'deepseek' }),
      timeoutMs: 65_000,
    }))
  })

  it('polishes through server AI endpoint', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      content: '今天系统学习了 Docker 网络。',
      providerName: '云栈 AI',
      model: 'deepseek-chat',
    }))
    const result = await polishStudyNoteViaServer('学了 Docker 网络', 'glm')
    expect(result.content).toContain('Docker')
    expect(mockedApiRequest).toHaveBeenCalledWith('/study-notes/ai/polish', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ content: '学了 Docker 网络', providerId: 'glm' }),
      timeoutMs: 65_000,
    }))
  })

  it('omits providerId in polish request body when not provided', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      content: 'ok',
      providerName: '云栈 AI',
      model: 'm',
    }))
    await polishStudyNoteViaServer('内容')
    const body = JSON.parse(mockedApiRequest.mock.calls[0]?.[1]?.body as string)
    expect(body).toEqual({ content: '内容' })
  })

  it('rejects invalid server AI response', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(testServerAiProvider()).rejects.toThrow('无效 AI 测试结果')
  })

  it('parses server provider list', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      providers: [
        { id: 'deepseek', name: 'DeepSeek', format: 'chat_completions', model: 'deepseek-chat' },
        { id: 'glm', name: '智谱 GLM', format: 'chat_completions', model: 'glm-4-flash' },
      ],
    }))
    const providers = await listServerAiProviders()
    expect(providers).toHaveLength(2)
    expect(providers[0].id).toBe('deepseek')
    expect(providers[1].model).toBe('glm-4-flash')
    expect(mockedApiRequest).toHaveBeenCalledWith('/study-notes/ai/providers')
  })

  it('rejects invalid server provider list', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      providers: [{ id: 'bad', name: 'Bad', format: 'unsupported', model: 'm' }],
    }))
    await expect(listServerAiProviders()).rejects.toThrow('无效 AI 供应商列表')
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(listServerAiProviders()).rejects.toThrow('无效 AI 供应商列表')
  })
})

describe('studyNotesApi streaming', () => {
  function createSseResponse(lines) {
    const encoder = new TextEncoder()
    const chunks = lines.map(line => encoder.encode(line))
    let index = 0
    const stream = new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(chunks[index])
          index += 1
        } else {
          controller.close()
        }
      },
    })
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  it('streams delta content via callbacks', async () => {
    const deltas = []
    let doneResult = null

    const sseLines = [
      'event: delta\ndata: {"content":"今天"}\n\n',
      'event: delta\ndata: {"content":"学了"}\n\n',
      'event: delta\ndata: {"content":"Docker"}\n\n',
      'event: done\ndata: {"content":"今天学了Docker","providerName":"云栈 AI","model":"deepseek-chat"}\n\n',
    ]

    const originalFetch = globalThis.fetch
    let requestBody = ''
    vi.stubGlobal('fetch', async (_url, options) => {
      requestBody = options?.body as string
      return createSseResponse(sseLines)
    })

    try {
      await polishStudyNoteViaServerStream(
        '学了 Docker',
        'glm',
        (delta) => { deltas.push(delta) },
        (result) => { doneResult = result },
      )
    } finally {
      vi.stubGlobal('fetch', originalFetch)
    }

    expect(deltas).toEqual(['今天', '学了', 'Docker'])
    expect(doneResult).toEqual({
      content: '今天学了Docker',
      providerName: '云栈 AI',
      model: 'deepseek-chat',
    })
    expect(JSON.parse(requestBody)).toEqual({ content: '学了 Docker', providerId: 'glm' })
  })

  it('throws on error event from server', async () => {
    const sseLines = [
      'event: error\ndata: {"error":"服务端 AI 尚未配置。"}\n\n',
    ]

    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', async () => createSseResponse(sseLines))

    await expect(polishStudyNoteViaServerStream(
      '内容',
      null,
      () => {},
      () => {},
    )).rejects.toThrow('服务端 AI 尚未配置。')

    vi.stubGlobal('fetch', originalFetch)
  })
})

describe('studyNotesApi export word', () => {
  function mockFetch(overrides: { ok?: boolean; status?: number; body?: Blob | string; contentType?: string; headers?: Record<string, string> } = {}) {
    const body = overrides.body ?? new Blob(['mock docx'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const headers = new Headers({
      'content-type': overrides.contentType ?? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': "attachment; filename*=UTF-8''%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0_2026%E5%B9%B47%E6%9C%8824%E6%97%A5.docx",
      ...overrides.headers,
    })
    return Promise.resolve({
      ok: overrides.ok ?? true,
      status: overrides.status ?? 200,
      json: async () => {
        if (typeof overrides.body === 'string') {
          try { return JSON.parse(overrides.body) } catch { return {} }
        }
        return {}
      },
      blob: async () => body instanceof Blob ? body : new Blob([body], { type: 'text/plain' }),
      headers,
    })
  }

  it('returns blob and filename', async () => {
    vi.stubGlobal('fetch', () => mockFetch())
    const { blob, filename } = await exportStudyNotesAsWord(['2026-07-24'], 'raw')
    expect(blob).toBeInstanceOf(Blob)
    expect(filename).toBe('学习笔记_2026年7月24日.docx')
    vi.stubGlobal('fetch', globalThis.fetch)
  })

  it('throws on empty dates', async () => {
    await expect(exportStudyNotesAsWord([], 'raw')).rejects.toThrow('请至少选择一篇学习记录。')
  })

  it('throws on invalid date format', async () => {
    await expect(exportStudyNotesAsWord(['not-a-date'], 'raw')).rejects.toThrow('学习记录日期格式无效。')
  })

  it('throws on server error response', async () => {
    vi.stubGlobal('fetch', () => mockFetch({ ok: false, status: 400, body: JSON.stringify({ error: 'AI 供应商 id 格式无效。' }), contentType: 'application/json' }))
    await expect(exportStudyNotesAsWord(['2026-07-24'], 'ai-layout', { providerId: 'invalid' })).rejects.toThrow('AI 供应商 id 格式无效。')
    vi.stubGlobal('fetch', globalThis.fetch)
  })

  it('throws on empty blob', async () => {
    vi.stubGlobal('fetch', () => mockFetch({ body: new Blob() }))
    await expect(exportStudyNotesAsWord(['2026-07-24'], 'raw')).rejects.toThrow('文档生成失败，服务返回了空内容。')
    vi.stubGlobal('fetch', globalThis.fetch)
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('Network error')))
    await expect(exportStudyNotesAsWord(['2026-07-24'], 'raw')).rejects.toThrow('无法连接云栈账号服务。')
    vi.stubGlobal('fetch', globalThis.fetch)
  })

  it('sends providerId only for ai-layout mode', async () => {
    let capturedBody: string | null = null
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
      capturedBody = init.body as string
      return mockFetch()
    })
    await exportStudyNotesAsWord(['2026-07-24'], 'ai-layout', { providerId: 'deepseek_v3' })
    expect(capturedBody).toBeTruthy()
    const parsed = JSON.parse(capturedBody!)
    expect(parsed.providerId).toBe('deepseek_v3')
    expect(parsed.mode).toBe('ai-layout')
    expect(parsed.dates).toEqual(['2026-07-24'])
    vi.stubGlobal('fetch', globalThis.fetch)
  })

  it('omits providerId for raw mode', async () => {
    let capturedBody: string | null = null
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
      capturedBody = init.body as string
      return mockFetch()
    })
    await exportStudyNotesAsWord(['2026-07-24'], 'raw', { providerId: 'deepseek_v3' })
    const parsed = JSON.parse(capturedBody!)
    expect(parsed.providerId).toBeUndefined()
    vi.stubGlobal('fetch', globalThis.fetch)
  })
})
