import { useUiTranslation } from '@/shared/i18n/locale'
import { Pin, X } from "lucide-react";
import { userLabel } from "../../../shared/utils/userLabel";
import { attachmentLabel } from "../../../shared/utils/format";
import type { ChatSectionProps } from "./ChatSectionProps";
import type { useChatSectionPanels } from "../hooks/useChatSectionPanels";
type Props = Omit<Pick<ChatSectionProps, "activeConversation" | "nextChatSearchJumpRevision" | "groupActivities" | "pinBusy" | "pinnedItems" | "setChatSearchJump" | "setGroupActivityViewedId" | "setNotice" | "t" | "toggleMessagePin">, "activeConversation"> & { activeConversation: NonNullable<ChatSectionProps["activeConversation"]> } & Pick<ReturnType<typeof useChatSectionPanels>, "pinnedExpanded" | "setPinnedExpanded">;
export default function PinnedItemsPanel({ activeConversation, nextChatSearchJumpRevision, groupActivities, pinBusy, pinnedExpanded, pinnedItems, setChatSearchJump, setGroupActivityViewedId, setNotice, setPinnedExpanded, t, toggleMessagePin }: Props) {
  const trUi = useUiTranslation()

 return <>
{pinnedItems.length > 0 && (
                    <div className="chat-pinned-panel" role="region" aria-label={trUi("common.ui.pinnedContent")}>
                      <div className="chat-pinned-heading">
                        <Pin size={16} aria-hidden="true" />
                        <strong>Nội dung đã ghim ({pinnedItems.length})</strong>
                        {pinnedItems.length > 1 && (
                          <button type="button" onClick={() => setPinnedExpanded((value) => !value)}
                            aria-expanded={pinnedExpanded}>
                            {pinnedExpanded ? trUi("common.collapse") : trUi("common.seeAll")}
                          </button>
                        )}
                      </div>
                      <div className="chat-pinned-items">
                        {pinnedItems.slice(0, pinnedExpanded ? 200 : 1).map((pin) => (
                          pin.type === 'message' ? (
                            <div className="chat-pinned-item" key={`message-${pin.message.id}`}>
                              <button type="button" className="chat-pinned-jump"
                                title={trUi("common.ui.goPinnedMessage")}
                                onClick={() => setChatSearchJump({
                                  conversationId: activeConversation.id,
                                  messageId: pin.message.id,
                                  revision: nextChatSearchJumpRevision(),
                                })}>
                                <strong>{userLabel(pin.message.senderDisplayName, pin.message.sender)}</strong>
                                <span>{pin.message.text || attachmentLabel(pin.message.attachments) || trUi("chat.messages")}</span>
                              </button>
                              <button type="button" className="chat-pinned-remove" disabled={pinBusy}
                                aria-label={trUi("chat.unpinMessage")} title={trUi("chat.unpinMessage")}
                                onClick={() => void toggleMessagePin(pin.message)}>
                                <X size={15} aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <div className="chat-pinned-item" key={`activity-${pin.activity.id}`}>
                              <button type="button" className="chat-pinned-jump"
                                title={trUi("common.ui.viewPinnedActivity")}
                                onClick={() => setGroupActivityViewedId(pin.activity.id)}>
                                <strong>{pin.activity.kind === 'poll' ? trUi("chat.poll") : pin.activity.kind === 'note' ? trUi("common.note") : 'Nhắc hẹn'}</strong>
                                <span>{pin.activity.body || (pin.activity.scheduledAt
                                  ? new Date(pin.activity.scheduledAt).toLocaleString('vi-VN')
                                  : 'Nhấn để xem chi tiết')}</span>
                              </button>
                              <button type="button" className="chat-pinned-remove"
                                aria-label={trUi("chat.unpinActivity")} title={trUi("chat.unpinActivity")}
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
