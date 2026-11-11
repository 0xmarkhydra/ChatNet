import { userLabel } from "../../../shared/utils/userLabel";
import UserAvatar from "../../../shared/ui/UserAvatar";
import { FeedText } from "./FeedDiscussion";
import { API } from "../../../shared/lib/config";
import MediaAttachmentsView from "../../../shared/ui/MediaAttachmentsView";
import FeedReactionControl from "./FeedReactionControl";
import UiIcon from "../../../shared/ui/UiIcon";
import { type Post } from "../types";
import { type Session } from "../../auth/lib/session";
import { type SetStateAction } from "react";
import type { Dispatch, ReactNode } from "react";

export type PostDetailOverlayProps = {
  activePost: Post;
  like: (post: Post, emoji?: string) => Promise<void>;
  likePreviews: Record<number, boolean>;
  postDiscussion: ReactNode | null;
  session: Session;
  setActivePostId: Dispatch<SetStateAction<number | null>>;
  targetLanguage: string;
  translationPreferencesLoaded: boolean;
};

export default function PostDetailOverlay({
  activePost,
  like,
  likePreviews,
  postDiscussion,
  session,
  setActivePostId,
  targetLanguage,
  translationPreferencesLoaded,
}: PostDetailOverlayProps) {
  return (
      <div
            className="post-detail-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Chi tiết bài viết của ${userLabel(activePost.authorDisplayName, activePost.author)}`}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setActivePostId(null);
            }}
          >
            <section className="post-detail-modal">
              <header className="post-detail-header">
                <div>
                  <strong>Chi tiết bài viết</strong>
                  <small>@{activePost.author}</small>
                </div>
                <button
                  type="button"
                  aria-label="Đóng chi tiết bài viết"
                  onClick={() => setActivePostId(null)}
                >
                  ×
                </button>
              </header>
              <div className="post-detail-scroll">
                <article className="post zalo-post post-detail-post">
                  <UserAvatar
                    username={activePost.author}
                    name={userLabel(
                      activePost.authorDisplayName,
                      activePost.author,
                    )}
                    className="avatar"
                  />
                  <div className="post-body">
                    <div className="post-author">
                      <div>
                        <strong>
                          {userLabel(
                            activePost.authorDisplayName,
                            activePost.author,
                          )}
                        </strong>
                        <small>
                          {new Date(activePost.createdAt).toLocaleString(
                            "vi-VN",
                          )}
                        </small>
                      </div>
                    </div>
                    {activePost.content && (
                      <FeedText
                        api={API}
                        token={session.token}
                        target={
                          translationPreferencesLoaded ? targetLanguage : ""
                        }
                        text={activePost.content}
                      />
                    )}
                    <MediaAttachmentsView items={activePost.attachments} />
                    <div className="post-toolbar">
                      <FeedReactionControl
                        post={activePost}
                        busy={likePreviews[activePost.id] !== undefined}
                        react={like}
                        showCount
                      />
                      <span className="post-stat">
                        <UiIcon name="comment" size={21} />
                        {activePost.comments?.length || 0} bình luận
                      </span>
                    </div>
                    {postDiscussion}
                  </div>
                </article>
              </div>
            </section>
          </div>
  );
}
