import type { ComponentProps } from "react";
import CallManager from "../../features/calls/components/CallManager";
import type { Conversation } from "../../features/chat/types";

type CallConversation = Pick<
  Conversation,
  "id" | "name" | "type" | "otherUsername" | "blockedByMe" | "blockedByOther"
>;

type CallManagerOptions = Omit<ComponentProps<typeof CallManager>, "conversations">;

type Props = CallManagerOptions & {
  conversations: readonly CallConversation[];
};

/** The app adapts chat conversation metadata to the calls feature contract. */
export function toCallManagerConversations(conversations: readonly CallConversation[]): ComponentProps<typeof CallManager>["conversations"] {
  return conversations.map(({ id, name, type, otherUsername, blockedByMe, blockedByOther }) => ({
    id,
    name,
    type,
    otherUsername,
    blocked: Boolean(blockedByMe || blockedByOther),
  }));
}

/** Persistent call lifecycle stays in CallManager; this component owns no state or effects. */
export default function AppShellCallManager({ conversations, ...options }: Props) {
  return <CallManager {...options} conversations={toCallManagerConversations(conversations)} />;
}
