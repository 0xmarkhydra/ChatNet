import { useUiTranslation } from '@/shared/i18n/locale'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft, Bookmark, ChevronRight, PencilLine, QrCode, ShieldCheck, UserRoundX } from 'lucide-react'
import UserAvatar from '@/shared/ui/UserAvatar'
import type { UserPrivacy } from '../types'

export type MobileProfileSettingsView = 'menu' | 'edit' | 'edit-from-menu' | 'privacy' | 'blocked' | null

export function isMobileProfileEdit(view: MobileProfileSettingsView) {
  return view === 'edit' || view === 'edit-from-menu'
}

export function MobileProfileScreen({ title, onBack, backDisabled = false, children }: { title: string; onBack: () => void; backDisabled?: boolean; children: ReactNode }) {
  const trUi = useUiTranslation()

  const screen = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    screen.current?.scrollIntoView?.({ block: 'start', behavior: 'auto' })
    heading.current?.focus({ preventScroll: true })
  }, [title])
  return <section ref={screen} className="flex min-w-0 flex-1 flex-col bg-background pb-[var(--bottom-nav-space,84px)] text-foreground">
    <header className="sticky top-0 z-10 grid h-14 grid-cols-[var(--soco-control-touch)_minmax(0,1fr)_var(--soco-control-touch)] items-center border-0 border-b border-solid border-border bg-card px-ui-2">
      <button type="button" aria-label={trUi("common.back")} disabled={backDisabled} onClick={onBack} className="grid size-control-touch place-items-center rounded-ui-md border-0 bg-transparent text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><ArrowLeft size={22} aria-hidden="true" /></button>
      <h2 ref={heading} tabIndex={-1} className="m-0 text-center text-ui-subtitle font-bold leading-tight text-foreground focus:outline-none">{title}</h2>
    </header>
    <div className="grid min-w-0 content-start gap-ui-4 p-ui-3">{children}</div>
  </section>
}

type MenuProps = { username: string; displayName: string; friendCount: number; onEdit: () => void; onQr: () => void; onPrivacy: () => void; onBlocked: () => void; onSaved: () => void }
export function MobileProfileMenu({ username, displayName, friendCount, onEdit, onQr, onPrivacy, onBlocked, onSaved }: MenuProps) {
  const groups = [
    { title: 'Trang cá nhân', rows: [
      { label: 'Chỉnh sửa trang cá nhân', hint: 'Cập nhật ảnh và thông tin cá nhân', Icon: PencilLine, action: onEdit },
      { label: 'Mã QR trang cá nhân', hint: 'Chia sẻ trang cá nhân của bạn', Icon: QrCode, action: onQr },
    ] },
    { title: 'Quyền riêng tư', rows: [
      { label: 'Quyền hiển thị', hint: 'Ai tìm thấy và kết nối với bạn', Icon: ShieldCheck, action: onPrivacy },
      { label: 'Người dùng đã chặn', hint: 'Quản lý danh sách đã chặn', Icon: UserRoundX, action: onBlocked },
    ] },
    { title: 'Nội dung của bạn', rows: [
      { label: 'Bài viết đã lưu', hint: 'Bài viết bạn đã lưu', Icon: Bookmark, action: onSaved },
    ] },
  ]
  return <>
    <div className="flex min-w-0 items-center gap-ui-3 rounded-ui-lg bg-card p-ui-4">
      <UserAvatar username={username} name={displayName} className="size-16 shrink-0 rounded-full" />
      <div className="min-w-0 wrap-anywhere">
        <strong className="text-ui-subtitle font-bold">{displayName}</strong>
        <p className="m-0 text-ui-label text-foreground/75">@{username}</p>
        {friendCount > 0 && <p className="m-0 text-ui-label text-foreground/75">{friendCount.toLocaleString('vi-VN')} người bạn</p>}
      </div>
    </div>
    {groups.map(group => <section key={group.title}>
      <h3 className="m-0 mb-ui-2 px-ui-1 text-ui-label font-bold uppercase text-foreground/75">{group.title}</h3>
      <div className="overflow-hidden rounded-ui-lg bg-card px-ui-3">
        {group.rows.map(({ label, hint, Icon, action }) => <button key={label} type="button" onClick={action} className="flex min-h-15 w-full min-w-0 items-center gap-ui-3 border-0 border-b border-solid border-border bg-card py-ui-2 text-left text-foreground last:border-b-0 focus-visible:outline-2 focus-visible:outline-primary">
          <span className="grid size-9 shrink-0 place-items-center rounded-ui-md bg-secondary text-primary"><Icon size={18} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1 wrap-anywhere"><strong className="block text-ui-subtitle font-semibold">{label}</strong><small className="block text-ui-caption leading-normal text-foreground/75">{hint}</small></span>
          <ChevronRight size={18} className="shrink-0 text-foreground/75" aria-hidden="true" />
        </button>)}
      </div>
    </section>)}
  </>
}

const privacyGroups = [
  { title: 'Tìm kiếm', rows: [
    ['searchableByUsername', 'Cho phép tìm bằng username', 'Người khác có thể tìm @username của bạn.'],
    ['searchableByName', 'Cho phép tìm bằng tên', 'Tên hiển thị của bạn có thể xuất hiện trong kết quả.'],
    ['searchableByEmail', 'Cho phép tìm bằng email', 'Chỉ tìm bằng email khớp chính xác; địa chỉ email không được hiển thị.'],
  ] },
  { title: 'Kết nối', rows: [
    ['allowFriendRequests', 'Cho phép lời mời mới', 'Tắt để ngăn lời mời kết bạn mới từ người khác.'],
    ['showOnlineStatus', 'Hiển thị trạng thái online', 'Ẩn sự hiện diện trong danh sách và kết quả tìm kiếm.'],
  ] },
] as const

export function MobileProfilePrivacy({ privacy, loading, busy, error, onRetry, onSave }: { privacy: UserPrivacy | null; loading: boolean; busy: boolean; error: string; onRetry: () => void; onSave: (value: UserPrivacy) => Promise<void> }) {
  const trUi = useUiTranslation()

  return <>
    <p className="m-0 text-ui-body text-foreground/75">{trUi("settings.privacyIntro")}</p>
    {loading && !privacy ? <div role="status" className="rounded-ui-lg bg-card p-ui-4">Đang tải cài đặt riêng tư…<div aria-hidden="true" className="mt-ui-3 grid gap-ui-3 motion-safe:animate-pulse">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-14 rounded-ui-md bg-secondary" />)}</div></div> : !privacy ? <div role="alert" className="rounded-ui-lg bg-card p-ui-4">Không thể tải cài đặt riêng tư.<button type="button" onClick={onRetry} className="ml-ui-2 min-h-control-touch border-0 bg-transparent font-semibold text-primary">{trUi("common.retry")}</button></div> : <>
      {error && <p role="alert" className="m-0 rounded-ui-md bg-card p-ui-3 text-ui-body text-danger">Lưu thất bại. Cài đặt trước đó vẫn được giữ.</p>}
      {privacyGroups.map(group => <section key={group.title} className="rounded-ui-lg bg-card p-ui-3">
        <h3 className="m-0 px-ui-1 pb-ui-2 text-ui-subtitle font-bold">{group.title}</h3>
        {group.rows.map(([key, label, hint]) => <div key={key} className="flex min-w-0 items-center gap-ui-3 border-0 border-t border-solid border-border py-ui-3">
          <div className="min-w-0 flex-1"><strong className="block text-ui-subtitle font-semibold">{label}</strong><small className="block text-ui-caption leading-normal text-foreground/75">{hint}</small></div>
          <button type="button" role="switch" aria-label={label} aria-checked={privacy[key]} disabled={busy || loading} onClick={() => void onSave({ ...privacy, [key]: !privacy[key] })} className="grid min-h-control-touch w-12 shrink-0 place-items-center border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60">
            <span aria-hidden="true" className={`flex h-7 w-12 items-center rounded-full p-0.5 box-border ${privacy[key] ? 'justify-end bg-primary' : 'justify-start bg-foreground/20'}`}><span className="size-6 rounded-full bg-white" /></span>
          </button>
        </div>)}
      </section>)}
      <p className="m-0 rounded-ui-md bg-secondary p-ui-3 text-ui-label text-primary">Thay đổi có hiệu lực ngay. Quyền xem bài viết và Story được chọn riêng khi đăng.</p>
    </>}
  </>
}