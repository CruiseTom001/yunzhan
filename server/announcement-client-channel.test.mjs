import { describe, expect, it } from 'vitest'
import {
  ANNOUNCEMENT_CLIENT_CHANNEL_DESKTOP,
  ANNOUNCEMENT_CLIENT_CHANNEL_WEB,
  parseAnnouncementClientChannel,
  resolveAnnouncementClientChannelFromHeaders,
  resolveAnnouncementClientChannelFromRequest,
} from './announcement-client-channel.mjs'

describe('announcement client channel', () => {
  it('maps desktop header to desktop channel', () => {
    expect(parseAnnouncementClientChannel('desktop')).toBe(ANNOUNCEMENT_CLIENT_CHANNEL_DESKTOP)
    expect(parseAnnouncementClientChannel(' Desktop ')).toBe(ANNOUNCEMENT_CLIENT_CHANNEL_DESKTOP)
  })

  it('falls back to web for missing or invalid header values', () => {
    expect(parseAnnouncementClientChannel(undefined)).toBe(ANNOUNCEMENT_CLIENT_CHANNEL_WEB)
    expect(parseAnnouncementClientChannel(null)).toBe(ANNOUNCEMENT_CLIENT_CHANNEL_WEB)
    expect(parseAnnouncementClientChannel('')).toBe(ANNOUNCEMENT_CLIENT_CHANNEL_WEB)
    expect(parseAnnouncementClientChannel('web')).toBe(ANNOUNCEMENT_CLIENT_CHANNEL_WEB)
    expect(parseAnnouncementClientChannel('mobile')).toBe(ANNOUNCEMENT_CLIENT_CHANNEL_WEB)
  })

  it('reads channel from request headers case-insensitively', () => {
    expect(resolveAnnouncementClientChannelFromHeaders({ 'x-yunzhan-client': 'desktop' }))
      .toBe(ANNOUNCEMENT_CLIENT_CHANNEL_DESKTOP)
    expect(resolveAnnouncementClientChannelFromHeaders({})).toBe(ANNOUNCEMENT_CLIENT_CHANNEL_WEB)
    expect(resolveAnnouncementClientChannelFromRequest({
      headers: { 'x-yunzhan-client': 'desktop' },
    })).toBe(ANNOUNCEMENT_CLIENT_CHANNEL_DESKTOP)
  })
})
