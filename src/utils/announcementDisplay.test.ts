import { describe, expect, it } from 'vitest'
import { formatAnnouncementCategory } from './announcementDisplay'

describe('announcementDisplay', () => {
  it('formats phase 2 announcement categories in Chinese', () => {
    expect(formatAnnouncementCategory('general')).toBe('公告')
    expect(formatAnnouncementCategory('web_release')).toBe('网站更新')
    expect(formatAnnouncementCategory('desktop_release')).toBe('桌面端更新')
  })
})
