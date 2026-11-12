import { type SetStateAction } from "react";
import { type MediaAttachment, type PresignedUpload } from "../../../shared/utils/media";
import { emptyDraft, type MessageDraft } from "../types";
import { uploadPresignedFile } from "../lib/mediaUpload";
import { type Post } from "../../feed/types";
import { type Session } from "../../auth/lib/session";
import { type ToastKind } from "../../notifications/utils/toast";
import type { Dispatch, RefObject } from "react";

export type UseMediaUploadsDeps = {
  activeConversationId: number | null;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  channelDraftKey: string;
  mediaUploadAbort: RefObject<AbortController | null>;
  mediaUploading: "chat" | "feed" | "story" | "profile" | null;
  messageAttachments: MediaAttachment[];
  messageSending: boolean;
  pendingPost: Post | null;
  postAttachments: MediaAttachment[];
  selectedChannelId: number;
  session: Session | null;
  sessionRef: RefObject<Session | null>;
  setChannelDrafts: Dispatch<SetStateAction<Record<string, MessageDraft>>>;
  setMediaUploading: Dispatch<SetStateAction<"chat" | "feed" | "story" | "profile" | null>>;
  setMediaUploadProgress: Dispatch<SetStateAction<{ loaded: number; total: number; } | null>>;
  setMessageDrafts: Dispatch<SetStateAction<Record<number, MessageDraft>>>;
  setNotice: (message: string, kind?: ToastKind) => void;
  setPostAttachments: Dispatch<SetStateAction<MediaAttachment[]>>;
};

export function useMediaUploads({
  activeConversationId,
  apiFetch,
  channelDraftKey,
  mediaUploadAbort,
  mediaUploading,
  messageAttachments,
  messageSending,
  pendingPost,
  postAttachments,
  selectedChannelId,
  session,
  sessionRef,
  setChannelDrafts,
  setMediaUploading,
  setMediaUploadProgress,
  setMessageDrafts,
  setNotice,
  setPostAttachments,
}: UseMediaUploadsDeps) {  function setMessageAttachments(update: SetStateAction<MediaAttachment[]>) {
    if (!activeConversationId) return;
    if (selectedChannelId > 0) {
      setChannelDrafts(current => {
        const previous = current[channelDraftKey] ?? emptyDraft;
        return {
          ...current,
          [channelDraftKey]: {
            ...previous,
            attachments: typeof update === 'function' ? update(previous.attachments) : update,
          },
        };
      });
      return;
    }
    setMessageDrafts((current) => {
      const previous = current[activeConversationId] ?? emptyDraft;
      return {
        ...current,
        [activeConversationId]: {
          ...previous,
          attachments:
            typeof update === "function"
              ? update(previous.attachments)
              : update,
        },
      };
    });
  }
  async function uploadMediaFiles(
    files: File[],
    scope: "chat" | "feed" | "story" | "profile",
  ) {
    if (!files.length) return [] as MediaAttachment[];
    if (mediaUploadAbort.current)
      throw new Error(
        "Đang tải tệp khác. Hãy hoàn tất hoặc hủy trước khi tải tiếp.",
      );
    const sessionId = session?.sessionId;
    const controller = new AbortController();
    mediaUploadAbort.current = controller;
    setMediaUploading(scope);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const loadedBytes = files.map(() => 0);
    setMediaUploadProgress({ loaded: 0, total: Math.max(1, totalBytes) });
    let lastReport = 0;

    function trackProgress(index: number, loaded: number) {
      if (mediaUploadAbort.current !== controller) return;
      loadedBytes[index] = Math.min(files[index].size, Math.max(0, loaded));
      const now = performance.now();
      if (loadedBytes[index] < files[index].size && now - lastReport < 120)
        return;
      lastReport = now;
      setMediaUploadProgress({
        loaded: loadedBytes.reduce((sum, value) => sum + value, 0),
        total: Math.max(1, totalBytes),
      });
    }

    try {
      const result = new Array<MediaAttachment>(files.length);
      let nextIndex = 0;
      const workerCount = Math.min(4, files.length);

      async function worker() {
        try {
          while (true) {
            if (controller.signal.aborted)
              throw new DOMException("Đã hủy tải tệp.", "AbortError");
            const index = nextIndex++;
            if (index >= files.length) return;

            const file = files[index];
            const contentType = file.type || "application/octet-stream";
            const presignResponse = await apiFetch("/api/media/presign", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scope,
                name: file.name,
                sizeBytes: file.size,
                contentType,
              }),
              signal: controller.signal,
            });
            if (controller.signal.aborted)
              throw new DOMException("Đã hủy tải tệp.", "AbortError");
            const ticket = (await presignResponse.json().catch(() => null)) as
              | (PresignedUpload & { error?: string })
              | null;
            if (!presignResponse.ok || !ticket?.uploadUrl) {
              throw new Error(
                ticket?.error ||
                  "Không cấp được quyền upload file. Hãy kiểm tra cấu hình S3.",
              );
            }

            await uploadPresignedFile(
              ticket.uploadUrl,
              file,
              contentType,
              controller.signal,
              (loaded) => trackProgress(index, loaded),
            );
            if (controller.signal.aborted)
              throw new DOMException("Đã hủy tải tệp.", "AbortError");
            result[index] = {
              storageRef: ticket.storageRef,
              name: file.name,
              sizeBytes: file.size,
              contentType,
              kind: ticket.kind,
              // Pending chat media uses a local preview. Never persist/reuse
              // the raw S3 GET URL from the upload ticket.
              url: scope === "chat" ? URL.createObjectURL(file) : ticket.downloadUrl,
            };
          }
        } catch (error) {
          controller.abort();
          throw error;
        }
      }

      const outcomes = await Promise.allSettled(
        Array.from({ length: workerCount }, () => worker()),
      );
      const errors = outcomes.filter(
        (outcome): outcome is PromiseRejectedResult =>
          outcome.status === "rejected",
      );
      const firstError =
        errors.find(
          (item) =>
            !(
              item.reason instanceof DOMException &&
              item.reason.name === "AbortError"
            ),
        ) ?? errors[0];
      if (firstError) throw firstError.reason;
      return result;
    } finally {
      if (mediaUploadAbort.current === controller) {
        mediaUploadAbort.current = null;
        setMediaUploadProgress(null);
        if (sessionRef.current?.sessionId === sessionId)
          setMediaUploading(null);
      }
    }
  }
  async function addChatFiles(files: File[]) {
    if (!files.length) return;
    if (!activeConversationId) {
      setNotice("Chọn hội thoại trước khi đính kèm tệp.", "warning");
      return;
    }
    if (mediaUploading || messageSending || mediaUploadAbort.current) {
      setNotice(
        "Hãy hoàn tất hoặc hủy tác vụ hiện tại trước khi thêm tệp.",
        "warning",
      );
      return;
    }
    const conversationId = activeConversationId;
    const channelId = selectedChannelId;
    const channelKey = channelDraftKey;
    const sessionId = session?.sessionId;
    const remaining = Math.max(0, 10 - messageAttachments.length);
    if (remaining === 0) {
      setNotice("Mỗi tin nhắn tối đa 10 file đính kèm.");
      return;
    }
    const selected = files.slice(0, remaining);
    if (selected.length < files.length)
      setNotice("Mỗi tin nhắn tối đa 10 file đính kèm.");
    try {
      const uploaded = await uploadMediaFiles(selected, "chat");
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (channelId > 0) {
        setChannelDrafts(current => {
          const previous = current[channelKey] ?? emptyDraft;
          return {
            ...current,
            [channelKey]: { ...previous, attachments: [...previous.attachments, ...uploaded].slice(0, 10) },
          };
        });
      } else {
        setMessageDrafts((current) => {
          const previous = current[conversationId] ?? emptyDraft;
          return {
            ...current,
            [conversationId]: {
              ...previous,
              attachments: [...previous.attachments, ...uploaded].slice(0, 10),
            },
          };
        });
      }
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error ? error.message : "Không upload được file",
        );
    }
  }
  async function addFeedFiles(files: File[]) {
    if (!files.length || pendingPost || mediaUploading) return;
    const sessionId = session?.sessionId;
    const remaining = Math.max(0, 12 - postAttachments.length);
    if (remaining === 0) {
      setNotice("Mỗi bài viết tối đa 12 ảnh/video.");
      return;
    }
    const selected = files.slice(0, remaining).filter(
      (file) => file.size > 0 && (file.type.startsWith("image/") || file.type.startsWith("video/")),
    );
    if (selected.length < Math.min(files.length, remaining))
      setNotice("Chỉ hỗ trợ ảnh/video hợp lệ và không rỗng.");
    if (remaining < files.length) setNotice("Mỗi bài viết tối đa 12 ảnh/video.");
    if (!selected.length) return;
    try {
      const uploaded = await uploadMediaFiles(selected, "feed");
      if (sessionRef.current?.sessionId !== sessionId) return;
      setPostAttachments((current) => [...current, ...uploaded].slice(0, 12));
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error ? error.message : "Không upload được media",
        );
    }
  }

  return {
    addChatFiles,
    addFeedFiles,
    setMessageAttachments,
    uploadMediaFiles,
  };
}
