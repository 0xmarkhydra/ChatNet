import { type Message } from "../types";
import { type MediaAttachment } from "../../../shared/utils/media";
import { copyChatImage } from "../lib/messageClipboard";
import { type MessageCopyTarget } from "../utils/messageCopyTarget";
import { type SetStateAction } from "react";
import { type ToastKind } from "../../../shared/utils/toast";
import type { Dispatch } from "react";

export type UseMessageClipboardDeps = {
  setMessageActionId: Dispatch<SetStateAction<number | null>>;
  setNotice: (message: string, kind?: ToastKind) => void;
};

export function useMessageClipboard({
  setMessageActionId,
  setNotice,
}: UseMessageClipboardDeps) {
  async function copyMessage(message: Message) {
    const content = message.text.trim();
    setMessageActionId(null);
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setNotice("Đã sao chép tin nhắn.", "success");
    } catch {
      setNotice("Không sao chép được tin nhắn trên trình duyệt này.", "error");
    }
  }
  async function copyMessageImage(attachment: MediaAttachment) {
    setMessageActionId(null);
    if (!attachment.url) return;
    try {
      await copyChatImage(attachment.url);
      setNotice("Đã sao chép ảnh. Bạn có thể dán bằng Cmd/Ctrl+V.", "success");
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Trình duyệt không cho phép đọc hoặc sao chép ảnh.";
      setNotice(`Không sao chép được ảnh. ${reason}`, "error");
    }
  }
  async function copyMessageLink(link: string) {
    setMessageActionId(null);
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Đã sao chép liên kết.", "success");
    } catch {
      setNotice("Không sao chép được liên kết trên trình duyệt này.", "error");
    }
  }
  async function copyMessageContent(
    message: Message,
    target: MessageCopyTarget,
  ) {
    if (target.kind === "image") return copyMessageImage(target.attachment);
    if (target.kind === "unavailable-link") {
      setMessageActionId(null);
      setNotice(
        `Tệp "${target.name}" hiện không có liên kết tải xuống.`,
        "warning",
      );
      return;
    }
    if (target.kind === "file-name") {
      setMessageActionId(null);
      try {
        await navigator.clipboard.writeText(target.name);
        setNotice("Đã sao chép tên tệp.", "success");
      } catch {
        setNotice("Không sao chép được tên tệp.", "error");
      }
      return;
    }
    if (target.kind === "link") {
      await copyMessageLink(target.url);
      if (target.temporary)
        setNotice(
          "Đã sao chép liên kết tải tệp. Liên kết này có thời hạn.",
          "success",
        );
      return;
    }
    return copyMessage(message);
  }

  return {
    copyMessageContent,
  };
}
