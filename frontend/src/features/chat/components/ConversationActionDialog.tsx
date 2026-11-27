import { useUiTranslation } from '@/shared/i18n/locale'
import { useState } from "react";
import { Bell, BellOff, Pin, PinOff, Trash2, Tag, Check, Mail, MailOpen } from "lucide-react";
import { type SetStateAction } from "react";
import { type Conversation } from "../types";
import type { Dispatch } from "react";

export type ConversationActionDialogProps = {
  activeConversationAction: Conversation;
  conversationMenuPosition: { x: number; y: number; } | null;
  pinBusy: boolean;
  onSetUnread?: (conversation: Conversation, unread: boolean) => Promise<void>;
  notificationBusy: boolean;
  historyActionBusy: boolean;
  clearSelectedConversationHistory: (conversation: Conversation) => Promise<void>;
  onToggleNotifications: (conversation: Conversation, muteMinutes?: number) => Promise<void>;
  categories: { id: number; name: string; color: string }[];
  categoryBusy: boolean;
  onAssignCategory: (id: number, categoryId: number | null) => Promise<boolean>;
  setConversationActionId: Dispatch<SetStateAction<number | null>>;
  toggleConversationPin: (conversation: Conversation) => Promise<void>;
};

export default function ConversationActionDialog({
  activeConversationAction,
  conversationMenuPosition,
  pinBusy,
  historyActionBusy,
  clearSelectedConversationHistory,
  setConversationActionId,
  onSetUnread, toggleConversationPin, notificationBusy, onToggleNotifications, categories, categoryBusy, onAssignCategory,
}: ConversationActionDialogProps) {
  const trUi = useUiTranslation()

  const [classifying, setClassifying] = useState(false);
  const [muting, setMuting] = useState(false);
  const close = () => setConversationActionId(null);
  return (
      <div className={conversationMenuPosition ? 'conversation-context-backdrop' : 'message-context-backdrop'}
            role="dialog" aria-modal="true"
            aria-label={trUi("common.ui.conversationOptionsName", { v1: String(activeConversationAction.name) })}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setConversationActionId(null)
            }}
            onKeyDown={(event) => { if (event.key === 'Escape') setConversationActionId(null) }}>
            <section
              className={conversationMenuPosition ? 'conversation-context-menu' : 'message-context-sheet'}
              style={conversationMenuPosition ? {
                left: Math.max(8, Math.min(conversationMenuPosition.x, window.innerWidth - 252)),
                top: Math.max(8, Math.min(conversationMenuPosition.y, window.innerHeight - 220)),
                maxHeight: "calc(100dvh - 16px)", overflowY: "auto",
              } : undefined}
            >
              {!conversationMenuPosition && (
                <div className="conversation-pin-dialog-title">
                  <strong>{activeConversationAction.name}</strong>
                  <span>Thiết lập riêng cho tài khoản của bạn</span>
                </div>
              )}
              <div className={conversationMenuPosition ? 'conversation-context-actions' : 'message-context-actions'}>
                <button type="button" autoFocus disabled={pinBusy}
                  onClick={() => {
                    setConversationActionId(null)
                    void toggleConversationPin(activeConversationAction)
                  }}>
                  <span aria-hidden="true">{activeConversationAction.pinnedAt ? <PinOff size={19} /> : <Pin size={19} />}</span>
                  <b>{activeConversationAction.pinnedAt ? trUi("chat.unpinConversation") : trUi("chat.pinConversation")}</b>
                </button>
                {onSetUnread && <button type="button" onClick={() => { close(); void onSetUnread(activeConversationAction, !(activeConversationAction.unreadCount || activeConversationAction.manualUnread)); }}>
                  <span aria-hidden="true">{activeConversationAction.unreadCount || activeConversationAction.manualUnread ? <MailOpen size={19}/> : <Mail size={19}/>}</span>
                  <b>{activeConversationAction.unreadCount || activeConversationAction.manualUnread ? trUi("chat.markRead") : trUi("chat.markUnread")}</b>
                </button>}
                <button type="button" disabled={notificationBusy} onClick={() => { close(); void onToggleNotifications(activeConversationAction); }}>
                  <span aria-hidden="true">{activeConversationAction.muted ? <Bell size={19} /> : <BellOff size={19} />}</span>
                  <b>{activeConversationAction.muted ? trUi("common.enableNotice") : trUi("chat.mute")}</b>
                </button>
                {!activeConversationAction.muted && <>
                  <button type="button" disabled={notificationBusy} aria-expanded={muting} onClick={() => setMuting(value => !value)}>
                    <span aria-hidden="true"><BellOff size={19} /></span><b>Tắt theo thời hạn</b>
                  </button>
                  {muting && [[60, '1 giờ'], [240, '4 giờ'], [1440, '24 giờ'], [10080, '7 ngày']].map(([minutes, label]) => (
                    <button type="button" key={minutes} disabled={notificationBusy} onClick={() => { close(); void onToggleNotifications(activeConversationAction, Number(minutes)); }}><span aria-hidden="true"><BellOff size={16}/></span><b>{label}</b></button>
                  ))}
                </>}
                <button type="button" aria-expanded={classifying} disabled={categoryBusy} onClick={() => setClassifying(value => !value)}>
                  <span aria-hidden="true"><Tag size={19} /></span><b>{trUi("chat.categories")}</b>
                </button>
                {classifying && [{ id: 0, name: 'Chưa phân loại', color: 'slate' }, ...categories].map(category => (
                  <button type="button" key={category.id} disabled={categoryBusy}
                    aria-pressed={(activeConversationAction.categoryId || 0) === category.id}
                    onClick={async () => { if (await onAssignCategory(activeConversationAction.id, category.id || null)) close(); }}>
                    <span aria-hidden="true">{(activeConversationAction.categoryId || 0) === category.id ? <Check size={18} /> : <Tag size={18} />}</span>
                    <b>{category.name}</b>
                  </button>
                ))}
                <button type="button" disabled={historyActionBusy} onClick={() => { close(); void clearSelectedConversationHistory(activeConversationAction) }}>
                  <span aria-hidden="true"><Trash2 size={19} className="text-danger" /></span><b className="text-danger">{trUi("chat.clearHistory")}</b>
                </button>
              </div>
              {!conversationMenuPosition && (
                <button type="button" className="message-context-cancel"
                  onClick={() => setConversationActionId(null)}>{trUi("common.close")}</button>
              )}
            </section>
          </div>
  );
}