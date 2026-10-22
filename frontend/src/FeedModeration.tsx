import { useEffect, useState } from 'react'
import { ShieldCheck, RefreshCw } from 'lucide-react'
import './feed-moderation.css'

type Report = {
  id: number
  targetType: 'post' | 'comment' | 'story'
  targetId: number
  reporter: string
  reason: string
  preview: string
  status: string
  createdAt: string
}

type Props = {
  request: (path: string, options?: RequestInit) => Promise<Response>
  onRemoved: (type: Report["targetType"], id: number) => void
}

// Mounted only on Feed. A 403 hides this entirely from ordinary members.
// The backend independently checks database-granted moderator membership.
export default function FeedModeration({ request, onRemoved }: Props) {
  const [allowed, setAllowed] = useState(false)
  const [open, setOpen] = useState(false)
  const [reports, setReports] = useState<Report[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await request('/api/feed/moderation/reports?limit=30')
      if (response.status === 403) { setAllowed(false); return }
      if (!response.ok) throw new Error('Không tải được báo cáo. Vui lòng thử lại.')
      const items = await response.json() as Report[]
      setReports(items)
      setHasMore(items.length === 30)
      setAllowed(true)
    } catch {
      setError('Không tải được báo cáo. Vui lòng thử lại.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function loadMore() {
    if (loading || !hasMore || !reports.length) return
    setLoading(true)
    setError('')
    try {
      const before = reports[reports.length - 1].id
      const response = await request('/api/feed/moderation/reports?limit=30&before=' + before)
      if (!response.ok) throw new Error('Không tải thêm được báo cáo.')
      const next = await response.json() as Report[]
      setHasMore(next.length === 30)
      setReports((current) => [...current, ...next.filter((item) => !current.some((old) => old.id === item.id))])
    } catch {
      setError('Không tải thêm được báo cáo.')
    } finally { setLoading(false) }
  }

  async function review(report: Report, decision: 'remove' | 'dismiss') {
    if (busy !== null) return
    if (decision === 'remove' && !window.confirm('Gỡ nội dung được báo cáo? Thao tác này không thể hoàn tác.')) return
    setBusy(report.id)
    setError('')
    try {
      const response = await request('/api/feed/moderation/reports/' + report.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (!response.ok) {
        if (response.status === 403) setAllowed(false)
        throw new Error('Không xử lý được báo cáo. Vui lòng tải lại danh sách.')
      }
      setReports((current) => current.filter((item) => item.id !== report.id))
      // A removal resolves other reports on the same target as well.
      if (decision === 'remove') { onRemoved(report.targetType, report.targetId); void load() }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể xử lý báo cáo.')
    } finally { setBusy(null) }
  }

  if (!allowed) return null

  return (
    <section className="soco-moderation" aria-label="Kiểm duyệt bảng tin">
      <div className="soco-moderation-heading">
        <ShieldCheck size={20} aria-hidden="true" />
        <strong>Kiểm duyệt nội dung</strong>
        <span>{reports.length} báo cáo chờ xử lý</span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Thu gọn' : 'Xem báo cáo'}
        </button>
      </div>
      {open && (
        <div className="soco-moderation-list">
          <button type="button" onClick={() => void load()} disabled={loading || busy !== null}>
            <RefreshCw size={16} aria-hidden="true" /> {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
          {error && <p role="alert" className="soco-moderation-error">{error}</p>}
          {!reports.length && !loading && <p>Không có báo cáo đang chờ xử lý.</p>}
          {reports.map((report) => (
            <article key={report.id} className="soco-moderation-report">
              <div><strong>{report.targetType === 'post' ? 'Bài viết' : report.targetType === 'comment' ? 'Bình luận' : 'Story'} #{report.targetId}</strong>
                <small> Báo cáo bởi @{report.reporter} · {new Date(report.createdAt).toLocaleString('vi-VN')}</small>
              </div>
              <p><strong>Lý do:</strong> {report.reason}</p>
              <p className="soco-moderation-preview"><strong>Nội dung:</strong> {report.preview}</p>
              <div className="soco-moderation-actions">
                <button type="button" disabled={busy !== null} onClick={() => void review(report, 'dismiss')}>
                  Bỏ qua
                </button>
                <button type="button" className="danger" disabled={busy !== null} onClick={() => void review(report, 'remove')}>
                  Gỡ nội dung
                </button>
              </div>
            </article>
          ))}
          {hasMore && <button type="button" disabled={loading || busy !== null} onClick={() => void loadMore()}>
            {loading ? 'Đang tải…' : 'Tải thêm báo cáo'}
          </button>}
        </div>
      )}
    </section>
  )
}
