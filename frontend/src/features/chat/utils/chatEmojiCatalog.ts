export type ChatEmoji = { emoji: string; label: string }
export type ChatEmojiGroup = { id: string; name: string; icon: string; emojis: ChatEmoji[] }

// One catalog for the message composer and the message reaction picker.
export const chatEmojiGroups: ChatEmojiGroup[] = [
  {
    id: 'faces', name: 'Cảm xúc', icon: '😀', emojis: [
      { emoji: '😀', label: 'Cười' }, { emoji: '😃', label: 'Cười tươi' },
      { emoji: '😄', label: 'Vui vẻ' }, { emoji: '😁', label: 'Cười rạng rỡ' },
      { emoji: '😆', label: 'Cười lớn' }, { emoji: '😅', label: 'Cười trừ' },
      { emoji: '🤣', label: 'Cười lăn' }, { emoji: '😂', label: 'Haha' },
      { emoji: '🙂', label: 'Mỉm cười' }, { emoji: '😊', label: 'Hạnh phúc' },
      { emoji: '😇', label: 'Thiên thần' }, { emoji: '🥰', label: 'Yêu thương' },
      { emoji: '😍', label: 'Mắt trái tim' }, { emoji: '😘', label: 'Hôn' },
      { emoji: '😋', label: 'Ngon miệng' }, { emoji: '😜', label: 'Nháy mắt' },
      { emoji: '🤪', label: 'Tinh nghịch' }, { emoji: '😎', label: 'Ngầu' },
      { emoji: '🤩', label: 'Thích thú' }, { emoji: '🥳', label: 'Ăn mừng' },
      { emoji: '😏', label: 'Cười nhếch' }, { emoji: '😒', label: 'Không hài lòng' },
      { emoji: '😔', label: 'Buồn' }, { emoji: '😢', label: 'Khóc' },
      { emoji: '😭', label: 'Khóc lớn' }, { emoji: '😤', label: 'Bực mình' },
      { emoji: '😡', label: 'Tức giận' }, { emoji: '😱', label: 'Sợ hãi' },
      { emoji: '😮', label: 'Bất ngờ' }, { emoji: '😲', label: 'Ngạc nhiên' },
      { emoji: '🥺', label: 'Năn nỉ' }, { emoji: '🤔', label: 'Suy nghĩ' },
      { emoji: '🫢', label: 'Che miệng' }, { emoji: '🤗', label: 'Ôm' },
      { emoji: '😴', label: 'Buồn ngủ' }, { emoji: '🤯', label: 'Bùng nổ' },
    ],
  },
  {
    id: 'gestures', name: 'Cử chỉ', icon: '👍', emojis: [
      { emoji: '👍', label: 'Thích' }, { emoji: '👎', label: 'Không thích' },
      { emoji: '👏', label: 'Vỗ tay' }, { emoji: '🙌', label: 'Giơ tay vui mừng' },
      { emoji: '👋', label: 'Vẫy tay' }, { emoji: '👌', label: 'OK' },
      { emoji: '✌️', label: 'Chiến thắng' }, { emoji: '🤞', label: 'Chúc may mắn' },
      { emoji: '🤟', label: 'Yêu bạn' }, { emoji: '🤘', label: 'Rock' },
      { emoji: '🤝', label: 'Bắt tay' }, { emoji: '🙏', label: 'Cảm ơn' },
      { emoji: '💪', label: 'Mạnh mẽ' }, { emoji: '👀', label: 'Đôi mắt' },
      { emoji: '💋', label: 'Dấu hôn' }, { emoji: '🫶', label: 'Tạo hình trái tim' },
    ],
  },
  {
    id: 'hearts', name: 'Trái tim', icon: '❤️', emojis: [
      { emoji: '❤️', label: 'Yêu thích' }, { emoji: '🩷', label: 'Tim hồng' },
      { emoji: '🧡', label: 'Tim cam' }, { emoji: '💛', label: 'Tim vàng' },
      { emoji: '💚', label: 'Tim xanh lá' }, { emoji: '💙', label: 'Tim xanh dương' },
      { emoji: '💜', label: 'Tim tím' }, { emoji: '🖤', label: 'Tim đen' },
      { emoji: '🤍', label: 'Tim trắng' }, { emoji: '💔', label: 'Tan vỡ' },
      { emoji: '💕', label: 'Hai trái tim' }, { emoji: '💖', label: 'Tim lấp lánh' },
      { emoji: '💘', label: 'Mũi tên tình yêu' }, { emoji: '💯', label: 'Một trăm điểm' },
    ],
  },
  {
    id: 'animals', name: 'Động vật', icon: '🐱', emojis: [
      { emoji: '🐶', label: 'Chó' }, { emoji: '🐱', label: 'Mèo' },
      { emoji: '🐭', label: 'Chuột' }, { emoji: '🐰', label: 'Thỏ' },
      { emoji: '🦊', label: 'Cáo' }, { emoji: '🐻', label: 'Gấu' },
      { emoji: '🐼', label: 'Gấu trúc' }, { emoji: '🐨', label: 'Gấu koala' },
      { emoji: '🐯', label: 'Hổ' }, { emoji: '🦁', label: 'Sư tử' },
      { emoji: '🐸', label: 'Ếch' }, { emoji: '🐷', label: 'Heo' },
      { emoji: '🐧', label: 'Chim cánh cụt' }, { emoji: '🦄', label: 'Kỳ lân' },
      { emoji: '🐝', label: 'Ong' }, { emoji: '🦋', label: 'Bướm' },
    ],
  },
  {
    id: 'food', name: 'Ăn uống', icon: '🍕', emojis: [
      { emoji: '🍎', label: 'Táo' }, { emoji: '🍓', label: 'Dâu tây' },
      { emoji: '🍉', label: 'Dưa hấu' }, { emoji: '🍌', label: 'Chuối' },
      { emoji: '🍔', label: 'Burger' }, { emoji: '🍟', label: 'Khoai tây chiên' },
      { emoji: '🍕', label: 'Pizza' }, { emoji: '🍣', label: 'Sushi' },
      { emoji: '🍜', label: 'Mì' }, { emoji: '🍰', label: 'Bánh ngọt' },
      { emoji: '🎂', label: 'Bánh sinh nhật' }, { emoji: '🍩', label: 'Bánh vòng' },
      { emoji: '☕', label: 'Cà phê' }, { emoji: '🧋', label: 'Trà sữa' },
      { emoji: '🍺', label: 'Bia' }, { emoji: '🥂', label: 'Cụng ly' },
    ],
  },
  {
    id: 'activities', name: 'Hoạt động', icon: '🎉', emojis: [
      { emoji: '🎉', label: 'Chúc mừng' }, { emoji: '🎊', label: 'Pháo giấy' },
      { emoji: '🎁', label: 'Quà tặng' }, { emoji: '🎈', label: 'Bóng bay' },
      { emoji: '🏆', label: 'Cúp' }, { emoji: '⚽', label: 'Bóng đá' },
      { emoji: '🏀', label: 'Bóng rổ' }, { emoji: '🎮', label: 'Trò chơi' },
      { emoji: '🎵', label: 'Âm nhạc' }, { emoji: '🎸', label: 'Đàn guitar' },
      { emoji: '🎨', label: 'Hội họa' }, { emoji: '🚀', label: 'Tên lửa' },
      { emoji: '✨', label: 'Lấp lánh' }, { emoji: '🔥', label: 'Bùng cháy' },
      { emoji: '⭐', label: 'Ngôi sao' }, { emoji: '🌈', label: 'Cầu vồng' },
    ],
  },
  {
    id: 'symbols', name: 'Biểu tượng', icon: '✅', emojis: [
      { emoji: '✅', label: 'Đồng ý' }, { emoji: '❌', label: 'Không' },
      { emoji: '❗', label: 'Chú ý' }, { emoji: '❓', label: 'Câu hỏi' },
      { emoji: '💡', label: 'Ý tưởng' }, { emoji: '💬', label: 'Trò chuyện' },
      { emoji: '🔔', label: 'Thông báo' }, { emoji: '📌', label: 'Ghim' },
      { emoji: '📅', label: 'Lịch' }, { emoji: '📷', label: 'Máy ảnh' },
      { emoji: '💻', label: 'Máy tính' }, { emoji: '📱', label: 'Điện thoại' },
      { emoji: '🔒', label: 'Khóa' }, { emoji: '💎', label: 'Kim cương' },
      { emoji: '☀️', label: 'Mặt trời' }, { emoji: '🌙', label: 'Mặt trăng' },
    ],
  },
]

export function searchChatEmojis(query: string, groupId?: string): ChatEmoji[] {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd')
  const needle = normalize(query.trim())
  const groups = needle || !groupId ? chatEmojiGroups : chatEmojiGroups.filter(group => group.id === groupId)
  return groups.flatMap(group => group.emojis.filter(item => !needle ||
    normalize(item.label).includes(needle) || normalize(group.name).includes(needle) || item.emoji === query.trim()))
}
