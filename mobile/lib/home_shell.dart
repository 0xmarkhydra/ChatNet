import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'presentation/mobile_shell_state.dart';
import 'presentation/mobile_scroll_chrome.dart';
import 'presentation/soco_bottom_navigation.dart';

import 'api.dart';
import 'chat_screen.dart';
import 'contacts_screen.dart';
import 'explore_screen.dart';
import 'feed_screen.dart';
import 'notification_sheet.dart';
import 'presentation/notification_store.dart';
import 'state/app_providers.dart';
import 'profile_qr.dart';
import 'profile_screen.dart';
import 'theme.dart';
import 'widgets.dart';

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({
    super.key,
    required this.api,
    required this.onLogout,
    required this.onLocaleChanged,
  });

  final Api api;
  final Future<void> Function() onLogout;
  final ValueChanged<String> onLocaleChanged;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  SocoTab get tab => ref.read(mobileShellProvider).tab;
  bool get conversationOpen => ref.read(mobileShellProvider).conversationOpen;
  int get unreadTotal => ref.read(mobileShellProvider).unreadTotal;
  late NotificationStore notificationStore;
  Timer? notificationPoll;
  Timer? notificationRefresh;
  @override
  void initState() {
    super.initState();
    notificationStore = NotificationStore(widget.api);
    unawaited(notificationStore.refresh());
    if (!widget.api.isDemo) {
      notificationPoll = Timer.periodic(
        const Duration(seconds: 30),
        (_) => _scheduleNotificationRefresh(),
      );
    }
  }

  void _scheduleNotificationRefresh() {
    notificationRefresh?.cancel();
    notificationRefresh = Timer(const Duration(milliseconds: 150), () {
      if (mounted) unawaited(notificationStore.refresh());
    });
  }

  String search = '';
  Json? requestedConversation;
  int openConversationRequest = 0;
  int createChatRequest = 0;
  int chatHomeRequest = 0;
  int createPostRequest = 0;
  int openPostRequest = 0;
  int? requestedPostId;
  int newFriendRequest = 0;
  int profileVisitRequest = 0;
  int profileSettingsRequest = 0;
  bool feedCommunitiesOpen = false;
  // Mount screens only after their first visit; IndexedStack still preserves
  // navigation state and scroll positions for every previously opened tab.
  final Set<SocoTab> _visitedTabs = <SocoTab>{};
  final contentKey = GlobalKey();
  final _scrollChrome = MobileScrollChrome();
  SocoTab? _lastChromeTab;
  bool _lastConversationOpen = false;
  bool _chromeFramePending = false;
  late final TextEditingController searchController = TextEditingController();

  void _onMobileScroll(
    ScrollNotification notification, {
    String source = 'page',
  }) {
    if (notification.metrics.axis != Axis.vertical) return;
    // A scroll ending at the last pixel must NOT reveal the bars. Flutter
    // forwards the direct drag flag so momentum/bounce never mimics a swipe.
    final delta = switch (notification) {
      ScrollUpdateNotification update => update.scrollDelta ?? 0.0,
      OverscrollNotification overscroll => overscroll.overscroll,
      _ => null,
    };
    if (delta == null) return;
    final isUserDrag = switch (notification) {
      ScrollUpdateNotification update => update.dragDetails != null,
      OverscrollNotification overscroll => overscroll.dragDetails != null,
      _ => false,
    };
    final metrics = notification.metrics;
    if (_scrollChrome.update(
      offset: metrics.pixels - metrics.minScrollExtent,
      scrollRange: metrics.maxScrollExtent - metrics.minScrollExtent,
      delta: delta,
      isUserDrag: isUserDrag,
      isChat: tab == SocoTab.chat,
      source: source,
    )) {
      // Scroll notifications arrive during layout; rebuild after this frame.
      if (_chromeFramePending) return;
      _chromeFramePending = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _chromeFramePending = false;
        if (mounted) setState(() {});
      });
    }
  }

  // A genuine reverse finger drag or upward wheel/trackpad event can occur
  // while the inbox is clamped at an edge, producing no scroll notification.
  // Reveal both bars together without changing the list's scroll position.
  void _revealMobileChatChrome() {
    if (!mounted || tab != SocoTab.chat || conversationOpen) return;
    if (_scrollChrome.reveal()) setState(() {});
  }

  void _select(int index) {
    final destination = SocoTab.values[index];
    ref.read(mobileShellProvider.notifier).select(destination);
    setState(() {
      search = '';
      searchController.clear();
      if (destination == SocoTab.chat) chatHomeRequest++;
      if (destination == SocoTab.profile) profileVisitRequest++;
    });
  }

  void _openChat(Json room) {
    if (!mounted) return;
    ref.read(mobileShellProvider.notifier).openConversation();
    setState(() {
      requestedConversation = room;
      openConversationRequest++;
      search = '';
      searchController.clear();
    });
  }

  void _openFeedPost(int postId) {
    ref.read(mobileShellProvider.notifier).select(SocoTab.feed);
    setState(() {
      requestedPostId = postId;
      feedCommunitiesOpen = false;
      openPostRequest++;
      search = '';
      searchController.clear();
    });
  }

  void _openInvitations() {
    ref.read(mobileShellProvider.notifier).select(SocoTab.contacts);
    setState(() => newFriendRequest++);
  }

  void _showNotifications() {
    showNotificationSheet(
      context,
      widget.api,
      store: notificationStore,
      onOpenConversation: _openChat,
      onOpenPost: _openFeedPost,
      onOpenInvitations: _openInvitations,
    );
  }

  void _createChat() {
    ref.read(mobileShellProvider.notifier).select(SocoTab.chat);
    setState(() => createChatRequest++);
  }

  String get hint => switch (tab) {
    SocoTab.chat => '',
    SocoTab.contacts => 'Tên, @username hoặc email',
    SocoTab.feed => 'Tìm tác giả hoặc nội dung bài viết',
    SocoTab.discover => 'Tìm địa điểm quanh đây',
    SocoTab.profile => '',
  };

  Widget _screens() {
    _visitedTabs.add(tab);
    return IndexedStack(
      index: tab.index,
      children: [
        if (_visitedTabs.contains(SocoTab.chat))
          ChatScreen(
            key: const ValueKey('chat'),
            api: widget.api,
            query: tab == SocoTab.chat ? search : '',
            requestedConversation: requestedConversation,
            openConversationRequest: openConversationRequest,
            createRequest: createChatRequest,
            resetRequest: chatHomeRequest,
            onUnreadChanged: (count) {
              if (mounted) {
                final changed = unreadTotal != count;
                ref.read(mobileShellProvider.notifier).setUnreadTotal(count);
                if (changed) _scheduleNotificationRefresh();
              }
            },
            onConversationChanged: (value) {
              if (mounted) {
                ref
                    .read(mobileShellProvider.notifier)
                    .setConversationOpen(value);
              }
            },
            // The avatar and channel lists have independent scrollports.
            // Do not read every nested Chat scroll notification from IndexedStack.
            onMobileScroll: (notification, source) {
              if (tab == SocoTab.chat && !conversationOpen) {
                _onMobileScroll(notification, source: source);
              }
            },
            onMobileReverseScroll: _revealMobileChatChrome,
          )
        else
          const SizedBox.shrink(),
        if (_visitedTabs.contains(SocoTab.contacts))
          ContactsScreen(
            key: const ValueKey('contacts'),
            api: widget.api,
            query: tab == SocoTab.contacts ? search : '',
            onOpenConversation: _openChat,
            onAddFriend: _createChat,
            onCreateGroup: _createChat,
            newFriendRequest: newFriendRequest,
            onScanQr: () => _showQr(initialScan: true),
            onShowQr: () => _showQr(),
          )
        else
          const SizedBox.shrink(),
        if (_visitedTabs.contains(SocoTab.discover))
          ExploreScreen(
            key: const ValueKey('discover'),
            api: widget.api,
            query: tab == SocoTab.discover ? search : '',
            onOpenConversation: _openChat,
            onViewPosts: () => _select(SocoTab.feed.index),
          )
        else
          const SizedBox.shrink(),
        if (_visitedTabs.contains(SocoTab.feed))
          FeedScreen(
            key: const ValueKey('feed'),
            api: widget.api,
            query: tab == SocoTab.feed ? search : '',
            createRequest: createPostRequest,
            showCommunities: feedCommunitiesOpen,
            onToggleCommunities: () =>
                setState(() => feedCommunitiesOpen = !feedCommunitiesOpen),
            openPostId: requestedPostId,
            openPostRequest: openPostRequest,
            onOpenOwnProfile: () => _select(SocoTab.profile.index),
            onOpenConversation: _openChat,
          )
        else
          const SizedBox.shrink(),
        if (_visitedTabs.contains(SocoTab.profile))
          ProfileScreen(
            key: const ValueKey('profile'),
            api: widget.api,
            refreshRequest: profileVisitRequest,
            settingsRequest: profileSettingsRequest,
            onLogout: widget.onLogout,
            onConnect: _connectProfile,
            onLocaleChanged: widget.onLocaleChanged,
            onNotifications: _showNotifications,
            onOpenPost: _openFeedPost,
            onOpenContacts: () => _select(SocoTab.contacts.index),
            onOpenConversation: _openChat,
            onCreatePost: () {
              ref.read(mobileShellProvider.notifier).select(SocoTab.feed);
              setState(() {
                feedCommunitiesOpen = false;
                createPostRequest++;
              });
            },
          )
        else
          const SizedBox.shrink(),
      ],
    );
  }

  // PWA: one shared toolbar on all five primary tabs.
  bool get _showsHeader => true;

  Widget _header(bool compact) {
    return Container(
      key: const ValueKey('web-appbar'),
      height: compact ? 52 : 76,
      padding: EdgeInsets.symmetric(horizontal: compact ? 12 : 20),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE9EDF5))),
      ),
      child: Row(
        children: [
          SocoLogo(size: compact ? 27 : 40),
          SizedBox(width: compact ? 6 : 10),
          if (compact)
            const Text(
              'SocCO',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                letterSpacing: -.3,
                color: Color(0xFF2358BD),
              ),
            )
          else
            const GradientText(
              'SocCO',
              style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900),
            ),
          if (!compact && hint.isNotEmpty) ...[
            const SizedBox(width: 26),
            Expanded(child: _searchField()),
          ],
          const Spacer(),
          ..._headerActions(),
        ],
      ),
    );
  }

  /// Search is always its own persistent row, independent of the collapsing
  /// toolbar (Contacts/Discover/Feed), exactly like the PWA mobile shell.
  Widget _mobileSearchDock() => Container(
    key: const ValueKey('mobile-search-dock'),
    height: 60,
    padding: const EdgeInsets.fromLTRB(12, 7, 12, 7),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(bottom: BorderSide(color: Color(0xFFE9EDF5))),
    ),
    child: _searchField(compact: true),
  );

  List<Widget> _headerActions() {
    final style = IconButton.styleFrom(
      foregroundColor: socoBlue,
      backgroundColor: Colors.transparent,
      hoverColor: socoSoftBlue,
      minimumSize: const Size.square(42),
      maximumSize: const Size.square(42),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
    final bell = IconButton(
      tooltip: 'Thông báo',
      style: style,
      onPressed: _showNotifications,
      icon: ListenableBuilder(
        listenable: notificationStore,
        builder: (context, _) => Badge(
          key: const ValueKey('header-notification-badge'),
          isLabelVisible: notificationStore.unread > 0,
          label: Text(
            notificationStore.unread > 99
                ? '99+'
                : '${notificationStore.unread}',
          ),
          backgroundColor: socoBlue,
          child: const SocoIcon(SocoIconType.bell, size: 20),
        ),
      ),
    );
    if (tab == SocoTab.feed) {
      return [
        IconButton(
          key: const ValueKey('feed-communities-toggle'),
          tooltip: 'Cộng đồng',
          style: style,
          onPressed: () =>
              setState(() => feedCommunitiesOpen = !feedCommunitiesOpen),
          icon: Icon(
            feedCommunitiesOpen ? Icons.groups_rounded : Icons.groups_outlined,
            size: 21,
          ),
        ),
        bell,
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: InkWell(
            key: const ValueKey('header-my-avatar'),
            onTap: () => _select(SocoTab.profile.index),
            borderRadius: BorderRadius.circular(50),
            child: UserAvatar(
              name: widget.api.user['displayName']?.toString() ?? '',
              username: widget.api.user['username']?.toString(),
              size: 32,
              fetchProfileImage: !widget.api.isDemo,
            ),
          ),
        ),
      ];
    }
    if (tab == SocoTab.contacts) {
      return [
        IconButton(
          tooltip: 'Thêm bạn',
          style: style,
          onPressed: () => setState(() => newFriendRequest++),
          icon: const SocoIcon(SocoIconType.plus, size: 21),
        ),
        bell,
      ];
    }
    if (tab == SocoTab.discover) return [bell];
    if (tab == SocoTab.profile) {
      return [
        IconButton(
          key: const ValueKey('profile-create-post'),
          tooltip: 'Đăng bài',
          style: style,
          onPressed: () {
            ref.read(mobileShellProvider.notifier).select(SocoTab.feed);
            setState(() {
              feedCommunitiesOpen = false;
              createPostRequest++;
            });
          },
          icon: const Icon(Icons.edit_outlined, size: 20),
        ),
        bell,
        Padding(
          padding: const EdgeInsets.only(left: 2),
          child: InkWell(
            key: const ValueKey('header-my-avatar'),
            onTap: () => setState(() => profileSettingsRequest++),
            borderRadius: BorderRadius.circular(50),
            child: UserAvatar(
              name: widget.api.user['displayName']?.toString() ?? '',
              username: widget.api.user['username']?.toString(),
              size: 32,
              fetchProfileImage: !widget.api.isDemo,
            ),
          ),
        ),
      ];
    }
    return [
      IconButton(
        tooltip: 'Quét QR',
        style: style,
        onPressed: () => _showQr(initialScan: true),
        icon: const SocoIcon(SocoIconType.qr, size: 21),
      ),
      IconButton(
        key: const ValueKey('quick-create'),
        tooltip: 'Tạo mới',
        style: style,
        onPressed: _createChat,
        icon: const SocoIcon(SocoIconType.plus, size: 21),
      ),
      bell,
    ];
  }

  Widget _searchField({bool compact = false}) {
    return SizedBox(
      height: compact ? 41 : 46,
      child: TextField(
        controller: searchController,
        onChanged: (value) => setState(() => search = value),
        decoration: InputDecoration(
          hintText: hint,
          prefixIcon: Padding(
            padding: const EdgeInsets.all(10),
            child: SocoIcon(SocoIconType.search, size: compact ? 21 : 22),
          ),
          suffixIcon: search.isEmpty
              ? null
              : IconButton(
                  onPressed: () {
                    searchController.clear();
                    setState(() => search = '');
                  },
                  icon: const Icon(Icons.close_rounded, size: 18),
                ),
          contentPadding: EdgeInsets.zero,
          filled: true,
          fillColor: const Color(0xFFF4F6FC),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(compact ? 13 : 16),
            borderSide: const BorderSide(color: Color(0xFFE7ECF7)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(compact ? 13 : 16),
            borderSide: const BorderSide(color: Color(0xFFE7ECF7)),
          ),
        ),
      ),
    );
  }

  void _connectProfile(String username) {
    ref.read(mobileShellProvider.notifier).select(SocoTab.contacts);
    setState(() {
      search = username;
      searchController.text = username;
    });
  }

  void _showQr({bool initialScan = false}) {
    final user = widget.api.user;
    showProfileQr(
      context,
      username: user['username']?.toString() ?? '',
      displayName:
          user['displayName']?.toString() ?? user['username']?.toString() ?? '',
      initialScan: initialScan,
      onConnect: _connectProfile,
    );
  }

  @override
  void dispose() {
    notificationPoll?.cancel();
    notificationRefresh?.cancel();
    notificationStore.dispose();
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(mobileShellProvider);
    ref.listen(realtimeRevisionProvider, (previous, next) {
      if (next.hasValue && next.value != previous?.value) {
        _scheduleNotificationRefresh();
      }
    });
    if (_lastChromeTab != tab || _lastConversationOpen != conversationOpen) {
      _lastChromeTab = tab;
      _lastConversationOpen = conversationOpen;
      _scrollChrome.reset();
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth <= 760;
        final framed = !compact;
        final hideBottomNav =
            compact && conversationOpen && tab == SocoTab.chat;
        return Scaffold(
          body: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1440),
                child: Container(
                  margin: framed ? const EdgeInsets.all(16) : EdgeInsets.zero,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: framed ? Border.all(color: socoLine) : null,
                    borderRadius: framed
                        ? BorderRadius.circular(22)
                        : BorderRadius.zero,
                    boxShadow: framed
                        ? const [
                            BoxShadow(
                              color: Color(0x12213882),
                              blurRadius: 34,
                              offset: Offset(0, 12),
                            ),
                          ]
                        : null,
                  ),
                  child: Stack(
                    children: [
                      Column(
                        children: [
                          if (_showsHeader &&
                              !(compact &&
                                  tab == SocoTab.chat &&
                                  conversationOpen))
                            AnimatedContainer(
                              key: const ValueKey('mobile-header-slot'),
                              duration: compact
                                  ? const Duration(milliseconds: 290)
                                  : Duration.zero,
                              curve: Curves.easeOutCubic,
                              height: compact
                                  ? (_scrollChrome.hidden ? 0 : 52)
                                  : 76,
                              child: ClipRect(
                                child: Align(
                                  alignment: Alignment.topCenter,
                                  child: IgnorePointer(
                                    ignoring: compact && _scrollChrome.hidden,
                                    child: AnimatedSlide(
                                      duration: const Duration(
                                        milliseconds: 290,
                                      ),
                                      curve: Curves.easeOutCubic,
                                      offset: compact && _scrollChrome.hidden
                                          ? const Offset(0, -1)
                                          : Offset.zero,
                                      child: AnimatedOpacity(
                                        duration: const Duration(
                                          milliseconds: 240,
                                        ),
                                        opacity: compact && _scrollChrome.hidden
                                            ? 0
                                            : 1,
                                        child: _header(compact),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          // Search is persistent even while the shared header
                          // slides away, like the PWA independent search dock.
                          if (compact && hint.isNotEmpty && !hideBottomNav)
                            _mobileSearchDock(),
                          Expanded(
                            child: NotificationListener<ScrollNotification>(
                              onNotification: (notification) {
                                if (compact &&
                                    tab != SocoTab.chat &&
                                    notification.depth == 0) {
                                  _onMobileScroll(notification);
                                }
                                return false;
                              },
                              child: KeyedSubtree(
                                key: contentKey,
                                child: _screens(),
                              ),
                            ),
                          ),
                          if (!compact && !hideBottomNav)
                            _bottomNavigation(compact),
                        ],
                      ),
                      // The PWA bottom bar floats over the content, without
                      // creating a blank 69px layout band below every screen.
                      if (compact && !hideBottomNav)
                        Positioned(
                          bottom: 16,
                          left: 24,
                          right: 24,
                          height: 56,
                          child: IgnorePointer(
                            ignoring: _scrollChrome.hidden,
                            child: AnimatedSlide(
                              duration: const Duration(milliseconds: 290),
                              curve: Curves.easeOutCubic,
                              offset: _scrollChrome.hidden
                                  ? const Offset(0, 2)
                                  : Offset.zero,
                              child: AnimatedOpacity(
                                duration: const Duration(milliseconds: 240),
                                opacity: _scrollChrome.hidden ? 0 : 1,
                                child: _bottomNavigation(true),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _bottomNavigation(bool compact) {
    return SocoBottomNavigationBar(
      compact: compact,
      selected: tab,
      unreadTotal: unreadTotal,
      onSelected: (destination) => _select(destination.index),
    );
  }
}
