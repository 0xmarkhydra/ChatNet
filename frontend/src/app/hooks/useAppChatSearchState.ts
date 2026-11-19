import { useCallback, useRef, useState } from "react";
import useSlidingPill from "../../shared/ui/useSlidingPill";
import { usePhoneSearchLayout } from "./usePhoneSearchLayout";
import { useQuickSearchDismiss } from "./useQuickSearchDismiss";

/** Header/chat-list search presentation; message search results remain in Chat. */
export function useAppChatSearchState() {
  const [globalSearch, setGlobalSearch] = useState("");
  const [chatListQuery, setChatListQuery] = useState("");
  const [chatListFilter, setChatListFilter] = useState<"all" | "unread" | "groups">("all");
  const chatFiltersPill = useSlidingPill<HTMLDivElement>(chatListFilter);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const phoneSearchLayout = usePhoneSearchLayout();
  const quickSearchAnchorRef = useRef<HTMLDivElement>(null);
  const [chatSearchJump, setChatSearchJump] = useState<{
    conversationId: number;
    messageId: number;
    revision: number;
  } | null>(null);
  const chatSearchJumpRevision = useRef(0);
  const nextChatSearchJumpRevision = useCallback(() => ++chatSearchJumpRevision.current, []);
  const lastScrolledSearchJump = useRef(0);
  useQuickSearchDismiss(quickSearchOpen, quickSearchAnchorRef, setQuickSearchOpen);

  return {
    globalSearch, setGlobalSearch,
    chatListQuery, setChatListQuery,
    chatListFilter, setChatListFilter,
    chatFiltersPill,
    quickSearchOpen, setQuickSearchOpen,
    phoneSearchLayout, quickSearchAnchorRef,
    chatSearchJump, setChatSearchJump,
    chatSearchJumpRevision, nextChatSearchJumpRevision,
    lastScrolledSearchJump,
  };
}
