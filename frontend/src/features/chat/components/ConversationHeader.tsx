import { Search, Users, Languages, MoreHorizontal, X, Hash } from "lucide-react";
import ConversationAvatar from "./ConversationAvatar";
import UserAvatar from "../../../shared/ui/UserAvatar";
import { CategoryAssignment } from "./ConversationCategories";
import { CallHeaderActions } from "../../calls/components/CallManager";
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
 return (
<header className="chat-head">
                    <div className="room-info">
                      <button className="mobile-back" type="button"
                        aria-label={activeConversation.type === "group" ? "Quay lại danh sách kênh" : "Quay lại danh sách"}
                        onClick={() => {
                          if (activeConversation.type === "group") {
                            setMobileChannelSelected(false);
                            setChannelSidebarOpen(true);
                          } else setActiveConversationId(null);
                        }}>‹</button>
                      {activeConversation.type === 'group' && selectedChannelId !== 0
                        ? <UserAvatar name={selectedRoomTitle} className="room-avatar" group imageUrl={selectedRoomAvatar} />
                        : <ConversationAvatar conversation={activeConversation} className="room-avatar" />}
                      <div className={activeConversation.type === 'group' ? 'group-room-details' : ''}>
                        {activeConversation.type === 'group' ? (
                          <>
                            <div className="group-room-title">
                              <strong title={selectedRoomTitle}>{selectedRoomTitle}</strong>
                              <button type="button" className="group-channel-sidebar-toggle"
                                aria-label="Mở danh sách kênh hội thoại"
                                onClick={() => { setMobileChannelSelected(false); setChannelSidebarOpen(true); }}>
                                <Hash size={18} aria-hidden="true" />
                              </button>
                            </div>
                            <div className="room-subtitle group-room-subtitle">
                              {selectedChannelId === 0 ? <>
                                <button type="button" className="group-room-member-count"
                                  aria-label={`Xem danh sách ${activeConversation.memberCount} thành viên nhóm`}
                                  onClick={() => {
                                    if (!groupSettingsOpen) openGroupSettings(activeConversation)
                                    setGroupMemberViewOpen(true)
                                  }}>
                                  <Users size={15} aria-hidden="true" />
                                  <span>{activeConversation.name} · {activeConversation.memberCount} thành viên</span>
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
                            <strong>{activeConversation.otherUsername
                              ? <button type="button" className="visitor-name-link"
                                onClick={() => openVisitor(activeConversation.otherUsername!)}
                                aria-label="Xem trang cá nhân">{activeConversation.name}</button>
                              : activeConversation.name}</strong>
                            <small className="room-subtitle">
                              {conversationBlocked ? (activeConversation.blockedByOther ? 'Bạn đã bị chặn' : 'Bạn đã chặn người này') : activeConversation.online ? '● Đang hoạt động' : 'Chat riêng'}
                              <CategoryAssignment model={conversationCategories}
                                conversationId={activeConversation.id}
                                categoryId={activeConversation.categoryId} />
                            </small>
                          </>
                        )}
                      </div>
                    </div>

                    {activeConversation.type === 'group' && (
                      <div className="group-mobile-actions">
                        <CallHeaderActions conversationId={activeConversation.id} disabled={conversationBlocked} />
                        <button type="button" className="group-more-trigger"
                          aria-label="Tìm tin nhắn trong cuộc trò chuyện"
                          onClick={() => setMessageSearchOpen(true)}>
                          <Search size={20} aria-hidden="true" />
                        </button>
                        <div className="translation-hub">
                          <button type="button" className="group-more-trigger translation-toolbar-toggle"
                            aria-label={effectiveAutoTranslate ? 'Cài đặt dịch AI, đang bật' : 'Cài đặt dịch AI, đang tắt'}
                            title="Cài đặt dịch AI"
                            aria-expanded={translationMenuOpen}
                            aria-controls="chat-translation-dialog"
                            onClick={() => {
                              setLanguageSearch('')
                              setTranslationMenuOpen((open) => !open)
                            }}>
                            <Languages size={20} strokeWidth={1.9} aria-hidden="true" />
                          </button>
                        </div>
                        <button type="button" className="group-more-trigger"
                          aria-label="Thông tin hội thoại" aria-controls="conversation-details-panel"
                          aria-expanded={conversationDetailsOpen}
                          onClick={() => { setGroupSettingsOpen(false); setConversationDetailsOpen((open) => !open) }}>
                          <MoreHorizontal size={23} aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    <div className="translate-controls">
                      <CallHeaderActions conversationId={activeConversation.id} disabled={conversationBlocked} />
                      <button type="button" className="group-settings-toggle" onClick={() => setMessageSearchOpen(true)} title="Tìm trong cuộc trò chuyện" aria-label="Tìm tin nhắn trong cuộc trò chuyện"><Search size={19} /></button>
                      <div className="translation-hub">
                        <button
                          type="button"
                          className={translationMenuOpen ? 'group-settings-toggle translation-toolbar-toggle active' : 'group-settings-toggle translation-toolbar-toggle'}
                          aria-expanded={translationMenuOpen}
                          aria-controls="chat-translation-dialog"
                          aria-label={effectiveAutoTranslate ? 'Cài đặt dịch AI, đang bật' : 'Cài đặt dịch AI, đang tắt'}
                          title="Cài đặt dịch AI"
                          onClick={() => {
                            setTranslationMenuOpen((current) => {
                              const next = !current
                              if (next) setLanguageSearch('')
                              return next
                            })
                          }}
                        >
                          <Languages size={21} strokeWidth={1.9} aria-hidden="true" />
                        </button>

                        {translationMenuOpen && createPortal(
                          <>
                            <button
                              type="button"
                              className="translation-hub-scrim"
                              aria-label="Đóng cài đặt dịch"
                              onClick={() => setTranslationMenuOpen(false)}
                            />
                            <div id="chat-translation-dialog" className="translation-hub-popover translation-dialog-modal" role="dialog" aria-modal="true" aria-label="Cài đặt dịch AI">
                              <div className="translation-hub-heading">
                                <div>
                                  <strong>{t('translation.title')}</strong>
                                  <small>{t('translation.subtitle')}</small>
                                </div>
                                <div className="translation-dialog-actions">
                                  <button
                                    type="button"
                                    className={effectiveAutoTranslate ? 'translation-hub-switch active' : 'translation-hub-switch'}
                                    aria-label="Tự động dịch tin nhắn"
                                    role="switch"
                                    aria-checked={effectiveAutoTranslate}
                                    onClick={() => changeAutoTranslate(!effectiveAutoTranslate)}
                                  >
                                    <span />
                                  </button>
                                  <button type="button" className="translation-dialog-close"
                                    aria-label="Đóng cài đặt dịch" onClick={() => setTranslationMenuOpen(false)}>
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
                                  <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setLanguageSearch('')}>×</button>
                                )}
                              </label>

                              <div className="translation-language-count">
                                <span>{visibleLanguageOptions.length} {t('translation.languageCount')}</span>
                                <small>{t('translation.languageHint')}</small>
                              </div>

                              <div className="translation-language-list" aria-label="Chọn ngôn ngữ dịch">
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
                      <button type="button" className={conversationDetailsOpen ? 'group-settings-toggle active' : 'group-settings-toggle'}
                        onClick={() => { setGroupSettingsOpen(false); setConversationDetailsOpen((open) => !open) }}
                        title="Thông tin hội thoại" aria-label="Thông tin hội thoại"
                        aria-controls="conversation-details-panel" aria-expanded={conversationDetailsOpen}>
                        <MoreHorizontal size={22} aria-hidden="true" />
                      </button>
                    </div>
                  </header>
 );
}