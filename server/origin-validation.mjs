/**
 * 桌面端来源校验工具(纯函数,无副作用,便于单元测试)。
 *
 * 当 ALLOW_ELECTRON_FILE_ORIGIN=true 且请求头 X-Yunzhan-Client=desktop 时,
 * 兼容 Electron 实际可能产生的 Origin 形态:
 *   - 'null'      (file:// 页面在 Chromium 中 Origin 被封为 null)
 *   - file://...  (部分 Electron/Chromium 版本会暴露 file:// scheme)
 *   - 空/undefined (某些版本的 fetch 不携带 Origin)
 *
 * 不允许:
 *   - 任意 https:// / http:// 来源(普通网页跨域来源仍走 allowedOrigins 白名单)
 *   - 未携带 X-Yunzhan-Client: desktop 的请求
 *   - ALLOW_ELECTRON_FILE_ORIGIN=false 时的任何 Electron 来源
 */

/**
 * 判断 Origin 字符串是否属于 Electron file 来源的合法形态。
 */
export function isElectronFileOrigin(origin) {
  return !origin || origin === 'null' || origin.startsWith('file://')
}

/**
 * 综合判断当前请求是否应当被视为允许的桌面端来源。
 * 仅在以下条件全部成立时返回 true:
 *   1. allowElectron 为 true(ALLOW_ELECTRON_FILE_ORIGIN=true)
 *   2. xYunzhanClient === 'desktop'
 *   3. Origin 属于 Electron file 来源形态
 */
export function isDesktopOriginAllowed(origin, xYunzhanClient, allowElectron) {
  return allowElectron
    && xYunzhanClient === 'desktop'
    && isElectronFileOrigin(origin)
}
