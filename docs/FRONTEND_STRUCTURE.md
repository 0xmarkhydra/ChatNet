# Cấu trúc thư mục Frontend

Áp dụng cho `frontend/src`. Tài liệu này mô tả quy ước đặt file và cách chuyển nhánh đang làm dở sang cấu trúc mới.

## Quy ước

```
src/
├── app/             Khung ứng dụng: App.tsx, layouts/, header/, navigation/, hooks/
├── features/<tên>/  Mỗi tính năng một thư mục: auth, calls, chat, contacts, discover,
│   │                feed, i18n, notifications, profile, pwa, settings
│   ├── components/  Component React (.tsx)
│   ├── hooks/       Hook (use*.ts, use*.tsx)
│   ├── lib/         Logic phụ thuộc môi trường: gọi API, storage, WebRTC, trình duyệt
│   ├── utils/       Hàm thuần, không đụng window/fetch/localStorage
│   ├── styles/      CSS của tính năng
│   └── types.ts     Kiểu dữ liệu dùng chung trong tính năng
├── shared/          ui/ (component dùng chung), lib/, utils/
├── styles/          CSS dùng chung toàn app
└── platform/        Tích hợp nền tảng (desktop/Electron)
```

- Code mới đặt vào đúng thư mục con của tính năng; không thêm file trực tiếp vào gốc `features/<tên>/`.
- Phần dùng chung giữa nhiều tính năng nên đưa vào `shared/` thay vì import chéo `components/` giữa các tính năng.
- PR này chỉ di chuyển file và sửa đường dẫn `import`, không đổi logic hay giao diện.

## Chuyển nhánh đang làm dở

1. Cập nhật nhánh của bạn bằng `git merge origin/main` (hoặc `git rebase origin/main`). Git tự theo dõi việc đổi tên file, nên thay đổi của bạn trong file cũ được áp vào file mới.
2. Nếu có xung đột, thường chỉ ở các dòng `import`: giữ nội dung của bạn và sửa đường dẫn theo bảng bên dưới.
3. File bạn tạo mới ở đường dẫn cũ: di chuyển vào thư mục tương ứng theo quy ước rồi sửa `import`.
4. Tìm lịch sử một file sau khi đổi tên: `git log --follow -- <đường dẫn mới>`.

## Bảng ánh xạ đường dẫn (tính từ `frontend/src`)

| Cũ | Mới |
|---|---|
| `app/useApiRequest.ts` | `app/hooks/useApiRequest.ts` |
| `app/useAppRealtime.ts` | `app/hooks/useAppRealtime.ts` |
| `app/AppSidebar.tsx` | `app/navigation/AppSidebar.tsx` |
| `app/BottomNavigation.tsx` | `app/navigation/BottomNavigation.tsx` |
| `features/auth/AccountSessionsPanel.tsx` | `features/auth/components/AccountSessionsPanel.tsx` |
| `features/auth/AuthScreen.tsx` | `features/auth/components/AuthScreen.tsx` |
| `features/auth/AuthSetup.tsx` | `features/auth/components/AuthSetup.tsx` |
| `features/auth/useAuthFlow.ts` | `features/auth/hooks/useAuthFlow.ts` |
| `features/auth/session.ts` | `features/auth/lib/session.ts` |
| `features/auth/auth-screen.css` | `features/auth/styles/auth-screen.css` |
| `features/calls/CallCenter.tsx` | `features/calls/components/CallCenter.tsx` |
| `features/calls/CallDeviceSettings.tsx` | `features/calls/components/CallDeviceSettings.tsx` |
| `features/calls/CallManager.tsx` | `features/calls/components/CallManager.tsx` |
| `features/calls/callCrypto.ts` | `features/calls/lib/callCrypto.ts` |
| `features/calls/callMediaInterpreter.ts` | `features/calls/lib/callMediaInterpreter.ts` |
| `features/calls/calls.ts` | `features/calls/lib/calls.ts` |
| `features/calls/callTranslation.ts` | `features/calls/lib/callTranslation.ts` |
| `features/calls/call-center.css` | `features/calls/styles/call-center.css` |
| `features/calls/call.css` | `features/calls/styles/call.css` |
| `features/calls/call-history.ts` | `features/calls/utils/call-history.ts` |
| `features/chat/ChatQuickSearch.tsx` | `features/chat/components/ChatQuickSearch.tsx` |
| `app/ChatTranslationSettingsPage.tsx` | `features/chat/components/ChatTranslationSettingsPage.tsx` |
| `app/CommunicationHub.tsx` | `features/chat/components/CommunicationHub.tsx` |
| `app/CommunityGroupsPage.tsx` | `features/chat/components/CommunityGroupsPage.tsx` |
| `app/CommunityGroupWizard.tsx` | `features/chat/components/CommunityGroupWizard.tsx` |
| `features/chat/ConversationCategories.tsx` | `features/chat/components/ConversationCategories.tsx` |
| `app/ConversationDetailsPanel.tsx` | `features/chat/components/ConversationDetailsPanel.tsx` |
| `features/chat/GroupActivities.tsx` | `features/chat/components/GroupActivities.tsx` |
| `features/chat/GroupChannelPicker.tsx` | `features/chat/components/GroupChannelPicker.tsx` |
| `features/chat/GroupCreator.tsx` | `features/chat/components/GroupCreator.tsx` |
| `features/chat/GroupGovernancePanel.tsx` | `features/chat/components/GroupGovernancePanel.tsx` |
| `features/chat/GroupInviteJoinDialog.tsx` | `features/chat/components/GroupInviteJoinDialog.tsx` |
| `features/chat/GroupManagementDetails.tsx` | `features/chat/components/GroupManagementDetails.tsx` |
| `features/chat/GroupRenameDialog.tsx` | `features/chat/components/GroupRenameDialog.tsx` |
| `features/chat/GroupSettingsPanel.tsx` | `features/chat/components/GroupSettingsPanel.tsx` |
| `features/chat/LinkPreview.tsx` | `features/chat/components/LinkPreview.tsx` |
| `features/chat/MessageActions.tsx` | `features/chat/components/MessageActions.tsx` |
| `features/chat/MessageSearchPanel.tsx` | `features/chat/components/MessageSearchPanel.tsx` |
| `features/chat/SharedContent.tsx` | `features/chat/components/SharedContent.tsx` |
| `features/chat/VoiceRecorder.tsx` | `features/chat/components/VoiceRecorder.tsx` |
| `features/chat/useChatPins.ts` | `features/chat/hooks/useChatPins.ts` |
| `features/chat/useChatQuickSearch.ts` | `features/chat/hooks/useChatQuickSearch.ts` |
| `features/chat/useConversationCategories.ts` | `features/chat/hooks/useConversationCategories.ts` |
| `features/chat/useConversationData.ts` | `features/chat/hooks/useConversationData.ts` |
| `features/chat/useConversationListSearch.ts` | `features/chat/hooks/useConversationListSearch.ts` |
| `features/chat/useGroupManagement.ts` | `features/chat/hooks/useGroupManagement.ts` |
| `features/chat/useMessageData.ts` | `features/chat/hooks/useMessageData.ts` |
| `chatOutbox.ts` | `features/chat/lib/chatOutbox.ts` |
| `features/chat/chatPersistence.ts` | `features/chat/lib/chatPersistence.ts` |
| `features/chat/conversationTranslationSettings.ts` | `features/chat/lib/conversationTranslationSettings.ts` |
| `features/chat/mediaUpload.ts` | `features/chat/lib/mediaUpload.ts` |
| `features/chat/messageClipboard.ts` | `features/chat/lib/messageClipboard.ts` |
| `features/chat/chat-file-transfer.css` | `features/chat/styles/chat-file-transfer.css` |
| `chat-message-search.css` | `features/chat/styles/chat-message-search.css` |
| `features/chat/chat-pins.css` | `features/chat/styles/chat-pins.css` |
| `features/chat/chat-quick-search.css` | `features/chat/styles/chat-quick-search.css` |
| `styles/chat-translation-settings.css` | `features/chat/styles/chat-translation-settings.css` |
| `app/community-groups.css` | `features/chat/styles/community-groups.css` |
| `features/chat/conversation-categories.css` | `features/chat/styles/conversation-categories.css` |
| `features/chat/conversation-content.css` | `features/chat/styles/conversation-content.css` |
| `features/chat/group-activities.css` | `features/chat/styles/group-activities.css` |
| `features/chat/group-channel-picker.css` | `features/chat/styles/group-channel-picker.css` |
| `features/chat/group-governance.css` | `features/chat/styles/group-governance.css` |
| `features/chat/group-management-workspace.css` | `features/chat/styles/group-management-workspace.css` |
| `features/chat/group-rename-dialog.css` | `features/chat/styles/group-rename-dialog.css` |
| `features/chat/group-room-header.css` | `features/chat/styles/group-room-header.css` |
| `features/chat/group-settings-sidebar.css` | `features/chat/styles/group-settings-sidebar.css` |
| `features/chat/link-preview.css` | `features/chat/styles/link-preview.css` |
| `features/chat/message-clipboard.css` | `features/chat/styles/message-clipboard.css` |
| `features/chat/message-search-panel.css` | `features/chat/styles/message-search-panel.css` |
| `styles/social-chat.css` | `features/chat/styles/social-chat.css` |
| `chat-message-filter.ts` | `features/chat/utils/chat-message-filter.ts` |
| `features/chat/chatFileTransfer.ts` | `features/chat/utils/chatFileTransfer.ts` |
| `features/chat/composerKeyboard.ts` | `features/chat/utils/composerKeyboard.ts` |
| `features/chat/conversationRead.ts` | `features/chat/utils/conversationRead.ts` |
| `features/chat/groupChannels.ts` | `features/chat/utils/groupChannels.ts` |
| `features/chat/messageCopyTarget.ts` | `features/chat/utils/messageCopyTarget.ts` |
| `features/chat/messageReactions.ts` | `features/chat/utils/messageReactions.ts` |
| `features/chat/messageTranslationPresentation.ts` | `features/chat/utils/messageTranslationPresentation.ts` |
| `features/chat/outboxRecovery.ts` | `features/chat/utils/outboxRecovery.ts` |
| `features/chat/voiceMedia.ts` | `features/chat/utils/voiceMedia.ts` |
| `features/contacts/BlockedUsersPanel.tsx` | `features/contacts/components/BlockedUsersPanel.tsx` |
| `features/contacts/ContactsView.tsx` | `features/contacts/components/ContactsView.tsx` |
| `features/contacts/useContactData.ts` | `features/contacts/hooks/useContactData.ts` |
| `features/contacts/friends-design-v2.css` | `features/contacts/styles/friends-design-v2.css` |
| `styles/friends.css` | `features/contacts/styles/friends.css` |
| `Marketplace.tsx` | `features/discover/components/Marketplace.tsx` |
| `features/discover/NearbyExplorer.tsx` | `features/discover/components/NearbyExplorer.tsx` |
| `features/discover/NearbyRadar.tsx` | `features/discover/components/NearbyRadar.tsx` |
| `features/discover/geolocation.ts` | `features/discover/lib/geolocation.ts` |
| `features/discover/nearbyPlaces.ts` | `features/discover/lib/nearbyPlaces.ts` |
| `marketplace.css` | `features/discover/styles/marketplace.css` |
| `features/discover/nearby-explorer.css` | `features/discover/styles/nearby-explorer.css` |
| `app/FeedCommunitiesList.tsx` | `features/feed/components/FeedCommunitiesList.tsx` |
| `features/feed/FeedDiscussion.tsx` | `features/feed/components/FeedDiscussion.tsx` |
| `features/feed/FeedLikeButton.tsx` | `features/feed/components/FeedLikeButton.tsx` |
| `features/feed/FeedModeration.tsx` | `features/feed/components/FeedModeration.tsx` |
| `features/feed/FeedPostActions.tsx` | `features/feed/components/FeedPostActions.tsx` |
| `features/feed/FeedPostCard.tsx` | `features/feed/components/FeedPostCard.tsx` |
| `features/feed/FeedReactionControl.tsx` | `features/feed/components/FeedReactionControl.tsx` |
| `features/feed/PostAudiencePicker.tsx` | `features/feed/components/PostAudiencePicker.tsx` |
| `app/PostCommentsPage.tsx` | `features/feed/components/PostCommentsPage.tsx` |
| `features/feed/PostComposer.tsx` | `features/feed/components/PostComposer.tsx` |
| `features/feed/PostExtrasView.tsx` | `features/feed/components/PostExtrasView.tsx` |
| `app/SocialFeedComposer.tsx` | `features/feed/components/SocialFeedComposer.tsx` |
| `app/SocialFeedSidebar.tsx` | `features/feed/components/SocialFeedSidebar.tsx` |
| `app/SocialFeedStories.tsx` | `features/feed/components/SocialFeedStories.tsx` |
| `features/feed/StoryComposer.tsx` | `features/feed/components/StoryComposer.tsx` |
| `features/feed/StoryViewer.tsx` | `features/feed/components/StoryViewer.tsx` |
| `features/feed/useFeedData.ts` | `features/feed/hooks/useFeedData.ts` |
| `features/feed/useFeedInfiniteScroll.ts` | `features/feed/hooks/useFeedInfiniteScroll.ts` |
| `features/feed/useFollowingPosts.ts` | `features/feed/hooks/useFollowingPosts.ts` |
| `features/feed/usePostSearch.ts` | `features/feed/hooks/usePostSearch.ts` |
| `features/feed/feed-actions.css` | `features/feed/styles/feed-actions.css` |
| `features/feed/feed-moderation.css` | `features/feed/styles/feed-moderation.css` |
| `styles/post-comments-page.css` | `features/feed/styles/post-comments-page.css` |
| `features/feed/post-extras.css` | `features/feed/styles/post-extras.css` |
| `styles/smart-composer.css` | `features/feed/styles/smart-composer.css` |
| `styles/social-feed.css` | `features/feed/styles/social-feed.css` |
| `styles/story-viewer.css` | `features/feed/styles/story-viewer.css` |
| `features/feed/feelings.ts` | `features/feed/utils/feelings.ts` |
| `features/feed/postExtras.ts` | `features/feed/utils/postExtras.ts` |
| `features/feed/postMentionNotifications.ts` | `features/feed/utils/postMentionNotifications.ts` |
| `features/i18n/i18n.ts` | `features/i18n/lib/i18n.ts` |
| `features/i18n/languages.ts` | `features/i18n/utils/languages.ts` |
| `app/NotificationsPage.tsx` | `features/notifications/components/NotificationsPage.tsx` |
| `app/NotificationsPanel.tsx` | `features/notifications/components/NotificationsPanel.tsx` |
| `features/notifications/incomingSound.ts` | `features/notifications/lib/incomingSound.ts` |
| `features/notifications/onesignal.ts` | `features/notifications/lib/onesignal.ts` |
| `app/notifications-page.css` | `features/notifications/styles/notifications-page.css` |
| `features/notifications/notifications.css` | `features/notifications/styles/notifications.css` |
| `app/notification-count.ts` | `features/notifications/utils/notification-count.ts` |
| `features/notifications/toast.ts` | `features/notifications/utils/toast.ts` |
| `features/profile/PrivacyControls.tsx` | `features/profile/components/PrivacyControls.tsx` |
| `app/ProfileEditorPage.tsx` | `features/profile/components/ProfileEditorPage.tsx` |
| `features/profile/ProfileIdentityForm.tsx` | `features/profile/components/ProfileIdentityForm.tsx` |
| `features/profile/ProfileNote.tsx` | `features/profile/components/ProfileNote.tsx` |
| `features/profile/ProfileOverlay.tsx` | `features/profile/components/ProfileOverlay.tsx` |
| `app/ProfilePage.tsx` | `features/profile/components/ProfilePage.tsx` |
| `features/profile/ProfileQr.tsx` | `features/profile/components/ProfileQr.tsx` |
| `features/profile/VisitorProfile.tsx` | `features/profile/components/VisitorProfile.tsx` |
| `features/profile/personal-timeline.css` | `features/profile/styles/personal-timeline.css` |
| `styles/profile-editor.css` | `features/profile/styles/profile-editor.css` |
| `features/profile/profile-note.css` | `features/profile/styles/profile-note.css` |
| `styles/profile-page.css` | `features/profile/styles/profile-page.css` |
| `features/profile/visitor-profile.css` | `features/profile/styles/visitor-profile.css` |
| `features/pwa/PWAUpdate.tsx` | `features/pwa/components/PWAUpdate.tsx` |
| `features/pwa/pwa-updates.ts` | `features/pwa/lib/pwa-updates.ts` |
| `app/SettingsWorkspace.tsx` | `features/settings/components/SettingsWorkspace.tsx` |
| `styles/settings-workspace.css` | `features/settings/styles/settings-workspace.css` |
| `styles/connection-tools.css` | `shared/ui/connection-tools.css` |
| `shared/lib/format.ts` | `shared/utils/format.ts` |
| `shared/lib/media.ts` | `shared/utils/media.ts` |
| `shared/lib/optimistic.ts` | `shared/utils/optimistic.ts` |
| `shared/lib/userLabel.ts` | `shared/utils/userLabel.ts` |
| `design-system/motion.css` | `styles/motion.css` |

## Hướng phụ thuộc (cập nhật)

`app → features → shared`; `platform` không import `features` hoặc `app`. Các file sau đã được chuyển để đúng hướng này:

| Cũ | Mới |
|---|---|
| `app/types.ts` (`Tab`) | `shared/types/navigation.ts` |
| `app/dataTypes.ts` (`ApiRequest`, `Notice`, `AppDataContext`) | `shared/types/api.ts` |
| `platform/useDesktopNotifications.ts` | `features/chat/hooks/useDesktopNotifications.ts` |
| `platform/DesktopBootstrap.tsx` | `app/DesktopBootstrap.tsx` |

Kiểu `Session`, `ManagedAccountSession` và `ToastKind` nay được định nghĩa ở `shared/types/` (`session.ts`, `notice.ts`). Các đường import cũ (`features/auth/lib/session`, `features/auth/types`, `features/notifications/utils/toast`) vẫn export lại đúng tên nên code đang có không bị vỡ.
