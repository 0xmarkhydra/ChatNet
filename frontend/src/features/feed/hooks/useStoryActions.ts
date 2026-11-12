import { attachmentRequestBody, type MediaAttachment } from "../../../shared/utils/media";
import { type Story } from "../types";
import { type QueuedChatMessage, enqueueChatMessage } from "../../chat/lib/chatOutbox";
import { userLabel } from "../../../shared/utils/userLabel";
import { type Conversation } from "../../chat/types";
import { type Session } from "../../auth/lib/session";
import { type SetStateAction } from "react";
import { type ToastKind } from "../../notifications/utils/toast";
import type { Dispatch, RefObject } from "react";

export type UseStoryActionsDeps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  mediaUploading: "chat" | "feed" | "story" | "profile" | null;
  name: string;
  openDirectByUsername: (username: string, mediaType?: "audio" | "video", onOpened?: (conversation: Conversation) => void) => Promise<void>;
  ownSendScrollConversation: RefObject<number | null>;
  retryQueuedChatMessages: () => Promise<void>;
  session: Session | null;
  sessionRef: RefObject<Session | null>;
  setActiveStoryId: Dispatch<SetStateAction<number | null>>;
  setChatOnline: Dispatch<SetStateAction<boolean>>;
  setNotice: (message: string, kind?: ToastKind) => void;
  setStories: Dispatch<SetStateAction<Story[]>>;
  setStoryBusy: Dispatch<SetStateAction<boolean>>;
  setStoryDraftFile: Dispatch<SetStateAction<File | null>>;
  storyBusy: boolean;
  updateChatOutbox: (transform: (items: QueuedChatMessage[]) => QueuedChatMessage[]) => QueuedChatMessage[];
  uploadMediaFiles: (files: File[], scope: "chat" | "feed" | "story" | "profile") => Promise<MediaAttachment[]>;
};

export function useStoryActions({
  apiFetch,
  mediaUploading,
  name,
  openDirectByUsername,
  ownSendScrollConversation,
  retryQueuedChatMessages,
  session,
  sessionRef,
  setActiveStoryId,
  setChatOnline,
  setNotice,
  setStories,
  setStoryBusy,
  setStoryDraftFile,
  storyBusy,
  updateChatOutbox,
  uploadMediaFiles,
}: UseStoryActionsDeps) {  async function createStory(file?: File) {
    if (!file || storyBusy || mediaUploading) return;
    const sessionId = session?.sessionId;
    setStoryBusy(true);
    try {
      const [attachment] = await uploadMediaFiles([file], "story");
      if (sessionRef.current?.sessionId !== sessionId) return;
      const response = await apiFetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachment: attachmentRequestBody(attachment) }),
      });
      const result = (await response.json().catch(() => null)) as
        | (Story & { error?: string })
        | null;
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok || !result?.id || !result.attachment)
        throw new Error(result?.error || "Không đăng được Story");
      setStories((current) => [
        result,
        ...current.filter((item) => item.id !== result.id),
      ]);
      setActiveStoryId(result.id);
      setStoryDraftFile(null);
      setNotice("Đã đăng Story.", "success");
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error ? error.message : "Không đăng được Story",
        );
    } finally {
      if (sessionRef.current?.sessionId === sessionId) setStoryBusy(false);
    }
  }
  async function deleteStory(story: Story) {
    if (story.author !== name || storyBusy || !window.confirm("Xóa Story này?"))
      return;
    const sessionId = session?.sessionId;
    setStoryBusy(true);
    try {
      const response = await apiFetch(`/api/stories/${story.id}`, {
        method: "DELETE",
      });
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok) throw new Error("Không xóa được Story");
      setStories((current) => current.filter((item) => item.id !== story.id));
      setActiveStoryId((current) => (current === story.id ? null : current));
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error ? error.message : "Không xóa được Story",
        );
    } finally {
      if (sessionRef.current?.sessionId === sessionId) setStoryBusy(false);
    }
  }
  async function replyToStory(story: Story, message: string): Promise<boolean> {
    const content = message.trim();
    if (!content || !sessionRef.current || story.author === sessionRef.current.user.username)
      return false;

    let queued = false;
    await openDirectByUsername(story.author, undefined, (conversation) => {
      const item: QueuedChatMessage = {
        clientId: crypto.randomUUID(),
        conversationId: conversation.id,
        text: `↪️ Trả lời Story (${new Date(story.createdAt).toLocaleString("vi-VN", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        })})\n${content}`,
        attachments: [],
        createdAt: new Date().toISOString(),
        status: "queued",
      };
      const next = updateChatOutbox((items) => enqueueChatMessage(items, item));
      if (!next.some((pending) => pending.clientId === item.clientId)) {
        setNotice("Không thể lưu phản hồi Story vào hàng đợi. Nội dung vẫn được giữ lại.", "warning");
        return;
      }
      queued = true;
      ownSendScrollConversation.current = conversation.id;
      setActiveStoryId(null);
      if (navigator.onLine) void retryQueuedChatMessages();
      else setChatOnline(false);
    });
    return queued;
  }
  async function shareStory(story: Story) {
    const url = story.attachment.url;
    if (!url) {
      setNotice("Không có đường dẫn Story để chia sẻ.");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Khoảnh khắc của " + userLabel(story.authorDisplayName, story.author),
          url,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setNotice("Đã sao chép liên kết media của Story (liên kết có thể hết hạn).");
      } else {
        setNotice("Trình duyệt không hỗ trợ chia sẻ liên kết Story.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setNotice("Không thể chia sẻ Story. Vui lòng thử lại.");
    }
  }
  async function reportStory(story: Story) {
    const answer = window.prompt("Nhập lý do báo cáo Story (5–500 ký tự):");
    if (answer === null) return;
    const reason = answer.trim();
    const length = Array.from(reason).length;
    if (length < 5 || length > 500) {
      setNotice("Lý do báo cáo cần từ 5 đến 500 ký tự.");
      return;
    }
    try {
      const response = await apiFetch("/api/feed/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "story",
          targetId: story.id,
          reason,
        }),
      });
      if (!response.ok) throw new Error("Không gửi được báo cáo Story.");
      setNotice("Đã gửi báo cáo Story.");
    } catch {
      setNotice("Không thể báo cáo Story. Vui lòng thử lại.");
    }
  }

  return {
    createStory,
    deleteStory,
    replyToStory,
    reportStory,
    shareStory,
  };
}
