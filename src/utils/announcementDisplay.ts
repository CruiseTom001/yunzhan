import type { AnnouncementCategory } from '@/utils/announcementApi'

export function formatAnnouncementCategory(category: AnnouncementCategory): string {
  switch (category) {
    case 'web_release':
      return '网站更新'
    case 'desktop_release':
      return '桌面端更新'
    default:
      return '公告'
  }
}

export function formatAnnouncementDate(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export const ANNOUNCEMENT_PAGE_SIZE = 20

export const ANNOUNCEMENT_LOAD_ERROR_MESSAGE = '公告加载失败，请稍后重试。'

export const ANNOUNCEMENT_ONBOARDING_BLOCK_MESSAGE = '请先完成或退出新手教程。'

export const ANNOUNCEMENT_DESKTOP_UPDATE_BLOCK_MESSAGE = '请先处理桌面端更新提示。'
