/**
 * 受限 HTTPS 拉取：超时覆盖连接+响应头+正文；流式累计字节上限。
 * 整条调用（含重定向）共用一个总截止时间，重定向不得重置超时。
 */
import { createDesktopReleaseHttpError } from './desktop-release-manifest.mjs'

export const DEFAULT_LIMITED_FETCH_TIMEOUT_MS = 10_000
export const DEFAULT_LIMITED_FETCH_MAX_REDIRECTS = 5

function isAbortError(error) {
  if (!error || typeof error !== 'object') return false
  return error.name === 'AbortError' || error.code === 'ABORT_ERR'
}

function readContentLength(headers) {
  if (!headers || typeof headers.get !== 'function') return null
  const raw = headers.get('content-length')
  if (raw == null || raw === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

function cancelResponseBody(response) {
  try {
    void response?.body?.cancel?.()
  } catch {
    // ignore
  }
}

/**
 * @param {Response} response
 * @param {{ maxBytes: number, signal: AbortSignal, controller: AbortController }} options
 */
export async function readResponseBodyWithLimit(response, {
  maxBytes,
  signal,
  controller,
}) {
  const contentLength = readContentLength(response.headers)
  if (contentLength != null && contentLength > maxBytes) {
    controller.abort()
    cancelResponseBody(response)
    throw createDesktopReleaseHttpError(
      `响应 Content-Length 超过 ${maxBytes} 字节上限。`,
      400,
      'size_limit',
    )
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    // 测试 mock Response 可能没有 body reader；退化为 arrayBuffer，但仍先看 Content-Length。
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength > maxBytes) {
      throw createDesktopReleaseHttpError(
        `响应正文超过 ${maxBytes} 字节上限。`,
        400,
        'size_limit',
      )
    }
    return buffer
  }

  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  let sizeLimitExceeded = false

  const abortRead = () => {
    try {
      void reader.cancel()
    } catch {
      // ignore
    }
  }
  if (signal.aborted) {
    abortRead()
    throw createDesktopReleaseHttpError('请求超时。', 504, 'timeout')
  }
  signal.addEventListener('abort', abortRead, { once: true })

  try {
    while (true) {
      if (signal.aborted) {
        throw createDesktopReleaseHttpError('请求超时。', 504, 'timeout')
      }
      const { done, value } = await reader.read()
      if (done) {
        if (signal.aborted) {
          throw createDesktopReleaseHttpError('请求超时。', 504, 'timeout')
        }
        break
      }
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        sizeLimitExceeded = true
        abortRead()
        throw createDesktopReleaseHttpError(
          `响应正文超过 ${maxBytes} 字节上限。`,
          400,
          'size_limit',
        )
      }
      chunks.push(Buffer.from(value))
    }
  } catch (error) {
    if (sizeLimitExceeded || (error && typeof error === 'object' && error.code === 'size_limit')) {
      throw createDesktopReleaseHttpError(
        `响应正文超过 ${maxBytes} 字节上限。`,
        400,
        'size_limit',
      )
    }
    if (isAbortError(error) || signal.aborted) {
      throw createDesktopReleaseHttpError('请求超时。', 504, 'timeout')
    }
    if (error && typeof error === 'object' && Number.isInteger(error.statusCode)) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    throw createDesktopReleaseHttpError(`读取响应失败：${message}`, 502, 'response_read_failed')
  } finally {
    signal.removeEventListener('abort', abortRead)
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }

  return Buffer.concat(chunks, total)
}

/**
 * @param {string} url
 * @param {{
 *   fetchImplementation?: typeof fetch,
 *   maxBytes: number,
 *   timeoutMs?: number,
 *   maxRedirects?: number,
 *   allowedHosts: Set<string>,
 *   redirectMode?: 'manual' | 'error',
 *   headers?: Record<string, string>,
 *   method?: string,
 *   errorPrefix?: string,
 * }} options
 */
export async function limitedHttpsFetch(url, {
  fetchImplementation = fetch,
  maxBytes,
  timeoutMs = DEFAULT_LIMITED_FETCH_TIMEOUT_MS,
  maxRedirects = DEFAULT_LIMITED_FETCH_MAX_REDIRECTS,
  allowedHosts,
  redirectMode = 'manual',
  headers = {},
  method = 'GET',
  errorPrefix = '请求',
}) {
  if (!(allowedHosts instanceof Set) || allowedHosts.size === 0) {
    throw createDesktopReleaseHttpError('允许的主机列表无效。', 500, 'allowed_hosts_invalid')
  }
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw createDesktopReleaseHttpError('响应大小上限无效。', 500, 'max_bytes_invalid')
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw createDesktopReleaseHttpError('超时时间无效。', 500, 'timeout_invalid')
  }

  const controller = new AbortController()
  const deadlineAt = Date.now() + timeoutMs
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const throwIfDeadlineExceeded = () => {
    if (controller.signal.aborted || Date.now() >= deadlineAt) {
      throw createDesktopReleaseHttpError(`${errorPrefix} 超时。`, 504, 'timeout')
    }
  }

  try {
    let currentUrl = url
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      throwIfDeadlineExceeded()

      let parsed
      try {
        parsed = new URL(currentUrl)
      } catch {
        throw createDesktopReleaseHttpError(`${errorPrefix} URL 无效。`, 400, 'fetch_url_invalid')
      }
      if (parsed.protocol !== 'https:') {
        throw createDesktopReleaseHttpError(`${errorPrefix} 仅允许 HTTPS。`, 400, 'fetch_url_insecure')
      }
      if (!allowedHosts.has(parsed.hostname)) {
        throw createDesktopReleaseHttpError(
          `${errorPrefix} 目标不在允许的官方域名。`,
          400,
          'fetch_host_not_allowed',
        )
      }

      let response
      try {
        response = await fetchImplementation(currentUrl, {
          method,
          redirect: redirectMode,
          headers,
          signal: controller.signal,
        })
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          throw createDesktopReleaseHttpError(`${errorPrefix} 超时。`, 504, 'timeout')
        }
        const message = error instanceof Error ? error.message : String(error)
        throw createDesktopReleaseHttpError(`${errorPrefix} 失败：${message}`, 502, 'fetch_failed')
      }

      throwIfDeadlineExceeded()

      if (response.status >= 300 && response.status < 400) {
        if (redirectMode === 'error') {
          throw createDesktopReleaseHttpError(`${errorPrefix} 禁止重定向。`, 502, 'redirect_forbidden')
        }
        const location = response.headers.get('location')
        if (!location) {
          throw createDesktopReleaseHttpError(`${errorPrefix} 重定向缺少 Location。`, 502, 'redirect_missing')
        }
        // 丢弃重定向响应正文，避免无界占用；总超时计时器不重置。
        cancelResponseBody(response)
        currentUrl = new URL(location, currentUrl).toString()
        continue
      }

      if (!response.ok) {
        cancelResponseBody(response)
        throw createDesktopReleaseHttpError(
          `${errorPrefix} 失败（HTTP ${response.status}）。`,
          response.status === 404 ? 404 : 502,
          response.status === 404 ? 'not_found' : 'fetch_http',
        )
      }

      return await readResponseBodyWithLimit(response, {
        maxBytes,
        signal: controller.signal,
        controller,
      })
    }

    throw createDesktopReleaseHttpError(`${errorPrefix} 重定向次数过多。`, 502, 'redirect_limit')
  } finally {
    clearTimeout(timer)
  }
}
