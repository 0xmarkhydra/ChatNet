import ChatTranslationSettingsPage from "./ChatTranslationSettingsPage";
import { type ChatTranslationSettings } from "../lib/conversationTranslationSettings";
import { type Session } from "../../auth/lib/session";
import { type ToastKind } from "../../../shared/utils/toast";
import { type SetStateAction } from "react";
import type { LanguageOption } from "../../i18n/utils/languages";
import type { Dispatch } from "react";

export type ChatTranslationSectionProps = {
  activeChatTranslationSettings: ChatTranslationSettings | undefined;
  activeConversation: { name: string; categoryId?: number; pinnedAt?: string; id: number; type: "direct" | "group"; blockedByMe?: boolean; blockedByOther?: boolean; otherUserId?: number; otherUsername?: string; memberCount: number; unreadCount: number; lastMessage: string; lastMessageAt?: string; online: boolean; createdAt: string; };
  autoTranslate: boolean;
  languageOptions: LanguageOption[];
  saveConversationTranslationSettings: (conversationId: number, settings: ChatTranslationSettings) => boolean;
  session: Session;
  setNotice: (message: string, kind?: ToastKind) => void;
  setTranslationSettingsConversationId: Dispatch<SetStateAction<number | null>>;
  targetLanguage: string;
  translationSettingsConversationId: number;
};

export default function ChatTranslationSection({
  activeChatTranslationSettings,
  activeConversation,
  autoTranslate,
  languageOptions,
  saveConversationTranslationSettings,
  session,
  setNotice,
  setTranslationSettingsConversationId,
  targetLanguage,
  translationSettingsConversationId,
}: ChatTranslationSectionProps) {
  return (
      <ChatTranslationSettingsPage
            key={`${session.user.id}:${translationSettingsConversationId}`}
            conversation={activeConversation}
            languages={languageOptions}
            initial={activeChatTranslationSettings ?? {
              enabled: autoTranslate,
              targetLanguage,
              sourceLanguage: targetLanguage === 'en' ? 'vi' : 'en',
              display: 'adaptive',
            }}
            onCancel={() => setTranslationSettingsConversationId(null)}
            onSave={settings => {
              if (saveConversationTranslationSettings(translationSettingsConversationId, settings)) {
                setTranslationSettingsConversationId(null);
                setNotice('Đã lưu cài đặt dịch cho cuộc trò chuyện.', 'success');
              }
            }}
          />
  );
}
