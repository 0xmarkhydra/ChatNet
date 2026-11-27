import test from 'node:test'
import assert from 'node:assert/strict'
import { findHardcodedUI } from './check-i18n-hardcode.mjs'

test('detects hardcoded UI copy, conditionals and notices but not translated keys or data', () => {
  const hits = findHardcodedUI(`
    function Screen({ user, busy }) {
      setNotice('Không thể tải', 'error')
      const record = { name: 'Nguyễn An' }
      return <><button aria-label="Đóng">{busy ? 'Đang tải' : 'Lưu'}</button>
        <input placeholder={trUi('common.search')} /><button data-tooltip="Gửi tin nhắn" tooltip="Thêm tùy chọn" ariaLabel="Đóng cửa sổ" />
        <p>{user.message}</p><p>Xin chào</p>
        <span>{\`Có \${user.count} người\`}</span>
      </>
    }`, 'Screen.tsx')
  assert.deepEqual(hits.map(hit => hit.text).sort(), ['Không thể tải', 'Đóng', 'Đang tải', 'Lưu', 'Xin chào', 'Có {value} người', 'Gửi tin nhắn', 'Thêm tùy chọn', 'Đóng cửa sổ'].sort())
})

test('extended audit detects UI configuration and default props, not user name records', () => {
  const source = `
    const tabs = [{ value: 'all', label: 'Dành cho bạn' }]
    const data = { name: 'Nguyễn An' }
    function Search({ clearLabel = 'Xóa từ khóa' }) { return <input placeholder="Tìm kiếm" /> }
    function Empty() { return <Gallery emptyText="Chưa có ảnh" /> }
  `
  assert.deepEqual(findHardcodedUI(source, 'Shared.tsx', true).map(hit => hit.text).sort(), ['Dành cho bạn','Xóa từ khóa','Tìm kiếm','Chưa có ảnh'].sort())
})
