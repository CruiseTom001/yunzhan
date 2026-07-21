const { app, BrowserWindow, ipcMain, session, shell } = require('electron')
const fs = require('fs/promises')
const fsSync = require('fs')
const path = require('path')

const isDev = !app.isPackaged

const progressFileName = 'progress.json'
const backupFileName = 'progress.backup.json'
const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const aiAllowedFormats = new Set(['anthropic_messages', 'chat_completions', 'responses'])
const aiProviderNameMaxLength = 80
const aiBaseUrlMaxLength = 2048
const aiKeyMaxLength = 4096
const aiModelMaxLength = 128
const aiContentMaxLength = 20_000
const aiPolishedMaxLength = 30_000
const aiResponseMaxBytes = 100_000
const aiRequestTimeoutMs = 60_000
const aiProviderErrorMaxLength = 600
const aiProviderErrorKeys = ['message', 'detail', 'reason', 'type', 'code', 'param']

function normalizeAccountId(value) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || !accountIdPattern.test(value)) {
    throw new Error('invalid account id')
  }
  return value.toLowerCase()
}

function getProgressPaths(accountId = null) {
  const userDataDir = app.getPath('userData')
  const normalizedAccountId = normalizeAccountId(accountId)
  const dataDir = normalizedAccountId
    ? path.join(userDataDir, 'accounts', normalizedAccountId)
    : userDataDir
  return {
    dataDir,
    progressPath: path.join(dataDir, progressFileName),
    backupPath: path.join(dataDir, backupFileName),
    tempPath: path.join(dataDir, `${progressFileName}.tmp`),
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateBoundedString(value, maxLength, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} invalid`)
  }
  const normalized = value.trim()
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new Error(`${fieldName} invalid`)
  }
  return normalized
}

function validateAiProvider(value) {
  if (!isPlainObject(value)) throw new Error('provider invalid')
  const name = validateBoundedString(value.name, aiProviderNameMaxLength, 'provider name')
  const apiKey = validateBoundedString(value.apiKey, aiKeyMaxLength, 'api key')
  const model = validateBoundedString(value.model, aiModelMaxLength, 'model')
  if (typeof value.format !== 'string' || !aiAllowedFormats.has(value.format)) {
    throw new Error('format invalid')
  }
  if (typeof value.baseUrl !== 'string' || value.baseUrl.trim().length > aiBaseUrlMaxLength) {
    throw new Error('base url invalid')
  }
  let baseUrl
  try {
    baseUrl = new URL(value.baseUrl.trim())
  } catch {
    throw new Error('base url invalid')
  }
  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error('base url invalid')
  }
  return {
    name,
    baseUrl: baseUrl.href.replace(/\/$/, ''),
    apiKey,
    format: value.format,
    model,
  }
}

function buildStudyNotePolishPrompt() {
  return [
    '你是云栈学习平台的学习记录润色助手。',
    '请保留用户自己的学习经历和事实，不新增没有依据的知识点。',
    '把内容整理成清晰、自然、适合复盘的中文学习记录。',
    '可以适当分段、修正错别字、补足表达，但不要写成营销文案。',
  ].join('\n')
}

function buildAiEndpoint(provider) {
  const endpointByFormat = {
    anthropic_messages: '/messages',
    chat_completions: '/chat/completions',
    responses: '/responses',
  }
  return `${provider.baseUrl.replace(/\/+$/, '')}${endpointByFormat[provider.format]}`
}

function buildAiRequest(provider, content, purpose = 'polish') {
  const systemPrompt = purpose === 'test'
    ? '请用中文简短回复“连接成功”。'
    : buildStudyNotePolishPrompt()
  if (provider.format === 'anthropic_messages') {
    return {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: {
        model: provider.model,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
        max_tokens: purpose === 'test' ? 64 : 2000,
      },
    }
  }
  if (provider.format === 'responses') {
    return {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: {
        model: provider.model,
        instructions: systemPrompt,
        input: content,
        temperature: 0.3,
        max_output_tokens: purpose === 'test' ? 64 : 2000,
      },
    }
  }
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: {
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      temperature: 0.3,
      max_tokens: purpose === 'test' ? 64 : 2000,
      stream: false,
    },
  }
}

async function readLimitedResponseText(response) {
  const reader = response.body && response.body.getReader ? response.body.getReader() : null
  if (!reader) return ''
  const chunks = []
  let total = 0
  let reading = true
  while (reading) {
    const { done, value } = await reader.read()
    if (done) {
      reading = false
      continue
    }
    total += value.byteLength
    if (total > aiResponseMaxBytes) {
      throw new Error('AI 供应商响应过大。')
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

function readTextPart(value) {
  if (typeof value === 'string') return value
  if (!isPlainObject(value)) return ''
  if (typeof value.text === 'string') return value.text
  if (typeof value.content === 'string') return value.content
  return ''
}

function parseChatCompletionContent(payload) {
  if (!isPlainObject(payload) || !Array.isArray(payload.choices)) return ''
  const choice = payload.choices[0]
  if (!isPlainObject(choice) || !isPlainObject(choice.message)) return ''
  return typeof choice.message.content === 'string' ? choice.message.content : ''
}

function parseAnthropicContent(payload) {
  if (!isPlainObject(payload)) return ''
  if (typeof payload.content === 'string') return payload.content
  if (!Array.isArray(payload.content)) return ''
  return payload.content.map(readTextPart).filter(Boolean).join('\n')
}

function parseResponsesContent(payload) {
  if (!isPlainObject(payload)) return ''
  if (typeof payload.output_text === 'string') return payload.output_text
  if (!Array.isArray(payload.output)) return ''
  return payload.output
    .flatMap(item => (isPlainObject(item) && Array.isArray(item.content) ? item.content : []))
    .map(readTextPart)
    .filter(Boolean)
    .join('\n')
}

function parseAiContent(payload, format, maxLength) {
  const content = format === 'anthropic_messages'
    ? parseAnthropicContent(payload)
    : format === 'responses'
      ? parseResponsesContent(payload)
      : parseChatCompletionContent(payload)
  const normalized = content.trim()
  return normalized.length >= 1 && normalized.length <= maxLength ? normalized : ''
}

function truncateAiProviderError(value) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > aiProviderErrorMaxLength
    ? `${normalized.slice(0, aiProviderErrorMaxLength)}...`
    : normalized
}

function redactAiProviderSecret(value, provider) {
  let redacted = value.replace(/Bearer\s+[^\s"'，。；;]+/gi, 'Bearer [已隐藏]')
  if (typeof provider.apiKey === 'string' && provider.apiKey.length >= 4) {
    redacted = redacted.split(provider.apiKey).join('[已隐藏]')
  }
  return redacted
}

function addAiProviderErrorPart(parts, value) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const normalized = String(value).trim()
    if (normalized && !parts.includes(normalized)) parts.push(normalized)
  }
}

function collectAiProviderErrorParts(value, parts) {
  if (parts.length >= 8) return
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    addAiProviderErrorPart(parts, value)
    return
  }
  if (Array.isArray(value)) {
    value.slice(0, 4).forEach(item => collectAiProviderErrorParts(item, parts))
    return
  }
  if (!isPlainObject(value)) return

  if (isPlainObject(value.error)) {
    collectAiProviderErrorParts(value.error, parts)
  } else {
    addAiProviderErrorPart(parts, value.error)
  }

  aiProviderErrorKeys.forEach(key => {
    addAiProviderErrorPart(parts, value[key])
  })

  if (Array.isArray(value.errors)) collectAiProviderErrorParts(value.errors, parts)
}

function extractAiProviderError(rawText, provider) {
  const parts = []
  try {
    collectAiProviderErrorParts(JSON.parse(rawText), parts)
  } catch {
    addAiProviderErrorPart(parts, rawText)
  }
  return truncateAiProviderError(redactAiProviderSecret(parts.join('；'), provider))
}

function buildAiProviderHttpError(response, rawText, provider) {
  const providerMessage = extractAiProviderError(rawText, provider)
  return providerMessage
    ? `AI 供应商返回错误：HTTP ${response.status}，${providerMessage}。`
    : `AI 供应商返回错误：HTTP ${response.status}。`
}

function isAiProviderTimeoutError(error) {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

function readAiProviderNetworkError(error) {
  if (!(error instanceof Error)) return ''
  if (isPlainObject(error.cause)) {
    const cause = error.cause
    if (typeof cause.code === 'string' && cause.code.trim()) return cause.code.trim()
    if (typeof cause.message === 'string' && cause.message.trim()) return cause.message.trim()
  }
  if (error.message && !/fetch failed/i.test(error.message)) return error.message
  return ''
}

async function requestAiProvider(input, purpose) {
  if (!isPlainObject(input)) throw new Error('payload invalid')
  const provider = validateAiProvider(input.provider)
  const content = purpose === 'test'
    ? '请测试当前模型连接。'
    : validateBoundedString(input.content, aiContentMaxLength, 'content')
  const requestPayload = buildAiRequest(provider, content, purpose)

  let response
  try {
    response = await fetch(buildAiEndpoint(provider), {
      method: 'POST',
      headers: requestPayload.headers,
      body: JSON.stringify(requestPayload.body),
      signal: AbortSignal.timeout(aiRequestTimeoutMs),
    })
  } catch (error) {
    const message = isAiProviderTimeoutError(error)
      ? 'AI 供应商响应超时。'
      : readAiProviderNetworkError(error)
        ? `无法连接 AI 供应商：${truncateAiProviderError(redactAiProviderSecret(readAiProviderNetworkError(error), provider))}。`
        : '无法连接 AI 供应商。'
    throw new Error(message)
  }

  const rawText = await readLimitedResponseText(response)
  if (!response.ok) throw new Error(buildAiProviderHttpError(response, rawText, provider))

  let payload
  try {
    payload = JSON.parse(rawText)
  } catch {
    throw new Error('AI 供应商返回了无效 JSON。')
  }

  const parsedContent = parseAiContent(payload, provider.format, purpose === 'test' ? 1000 : aiPolishedMaxLength)
  if (!parsedContent) throw new Error('AI 供应商返回内容无效。')
  return {
    content: parsedContent,
    providerName: provider.name,
    model: provider.model,
  }
}

function createContentSecurityPolicy() {
  const configuredApiOrigin = getConfiguredApiOrigin()
  const developmentConnections = isDev
    ? ' http://localhost:5173 http://127.0.0.1:5173 http://localhost:8787 http://127.0.0.1:8787 ws://localhost:5173 ws://127.0.0.1:5173'
    : ''
  const apiConnection = configuredApiOrigin ? ` ${configuredApiOrigin}` : ''
  return [
    "default-src 'self'",
    `connect-src 'self' https://api.deepseek.com${developmentConnections}${apiConnection}`,
    isDev ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

function getConfiguredApiOrigin() {
  const value = process.env.YUNZHAN_API_ORIGIN || readApiOriginFromConfig()
  if (!value) return isDev ? 'http://127.0.0.1:8787' : ''
  try {
    const target = new URL(value)
    if (target.protocol !== 'https:' && !(isDev && target.protocol === 'http:')) {
      console.warn('Ignored insecure YUNZHAN_API_ORIGIN.')
      return ''
    }
    return target.origin
  } catch {
    console.warn('Ignored invalid YUNZHAN_API_ORIGIN.')
    return ''
  }
}

function readApiOriginFromConfig() {
  const configPath = path.join(__dirname, 'api-config.json')
  try {
    const stats = fsSync.statSync(configPath)
    if (stats.size > 2048) return ''
    const parsed = JSON.parse(fsSync.readFileSync(configPath, 'utf8'))
    return parsed && typeof parsed === 'object' && typeof parsed.apiOrigin === 'string'
      ? parsed.apiOrigin.trim()
      : ''
  } catch {
    return ''
  }
}

function registerSecurityHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [createContentSecurityPolicy()],
        'X-Content-Type-Options': ['nosniff'],
      },
    })
  })
}

function registerIpc() {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getApiBaseUrl', () => getConfiguredApiOrigin())
  ipcMain.handle('app:openDataFolder', () => shell.openPath(app.getPath('userData')))
  ipcMain.handle('ai:polishStudyNote', async (_event, payload) => requestAiProvider(payload, 'polish'))
  ipcMain.handle('ai:testProvider', async (_event, provider) => requestAiProvider({ provider }, 'test'))

  ipcMain.handle('progress:load', async (_event, accountId) => {
    const { progressPath, backupPath } = getProgressPaths(accountId)
    const readJson = async (filePath, source) => {
      const raw = await fs.readFile(filePath, 'utf8')
      return {
        source,
        path: filePath,
        payload: JSON.parse(raw),
      }
    }

    try {
      return await readJson(progressPath, 'primary')
    } catch (primaryError) {
      try {
        return await readJson(backupPath, 'backup')
      } catch {
        if (primaryError && primaryError.code !== 'ENOENT') {
          console.warn('Failed to read progress file:', primaryError)
        }
        return null
      }
    }
  })

  ipcMain.handle('progress:save', async (_event, payload) => {
    // 深度防御：限制磁盘文件大小，防止异常大的 payload 撑爆 userData
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !payload.progress) {
      return { ok: false, error: 'invalid progress payload' }
    }
    const { dataDir, progressPath, backupPath, tempPath } = getProgressPaths(payload.accountId)
    await fs.mkdir(dataDir, { recursive: true })

    const payloadJson = JSON.stringify(payload)
    if (payloadJson.length > 10 * 1024 * 1024) {
      return { ok: false, error: 'payload too large', path: progressPath }
    }

    try {
      await fs.copyFile(progressPath, backupPath)
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        console.warn('Failed to refresh progress backup:', error)
      }
    }

    const envelope = {
      ...payload,
      version: 1,
      updatedAt: Date.now(),
    }
    await fs.writeFile(tempPath, JSON.stringify(envelope, null, 2), 'utf8')
    await fs.rename(tempPath, progressPath)

    return {
      ok: true,
      path: progressPath,
      updatedAt: envelope.updatedAt,
    }
  })

  ipcMain.handle('progress:clear', async (_event, accountId) => {
    const { progressPath, backupPath, tempPath } = getProgressPaths(accountId)
    await Promise.allSettled([
      fs.rm(progressPath, { force: true }),
      fs.rm(backupPath, { force: true }),
      fs.rm(tempPath, { force: true }),
    ])
    return { ok: true }
  })
}

function isExternalWebUrl(url) {
  try {
    const protocol = new URL(url).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function openExternalWebUrl(url) {
  if (!isExternalWebUrl(url)) return
  void shell.openExternal(url).catch(error => {
    console.warn('Failed to open external URL:', error)
  })
}

function isAllowedAppNavigation(url) {
  try {
    const target = new URL(url)
    if (!isDev) return target.protocol === 'file:'
    return target.origin === 'http://localhost:5173' || target.origin === 'http://127.0.0.1:5173'
  } catch {
    return false
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '云栈',
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalWebUrl(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAppNavigation(url)) return
    event.preventDefault()
    openExternalWebUrl(url)
  })

  // 隐藏菜单栏（生产环境）
  if (!isDev) {
    win.setMenuBarVisibility(false)
  }

  if (isDev) {
    // 开发模式：加载 Vite 开发服务器
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    // 生产模式：加载构建后的文件
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 监听页面标题变化，防止被页面修改
  win.on('page-title-updated', (e) => {
    e.preventDefault()
  })
}

app.whenReady().then(() => {
  registerSecurityHeaders()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
