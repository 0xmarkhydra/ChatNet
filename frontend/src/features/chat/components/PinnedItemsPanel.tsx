import { Pin, X } from "lucide-react";
import { userLabel } from "../../../shared/utils/userLabel";
import { attachmentLabel } from "../../../shared/utils/format";
import type { ChatSectionProps } from "./ChatSectionProps";
type Props = Omit<Pick<ChatSectionProps, "activeConversation" | "nextChatSearchJumpRevision" | "groupActivities" | "pinBusy" | "pinnedExpanded" | "pinnedItems" | "setChatSearchJump" | "setGroupActivityViewedId" | "setNotice" | "setPinnedExpanded" | "t" | "toggleMessagePin">, "activeConversation"> & { activeConversation: NonNullable<ChatSectionProps["activeConversation"]> };
export default function PinnedItemsPanel({ activeConversation, nextChatSearchJumpRevision, groupActivities, pinBusy, pinnedExpanded, pinnedItems, setChatSearchJump, setGroupActivityViewedId, setNotice, setPinnedExpanded, t, toggleMessagePin }: Props) {
 return <>
{pinnedItems.length > 0 && (
                    <div className="chat-pinned-panel" role="region" aria-label="Nội dung đã ghim">
                      <div className="chat-pinned-heading">
                        <Pin size={16} aria-hidden="true" />
                        <strong>Nội dung đã ghim ({pinnedItems.length})</strong>
                        {pinnedItems.length > 1 && (
                          <button type="button" onClick={() => setPinnedExpanded((value) => !value)}
                            aria-expanded={pinnedExpanded}>
                            {pinnedExpanded ? 'Thu gọn' : 'Xem tất cả'}
                          </button>
                        )}
                      </div>
                      <div className="chat-pinned-items">
                        {pinnedItems.slice(0, pinnedExpanded ? 200 : 1).map((pin) => (
                          pin.type === 'message' ? (
                            <div className="chat-pinned-item" key={`message-${pin.message.id}`}>
                              <button type="button" className="chat-pinned-jump"
                                title="Đi đến tin nhắn đã ghim"
                                onClick={() => setChatSearchJump({
                                  conversationId: activeConversation.id,
                                  messageId: pin.message.id,
                                  revision: nextChatSearchJumpRevision(),
                                })}>
                                <strong>{userLabel(pin.message.senderDisplayName, pin.message.sender)}</strong>
                                <span>{pin.message.text || attachmentLabel(pin.message.attachments) || 'Tin nhắn'}</span>
                              </button>
                              <button type="button" className="chat-pinned-remove" disabled={pinBusy}
                                aria-label="Bỏ ghim tin nhắn" title="Bỏ ghim tin nhắn"
                                onClick={() => void toggleMessagePin(pin.message)}>
                                <X size={15} aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <div className="chat-pinned-item" key={`activity-${pin.activity.id}`}>
                              <button type="button" className="chat-pinned-jump"
                                title="Xem hoạt động nhóm đã ghim"
                                onClick={() => setGroupActivityViewedId(pin.activity.id)}>
                                <strong>{pin.activity.kind === 'poll' ? 'Bình chọn' : pin.activity.kind === 'note' ? 'Ghi chú' : 'Nhắc hẹn'}</strong>
                                <span>{pin.activity.body || (pin.activity.scheduledAt
                                  ? new Date(pin.activity.scheduledAt).toLocaleString('vi-VN')
                                  : 'Nhấn để xem chi tiết')}</span>
                              </button>
                              <button type="button" className="chat-pinned-remove"
                                aria-label="Bỏ ghim hoạt động nhóm" title="Bỏ ghim hoạt động nhóm"
                                onClick={() => void groupActivities.setPin(pin.activity.id, false)
                                  .catch((error) => setNotice(error instanceof Error ? error.message : 'Không thể bỏ ghim.', 'error'))}>
                                <X size={15} aria-hidden="true" />
                              </button>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
</>;
}
