import type { StoryBackground } from '../types'

export const STORY_TEXT_LIMIT = 200
export const STORY_BACKGROUNDS: Record<StoryBackground, string> = {
  berry: 'Tím hồng',
  indigo: 'Xanh tím',
  teal: 'Xanh ngọc',
  sunset: 'Cam hoàng hôn',
}

export function storyTextLength(text: string) {
  return Array.from(text.trim()).length
}