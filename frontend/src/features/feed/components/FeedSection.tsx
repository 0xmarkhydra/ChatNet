import { collapseQuickReposts } from "../utils/feedRequestState";
import FeedModeration from "./FeedModeration";
import SocialFeedStories from "./SocialFeedStories";
import { userLabel } from "../../../shared/utils/userLabel";
import StoryTray from "./StoryTray";
import StoryListSheet from "./StoryListSheet";
import { markStorySeen, useSeenStories } from "../utils/storySeen";
import UserAvatar from "../../../shared/ui/UserAvatar";
import SocialFeedComposer from "./SocialFeedComposer";
import FeedFilters from "./FeedFilters";
import FeedCommunitiesList from "./FeedCommunitiesList";
import FeedPendingPost from "./FeedPendingPost";
import FeedPostsFallback from "./FeedPostsFallback";
import { SocoEmptyState, SocoTextAction } from "../../../shared/ui/SocoUI";
import SocialFeedSidebar from "./SocialFeedSidebar";
import type { FriendSearchResult, FriendConnection } from "../../contacts";
import { type Conversation } from "../../chat";
import { type Post, type Story, type StoryDraft } from "../types";
import type { ProfileMediaState } from "../../profile";
import { type Session } from "../../../shared/types/session";
import { useEffect, useState, type SetStateAction } from "react";
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
  feedInitialLoading: boolean;
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
  loadSavedPosts: (more?: boolean, mode?: "open" | "refresh") => Promise<void>;
  mediaUploading: "chat" | "feed" | "profile" | "story" | null;
  name: string;
  normalizedSearch: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  communityCard: ReactNode;
  openVisitor: (username: string) => void;
  pendingPost: Post | null;
  postComposerRef: RefObject<HTMLTextAreaElement | null>;
  posts: Post[];
  postSearch: { posts: Post[]; loading: boolean; loadingMore: boolean; hasMore: boolean; error: string; loadMore: (retryOnError?: boolean) => Promise<void>; retry: () => void; syncPost: (updated: Post) => void; removePost: (id: number) => void; };
  postText: string;
  profileMedia: ProfileMediaState | null;
  refreshPosts: () => Promise<void>;
  renderPosts: (items: Post[], showSave?: boolean) => ReactNode[];
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
  setPosts: Dispatch<SetStateAction<Post[]>>;
  setSavedPosts: Dispatch<SetStateAction<Post[]>>;
  setSearchHasScrolled: Dispatch<SetStateAction<boolean>>;
  setStories: Dispatch<SetStateAction<Story[]>>;
  setStoryDraft: Dispatch<SetStateAction<StoryDraft | null>>;
  stories: Story[];
  storyBusy: boolean;
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
  feedInitialLoading,
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
  searchQuery,
  onSearchChange,
  communityCard,
  openVisitor,
  pendingPost,
  postComposerRef,
  posts,
  postSearch,
  postText,
  profileMedia,
  refreshPosts,
  renderPosts,
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
  setPosts,
  setSavedPosts,
  setSearchHasScrolled,
  setStories,
  setStoryDraft,
  stories,
  storyBusy,
  switchTab,
}: FeedSectionProps) {
  const [storyListOpen, setStoryListOpen] = useState(false);
  const seenStories = useSeenStories(session.sessionId);
  useEffect(() => {
    if (activeStoryId !== null) markStorySeen(session.sessionId, activeStoryId);
  }, [activeStoryId, session.sessionId]);
  const storyDisplayName = userLabel(profileMedia?.displayName || session.user.displayName, name);
  return (
      <div
            className="feed-view zalo-feed-view social-feed app-mobile:px-0! app-mobile:pb-[max(24px,env(safe-area-inset-bottom))]!"
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
            <div className="social-feed-grid flex w-full min-w-0 flex-col gap-0 p-0 app-desktop:mx-auto app-desktop:grid app-desktop:max-w-[700px] app-desktop:grid-cols-[minmax(0,1fr)] app-desktop:items-start app-desktop:justify-center app-desktop:gap-[22px] app-desktop:px-[18px] app-desktop:pt-[17px] app-desktop:pb-9 app-wide:max-w-[1040px] app-wide:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] app-wide:gap-[18px] app-full:grid-cols-[minmax(0,620px)_minmax(260px,320px)] app-full:gap-[22px] app-full:px-6 app-full:pt-5">
              <div className="social-feed-center flex min-w-0 flex-col gap-0 app-desktop:gap-[15px] app-desktop:[&>*]:box-border app-desktop:[&>*]:w-full app-desktop:[&>*]:min-w-0">
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
                    onCreate={() => setStoryDraft({ kind: "choose" })}
                    onOpen={setActiveStoryId}
                  />
                ) : (
                  <>
                    <StoryTray
                      username={name}
                      displayName={storyDisplayName}
                      stories={stories}
                      seen={seenStories}
                      busy={storyBusy || mediaUploading === "story"}
                      onCreate={() => setStoryDraft({ kind: "choose" })}
                      onOpen={setActiveStoryId}
                      onSeeAll={() => setStoryListOpen(true)}
                    />
                    <StoryListSheet
                      open={storyListOpen}
                      onOpenChange={setStoryListOpen}
                      username={name}
                      displayName={storyDisplayName}
                      stories={stories}
                      seen={seenStories}
                      busy={storyBusy || mediaUploading === "story"}
                      onCreate={() => {
                        setStoryListOpen(false);
                        setStoryDraft({ kind: "choose" });
                      }}
                      onOpen={(id) => {
                        setStoryListOpen(false);
                        setActiveStoryId(id);
                      }}
                    />
                  </>
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
                    onCreateStory={() => setStoryDraft({ kind: "choose" })}
                    onCheckIn={() => {
                      setFeedCheckInOpen(true);
                      setFeedComposerOpen(true);
                    }}
                  />
                </>)}

                {!feedCommunitiesOpen && !isProfileDesktop && (
                  <FeedFilters
                    isProfileDesktop={isProfileDesktop}
                    filter={feedFilter}
                    onHostMount={feedFiltersPill.hostRef}
                    onPillMount={feedFiltersPill.pillRef}
                    onActiveMount={feedFiltersPill.activeRef}
                    setFilter={setFeedFilter}
                    onCloseCommunities={() => setFeedCommunitiesOpen(false)}
                    onRefresh={() => {
                      if (feedFilter === "following") followingFeed.refresh();
                      else if (feedFilter === "saved") void loadSavedPosts(false, "refresh");
                      else void refreshPosts();
                    }}
                  />
                )}
                <div className="feed zalo-feed" aria-busy={feedInitialLoading}>
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


                  {feedInitialLoading
                    ? <FeedPostsFallback />
                    : renderPosts(collapseQuickReposts(searchedPosts), isProfileDesktop)}

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
                            void loadSavedPosts(false, "refresh");
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
                    !feedInitialLoading &&
                    (!feedLoadingMore || feedFilter === "saved") &&
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
                                : feedFilter === "saved"
                                  ? "Chưa có bài viết đã lưu"
                                  : "Chưa có bài viết"
                          }
                          description={
                            normalizedSearch
                              ? "Thử một từ khóa khác nhé."
                              : feedFilter === "following"
                                ? "Kết bạn để xem các bài viết được chia sẻ với bạn."
                                : feedFilter === "saved"
                                  ? "Mở menu của bài viết và chọn Lưu bài viết để xem lại ở đây."
                                  : "Hãy chia sẻ khoảnh khắc đầu tiên của bạn."
                          }
                          action={
                            !normalizedSearch && (
                              <SocoTextAction
                                onClick={() =>
                                  feedFilter === "following"
                                    ? switchTab("contacts")
                                    : feedFilter === "saved"
                                      ? setFeedFilter("all")
                                      : isProfileDesktop
                                        ? (setFeedCheckInOpen(false),
                                          setFeedComposerOpen(true))
                                        : postComposerRef.current?.focus()
                                }
                              >
                                {feedFilter === "following"
                                  ? "Tìm bạn bè"
                                  : feedFilter === "saved"
                                    ? "Quay lại Bảng tin"
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
                  friends={friends}
                  friendRequests={friendRequests}
                  friendBusyIds={friendBusyIds}
                  request={apiFetch}
                  onFriend={(friend) => {
                    void actOnFriend(friend);
                  }}
                  onViewUser={openVisitor}
                  onViewContacts={() => switchTab("contacts")}
                  searchQuery={searchQuery}
                  onSearchChange={onSearchChange}
                  communityCard={communityCard}
                />
              )}
            </div>
          </div>
  );
}
