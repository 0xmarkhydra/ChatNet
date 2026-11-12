import PostCommentsPage from "./PostCommentsPage";
import { type Post } from "../types";
import type { ProfileMediaState } from "../../profile/types";
import { type Session } from "../../auth/lib/session";
import { type SetStateAction } from "react";
import { type ToastKind } from "../../notifications/utils/toast";
import type { Dispatch, ReactNode } from "react";

export type FeedPostDetailProps = {
  activePost: Post;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  closeFeedPostDetails: () => void;
  commentSortOrder: "newest" | "oldest";
  like: (post: Post, emoji?: string) => Promise<void>;
  likePreviews: Record<number, boolean>;
  name: string;
  onEditPost: (post: Post) => void;
  openVisitor: (username: string) => void;
  postDiscussion: ReactNode | null;
  profileMedia: ProfileMediaState | null;
  removeFeedPost: (id: number) => void;
  session: Session;
  setCommentSortOrder: Dispatch<SetStateAction<"newest" | "oldest">>;
  setNotice: (message: string, kind?: ToastKind) => void;
  syncFeedPost: (updated: Post) => void;
  taggedNames: Record<string, string>;
  targetLanguage: string;
  translationPreferencesLoaded: boolean;
};

export default function FeedPostDetail({
  activePost,
  apiFetch,
  closeFeedPostDetails,
  commentSortOrder,
  like,
  likePreviews,
  name,
  onEditPost,
  openVisitor,
  postDiscussion,
  profileMedia,
  removeFeedPost,
  session,
  setCommentSortOrder,
  setNotice,
  syncFeedPost,
  taggedNames,
  targetLanguage,
  translationPreferencesLoaded,
}: FeedPostDetailProps) {
  return (
      <PostCommentsPage
            key={activePost.id}
            post={activePost}
            username={name}
            ownDisplayName={profileMedia?.displayName || session.user.displayName || name}
            token={session.token}
            targetLanguage={translationPreferencesLoaded ? targetLanguage : ""}
            request={apiFetch}
            sortOrder={commentSortOrder}
            onSortChange={setCommentSortOrder}
            onDeleted={(id) => { removeFeedPost(id); closeFeedPostDetails(); }}
            onAuthorOpen={openVisitor}
            likeBusy={likePreviews[activePost.id] !== undefined}
            onLike={(post, emoji) => like(post, emoji)}
            onUpdated={syncFeedPost}
            onEditPost={onEditPost}
            taggedNames={taggedNames}
            onFeedback={(message, kind) => setNotice(message, kind)}
          >
            {postDiscussion}
          </PostCommentsPage>
  );
}
