import { describe, expect, it } from 'vitest'
import { storyMediaError } from './storyMedia'

const selected = (name: string, size: number, type: string) => ({ name, size, type })

describe('Story media selection', () => {
  it('accepts supported image and video files', () => {
    expect(storyMediaError(selected('ảnh.png', 1024, 'image/png'))).toBeNull()
    expect(storyMediaError(selected('clip.MP4', 150 * 1024 * 1024, 'video/mp4'))).toBeNull()
  })

  it('rejects unsupported or disguised media before upload', () => {
    expect(storyMediaError(selected('graphic.svg', 1024, 'image/svg+xml'))).toContain('Chỉ hỗ trợ')
    expect(storyMediaError(selected('photo.png', 1024, 'video/mp4'))).toContain('Chỉ hỗ trợ')
  })

  it('enforces server size limits', () => {
    expect(storyMediaError(selected('empty.jpg', 0, 'image/jpeg'))).toContain('20 MB')
    expect(storyMediaError(selected('large.png', 20 * 1024 * 1024 + 1, 'image/png'))).toContain('20 MB')
    expect(storyMediaError(selected('large.mov', 150 * 1024 * 1024 + 1, 'video/quicktime'))).toContain('150 MB')
  })
})
