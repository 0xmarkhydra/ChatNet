import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Conversation } from "../types";
import type { ChatQuickContact, ChatQuickHit } from "./useChatQuickSearch";
import type { ChatMessageJump } from "./useChatMessageJumpFocus";

/** Own quick-search selection and message-jump coordination inside Chat. */
export function useChatQuickSelectionActions({
  setQuickSearchOpen,
  setGlobalSearch,
  setChatSearchJump,
  setConversations,
  selectConversation,
  openDirectByUsername,
  nextRevision,
  setTranslations,
  setTranslationOriginals,
}: {
  setQuickSearchOpen: Dispatch<SetStateAction<boolean>>;
  setGlobalSearch: Dispatch<SetStateAction<string>>;
  setChatSearchJump: Dispatch<SetStateAction<ChatMessageJump | null>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  selectConversation: (id: number) => void;
  openDirectByUsername: (username: string) => unknown;
  nextRevision: () => number;
  setTranslations: Dispatch<SetStateAction<Record<number, string>>>;
  setTranslationOriginals: Dispatch<SetStateAction<Record<number, boolean>>>;
}) {
  const ensureConversation = useCallback((selected: Conversation) => {
    setConversations(current => current.some(item => item.id === selected.id)
      ? current : [...current, selected]);
  }, [setConversations]);

  const openChatQuickContact = useCallback((contact: ChatQuickContact) => {
    setQuickSearchOpen(false);
    setGlobalSearch("");
    setChatSearchJump(null);
    if (contact.conversation) {
      ensureConversation(contact.conversation);
      selectConversation(contact.conversation.id);
    } else if (contact.username) {
      void openDirectByUsername(contact.username);
    }
  }, [setQuickSearchOpen, setGlobalSearch, setChatSearchJump, ensureConversation, selectConversation, openDirectByUsername]);

  const openChatQuickHit = useCallback((hit: ChatQuickHit) => {
    setQuickSearchOpen(false);
    setGlobalSearch("");
    ensureConversation(hit.conversation);
    setChatSearchJump({
      conversationId: hit.conversation.id,
      messageId: hit.id,
      revision: nextRevision(),
    });
    selectConversation(hit.conversation.id);
    setTranslations({});
    setTranslationOriginals({});
  }, [
    setQuickSearchOpen, setGlobalSearch, ensureConversation, setChatSearchJump,
    nextRevision, selectConversation, setTranslations, setTranslationOriginals,
  ]);

  return { openChatQuickContact, openChatQuickHit };
}
