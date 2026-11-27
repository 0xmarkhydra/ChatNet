import { formatUiRelativeTime } from '@/shared/i18n/locale'

export function relativeStoryTime(date: string, justNow: string, now = Date.now(), locale = 'vi'): string {
  return formatUiRelativeTime(date, locale, justNow, now, Infinity)
}
