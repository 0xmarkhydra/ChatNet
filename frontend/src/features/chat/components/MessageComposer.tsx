import { useQuickReplyVisibility } from "../hooks/useQuickReplyVisibility";
import QuickReplyPanel from "./QuickReplyPanel";
import { Images, ThumbsUp, X } from "lucide-react";
import ChatComposerPlusMenu from "./ChatComposerPlusMenu";
import ScheduledMessageQueue from "./ScheduledMessageQueue";
import type { ApiRequest } from "@/shared/types/api";
import UiIcon from "../../../shared/ui/UiIcon";
import { userLabel } from "../../../shared/utils/userLabel";
import { attachmentLabel } from "../../../shared/utils/format";
import { replyPreview, stickerPreviewUrl } from "../utils/conversationPreview";
import { chatFilesFromClipboard } from "../utils/chatFileTransfer";
import MediaAttachmentsView from "../../../shared/ui/MediaAttachmentsView";
import { isDesktopBuild } from "../../../platform/desktop";
import VoiceRecorder from "./VoiceRecorder";
import ChatMentionInput from "./ChatMentionInput";
import type { GroupMember } from "../types";
import type { ChatSectionProps } from "./ChatSectionProps";
import type { RefObject } from "react";

const CHAT_ATTACHMENT_ACCEPT = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip';

type Props = Omit<Pick<ChatSectionProps, "activeConversation" | "activeConversationId" | "addChatFiles" | "canSend" | "canSendLike" | "mediaUploading" | "messageAttachments" | "messageInputRef" | "messageSending" | "messageText" | "replyingTo" | "selectedChannelId" | "sendMessage" | "sendLike" | "session" | "setGroupActivityCreateKind" | "setMessageAttachments" | "setMessageText" | "setNotice" | "setReplyingTo">, "activeConversation"> & { activeConversation: NonNullable<ChatSectionProps["activeConversation"]>; groupMembers: GroupMember[]; chatFileInputRef: RefObject<HTMLInputElement | null>; apiFetch: ApiRequest; canSchedule: boolean };

export default function MessageComposer({ activeConversation, activeConversationId, addChatFiles, apiFetch, canSchedule, canSend, canSendLike, chatFileInputRef, mediaUploading, messageAttachments, messageInputRef, messageSending, messageText, replyingTo, selectedChannelId, sendMessage, sendLike, session, setGroupActivityCreateKind, setMessageAttachments, setMessageText, setNotice, setReplyingTo, groupMembers }: Props) {
  const quickReplies = useQuickReplyVisibility(`${session.sessionId}:${activeConversation.id}:${selectedChannelId}`, messageText);
  function openAttachmentPicker(mediaOnly: boolean) {
    const input = chatFileInputRef.current;
    if (!input) return;
    input.accept = mediaOnly ? 'image/*,video/*' : CHAT_ATTACHMENT_ACCEPT;
    input.click();
  }

  function insertEmoji(emoji: string) {
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? messageText.length;
    const end = input?.selectionEnd ?? start;
    const next = messageText.slice(0, start) + emoji + messageText.slice(end);
    if (next.length > 4000) return;
    setMessageText(next);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function composerMenu(onSchedule?: () => void) {
    return <ChatComposerPlusMenu
      key={`menu:${session.sessionId}:${activeConversation.id}:${selectedChannelId}`}
      disabled={Boolean(mediaUploading) || messageSending}
      onAttachFile={() => openAttachmentPicker(false)}
      onAttachMedia={() => openAttachmentPicker(true)}
      onInsertEmoji={insertEmoji}
      userId={session.user.id}
      onSelectGiphy={url => setMessageText([messageText, url].filter(Boolean).join('\n'))}
      onSelectSticker={file => { void addChatFiles([file]) }}
      onSchedule={onSchedule}
      onQuickReplies={quickReplies.open}
      onGroupActivity={activeConversation.type === 'group' ? setGroupActivityCreateKind : undefined}
    />
  }

  const replySticker = replyingTo && !replyingTo.deleted ? stickerPreviewUrl(replyingTo.text) : "";
  const hasMessageContent = messageText.trim().length > 0 || messageAttachments.length > 0;

  return (
    <form className="composer media-composer compact-chat-composer" onSubmit={(event) => {
                    void sendMessage(event)
                    if (isDesktopBuild) messageInputRef.current?.focus()
                  }}>
                    <input
                      ref={chatFileInputRef}
                      className="hidden-media-input"
                      type="file"
                      multiple
                      accept={CHAT_ATTACHMENT_ACCEPT}
                      onChange={(event) => {
                        const files = Array.from(event.currentTarget.files || [])
                        event.currentTarget.value = ''
                        void addChatFiles(files)
                      }}
                    />
                    {replyingTo && (
                      <div className="composer-reply-preview">
                        {replySticker && <img src={replySticker} alt="" referrerPolicy="no-referrer" className="size-10 shrink-0 object-contain" />}
                        <div className="min-w-0 flex-1">
                          <strong>Đang trả lời {userLabel(replyingTo.senderDisplayName, replyingTo.sender)}</strong>
                          <span>{replyingTo.deleted ? 'Tin nhắn đã thu hồi' : (replyPreview(replyingTo.text) || attachmentLabel(replyingTo.attachments))}</span>
                        </div>
                        <button type="button" className="ghost-action flex! size-8! shrink-0 items-center justify-center self-center m-0! p-0! border-0! bg-transparent! shadow-none!" onClick={() => setReplyingTo(null)} aria-label="Hủy trả lời" title="Hủy trả lời"><X size={18} aria-hidden="true" /></button>
                      </div>
                    )}
                    {messageAttachments.length > 0 && (
                      <div className="composer-pending">
                        <MediaAttachmentsView
                          items={messageAttachments}
                          pending
                          onRemove={messageSending ? undefined : (index) => setMessageAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        />
                      </div>
                    )}
                    <QuickReplyPanel key={`quick-replies:${session.sessionId}:${activeConversation.id}:${selectedChannelId}`} request={apiFetch} query={quickReplies.query} managing={quickReplies.managing} onClose={quickReplies.close} onSelect={text => { if (/^\/[a-z0-9_-]*$/i.test(messageText)) setMessageText(text); else insertEmoji(text); }} />
                    {canSchedule ? <ScheduledMessageQueue
                      key={`schedule:${session.sessionId}`}
                      request={apiFetch}
                      conversationId={activeConversation.id}
                      channelId={selectedChannelId}
                      initialText={!messageAttachments.length && !replyingTo ? messageText : ""}
                      renderTrigger={composerMenu}
                    /> : composerMenu()}
                    <button className="ghost-action chat-composer-image" type="button"
                      onClick={() => openAttachmentPicker(true)}
                      disabled={Boolean(mediaUploading) || messageSending}
                      aria-label="Đính kèm ảnh hoặc video" title="Chọn ảnh hoặc video">
                      <Images size={19} aria-hidden="true" />
                    </button>
                    <VoiceRecorder
                      key={`voice:${session.sessionId}:${activeConversationId}`}
                      disabled={Boolean(mediaUploading) || messageSending}
                      onRecorded={(file) => { void addChatFiles([file]) }}
                      onError={(message) => setNotice(message, 'error')}
                    />

                    <ChatMentionInput
                      key={`mention:${session.sessionId}:${activeConversation.id}:${selectedChannelId}`}
                      conversationId={activeConversation.id}
                      members={activeConversation.type === 'group' ? groupMembers.filter(member => member.id !== session.user.id) : []}
                      inputRef={messageInputRef}
                      text={messageText}
                      setText={setMessageText}
                      placeholder="Nhập tin nhắn…"
                      onFilesPaste={(event) => {
                        const files = chatFilesFromClipboard(event.clipboardData)
                        if (files.length === 0) return
                        event.preventDefault()
                        void addChatFiles(files)
                      }}
                    />
                    <button
                      className="send-button chat-composer-primary"
                      type={hasMessageContent ? "submit" : "button"}
                      disabled={hasMessageContent ? !canSend : !canSendLike}
                      aria-label={hasMessageContent ? "Gửi tin nhắn" : "Gửi Like"}
                      title={hasMessageContent ? "Gửi tin nhắn" : "Gửi Like"}
                      onClick={hasMessageContent ? undefined : () => void sendLike()}
                    >
                      {hasMessageContent ? <UiIcon name="send" size={21} /> : <ThumbsUp size={21} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />}
                    </button>
                  </form>
  );
}