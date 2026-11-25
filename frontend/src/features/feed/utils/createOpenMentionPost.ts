import type { Dispatch, SetStateAction } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { ApiRequest, Notice } from '../../../shared/types/api'
import type { Tab } from '../../../shared/types/navigation'
import type { Post } from '../types'
import type { PostMentionNotification } from '../utils/postMentionNotifications'

type Options = {
  isCurrentMentionVisit: () => boolean
  apiFetch: ApiRequest
  setPosts: Dispatch<SetStateAction<Post[]>>
  setFeedCommunitiesOpen: (value: boolean) => void
  setTab: (value: Tab) => void
  navigate: NavigateFunction
  feedPostPath: (postId: number) => string
  readPostMention: (id: number) => Promise<void>
  setNotice: Notice
}

/** Loads mention targets before navigation, discarding stale responses on account switch. */
export function createOpenMentionPost({
  isCurrentMentionVisit, apiFetch, setPosts, setFeedCommunitiesOpen,
  setTab, navigate, feedPostPath, readPostMention, setNotice,
}: Options) {
  async function openMentionPost(mention: PostMentionNotification) {
    if (!isCurrentMentionVisit()) return;
    try {
      const response = await apiFetch(`/api/posts/${mention.postId}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404
        ? "Bài viết không tồn tại hoặc bạn không còn quyền xem."
        : "Không mở được bài viết.");
      const post = await response.json() as Post;
      if (!isCurrentMentionVisit()) return;
      setPosts(current => [post, ...current.filter(item => item.id !== post.id)]);
      setFeedCommunitiesOpen(false);
      setTab("feed");
      navigate(feedPostPath(post.id), { state: { postId: post.id } });
      void readPostMention(mention.id);
    } catch (error) {
      if (isCurrentMentionVisit())
        setNotice(error instanceof Error ? error.message : "Không mở được bài viết.", "error");
    }
  }

  return openMentionPost
}