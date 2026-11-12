export const POST_FEELINGS = [
  { id: 'happy', emoji: '😊', label: 'vui vẻ' },
  { id: 'loved', emoji: '🥰', label: 'hạnh phúc' },
  { id: 'excited', emoji: '🤩', label: 'hào hứng' },
  { id: 'peaceful', emoji: '😌', label: 'bình yên' },
  { id: 'grateful', emoji: '🙏', label: 'biết ơn' },
  { id: 'lovely', emoji: '😍', label: 'yêu đời' },
  { id: 'sad', emoji: '😔', label: 'buồn' },
  { id: 'anxious', emoji: '😟', label: 'lo lắng' },
  { id: 'tired', emoji: '😴', label: 'mệt mỏi' },
] as const

export function feelingPostLine(id: string): string {
  const feeling = POST_FEELINGS.find(item => item.id === id)
  return feeling ? `${feeling.emoji} Đang cảm thấy ${feeling.label}` : ''
}
