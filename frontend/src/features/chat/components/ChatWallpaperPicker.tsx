import { useUiTranslation } from '@/shared/i18n/locale'
import { useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/shared/ui/dialog'
import { ConversationOptionRow } from './ConversationManagementSection'
import type { Conversation } from '../types'
const presets = [
  { key: 'default', name: 'Mặc định', color: 'transparent' },
  { key: 'blue', name: 'Xanh dương', color: '#dcecff' },
  { key: 'green', name: 'Xanh lá', color: '#dceee2' },
  { key: 'rose', name: 'Hồng', color: '#f9e3eb' },
  { key: 'sand', name: 'Kem', color: '#f7ecda' },
] as const
export function wallpaperBackground(value?: string) {
  const preset = presets.find(item => item.key === value)
  return preset && preset.key !== 'default' ? 'linear-gradient(145deg,' + preset.color + ', #f4f6fa)' : undefined
}
export default function ChatWallpaperPicker({ conversation, request, notify, onRefresh }: {
  conversation: Conversation; request: (path: string, init?: RequestInit) => Promise<Response>
  notify: (text: string, kind?: 'success' | 'error' | 'warning') => void; onRefresh?: () => Promise<void>
}) {
  const trUi = useUiTranslation()

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  async function select(wallpaper: string) {
    if (busy) return
    setBusy(true)
    try {
      const result = await request('/api/conversations/' + conversation.id + '/wallpaper', { method:'PUT', headers: {'Content-Type':'application/json'}, body:JSON.stringify({wallpaper}) })
      if (!result.ok) throw new Error('Không đổi được hình nền.')
      await onRefresh?.()
      setOpen(false); notify('Đã đổi hình nền riêng của bạn.', 'success')
    } catch (e) { notify(e instanceof Error ? e.message : 'Không đổi được hình nền.', 'error') }
    finally { setBusy(false) }
  }
  return <>
    <ConversationOptionRow icon={<Palette size={18}/>} aria-haspopup="dialog" onClick={() => setOpen(true)}>{trUi("chat.wallpaper")}</ConversationOptionRow>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>{trUi("chat.wallpaper")}</DialogTitle>
        <DialogDescription>{trUi("chat.wallpaperPrivate")}</DialogDescription>
        <div className="grid grid-cols-2 gap-2">
          {presets.map(item => {
            const selected = (conversation.wallpaper || 'default') === item.key
            return <Button key={item.key} variant="outline" size="lg" disabled={busy} aria-pressed={selected} onClick={() => void select(item.key)} className="h-auto min-h-20 flex-col gap-2 whitespace-normal py-3" >
              <span className="relative block h-8 w-16 rounded-ui-md border border-border" style={{backgroundImage:wallpaperBackground(item.key)}}>{selected && <Check size={16} className="absolute bottom-0 right-0 text-primary"/>}</span>
              {item.name}
            </Button>
          })}
        </div>
      </DialogContent>
    </Dialog>
  </>
}
