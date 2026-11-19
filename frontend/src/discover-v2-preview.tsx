import { useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ExplorePage from './features/discover/components/ExplorePage'
import type { DiscoverSectionProps } from './features/discover/types'
import './styles/soco-theme.css'
import './discover-v2-preview.css'

type Scenario = 'filled' | 'empty' | 'error'
const groups = [
  { id: 101, name: 'Nhiếp ảnh đường phố', topic: 'Nhiếp ảnh', description: 'Chia sẻ ảnh đời thường và góc nhìn thú vị.', visibility: 'public', memberCount: 1248 },
  { id: 102, name: 'Lập trình Web', topic: 'Công nghệ', description: 'React, TypeScript và phát triển sản phẩm.', visibility: 'public', memberCount: 3280 },
  { id: 103, name: 'Du lịch tự túc', topic: 'Du lịch', description: 'Cùng khám phá lịch trình và kinh nghiệm đi xa.', visibility: 'public', memberCount: 976 },
  { id: 104, name: 'Hội đọc sách', topic: 'Sách', description: 'Thảo luận và giới thiệu những cuốn sách hay.', visibility: 'public', memberCount: 578 },
  { id: 105, name: 'Thiết kế sản phẩm', topic: 'Công nghệ', description: 'Chia sẻ case study thiết kế UI/UX.', visibility: 'public', memberCount: 859 },
  { id: 106, name: 'Ảnh phong cảnh', topic: 'Nhiếp ảnh', description: 'Những bức ảnh thiên nhiên ấn tượng.', visibility: 'public', memberCount: 740 },
]
const previewExtras = {
  posts: [
    { id: 1, author: 'Minh Anh', community: 'Nhiếp ảnh đường phố', body: 'Mưa vừa tạnh, ngõ nhỏ phản chiếu đèn vàng. Ai có mẹo chụp cảnh đêm bằng điện thoại không?', likes: 128, comments: 24, when: '2 giờ trước', tag: 'phốđêm' },
    { id: 2, author: 'Hoàng Nam', community: 'Lập trình Web', body: 'Đã chuyển route sang lazy loading, bundle ban đầu giảm rõ rệt. Mình viết lại các bước ở bình luận.', likes: 86, comments: 31, when: '5 giờ trước', tag: 'reactjs' },
    { id: 3, author: 'Thu Hà', community: 'Du lịch tự túc', body: 'Gợi ý lịch trình ba ngày ở Đà Lạt cho nhóm bạn, ưu tiên quán cà phê yên tĩnh.', likes: 64, comments: 12, when: 'Hôm qua', tag: 'dulich' },
  ],
  tags: [
    { name: 'phốđêm', postCount: 1200 },
    { name: 'reactjs', postCount: 860 },
    { name: 'dulich', postCount: 640 },
    { name: 'cafésáng', postCount: 410 },
    { name: 'acoustic', postCount: 305 },
  ],
}
const users: DiscoverSectionProps['nearbyUsers'] = [
  { id: 201, username: 'an123', displayName: 'Bạn An', online: true },
  { id: 202, username: 'baobinh', displayName: 'Bảo Bình', online: true },
  { id: 203, username: 'linhtran', displayName: 'Linh Trần', online: false },
]

function Preview() {
  const [scenario, setScenario] = useState<Scenario>('filled')
  const [revision, setRevision] = useState(0)
  const [joinIds, setJoinIds] = useState<number[]>([])
  const [friends, setFriends] = useState<number[]>([])
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [radius, setRadius] = useState(5)

  const request = useCallback<DiscoverSectionProps['request']>(async path => {
    if (path.startsWith('/api/groups/public')) {
      if (scenario === 'error') return { ok: false, status: 500, json: async () => ({}) } as Response
      const items = scenario === 'filled' ? groups.filter(group => !joinIds.includes(group.id)) : []
      return { ok: true, status: 200, json: async () => items } as Response
    }
    const id = path.startsWith('/api/groups/') && path.endsWith('/join') ? Number(path.split('/')[3]) : NaN
    if (Number.isSafeInteger(id) && id > 0) {
      setJoinIds(previous => previous.includes(id) ? previous : [...previous, id])
      setNotice('Đã mô phỏng gửi yêu cầu tham gia cộng đồng. Không gọi backend.')
      return { ok: true, status: 200, json: async () => ({ status: 'requested' }) } as Response
    }
    throw new Error('API chưa được mô phỏng trong trang preview.')
  }, [scenario, joinIds])

  const actOnFriend = useCallback<DiscoverSectionProps['actOnFriend']>(async friend => {
    setFriends(previous => previous.includes(friend.id) ? previous.filter(id => id !== friend.id) : [...previous, friend.id])
    setNotice('Đã mô phỏng thao tác kết bạn. Không gọi backend.')
  }, [])

  const props: DiscoverSectionProps = {
    request, sessionId: 'preview-' + scenario + '-' + revision,
    actOnFriend, findNearby: async () => setNotice('Quét gần đây đang được mô phỏng trong preview.'),
    friendActionBusy: null,
    friendRelationship: id => friends.includes(id) ? 'outgoing' : 'none',
    globalSearch: query, nearbyBusy: false, nearbyRadiusKm: radius,
    nearbyResultRadiusKm: radius, nearbyScanning: false, nearbyUntil: 0,
    nearbyUsers: scenario === 'filled' ? users : [],
    setGlobalSearch: setQuery, setNearbyRadiusKm: setRadius,
    stopNearby: async () => {},
  }

  function switchScenario(next: Scenario) {
    setScenario(next)
    setRevision(value => value + 1)
    setFriends([])
    setJoinIds([])
    setNotice('')
    window.history.replaceState(window.history.state, '', '/discover-v2-preview.html')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return <div className="preview-shell">
    <header className="preview-toolbar">
      <div className="preview-identity"><strong>ChatNet · Explore v2</strong><span>PREVIEW — DỮ LIỆU API GIẢ LẬP</span></div>
      <div className="preview-controls" role="group" aria-label="Chế độ dữ liệu API">
        <button type="button" aria-pressed={scenario === 'filled'} onClick={() => switchScenario('filled')}>API có dữ liệu</button>
        <button type="button" aria-pressed={scenario === 'empty'} onClick={() => switchScenario('empty')}>API rỗng</button>
        <button type="button" aria-pressed={scenario === 'error'} onClick={() => switchScenario('error')}>API lỗi</button>
      </div>
    </header>
    <div className="preview-intro">Đây là component <code>ExplorePage</code> thật của nhánh v2, nhận phản hồi API giả lập từ bộ dữ liệu bên dưới. Lọc chủ đề, thử Tham gia và Kết bạn; không có thao tác nào ghi dữ liệu lên server.</div>
    {notice && <div className="preview-notice" role="status">{notice}</div>}
    <BrowserRouter><ExplorePage {...props} previewExtras={scenario === 'filled' ? previewExtras : undefined} previewEmptyDesign={scenario === 'empty'} onPreviewAction={action => setNotice(action + ' — đây chỉ là nút mô phỏng, chưa kết nối tính năng thật.')} /></BrowserRouter>
  </div>
}

createRoot(document.getElementById('root')!).render(<Preview />)
