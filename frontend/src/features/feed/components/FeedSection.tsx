import { collapseQuickReposts } from "../utils/feedRequestState";
import FeedModeration from "./FeedModeration";
import SocialFeedStories from "./SocialFeedStories";
import { userLabel } from "../../../shared/utils/userLabel";
import MobileFeedStories from "./MobileFeedStories";
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
  loadSavedPosts: (more?: boolean) => Promise<void>;
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
  setPosts,
  setSavedPosts,
  setSearchHasScrolled,
  setStories,
  setStoryDraft,
  stories,
  storyBusy,
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
            <div className="social-feed-grid flex w-full min-w-0 flex-col gap-0 p-0 min-[761px]:mx-auto min-[761px]:grid min-[761px]:max-w-[700px] min-[761px]:grid-cols-[minmax(0,1fr)] min-[761px]:items-start min-[761px]:justify-center min-[761px]:gap-[22px] min-[761px]:px-[18px] min-[761px]:pt-[17px] min-[761px]:pb-9 min-[1121px]:max-w-[1040px] min-[1121px]:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] min-[1121px]:gap-[18px] min-[1331px]:grid-cols-[minmax(0,620px)_minmax(260px,320px)] min-[1331px]:gap-[22px] min-[1331px]:px-6 min-[1331px]:pt-5">
              <div className="social-feed-center flex min-w-0 flex-col gap-0 min-[761px]:gap-[15px] min-[761px]:[&>*]:box-border min-[761px]:[&>*]:w-full min-[761px]:[&>*]:min-w-0">
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
                  <MobileFeedStories
                    username={name}
                    stories={stories}
                    busy={storyBusy || mediaUploading === "story"}
                    onCreate={() => setStoryDraft({ kind: "choose" })}
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
                      else if (feedFilter === "saved") void loadSavedPosts();
                      else void refreshPosts();
                    }}
                    onLoadSaved={() => void loadSavedPosts()}
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
                    !feedInitialLoading &&
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
