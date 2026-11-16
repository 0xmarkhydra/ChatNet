import { Plus, Images } from "lucide-react";
import UiIcon from "../../../shared/ui/UiIcon";
import { userLabel } from "../../../shared/utils/userLabel";
import { attachmentLabel } from "../../../shared/utils/format";
import { chatFilesFromClipboard } from "../utils/chatFileTransfer";
import { GroupActivityComposerMenu } from "./GroupActivities";
import MediaAttachmentsView from "../../../shared/ui/MediaAttachmentsView";
import { isDesktopBuild } from "../../../platform/desktop";
import VoiceRecorder from "./VoiceRecorder";
import ChatMentionInput from "./ChatMentionInput";
import type { GroupMember } from "../types";
import type { ChatSectionProps } from "./ChatSectionProps";

type Props = Omit<Pick<ChatSectionProps, "activeConversation" | "activeConversationId" | "addChatFiles" | "canSend" | "chatFileInputRef" | "groupChannels" | "isProfileDesktop" | "mediaUploading" | "messageAttachments" | "messageInputRef" | "messageSending" | "messageText" | "replyingTo" | "selectedChannelId" | "sendMessage" | "session" | "setGroupActivityCreateKind" | "setMessageAttachments" | "setMessageText" | "setNotice" | "setReplyingTo" | "t">, "activeConversation"> & { activeConversation: NonNullable<ChatSectionProps["activeConversation"]>; groupMembers: GroupMember[] };

export default function MessageComposer({ activeConversation, activeConversationId, addChatFiles, canSend, chatFileInputRef, groupChannels, isProfileDesktop, mediaUploading, messageAttachments, messageInputRef, messageSending, messageText, replyingTo, selectedChannelId, sendMessage, session, setGroupActivityCreateKind, setMessageAttachments, setMessageText, setNotice, setReplyingTo, t, groupMembers }: Props) {
  return (
    <form className="composer media-composer" onSubmit={(event) => {
                    void sendMessage(event)
                    if (isDesktopBuild) messageInputRef.current?.focus()
                  }}>
                    <input
                      ref={chatFileInputRef}
                      className="hidden-media-input"
                      type="file"
                      multiple
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                      onChange={(event) => {
                        const files = Array.from(event.currentTarget.files || [])
                        event.currentTarget.value = ''
                        void addChatFiles(files)
                      }}
                    />
                    {replyingTo && (
                      <div className="composer-reply-preview">
                        <div>
                          <strong>Đang trả lời {userLabel(replyingTo.senderDisplayName, replyingTo.sender)}</strong>
                          <span>{replyingTo.deleted ? 'Tin nhắn đã thu hồi' : (replyingTo.text || attachmentLabel(replyingTo.attachments))}</span>
                        </div>
                        <button type="button" onClick={() => setReplyingTo(null)} aria-label="Hủy trả lời">×</button>
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
                    <button
                      className="ghost-action attach-button"
                      type="button"
                      onClick={() => chatFileInputRef.current?.click()}
                      disabled={Boolean(mediaUploading) || messageSending}
                      aria-label="Đính kèm file"
                    >
                      <UiIcon name="attach" size={22} />
                      <Plus className="chat-composer-plus" size={21} aria-hidden="true" />
                    </button>
                    <button className="ghost-action chat-composer-image" type="button"
                      onClick={() => chatFileInputRef.current?.click()}
                      disabled={Boolean(mediaUploading) || messageSending}
                      aria-label="Đính kèm ảnh hoặc video" title="Chọn ảnh hoặc video">
                      <Images size={19} aria-hidden="true" />
                    </button>
                    <VoiceRecorder
                      key={`${session.sessionId}:${activeConversationId}`}
                      disabled={Boolean(mediaUploading) || messageSending}
                      onRecorded={(file) => { void addChatFiles([file]) }}
                      onError={(message) => setNotice(message, 'error')}
                    />
                    {activeConversation.type === 'group' && (
                      <GroupActivityComposerMenu
                        key={activeConversation.id}
                        onCreate={setGroupActivityCreateKind}
                      />
                    )}
                    <ChatMentionInput
                      key={`${session.sessionId}:${activeConversation.id}:${selectedChannelId}`}
                      conversationId={activeConversation.id}
                      members={activeConversation.type === 'group' ? groupMembers.filter(member => member.id !== session.user.id) : []}
                      inputRef={messageInputRef}
                      text={messageText}
                      setText={setMessageText}
                      placeholder={isProfileDesktop ? 'Nhập tin nhắn...' : activeConversation.type === 'group' ? selectedChannelId ? `Nhắn vào # ${groupChannels.find(channel => channel.id === selectedChannelId)?.name || 'kênh hội thoại'}...` : `Nhắn vào ${activeConversation.name}...` : `Nhắn ${activeConversation.name}...`}
                      onFilesPaste={(event) => {
                        const files = chatFilesFromClipboard(event.clipboardData)
                        if (files.length === 0) return
                        event.preventDefault()
                        void addChatFiles(files)
                      }}
                    />
                    <button className="send-button polished-send" disabled={!canSend} aria-label="Gửi tin nhắn">
                      <><span className="send-label">Gửi</span><UiIcon name="send" size={19} /></>
                    </button>
                  </form>
  );
}