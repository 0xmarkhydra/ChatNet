import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const children = [
  'ConversationHeader',
  'ConversationList',
  'MessageComposer',
  'MessageTimeline',
  'PinnedItemsPanel',
] as const

describe('ChatSection component dependency boundaries', () => {
  it.each(children)('%s consumes the shared props contract without importing ChatSection', (component) => {
    const source = readFileSync(new URL(`./${component}.tsx`, import.meta.url), 'utf8')
    expect(source).toContain('import type { ChatSectionProps } from "./ChatSectionProps"')
    expect(source).not.toMatch(/from\s*['"]\.\/ChatSection['"]/)
  })
})
