import { useUiTranslation } from '@/shared/i18n/locale'
import { Search, Users, Languages, MoreHorizontal, X, Hash } from "lucide-react";
import ConversationAvatar from "./ConversationAvatar";
import UserAvatar from "../../../shared/ui/UserAvatar";
import { CategoryAssignment } from "./ConversationCategories";
import { CallHeaderActions } from "../../calls";
import { createPortal } from "react-dom";
import type { ChatSectionProps } from "./ChatSectionProps";
import type { Dispatch, SetStateAction } from "react";

type Props = Omit<Pick<ChatSectionProps, "activeConversation" | "changeAutoTranslate" | "changeTargetLanguage" | "conversationBlocked" | "conversationCategories" | "conversationDetailsOpen" | "effectiveAutoTranslate" | "effectiveTargetLanguage" | "groupSettingsOpen" | "languageSearch" | "openGroupSettings" | "openVisitor" | "setActiveConversationId" | "setConversationDetailsOpen" | "setGroupMemberViewOpen" | "setGroupSettingsOpen" | "setLanguageSearch" | "setMessageSearchOpen" | "setTranslationMenuOpen" | "t" | "translationMenuOpen" | "visibleLanguageOptions"> & { setChannelSidebarOpen: Dispatch<SetStateAction<boolean>> }, "activeConversation"> & { activeConversation: NonNullable<ChatSectionProps["activeConversation"]>;
  setMobileChannelSelected: Dispatch<SetStateAction<boolean>>;
  selectedChannelId: number;
  selectedRoomTitle: string;
  selectedRoomAvatar?: string;
  selectedChannelDescription?: string;
};
export default function ConversationHeader({ activeConversation, changeAutoTranslate, changeTargetLanguage, conversationBlocked, conversationCategories, conversationDetailsOpen, effectiveAutoTranslate, effectiveTargetLanguage, groupSettingsOpen, languageSearch, openGroupSettings, openVisitor, setActiveConversationId, setConversationDetailsOpen, setGroupMemberViewOpen, setGroupSettingsOpen, setLanguageSearch, setMessageSearchOpen, setTranslationMenuOpen, t, translationMenuOpen, visibleLanguageOptions, setChannelSidebarOpen, setMobileChannelSelected, selectedChannelId, selectedRoomTitle, selectedRoomAvatar, selectedChannelDescription }: Props) {
  const trUi = useUiTranslation()

  function toggleDetails() {
    setGroupSettingsOpen(false);
    setConversationDetailsOpen(open => !open);
  }

  // The responsive wrappers keep their existing CSS; both use the same actions.
  function renderActions(desktop: boolean) {
    const buttonClass = desktop ? 'group-settings-toggle' : 'group-more-trigger';
    return <>
      <CallHeaderActions conversationId={activeConversation.id} disabled={conversationBlocked} />
      <button type="button" className={buttonClass}
        title={desktop ? trUi("common.ui.searchInChat") : undefined}
        aria-label={trUi("chat.searchMessage")}
        onClick={() => setMessageSearchOpen(true)}>
        <Search size={desktop ? 19 : 20} aria-hidden="true" />
      </button>
      <div className="translation-hub">
        <button type="button"
          className={`${buttonClass} translation-toolbar-toggle${desktop && translationMenuOpen ? ' active' : ''}`}
          aria-label={effectiveAutoTranslate ? trUi("common.ui.aiEnabled") : trUi("common.ui.aiDisabled")}
          title={trUi("chat.aiSettings")} aria-expanded={translationMenuOpen} aria-controls="chat-translation-dialog"
          onClick={() => {
            if (!translationMenuOpen || !desktop) setLanguageSearch('');
            setTranslationMenuOpen(open => !open);
          }}>
          <Languages size={desktop ? 21 : 20} strokeWidth={1.9} aria-hidden="true" />
        </button>
        {desktop && translationMenuOpen && createPortal(
                          <>
                            <button
                              type="button"
                              className="translation-hub-scrim"
                              aria-label={trUi("chat.closeTranslationSettings")}
                              onClick={() => setTranslationMenuOpen(false)}
                            />
                            <div id="chat-translation-dialog" className="translation-hub-popover translation-dialog-modal" role="dialog" aria-modal="true" aria-label={trUi("chat.aiSettings")}>
                              <div className="translation-hub-heading">
                                <div>
                                  <strong>{t('translation.title')}</strong>
                                  <small>{t('translation.subtitle')}</small>
                                </div>
                                <div className="translation-dialog-actions">
                                  <button
                                    type="button"
                                    className={effectiveAutoTranslate ? 'translation-hub-switch active' : 'translation-hub-switch'}
                                    aria-label={trUi("chat.autoTranslate")}
                                    role="switch"
                                    aria-checked={effectiveAutoTranslate}
                                    onClick={() => changeAutoTranslate(!effectiveAutoTranslate)}
                                  >
                                    <span />
                                  </button>
                                  <button type="button" className="translation-dialog-close"
                                    aria-label={trUi("chat.closeTranslationSettings")} onClick={() => setTranslationMenuOpen(false)}>
                                    <X size={19} aria-hidden="true" />
                                  </button>
                                </div>
                              </div>

                              <label className="translation-language-search">
                                <span aria-hidden="true">⌕</span>
                                <input
                                  type="search"
                                  value={languageSearch}
                                  onChange={(event) => setLanguageSearch(event.target.value)}
                                  placeholder={t('translation.searchPlaceholder')}
                                  autoComplete="off"
                                  autoCapitalize="none"
                                  spellCheck={false}
                                  autoFocus
                                />
                                {languageSearch && (
                                  <button type="button" aria-label={trUi("common.clearSearch")} onClick={() => setLanguageSearch('')}>×</button>
                                )}
                              </label>

                              <div className="translation-language-count">
                                <span>{visibleLanguageOptions.length} {t('translation.languageCount')}</span>
                                <small>{t('translation.languageHint')}</small>
                              </div>

                              <div className="translation-language-list" aria-label={trUi("chat.selectTranslationLanguage")}>
                                {visibleLanguageOptions.map((language) => (
                                  <button
                                    key={language.value}
                                    type="button"
                                    className={effectiveTargetLanguage === language.value ? 'active' : ''}
                                    onClick={() => changeTargetLanguage(language.value)}
                                  >
                                    <span className="translation-language-flag" aria-hidden="true">{language.flag}</span>
                                    <span className="translation-language-copy">
                                      <strong>{language.localizedLanguage}</strong>
                                      <small>{language.nativeLanguage}</small>
                                      <em>{language.localizedRegion} · {language.nativeRegion}</em>
                                    </span>
                                    <b>{language.code}</b>
                                    {effectiveTargetLanguage === language.value && <i aria-hidden="true">✓</i>}
                                  </button>
                                ))}
                                {visibleLanguageOptions.length === 0 && (
                                  <div className="translation-language-empty">
                                    {t('translation.noResults')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </>, document.body
                        )}
      </div>
      <button type="button" className={`${buttonClass}${desktop && conversationDetailsOpen ? ' active' : ''}`}
        title={desktop ? trUi("chat.conversationInfo") : undefined}
        aria-label={trUi("chat.conversationInfo")} aria-controls="conversation-details-panel"
        aria-expanded={conversationDetailsOpen} onClick={toggleDetails}>
        <MoreHorizontal size={desktop ? 22 : 23} aria-hidden="true" />
      </button>
    </>;
  }

 return (
<header className="chat-head">
                    <div className="room-info">
                      <button className="mobile-back" type="button"
                        aria-label={activeConversation.type === "group" ? trUi("common.ui.backChannels") : trUi("common.ui.backList")}
                        onClick={() => {
                          if (activeConversation.type === "group") {
                            setMobileChannelSelected(false);
                            setChannelSidebarOpen(true);
                          } else setActiveConversationId(null);
                        }}>‹</button>
                      {activeConversation.type === 'group' && selectedChannelId !== 0
                        ? <UserAvatar name={selectedRoomTitle} className="room-avatar" group imageUrl={selectedRoomAvatar} />
                        : <ConversationAvatar conversation={activeConversation} className="room-avatar" />}
                      <div className={activeConversation.type === 'group' ? 'group-room-details' : 'room-copy'}>
                        {activeConversation.type === 'group' ? (
                          <>
                            <div className="group-room-title">
                              <strong title={selectedRoomTitle}>{selectedRoomTitle}</strong>
                              <button type="button" className="group-channel-sidebar-toggle"
                                aria-label={trUi("chat.openChannels")}
                                onClick={() => { setMobileChannelSelected(false); setChannelSidebarOpen(true); }}>
                                <Hash size={18} aria-hidden="true" />
                              </button>
                            </div>
                            <div className="room-subtitle group-room-subtitle">
                              {selectedChannelId === 0 ? <>
                                <button type="button" className="group-room-member-count"
                                  aria-label={trUi("common.ui.groupMembersCount", { v1: String(activeConversation.memberCount) })}
                                  onClick={() => {
                                    if (!groupSettingsOpen) openGroupSettings(activeConversation)
                                    setGroupMemberViewOpen(true)
                                  }}>
                                  <Users size={15} aria-hidden="true" />
                                  <span>{activeConversation.memberCount} thành viên</span>
                                </button>
                                <CategoryAssignment model={conversationCategories}
                                  conversationId={activeConversation.id}
                                  categoryId={activeConversation.categoryId} />
                              </> : <span className="group-channel-parent-label"
                                title={selectedChannelDescription || activeConversation.name}>
                                {selectedChannelDescription || `Thuộc nhóm ${activeConversation.name}`}
                              </span>}
                            </div>
                          </>
                        ) : (
                          <>
                            <strong title={activeConversation.name}>{activeConversation.otherUsername
                              ? <button type="button" className="visitor-name-link"
                                onClick={() => openVisitor(activeConversation.otherUsername!)}
                                aria-label={trUi("profile.viewProfile")}>{activeConversation.name}</button>
                              : activeConversation.name}</strong>
                            <small className="room-subtitle">
                              {conversationBlocked ? (activeConversation.blockedByOther ? trUi("chat.blockedBy") : trUi("chat.blockedUser")) : activeConversation.online ? '● Đang hoạt động' : trUi("app.privateChat")}
                              <CategoryAssignment model={conversationCategories}
                                conversationId={activeConversation.id}
                                categoryId={activeConversation.categoryId} />
                            </small>
                          </>
                        )}
                      </div>
                    </div>

                    <div className={activeConversation.type === 'group' ? 'group-mobile-actions' : 'group-mobile-actions compact-room-actions'}>
                      {renderActions(false)}
                    </div>
                    <div className="translate-controls">
                      {renderActions(true)}
                    </div>
                  </header>
 );
}