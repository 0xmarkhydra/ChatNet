import { RefreshCw, Languages, MoreHorizontal, SmilePlus, LoaderCircle, CornerUpLeft, Forward } from "lucide-react";
import UserAvatar from "../../../shared/ui/UserAvatar";
import { userLabel } from "../../../shared/utils/userLabel";
import { formatTime } from "../../../shared/utils/format";
import { MessageReadersInline } from "./MessageReadersDialog";
import { getMessageTranslationView } from "../utils/messageTranslationPresentation";
import { messageReactionLabel } from "../utils/messageReactions";
import { getLatestDirectDelivery, getLatestGroupReaderIdsByMessage } from "../utils/messageReaders";
import { Fragment, useMemo } from "react";
import { GroupActivityMarker } from "./GroupActivities";
import { messageTextParts, messageLinkHref } from "../lib/messageClipboard";
import LinkPreview from "./LinkPreview";
import MediaAttachmentsView from "../../../shared/ui/MediaAttachmentsView";
import type { ChatSectionProps } from "./ChatSection";
import type { Dispatch, SetStateAction } from "react";
import type { Message } from "../types";

type Props = Omit<Pick<ChatSectionProps, "activeChatTranslationSettings" | "activeConversation" | "activeConversationId" | "apiFetch" | "beginMessageLongPress" | "bottomRef" | "cancelMessageLongPress" | "chatOnline" | "chatOutbox" | "conversationBlocked" | "effectiveAutoTranslate" | "effectiveTargetLanguage" | "groupActivities" | "hasMoreMessages" | "languageOptions" | "loadMissingMessages" | "loadOlderMessages" | "manuallyTranslated" | "messageGapBefore" | "messageGapLoading" | "messageInputRef" | "setMessageScrollAtBottom" | "messagesLoadingMore" | "messagesScrollRef" | "moveMessageLongPress" | "openMessageActions" | "openMessageReactions" | "onReactionUsers" | "onForwardMessage" | "reactionPreviews" | "retryQueuedChatMessages" | "selectedChannelId" | "session" | "setGroupActivityViewedId" | "setManuallyTranslated" | "setReplyingTo" | "setTranslationOriginals" | "sortedGroupActivityEvents" | "suppressMessageClick" | "t" | "translateMessage" | "translationFailures" | "translationOriginals" | "translationPending" | "translations" | "updateChatOutbox" | "visibleMessages">, "activeConversation"> & {
  activeConversation: NonNullable<ChatSectionProps["activeConversation"]>;
  messageReaderMembers: Array<{ id: number; username: string; displayName: string }>;
  setReadersTarget: Dispatch<SetStateAction<{ message: Message; readerIds: number[]; sessionId: string } | null>>;
};
export default function MessageTimeline({ activeChatTranslationSettings, activeConversation, activeConversationId, apiFetch, beginMessageLongPress, bottomRef, cancelMessageLongPress, chatOnline, chatOutbox, conversationBlocked, effectiveAutoTranslate, effectiveTargetLanguage, groupActivities, hasMoreMessages, languageOptions, loadMissingMessages, loadOlderMessages, manuallyTranslated, messageGapBefore, messageGapLoading, messageInputRef, setMessageScrollAtBottom, messagesLoadingMore, messagesScrollRef, moveMessageLongPress, openMessageActions, openMessageReactions, onReactionUsers, onForwardMessage, reactionPreviews, retryQueuedChatMessages, selectedChannelId, session, setGroupActivityViewedId, setManuallyTranslated, setReplyingTo, setTranslationOriginals, sortedGroupActivityEvents, suppressMessageClick, t, translateMessage, translationFailures, translationOriginals, translationPending, translations, updateChatOutbox, visibleMessages, messageReaderMembers, setReadersTarget }: Props) {
  const latestDirectDelivery = useMemo(() => (
    activeConversation.type === 'direct' && activeConversation.otherUserId !== undefined
      ? getLatestDirectDelivery(visibleMessages, session.user.id, activeConversation.otherUserId)
      : null
  ), [activeConversation, session.user.id, visibleMessages]);
  const groupReaderIdsByMessage = useMemo(() => (
    activeConversation.type === 'group'
      ? getLatestGroupReaderIdsByMessage(visibleMessages, session.user.id, messageReaderMembers)
      : new Map<number, number[]>()
  ), [activeConversation, messageReaderMembers, session.user.id, visibleMessages]);

  return (
    <div className="messages" ref={messagesScrollRef} onScroll={(event) => {
                    const element = event.currentTarget
                    setMessageScrollAtBottom(element.scrollHeight - element.scrollTop - element.clientHeight < 100)
                  }}>
                    {hasMoreMessages && (
                      <button type="button" className="soco-load-more soco-older-messages"
                        onClick={() => void loadOlderMessages()} disabled={messagesLoadingMore}
                        aria-busy={messagesLoadingMore}>
                        <RefreshCw size={16} aria-hidden="true" />
                        Tải thêm tin nhắn cũ
                      </button>
                    )}
                    {visibleMessages.map((message, index) => {
                      const messageDay = new Date(message.createdAt)
                      const previousDay = index > 0 ? new Date(visibleMessages[index - 1].createdAt) : null
                      const displayDay = !previousDay || messageDay.toDateString() !== previousDay.toDateString()
                      const today = new Date()
                      const yesterday = new Date(today)
                      yesterday.setDate(yesterday.getDate() - 1)
                      const dayLabel = messageDay.toDateString() === today.toDateString() ? 'Hôm nay'
                        : messageDay.toDateString() === yesterday.toDateString() ? 'Hôm qua'
                          : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(messageDay)
                      const mine = message.senderId === session.user.id
                      const groupReaderIds = activeConversation.type === 'group' && mine
                        ? groupReaderIdsByMessage.get(message.id) || []
                        : []
                      const translatedText = !message.deleted ? translations[message.id] : ''
                      const photoOnly = !message.deleted && !message.text && message.attachments?.length === 1 && message.attachments[0].kind === 'image' && Boolean(message.attachments[0].url)
                      const originalVisible = Boolean(translationOriginals[message.id])
                      const translatedLanguage = languageOptions.find(option => option.value === effectiveTargetLanguage)?.localizedLanguage || effectiveTargetLanguage.toUpperCase()
                      const translationEnabled = effectiveAutoTranslate || Boolean(manuallyTranslated[message.id])
                      const translationView = getMessageTranslationView({
                        originalText: message.text,
                        translatedText,
                        enabled: translationEnabled,
                        showOriginal: originalVisible,
                        display: activeChatTranslationSettings?.display,
                      })
                      const hasTranslation = Boolean(translatedText?.trim() && translatedText.trim() !== message.text.trim())
                      const longTranslation = hasTranslation && translationEnabled && (activeChatTranslationSettings?.display === 'translated' ||
                        (activeChatTranslationSettings?.display !== 'bilingual' && Array.from(message.text).length > 100))
                      const isTranslating = Boolean(translationPending[message.id])
                      const translationFailed = Boolean(translationFailures[message.id])
                      const reactionControls = !conversationBlocked ? (
                        <div className="message-reactions">
                          {(message.reactions || []).map((reaction) => (
                            <button
                              key={reaction.emoji}
                              type="button"
                              disabled={reactionPreviews[message.id] !== undefined}
                              className={reaction.mine ? 'reaction-chip active' : 'reaction-chip'}
                              onClick={() => onReactionUsers(message, reaction.emoji)}
                              aria-label={`Xem ${reaction.count} người thả ${messageReactionLabel(reaction.emoji)}`}
                            >
                              {reaction.emoji} {reaction.count}
                            </button>
                          ))}
                          <button type="button" className="reaction-add"
                            aria-label="Chọn cảm xúc cho tin nhắn"
                            title="Thả cảm xúc"
                            onClick={() => openMessageReactions(message)}>
                            <SmilePlus size={16} aria-hidden="true" />
                          </button>
                        </div>
                      ) : null
                      return (
                        <Fragment key={message.id}>
                          {displayDay && <div className="day-divider"><span>{dayLabel}</span></div>}
                          {activeConversation.type === 'group' && sortedGroupActivityEvents
                            .filter(event => event.createdAt <= message.createdAt &&
                              (index === 0 || event.createdAt > visibleMessages[index - 1].createdAt))
                            .map(event => <GroupActivityMarker key={`activity-${event.id}`} event={event}
                              activity={groupActivities.activities.find(item => item.id === event.activityId)}
                              onOpen={() => setGroupActivityViewedId(event.activityId)} />)}
                          {messageGapBefore === message.id && (
                            <button type="button" className="soco-load-more soco-middle-messages"
                              onClick={() => void loadMissingMessages()} disabled={messageGapLoading}
                              aria-busy={messageGapLoading}>
                              <RefreshCw size={15} aria-hidden="true" />
                              Tải tin nhắn ở giữa
                            </button>
                          )}
                        <article
                          data-message-id={message.id}
                          className={'message message-press-target' + (mine ? ' mine' : '') + (activeConversation.type === 'group' ? ' channel-message' : '')}
                          onPointerDown={(event) => {
                            suppressMessageClick.current = null
                            if (!conversationBlocked) beginMessageLongPress(message, event.clientX, event.clientY, event.button, event.pointerType, event.target)
                          }}
                          onPointerMove={(event) => moveMessageLongPress(event.clientX, event.clientY)}
                          onPointerUp={cancelMessageLongPress}
                          onPointerCancel={cancelMessageLongPress}
                          onPointerLeave={cancelMessageLongPress}
                          onClickCapture={(event) => {
                            if (suppressMessageClick.current !== message.id) return
                            event.preventDefault()
                            event.stopPropagation()
                            suppressMessageClick.current = null
                          }}
                          onContextMenu={(event) => {
                            if (message.deleted || conversationBlocked) return
                            // Keep native context-copy for text selected inside this message.
                            const selection = window.getSelection()
                            if (event.target instanceof Element &&
                                event.target.closest('.message-selectable-text') &&
                                !event.target.closest('a.message-inline-link') &&
                                selection && !selection.isCollapsed &&
                                event.currentTarget.contains(selection.anchorNode) &&
                                event.currentTarget.contains(selection.focusNode)) return
                            event.preventDefault()
                            openMessageActions(message, event.target)
                          }}
                        >
                          {!mine && (
                            <>
                              <UserAvatar username={message.sender} name={userLabel(message.senderDisplayName, message.sender)}
                                className="chat-message-sender-avatar" online={false} />
                              <div className={activeConversation.type === 'group' ? 'message-meta' : 'message-meta chat-message-meta-direct'}>{userLabel(message.senderDisplayName, message.sender)}</div>
                            </>
                          )}
                          {message.replyToMessageId && (
                            <div className="message-reply-quote">
                              <strong>{userLabel(message.replyToDisplayName, message.replyToSender)}</strong>
                              <span>{message.replyToText || 'Tin nhắn đã thu hồi'}</span>
                            </div>
                          )}
                          {message.deleted ? (
                            <div className="bubble recalled-message">Tin nhắn đã được thu hồi</div>
                          ) : (
                            <div className="message-content">
                              {message.forwarded && (
                                <span className="chat-forwarded-caption">Đã chuyển tiếp 1 tin nhắn</span>
                              )}
                              {message.text && (
                                <div className={`bubble${translationView.mode === 'dual' ? ' chat-translation-dual' : ''}${translationView.mode === 'translated' ? ' translated-bubble translation-flip-bubble' : ''}`}>
                                  <span
                                    key={`${message.id}-${translationView.mode}-${originalVisible ? 'original' : 'translated'}`}
                                    className="translation-flip-content message-selectable-text"
                                  >
                                    {messageTextParts(translationView.primaryText).map((part, index) => part.kind === 'link'
                                      ? <a key={index} className="message-inline-link" href={messageLinkHref(part.text)} target="_blank" rel="noopener noreferrer">{part.text}</a>
                                      : <Fragment key={index}>{part.text}</Fragment>)}
                                  </span>
                                  {translationView.secondaryText !== null && (
                                    <span className="chat-translation-original message-selectable-text">
                                      {messageTextParts(translationView.secondaryText).map((part, index) => part.kind === 'link'
                                        ? <a key={index} className="message-inline-link" href={messageLinkHref(part.text)} target="_blank" rel="noopener noreferrer">{part.text}</a>
                                        : <Fragment key={index}>{part.text}</Fragment>)}
                                    </span>
                                  )}
                                  <LinkPreview text={message.text} cacheScope={session?.sessionId || ""} request={apiFetch} />
                                  {reactionControls}
                                  {!isTranslating && !effectiveAutoTranslate && translationView.mode === 'dual' && (
                                    <button type="button" className="chat-translation-action"
                                      aria-label="Ẩn dịch" title="Ẩn dịch"
                                      onClick={() => setManuallyTranslated((current) => ({ ...current, [message.id]: false }))}>
                                      <Languages size={17} strokeWidth={1.9} aria-hidden="true" />
                                    </button>
                                  )}
                                  {!isTranslating && !effectiveAutoTranslate &&
                                    (!manuallyTranslated[message.id] || !hasTranslation) && (
                                    <button type="button" className="chat-translation-action"
                                      aria-label={translationFailed ? 'Thử dịch lại' : 'Dịch'}
                                      title={translationFailed ? 'Thử dịch lại' : 'Dịch'}
                                      onClick={() => void translateMessage(message)}>
                                      <Languages size={17} strokeWidth={1.9} aria-hidden="true" />
                                    </button>
                                  )}
                                  {!isTranslating && effectiveAutoTranslate && translationFailed && !hasTranslation && (
                                    <button type="button" className="chat-translation-action"
                                      aria-label="Thử dịch lại" title="Thử dịch lại"
                                      onClick={() => void translateMessage(message)}>
                                      <Languages size={17} strokeWidth={1.9} aria-hidden="true" />
                                    </button>
                                  )}
                                </div>
                              )}
                              {longTranslation && (
                                <button
                                  type="button"
                                  className={originalVisible ? 'translation-flip-pill original' : 'translation-flip-pill translated'}
                                  aria-label={originalVisible ? 'Hiện nội dung đã dịch' : 'Hiện tin nhắn gốc'}
                                  onClick={() => setTranslationOriginals((current) => ({
                                    ...current, [message.id]: !current[message.id],
                                  }))}
                                >
                                  <span className="translation-flip-icon" aria-hidden="true">↔</span>
                                  <b>{originalVisible ? 'DỊCH' : 'GỐC'}</b>
                                  <small>{originalVisible ? translatedLanguage : 'Nguyên văn'}</small>
                                  <span className="translation-flip-swap" aria-hidden="true">↔</span>
                                </button>
                              )}
                              {isTranslating && (
                                <span className="chat-translation-loading" role="status" aria-live="polite">
                                  <LoaderCircle size={15} aria-hidden="true" />
                                  Đang dịch tin nhắn…
                                </span>
                              )}
                              {Boolean(message.attachments?.length) && (
                                <div className={photoOnly ? 'chat-message-media chat-message-photo' : 'chat-message-media'}>
                                  <MediaAttachmentsView items={message.attachments} />
                                  {photoOnly && <span className="chat-image-time">{formatTime(message.createdAt)}</span>}
                                </div>
                              )}
                              {!message.text && reactionControls}
                              {!conversationBlocked && (
                                <div className="chat-message-hover-toolbar" role="group" aria-label="Thao tác tin nhắn">
                                  <button type="button" title="Trả lời" aria-label="Trả lời tin nhắn"
                                    onClick={() => { setReplyingTo(message); messageInputRef.current?.focus() }}>
                                    <CornerUpLeft size={18} strokeWidth={2} aria-hidden="true" />
                                  </button>
                                  <button type="button" title="Chuyển tiếp" aria-label="Chuyển tiếp tin nhắn"
                                    onClick={() => onForwardMessage(message)}>
                                    <Forward size={18} aria-hidden="true" />
                                  </button>
                                  {Boolean(message.text.trim()) && (
                                    <button type="button" title="Dịch" aria-label="Dịch tin nhắn"
                                      disabled={isTranslating}
                                      onClick={() => void translateMessage(message)}>
                                      <Languages size={18} aria-hidden="true" />
                                    </button>
                                  )}
                                  <button type="button" title="Thêm tùy chọn" aria-label="Thêm tùy chọn tin nhắn"
                                    onClick={(event) => openMessageActions(message, event.currentTarget)}>
                                    <MoreHorizontal size={18} aria-hidden="true" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <div className={photoOnly ? 'message-stamp chat-photo-stamp' : 'message-stamp'}>
                            {formatTime(message.createdAt)}
                            {message.editedAt && !message.deleted ? ' · đã sửa' : ''}
                            {activeConversation.type === 'direct' && mine && !message.deleted && latestDirectDelivery?.messageId === message.id
                              ? <span className="chat-message-delivery-status"> · {latestDirectDelivery.status === 'read' ? 'Đã xem' : 'Đã gửi'}</span>
                              : ''}
                            {activeConversation.type === 'group' && mine && groupReaderIds.length > 0
                              ? <MessageReadersInline
                                  readerIds={groupReaderIds}
                                  members={messageReaderMembers}
                                  onOpen={() => setReadersTarget({ message, readerIds: groupReaderIds, sessionId: session.sessionId })}
                                />
                              : ''}
                          </div>
                        </article>
                        </Fragment>
                      )
                    })}
                    {activeConversation.type === 'group' && sortedGroupActivityEvents
                      .filter(event => !visibleMessages.length || event.createdAt > visibleMessages[visibleMessages.length - 1].createdAt)
                      .map(event => <GroupActivityMarker key={`activity-${event.id}`} event={event}
                        activity={groupActivities.activities.find(item => item.id === event.activityId)}
                        onOpen={() => setGroupActivityViewedId(event.activityId)} />)}
                    {activeConversation.type === 'group' && groupActivities.error && (
                      <button type="button" className="group-activity-marker" onClick={() => void groupActivities.refresh()}>
                        Không tải được hoạt động nhóm. Nhấn để thử lại.
                      </button>
                    )}
                    {chatOutbox.filter((item) => item.conversationId === activeConversationId && (item.channelId || 0) === selectedChannelId).map((item) => (
                      <article className="message mine outgoing-preview chat-outbox-message" key={item.clientId} aria-busy={item.status !== 'failed'}>
                        {item.replyToMessageId && (
                          <div className="message-reply-quote">
                            <strong>{item.replyToSender || 'Trả lời'}</strong><span>{item.replyToText}</span>
                          </div>
                        )}
                        {item.text && <div className="bubble"><span className="message-selectable-text">{item.text}</span></div>}
                        <MediaAttachmentsView items={item.attachments} />
                        <div className="chat-outbox-footer">
                          {(item.status === 'failed' || !chatOnline) && (
                            <span className={item.status === 'failed' ? 'message-stamp chat-outbox-error' : 'message-stamp'} role="status">
                              {item.status === 'failed' ? item.error || 'Không gửi được' : 'Chờ có mạng'}
                            </span>
                          )}
                          {!conversationBlocked && (item.status === 'failed' || (item.status === 'unconfirmed' && chatOnline)) && (
                            <button type="button" className="chat-outbox-retry"
                              aria-label={item.status === 'failed' ? 'Gửi lại tin nhắn bị lỗi' : 'Gửi lại tin nhắn đang chờ'}
                              onClick={() => {
                              updateChatOutbox((items) => items.map((old) =>
                                old.clientId === item.clientId ? { ...old, status: 'queued', error: undefined } : old))
                              void retryQueuedChatMessages()
                            }}><RefreshCw size={14} /> Gửi lại</button>
                          )}
                        </div>
                      </article>
                    ))}
                    <div ref={bottomRef} />
                  </div>
  );
}
