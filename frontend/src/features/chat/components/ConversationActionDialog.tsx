import { Bell, BellOff, Pin, PinOff, Trash2 } from "lucide-react";
import { type SetStateAction } from "react";
import { type Conversation } from "../types";
import type { Dispatch } from "react";

export type ConversationActionDialogProps = {
  activeConversationAction: Conversation;
  conversationMenuPosition: { x: number; y: number; } | null;
  pinBusy: boolean;
  notificationBusy: boolean;
  historyActionBusy: boolean;
  toggleConversationNotifications: (conversation: Conversation) => Promise<void>;
  clearSelectedConversationHistory: (conversation: Conversation) => Promise<void>;
  setConversationActionId: Dispatch<SetStateAction<number | null>>;
  toggleConversationPin: (conversation: Conversation) => Promise<void>;
};

export default function ConversationActionDialog({
  activeConversationAction,
  conversationMenuPosition,
  pinBusy,
  notificationBusy,
  historyActionBusy,
  toggleConversationNotifications,
  clearSelectedConversationHistory,
  setConversationActionId,
  toggleConversationPin,
}: ConversationActionDialogProps) {
  return (
      <div className={conversationMenuPosition ? 'conversation-context-backdrop' : 'message-context-backdrop'}
            role="dialog" aria-modal="true"
            aria-label={`Tùy chọn cuộc trò chuyện ${activeConversationAction.name}`}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setConversationActionId(null)
            }}
            onKeyDown={(event) => { if (event.key === 'Escape') setConversationActionId(null) }}>
            <section
              className={conversationMenuPosition ? 'conversation-context-menu' : 'message-context-sheet'}
              style={conversationMenuPosition ? {
                left: Math.max(8, Math.min(conversationMenuPosition.x, window.innerWidth - 252)),
                top: Math.max(8, Math.min(conversationMenuPosition.y, window.innerHeight - 152)),
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
                  <b>{activeConversationAction.pinnedAt ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện'}</b>
                </button>
                <button type="button" disabled={notificationBusy} onClick={() => {
                  setConversationActionId(null)
                  void toggleConversationNotifications(activeConversationAction)
                }}>
                  <span aria-hidden="true">{activeConversationAction.muted ? <Bell size={19} /> : <BellOff size={19} />}</span>
                  <b>{activeConversationAction.muted ? 'Bật thông báo' : 'Tắt thông báo'}</b>
                </button>
                <button type="button" disabled={historyActionBusy} onClick={() => {
                  setConversationActionId(null)
                  void clearSelectedConversationHistory(activeConversationAction)
                }}>
                  <span aria-hidden="true"><Trash2 size={19} className="text-danger" /></span>
                  <b className="text-danger">Xóa lịch sử trò chuyện</b>
                </button>
              </div>
              {!conversationMenuPosition && (
                <button type="button" className="message-context-cancel"
                  onClick={() => setConversationActionId(null)}>Đóng</button>
              )}
            </section>
          </div>
  );
}