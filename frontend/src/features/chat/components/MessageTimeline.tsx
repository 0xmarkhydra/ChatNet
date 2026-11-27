import { useUiLocale, useUiTranslation } from '@/shared/i18n/locale'
import { ArrowDown, RefreshCw, Languages, MoreHorizontal, LoaderCircle, CornerUpLeft, Forward } from "lucide-react";
import UserAvatar from "../../../shared/ui/UserAvatar";
import { userLabel } from "../../../shared/utils/userLabel";
import { formatTime } from "../../../shared/utils/format";
import { MessageReadersInline } from "./MessageReadersDialog";
import { getMessageTranslationView } from "../utils/messageTranslationPresentation";
import { messageReactionLabel } from "../utils/messageReactions";
import { getLatestDirectDelivery, getLatestGroupReaderIdsByMessage } from "../utils/messageReaders";
import { Fragment, memo, useLayoutEffect, useMemo, useState } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import { useChatScrollCoordinator } from "../hooks/useChatScrollCoordinator";
import { GroupActivityMarker } from "./GroupActivities";
import { messageTextParts, messageLinkHref } from "../lib/messageClipboard";
import { getMessageGroupPosition } from "../utils/messageGrouping";
import LinkPreview from "./LinkPreview";
import { replyPreview } from "../utils/conversationPreview";
import { isGiphyMedia } from "../api/giphy";
import MediaAttachmentsView from "../../../shared/ui/MediaAttachmentsView";
import type { ChatSectionProps } from "./ChatSectionProps";
import type { useMessageLongPress } from "../hooks/useMessageLongPress";
import type { Dispatch, SetStateAction } from "react";
import type { Message, GroupMember } from "../types";
import MessageMentionText from "./MessageMentionText";
import { wallpaperBackground } from './ChatWallpaperPicker';
import MessageReactionQuickPicker from "./MessageReactionQuickPicker";


// Isolate scroll-button state so scrolling never rerenders the message bubbles.
function JumpToLatest({ messagesScrollRef }: Pick<ChatSectionProps, 'messagesScrollRef'>) {
  const trUi = useUiTranslation()

  const [showLatest, setShowLatest] = useState(false);
  useLayoutEffect(() => {
    const element = messagesScrollRef.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setShowLatest(element.scrollHeight - element.scrollTop - element.clientHeight >= 96);
      });
    };
    // Recheck when translated text, media, or message rows change geometry.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    const observeRows = () => {
      observer?.disconnect();
      observer?.observe(element);
      for (const child of element.children) observer?.observe(child);
      update();
    };
    const mutations = new MutationObserver(observeRows);
    mutations.observe(element, { childList: true });
    observeRows();
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('scroll', update);
      mutations.disconnect();
      observer?.disconnect();
    };
  }, [messagesScrollRef]);
  if (!showLatest) return null;
  const jumpLatest = () => {
    const element = messagesScrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <button type="button" className="chat-jump-latest absolute bottom-ui-3 left-1/2 z-[12] grid size-control-touch -translate-x-1/2 cursor-pointer place-items-center rounded-full border border-solid border-border-subtle bg-card p-0 text-primary shadow-ui-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={jumpLatest} aria-label={trUi("chat.latestMessage")} title={trUi("chat.latestMessage")}><ArrowDown size={20} aria-hidden="true" /></button>;
}

type Props = Omit<Pick<ChatSectionProps, "activeChatTranslationSettings" | "activeConversation" | "activeConversationId" | "apiFetch" | "bottomRef" | "chatOnline" | "chatOutbox" | "conversationBlocked" | "effectiveAutoTranslate" | "effectiveTargetLanguage" | "groupActivities" | "hasMoreMessages" | "languageOptions" | "loadMissingMessages" | "loadOlderMessages" | "manuallyTranslated" | "messageGapBefore" | "messageGapLoading" | "messageInputRef" | "setMessageScrollAtBottom" | "messagesLoadingMore" | "messageHistoryLoading" | "unreadMessageId" | "messageHistoryError" | "retryMessageHistory" | "messagesScrollRef" | "chatScrollRefs" | "outgoingMessage" | "onReactionUsers" | "onForwardMessage" | "reactionPreviews" | "retryQueuedChatMessages" | "selectedChannelId" | "session" | "setGroupActivityViewedId" | "setManuallyTranslated" | "setReplyingTo" | "setTranslationOriginals" | "sortedGroupActivityEvents" | "t" | "toggleReaction" | "translateMessage" | "translationFailures" | "translationOriginals" | "translationPending" | "translations" | "updateChatOutbox" | "visibleMessages">, "activeConversation"> & Pick<ReturnType<typeof useMessageLongPress>, "beginMessageLongPress" | "cancelMessageLongPress" | "moveMessageLongPress" | "openMessageActions" | "openMessageReactions" | "suppressMessageClick"> & {
  activeConversation: NonNullable<ChatSectionProps["activeConversation"]>;
  messageReaderMembers: Array<{ id: number; username: string; displayName: string }>;
  groupMembers: GroupMember[];
  onProfile: (username: string) => void;
  setReadersTarget: Dispatch<SetStateAction<{ message: Message; readerIds: number[]; sessionId: string } | null>>;
};
export default function MessageTimeline({ activeChatTranslationSettings, activeConversation, activeConversationId, apiFetch, beginMessageLongPress, bottomRef, cancelMessageLongPress, chatOnline, chatOutbox, conversationBlocked, effectiveAutoTranslate, effectiveTargetLanguage, groupActivities, hasMoreMessages, languageOptions, loadMissingMessages, loadOlderMessages, manuallyTranslated, messageGapBefore, messageGapLoading, messageInputRef, setMessageScrollAtBottom, messagesLoadingMore, messageHistoryLoading, unreadMessageId, messageHistoryError, retryMessageHistory, messagesScrollRef, chatScrollRefs, outgoingMessage, moveMessageLongPress, openMessageActions, openMessageReactions, onReactionUsers, onForwardMessage, reactionPreviews, retryQueuedChatMessages, selectedChannelId, session, setGroupActivityViewedId, setManuallyTranslated, setReplyingTo, setTranslationOriginals, sortedGroupActivityEvents, suppressMessageClick, t, toggleReaction, translateMessage, translationFailures, translationOriginals, translationPending, translations, updateChatOutbox, visibleMessages, messageReaderMembers, setReadersTarget, groupMembers, onProfile }: Props) {
  const trUi = useUiTranslation()
  const uiLocale = useUiLocale()
  const timelineDateFormatter = useMemo(() => new Intl.DateTimeFormat(uiLocale, { day: '2-digit', month: '2-digit', year: 'numeric' }), [uiLocale])
  useChatScrollCoordinator({ ...chatScrollRefs, activeConversationId, selectedChannelId, unreadMessageId, messageHistoryLoading, messages: visibleMessages, outgoingMessage, chatOutbox });
  const latestRowActions = useLatest({ apiFetch, beginMessageLongPress, cancelMessageLongPress, moveMessageLongPress, openMessageActions, openMessageReactions, onReactionUsers, onForwardMessage, toggleReaction, setManuallyTranslated, setReplyingTo, setTranslationOriginals, translateMessage, onProfile, setReadersTarget });
  const rowActions = useMemo<RowActions>(() => ({
    apiFetch: (...args) => latestRowActions.current.apiFetch(...args),
    beginMessageLongPress: (...args) => latestRowActions.current.beginMessageLongPress(...args),
    cancelMessageLongPress: (...args) => latestRowActions.current.cancelMessageLongPress(...args),
    moveMessageLongPress: (...args) => latestRowActions.current.moveMessageLongPress(...args),
    openMessageActions: (...args) => latestRowActions.current.openMessageActions(...args),
    openMessageReactions: (...args) => latestRowActions.current.openMessageReactions(...args),
    onReactionUsers: (...args) => latestRowActions.current.onReactionUsers(...args),
    onForwardMessage: (...args) => latestRowActions.current.onForwardMessage(...args),
    toggleReaction: (...args) => latestRowActions.current.toggleReaction(...args),
    setManuallyTranslated: (...args) => latestRowActions.current.setManuallyTranslated(...args),
    setReplyingTo: (...args) => latestRowActions.current.setReplyingTo(...args),
    setTranslationOriginals: (...args) => latestRowActions.current.setTranslationOriginals(...args),
    translateMessage: (...args) => latestRowActions.current.translateMessage(...args),
    onProfile: (...args) => latestRowActions.current.onProfile(...args),
    setReadersTarget: (...args) => latestRowActions.current.setReadersTarget(...args),
  }), [latestRowActions]);
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

  const syncScroll = (element: HTMLDivElement) => {
    if (element.clientHeight > 0) setMessageScrollAtBottom(element.scrollHeight - element.scrollTop - element.clientHeight < 96);
  };
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayLabel = today.toDateString();
  const yesterdayLabel = yesterday.toDateString();
  const translatedLanguage = languageOptions.find(option => option.value === effectiveTargetLanguage)?.localizedLanguage || effectiveTargetLanguage.toUpperCase();

  return (
    <div className="chat-timeline-frame relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <div className="messages min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain scroll-auto!" style={{ backgroundImage: wallpaperBackground(activeConversation.wallpaper) }} ref={messagesScrollRef} onScroll={event => syncScroll(event.currentTarget)}>
                    {hasMoreMessages && (
                      <button type="button" className="soco-load-more soco-older-messages"
                        onClick={() => void loadOlderMessages()} disabled={messagesLoadingMore}
                        aria-busy={messagesLoadingMore}>
                        <RefreshCw size={16} aria-hidden="true" />
                        Tải thêm tin nhắn cũ
                      </button>
                    )}
                    {visibleMessages.length === 0 && messageHistoryLoading && !messageHistoryError && (
                      <div role="status" aria-live="polite" className="flex flex-col justify-end gap-4 px-4 py-4 min-h-full text-sm text-slate-500">
                        <span className="sr-only">Đang tải tin nhắn…</span>
                        {[0,1,2,3,4].map(index => <div key={index} aria-hidden="true" className={'h-9 shrink-0 rounded-2xl bg-muted/60 motion-safe:animate-pulse ' + (index % 2 ? 'self-end w-[45%]' : 'self-start w-[58%]')} />)}
                      </div>
                    )}
                    {visibleMessages.length === 0 && messageHistoryError && (
                      <div role="alert" className="flex flex-col items-center gap-3 py-10 text-sm text-slate-500">
                        <span>Không tải được lịch sử tin nhắn.</span>
                        <button type="button" className="soco-load-more" onClick={retryMessageHistory}>{trUi("common.retry")}</button>
                      </div>
                    )}
                    {visibleMessages.map((message, index) => {
                      const messageDay = new Date(message.createdAt)
                      const previousDay = index > 0 ? new Date(visibleMessages[index - 1].createdAt) : null
                      const displayDay = !previousDay || messageDay.toDateString() !== previousDay.toDateString()
                      const dayLabel = !displayDay ? '' : messageDay.toDateString() === todayLabel ? trUi('chat.today')
                        : messageDay.toDateString() === yesterdayLabel ? trUi('chat.yesterday')
                          : timelineDateFormatter.format(messageDay)
                      const mine = message.senderId === session.user.id
                      const groupReaderIds = activeConversation.type === 'group' && mine
                        ? groupReaderIdsByMessage.get(message.id) || noReaders
                        : noReaders
                      const groupPosition = getMessageGroupPosition(visibleMessages, index, {
                        gapBeforeId: messageGapBefore,
                        unreadBeforeId: unreadMessageId,
                        interruptions: activeConversation.type === 'group' ? sortedGroupActivityEvents : undefined,
                      })
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
                          {unreadMessageId === message.id && (
                            <div className="chat-unread-divider my-ui-4 flex min-w-0 shrink-0 items-center gap-ui-2 text-ui-label font-semibold text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border" data-unread-message-id={message.id} role="separator" aria-label={trUi("chat.unread")}>
                              <span className="text-center">{trUi("chat.unread")}</span>
                            </div>
                          )}
                        <MessageTimelineRow message={message} mine={mine} isGroup={activeConversation.type === 'group'}
                          groupPosition={groupPosition} groupReaderIds={groupReaderIds}
                          groupMembers={activeConversation.type === 'group' ? groupMembers : noMembers}
                          messageReaderMembers={messageReaderMembers} sessionId={session.sessionId}
                          deliveryStatus={latestDirectDelivery?.messageId === message.id ? latestDirectDelivery.status : undefined}
                          conversationBlocked={conversationBlocked} effectiveAutoTranslate={effectiveAutoTranslate}
                          translationDisplay={activeChatTranslationSettings?.display} translatedLanguage={translatedLanguage}
                          translation={translations[message.id]} originalVisible={Boolean(translationOriginals[message.id])}
                          manualTranslation={Boolean(manuallyTranslated[message.id])} translationBusy={Boolean(translationPending[message.id])}
                          translationFailed={Boolean(translationFailures[message.id])} reactionBusy={reactionPreviews[message.id] !== undefined}
                          messageInputRef={messageInputRef} suppressMessageClick={suppressMessageClick} actions={rowActions} />
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
                            <strong>{item.replyToSender || trUi("chat.reply")}</strong><span>{replyPreview(item.replyToText || '')}</span>
                          </div>
                        )}
                        {item.text && (isGiphyMedia(item.text.trim()) ? <img src={item.text.trim()} alt="Sticker GIPHY" referrerPolicy="no-referrer" loading="lazy" decoding="async" className="block h-auto max-h-48 w-40 max-w-full object-contain" /> : <div className="bubble"><span className="message-selectable-text">{item.text}</span></div>)}
                        <MediaAttachmentsView items={item.attachments} />
                        <div className="chat-outbox-footer">
                          {(item.status === 'failed' || !chatOnline) && (
                            <span className={item.status === 'failed' ? 'message-stamp chat-outbox-error' : 'message-stamp'} role="status">
                              {item.status === 'failed' ? item.error || 'Không gửi được' : trUi("chat.waitingNetwork")}
                            </span>
                          )}
                          {!conversationBlocked && (item.status === 'failed' || (item.status === 'unconfirmed' && chatOnline)) && (
                            <button type="button" className="chat-outbox-retry"
                              aria-label={item.status === 'failed' ? trUi("common.ui.retryFailedMessage") : trUi("common.ui.retryPendingMessage")}
                              onClick={() => {
                              updateChatOutbox((items) => items.map((old) =>
                                old.clientId === item.clientId ? { ...old, status: 'queued', error: undefined } : old))
                              void retryQueuedChatMessages()
                            }}><RefreshCw size={14} />{trUi("common.resend")}</button>
                          )}
                        </div>
                      </article>
                    ))}
                    <div ref={bottomRef} />
                  </div>
      <JumpToLatest messagesScrollRef={messagesScrollRef} />
    </div>
  );
}
type RowActions = Pick<Props, 'apiFetch' | 'beginMessageLongPress' | 'cancelMessageLongPress' | 'moveMessageLongPress' | 'openMessageActions' | 'openMessageReactions' | 'onReactionUsers' | 'onForwardMessage' | 'toggleReaction' | 'setManuallyTranslated' | 'setReplyingTo' | 'setTranslationOriginals' | 'translateMessage' | 'onProfile' | 'setReadersTarget'>;
const noMembers: GroupMember[] = [];
const noReaders: number[] = [];
type RowProps = {
  message: Message;
  mine: boolean;
  isGroup: boolean;
  groupPosition: ReturnType<typeof getMessageGroupPosition>;
  groupReaderIds: number[];
  groupMembers: GroupMember[];
  messageReaderMembers: Props['messageReaderMembers'];
  deliveryStatus?: string;
  sessionId: string;
  conversationBlocked: boolean;
  effectiveAutoTranslate: boolean;
  translationDisplay: NonNullable<Props['activeChatTranslationSettings']>['display'] | undefined;
  translatedLanguage: string;
  translation?: string;
  originalVisible: boolean;
  manualTranslation: boolean;
  translationBusy: boolean;
  translationFailed: boolean;
  reactionBusy: boolean;
  messageInputRef: Props['messageInputRef'];
  suppressMessageClick: Props['suppressMessageClick'];
  actions: RowActions;
};

// Bubble-local state stays mounted when unrelated draft, rail, or receipt updates render the parent.
const MessageTimelineRow = memo(function MessageTimelineRow({ message, mine, isGroup, groupPosition, groupReaderIds, groupMembers, messageReaderMembers, deliveryStatus, sessionId, conversationBlocked, effectiveAutoTranslate, translationDisplay, translatedLanguage, translation, originalVisible, manualTranslation, translationBusy, translationFailed, reactionBusy, messageInputRef, suppressMessageClick: suppressMessageClickRef, actions }: RowProps) {
  const trUi = useUiTranslation()
  const uiLocale = useUiLocale()
  const { apiFetch, beginMessageLongPress, cancelMessageLongPress, moveMessageLongPress, openMessageActions, openMessageReactions, onReactionUsers, onForwardMessage, toggleReaction, setManuallyTranslated, setReplyingTo, setTranslationOriginals, translateMessage, onProfile, setReadersTarget } = actions;
  const groupStart = groupPosition === 'single' || groupPosition === 'start'
  const groupEnd = groupPosition === 'single' || groupPosition === 'end'
  const giphyUrl = !message.deleted && isGiphyMedia(message.text.trim()) ? message.text.trim() : ''
  const translatedText = !message.deleted && !giphyUrl ? translation : ''
  const photoOnly = !message.deleted && !message.text && message.attachments?.length === 1 && message.attachments[0].kind === 'image' && Boolean(message.attachments[0].url)
  const translationEnabled = effectiveAutoTranslate || manualTranslation
  const translationView = getMessageTranslationView({
    originalText: message.text,
    translatedText,
    enabled: translationEnabled,
    showOriginal: originalVisible,
    display: translationDisplay,
  })
  const hasTranslation = Boolean(translatedText?.trim() && translatedText.trim() !== message.text.trim())
  const longTranslation = hasTranslation && translationEnabled && (translationDisplay === 'translated' ||
    (translationDisplay !== 'bilingual' && Array.from(message.text).length > 100))
  const isTranslating = !giphyUrl && translationBusy
  const reactionControls = !conversationBlocked ? (
    <div className="message-reactions">
      {(message.reactions || []).map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          disabled={reactionBusy}
          className={reaction.mine ? 'reaction-chip active' : 'reaction-chip'}
          onClick={() => onReactionUsers(message, reaction.emoji)}
          aria-label={trUi("common.ui.viewReactionCount", { v1: reaction.count, v2: messageReactionLabel(reaction.emoji, trUi) })}
        >
          <span className={reaction.mine && reactionBusy ? 'reaction-motion-glyph' : undefined}
            aria-hidden="true">{reaction.emoji}</span>{' '}{reaction.count}
        </button>
      ))}
      <MessageReactionQuickPicker message={message}
        busy={reactionBusy}
        toggleReaction={toggleReaction} openMessageReactions={openMessageReactions} />
    </div>
  ) : null
  return (
    <article
      data-message-id={message.id}
      className={'message message-press-target min-w-0 animate-none!' + (mine ? ' mine' : '') + (isGroup ? ' channel-message' : '') + (groupPosition !== 'single' ? ` message-group-${groupPosition}` : '')}
      title={!groupEnd ? formatTime(message.createdAt, uiLocale) + (message.editedAt && !message.deleted ? ' · ' + trUi('chat.edited') : '') : undefined}
      onPointerDown={(event) => {
        suppressMessageClickRef.current = null
        if (!conversationBlocked) beginMessageLongPress(message, event.clientX, event.clientY, event.button, event.pointerType, event.target)
      }}
      onPointerMove={(event) => moveMessageLongPress(event.clientX, event.clientY)}
      onPointerUp={cancelMessageLongPress}
      onPointerCancel={cancelMessageLongPress}
      onPointerLeave={cancelMessageLongPress}
      onClickCapture={(event) => {
        if (suppressMessageClickRef.current !== message.id) return
        event.preventDefault()
        event.stopPropagation()
        suppressMessageClickRef.current = null
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
          {groupEnd && <UserAvatar username={message.sender} name={userLabel(message.senderDisplayName, message.sender)}
            className="chat-message-sender-avatar" online={false} />}
          {groupStart && <div className={isGroup ? 'message-meta' : 'message-meta chat-message-meta-direct'}>{userLabel(message.senderDisplayName, message.sender)}</div>}
        </>
      )}
      {message.replyToMessageId && (
        <div className="message-reply-quote">
          <strong>{userLabel(message.replyToDisplayName, message.replyToSender)}</strong>
          <span>{replyPreview(message.replyToText || '') || trUi('chat.recalled')}</span>
        </div>
      )}
      {message.deleted ? (
        <div className="bubble recalled-message">{trUi("chat.recalledFull")}</div>
      ) : (
        <div className="message-content">
          {message.forwarded && (
            <span className="chat-forwarded-caption">{trUi("chat.forwardedOne")}</span>
          )}
          {giphyUrl && <div className="chat-message-media"><img src={giphyUrl} alt="Sticker GIPHY" referrerPolicy="no-referrer" loading="lazy" decoding="async" className="block h-auto max-h-48 w-40 max-w-full object-contain" /></div>}
          {message.text && !giphyUrl && (
            <div className={`bubble${translationView.mode === 'dual' ? ' chat-translation-dual' : ''}${translationView.mode === 'translated' ? ' translated-bubble translation-flip-bubble' : ''}`}>
              <span
                key={`${message.id}-${translationView.mode}-${originalVisible ? 'original' : 'translated'}`}
                className="translation-flip-content message-selectable-text"
              >
                <MessageMentionText text={translationView.primaryText} members={groupMembers} onProfile={onProfile} />
              </span>
              {translationView.secondaryText !== null && (
                <span className="chat-translation-original message-selectable-text">
                  {messageTextParts(translationView.secondaryText).map((part, index) => part.kind === 'link'
                    ? <a key={index} className="message-inline-link" href={messageLinkHref(part.text)} target="_blank" rel="noopener noreferrer">{part.text}</a>
                    : <Fragment key={index}>{part.text}</Fragment>)}
                </span>
              )}
              <LinkPreview text={message.text} cacheScope={sessionId} request={apiFetch} />
              {reactionControls}
              {!isTranslating && !effectiveAutoTranslate && translationView.mode === 'dual' && (
                <button type="button" className="chat-translation-action"
                  aria-label={trUi("chat.hideTranslation")} title={trUi("chat.hideTranslation")}
                  onClick={() => setManuallyTranslated((current) => ({ ...current, [message.id]: false }))}>
                  <Languages size={17} strokeWidth={1.9} aria-hidden="true" />
                </button>
              )}
              {!isTranslating && !effectiveAutoTranslate &&
                (!manualTranslation || !hasTranslation) && (
                <button type="button" className="chat-translation-action"
                  aria-label={translationFailed ? trUi('chat.retryTranslation') : trUi('chat.translate')}
                  title={translationFailed ? trUi('chat.retryTranslation') : trUi('chat.translate')}
                  onClick={() => void translateMessage(message)}>
                  <Languages size={17} strokeWidth={1.9} aria-hidden="true" />
                </button>
              )}
              {!isTranslating && effectiveAutoTranslate && translationFailed && !hasTranslation && (
                <button type="button" className="chat-translation-action"
                  aria-label={trUi("chat.retryTranslation")} title={trUi("chat.retryTranslation")}
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
              aria-label={originalVisible ? trUi('common.ui.showTranslated') : trUi('common.ui.showOriginal')}
              onClick={() => setTranslationOriginals((current) => ({
                ...current, [message.id]: !current[message.id],
              }))}
            >
              <span className="translation-flip-icon" aria-hidden="true">↔</span>
              <b>{originalVisible ? trUi('chat.translatedShort') : trUi('chat.originalShort')}</b>
              <small>{originalVisible ? translatedLanguage : trUi('chat.originalText')}</small>
              <span className="translation-flip-swap" aria-hidden="true">↔</span>
            </button>
          )}
          {isTranslating && (
            <span className="chat-translation-loading" role="status" aria-live="polite">
              <LoaderCircle size={15} aria-hidden="true" />
              {trUi('chat.translationWorking')}
            </span>
          )}
          {Boolean(message.attachments?.length) && (
            <div className={photoOnly ? 'chat-message-media chat-message-photo' : 'chat-message-media'}>
              <MediaAttachmentsView items={message.attachments} deferVideo />
              {photoOnly && <span className="chat-image-time">{formatTime(message.createdAt, uiLocale)}</span>}
            </div>
          )}
          {(!message.text || giphyUrl) && reactionControls}
          {!conversationBlocked && (
            <div className="chat-message-hover-toolbar" role="group" aria-label={trUi("common.ui.messageActions")}>
              <button type="button" title={trUi("chat.reply")} aria-label={trUi("common.ui.replyMessage")}
                onClick={() => { setReplyingTo(message); messageInputRef.current?.focus() }}>
                <CornerUpLeft size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <button type="button" title={trUi("chat.forward")} aria-label={trUi("chat.forwardMessage")}
                onClick={() => onForwardMessage(message)}>
                <Forward size={18} aria-hidden="true" />
              </button>
              {Boolean(message.text.trim()) && !giphyUrl && (
                <button type="button" title={trUi("chat.translate")} aria-label={trUi("common.ui.translateMessage")}
                  disabled={isTranslating}
                  onClick={() => void translateMessage(message)}>
                  <Languages size={18} aria-hidden="true" />
                </button>
              )}
              <button type="button" title={trUi("common.ui.moreOptions")} aria-label={trUi("common.ui.moreMessageOptions")}
                onClick={(event) => openMessageActions(message, event.currentTarget)}>
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
      <div className={photoOnly ? 'message-stamp chat-photo-stamp' : 'message-stamp'}>
        {formatTime(message.createdAt, uiLocale)}
        {message.editedAt && !message.deleted ? ' · ' + trUi('chat.edited') : ''}
        {!isGroup && mine && !message.deleted && deliveryStatus
          ? <span className="chat-message-delivery-status"> · {deliveryStatus === 'read' ? trUi('chat.seen') : trUi('common.sent')}</span>
          : ''}
        {isGroup && mine && groupReaderIds.length > 0
          ? <MessageReadersInline
              readerIds={groupReaderIds}
              members={messageReaderMembers}
              onOpen={() => setReadersTarget({ message, readerIds: groupReaderIds, sessionId: sessionId })}
            />
          : ''}
      </div>
    </article>
  );
});