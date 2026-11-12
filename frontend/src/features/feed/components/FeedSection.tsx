import FeedModeration from "./FeedModeration";
import SocialFeedStories from "./SocialFeedStories";
import { userLabel } from "../../../shared/utils/userLabel";
import MobileFeedStories from "./MobileFeedStories";
import UserAvatar from "../../../shared/ui/UserAvatar";
import SocialFeedComposer from "./SocialFeedComposer";
import FeedFilters from "./FeedFilters";
import FeedCommunitiesList from "./FeedCommunitiesList";
import FeedPendingPost from "./FeedPendingPost";
import { SocoEmptyState, SocoTextAction } from "../../../shared/ui/SocoUI";
import SocialFeedSidebar from "./SocialFeedSidebar";
import type { FriendSearchResult, FriendConnection } from "../../contacts/types";
import { type Conversation } from "../../chat/types";
import { type Post, type Story } from "../types";
import type { ProfileMediaState } from "../../profile/types";
import { type Session } from "../../auth/lib/session";
import { type SetStateAction } from "react";
import type { Tab } from "../../../shared/types/navigation";
import type { Dispatch, RefObject, ReactNode } from "react";

export type FeedSectionProps = {
  activePostId: number | null;
  activeStoryId: number | null;
  actOnFriend: (friend: FriendSearchResult | FriendConnection, decline?: boolean) => Promise<void>;
  addFeedFiles: (files: File[]) => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  conversationLoadingMore: boolean;
  conversations: Conversation[];
  feedCommunitiesOpen: boolean;
  feedFilter: "all" | "following" | "latest" | "saved";
  feedFiltersPill: { hostRef: (node: HTMLDivElement | null) => void; activeRef: (node: HTMLButtonElement | null) => void; pillRef: (node: HTMLSpanElement | null) => void; };
  feedInfiniteScrollRef: RefObject<HTMLDivElement | null>;
  feedLoadingMore: boolean;
  feedPagingError: boolean;
  feedSearchActive: boolean;
  feedViewRef: RefObject<HTMLDivElement | null>;
  followingFeed: { refresh: () => void; syncPost: (post: Post) => void; removePost: (id: number) => void; posts: Post[]; loading: boolean; loadingMore: boolean; hasMore: boolean; error: string; loadMore: () => Promise<void>; };
  friendBusyIds: Set<number>;
  friendRequests: FriendConnection[];
  friends: FriendConnection[];
  hasMoreConversations: boolean;
  isProfileDesktop: boolean;
  loadMoreConversations: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  loadSavedPosts: (more?: boolean) => Promise<void>;
  mediaUploading: "chat" | "feed" | "profile" | "story" | null;
  name: string;
  normalizedSearch: string;
  openVisitor: (username: string) => void;
  pendingPost: Post | null;
  postComposerRef: RefObject<HTMLTextAreaElement | null>;
  posts: Post[];
  postSearch: { posts: Post[]; loading: boolean; loadingMore: boolean; hasMore: boolean; error: string; loadMore: (retryOnError?: boolean) => Promise<void>; retry: () => void; syncPost: (updated: Post) => void; removePost: (id: number) => void; };
  postText: string;
  profileMedia: ProfileMediaState | null;
  refreshPosts: () => Promise<void>;
  renderPosts: (items: Post[], showSave?: boolean) => ReactNode[];
  savedPosts: Post[];
  searchedPosts: Post[];
  session: Session;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setActivePostId: Dispatch<SetStateAction<number | null>>;
  setActiveStoryId: Dispatch<SetStateAction<number | null>>;
  setChatListFilter: Dispatch<SetStateAction<"all" | "unread" | "groups">>;
  setFeedCheckInOpen: Dispatch<SetStateAction<boolean>>;
  setFeedCommunitiesOpen: Dispatch<SetStateAction<boolean>>;
  setFeedComposerOpen: Dispatch<SetStateAction<boolean>>;
  setFeedFilter: Dispatch<SetStateAction<"all" | "following" | "latest" | "saved">>;
  setGlobalSearch: Dispatch<SetStateAction<string>>;
  setPosts: Dispatch<SetStateAction<Post[]>>;
  setSavedPosts: Dispatch<SetStateAction<Post[]>>;
  setSearchHasScrolled: Dispatch<SetStateAction<boolean>>;
  setStories: Dispatch<SetStateAction<Story[]>>;
  setStoryDraftFile: Dispatch<SetStateAction<File | null>>;
  stories: Story[];
  storyBusy: boolean;
  storyFileInputRef: RefObject<HTMLInputElement | null>;
  switchTab: (nextTab: Tab) => void;
};

export default function FeedSection({
  activePostId,
  activeStoryId,
  actOnFriend,
  addFeedFiles,
  apiFetch,
  conversationLoadingMore,
  conversations,
  feedCommunitiesOpen,
  feedFilter,
  feedFiltersPill,
  feedInfiniteScrollRef,
  feedLoadingMore,
  feedPagingError,
  feedSearchActive,
  feedViewRef,
  followingFeed,
  friendBusyIds,
  friendRequests,
  friends,
  hasMoreConversations,
  isProfileDesktop,
  loadMoreConversations,
  loadMorePosts,
  loadSavedPosts,
  mediaUploading,
  name,
  normalizedSearch,
  openVisitor,
  pendingPost,
  postComposerRef,
  posts,
  postSearch,
  postText,
  profileMedia,
  refreshPosts,
  renderPosts,
  savedPosts,
  searchedPosts,
  session,
  setActiveConversationId,
  setActivePostId,
  setActiveStoryId,
  setChatListFilter,
  setFeedCheckInOpen,
  setFeedCommunitiesOpen,
  setFeedComposerOpen,
  setFeedFilter,
  setGlobalSearch,
  setPosts,
  setSavedPosts,
  setSearchHasScrolled,
  setStories,
  setStoryDraftFile,
  stories,
  storyBusy,
  storyFileInputRef,
  switchTab,
}: FeedSectionProps) {
  return (
      <div
            className="feed-view zalo-feed-view social-feed"
            ref={feedViewRef}
            onScroll={(event) => {
              if (feedSearchActive && event.currentTarget.scrollTop > 0)
                setSearchHasScrolled(true);
            }}
          >
            <FeedModeration
              request={apiFetch}
              onRemoved={(type, id) => {
                if (type === "post") {
                  setPosts((current) =>
                    current.filter((post) => post.id !== id),
                  );
                  setSavedPosts((current) =>
                    current.filter((post) => post.id !== id),
                  );
                  postSearch.removePost(id);
                  if (activePostId === id) setActivePostId(null);
                } else if (type === "comment") {
                  void refreshPosts();
                } else {
                  setStories((current) =>
                    current.filter((story) => story.id !== id),
                  );
                  if (activeStoryId === id) setActiveStoryId(null);
                }
              }}
            />
            <input
              ref={storyFileInputRef}
              className="hidden-media-input"
              type="file"
              accept="image/*,video/*"
              aria-label="Chọn ảnh hoặc video cho Story"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) setStoryDraftFile(file);
              }}
            />
            <div className="social-feed-grid">
              <div className="social-feed-center">
                {!feedCommunitiesOpen && (<>
                {isProfileDesktop ? (
                  <SocialFeedStories
                    username={name}
                    displayName={userLabel(
                      profileMedia?.displayName || session.user.displayName,
                      name,
                    )}
                    stories={stories}
                    busy={storyBusy || mediaUploading === "story"}
                    onCreate={() => storyFileInputRef.current?.click()}
                    onOpen={setActiveStoryId}
                  />
                ) : (
                  <MobileFeedStories
                    username={name}
                    stories={stories}
                    busy={storyBusy || mediaUploading === "story"}
                    onCreate={() => storyFileInputRef.current?.click()}
                    onOpen={setActiveStoryId}
                  />
                )}

                <SocialFeedComposer
                    username={name}
                    displayName={userLabel(
                      profileMedia?.displayName || session.user.displayName,
                      name,
                    )}
                    draft={postText}
                    pending={Boolean(pendingPost) || mediaUploading === "feed"}
                    storyBusy={storyBusy || mediaUploading === "story"}
                    onCreatePost={() => {
                      setFeedComposerOpen(true);
                    }}
                    onCreateMediaPost={(files) => {
                      setFeedComposerOpen(true);
                      void addFeedFiles(files);
                    }}
                    onCreateStory={() => storyFileInputRef.current?.click()}
                    onCheckIn={() => {
                      setFeedCheckInOpen(true);
                      setFeedComposerOpen(true);
                    }}
                  />
                </>)}

                {!feedCommunitiesOpen && (
                  <FeedFilters
                    isProfileDesktop={isProfileDesktop}
                    filter={feedFilter}
                    pill={feedFiltersPill}
                    setFilter={setFeedFilter}
                    onCloseCommunities={() => setFeedCommunitiesOpen(false)}
                    onRefresh={() => {
                      if (feedFilter === "following") followingFeed.refresh();
                      else if (feedFilter === "saved") void loadSavedPosts();
                      else void refreshPosts();
                    }}
                    onLoadSaved={() => void loadSavedPosts()}
                  />
                )}
                <div className="feed zalo-feed">
                  {feedCommunitiesOpen ? (
                    <FeedCommunitiesList
                      groups={conversations}
                      onOpen={(id) => { switchTab("chat"); setChatListFilter("all"); setActiveConversationId(id); }}
                      hasMore={hasMoreConversations}
                      loadingMore={conversationLoadingMore}
                      onLoadMore={() => void loadMoreConversations()}
                    />
                  ) : (<>
                  {pendingPost && <FeedPendingPost post={pendingPost} />}


                  {renderPosts(searchedPosts, isProfileDesktop)}

                  {feedPagingError && (
                    <div role="alert" className="soco-feed-load-more">
                      <span>
                        {feedSearchActive
                          ? postSearch.error
                          : feedFilter === "following"
                            ? followingFeed.error
                            : "Không thể tải bài viết."}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (feedSearchActive) postSearch.retry();
                          else if (feedFilter === "saved")
                            void loadSavedPosts(savedPosts.length > 0);
                          else if (feedFilter === "following")
                            followingFeed.refresh();
                          else if (posts.length === 0) void refreshPosts();
                          else void loadMorePosts();
                        }}
                      >
                        Thử lại
                      </button>
                    </div>
                  )}
                  <div
                    ref={feedInfiniteScrollRef}
                    aria-hidden="true"
                    style={{ height: 1 }}
                  />
                  {searchedPosts.length === 0 &&
                    !feedLoadingMore &&
                    !(feedSearchActive && postSearch.loading) &&
                    !(feedFilter === "following" && followingFeed.loading) &&
                    !feedPagingError && (
                      <div className="feed-empty">
                        <SocoEmptyState
                          title={
                            normalizedSearch
                              ? "Không tìm thấy bài viết"
                              : feedFilter === "following"
                                ? "Chưa có bài viết từ bạn bè"
                                : "Chưa có bài viết"
                          }
                          description={
                            normalizedSearch
                              ? "Thử một từ khóa khác nhé."
                              : feedFilter === "following"
                                ? "Kết bạn để xem các bài viết được chia sẻ với bạn."
                                : "Hãy chia sẻ khoảnh khắc đầu tiên của bạn."
                          }
                          action={
                            !normalizedSearch && (
                              <SocoTextAction
                                onClick={() =>
                                  feedFilter === "following"
                                    ? switchTab("contacts")
                                    : isProfileDesktop
                                      ? (setFeedCheckInOpen(false),
                                        setFeedComposerOpen(true))
                                      : postComposerRef.current?.focus()
                                }
                              >
                                {feedFilter === "following"
                                  ? "Tìm bạn bè"
                                  : "Tạo bài viết"}
                              </SocoTextAction>
                            )
                          }
                        />
                      </div>
                    )}
                  </>)}
                </div>
              </div>
              {!feedCommunitiesOpen && isProfileDesktop && (
                <SocialFeedSidebar
                  username={name}
                  sessionId={session.sessionId}
                  posts={posts}
                  friends={friends}
                  friendRequests={friendRequests}
                  friendBusyIds={friendBusyIds}
                  request={apiFetch}
                  onFriend={(friend) => {
                    void actOnFriend(friend);
                  }}
                  onViewUser={openVisitor}
                  onViewContacts={() => switchTab("contacts")}
                  onSearchTag={(tag) => {
                    setFeedFilter("all");
                    setGlobalSearch(tag);
                  }}
                  onOpenChat={() => switchTab("chat")}
                />
              )}
            </div>
          </div>
  );
}
