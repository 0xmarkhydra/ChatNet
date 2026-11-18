import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'presentation/mobile_shell_state.dart';
import 'presentation/soco_bottom_navigation.dart';

import 'api.dart';
import 'chat_screen.dart';
import 'contacts_screen.dart';
import 'discover_screen.dart';
import 'feed_screen.dart';
import 'notification_sheet.dart';
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
  String search = '';
  Json? requestedConversation;
  int createChatRequest = 0;
  int chatHomeRequest = 0;
  int createPostRequest = 0;
  int newFriendRequest = 0;
  final contentKey = GlobalKey();
  late final TextEditingController searchController = TextEditingController();

  void _select(int index) {
    final destination = SocoTab.values[index];
    ref.read(mobileShellProvider.notifier).select(destination);
    setState(() {
      search = '';
      searchController.clear();
      if (destination == SocoTab.chat) chatHomeRequest++;
    });
  }

  void _openChat(Json room) {
    if (!mounted) return;
    ref.read(mobileShellProvider.notifier).openConversation();
    setState(() {
      requestedConversation = room;
      search = '';
      searchController.clear();
    });
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
    return IndexedStack(
      index: tab.index,
      children: [
        ChatScreen(
          key: const ValueKey('chat'),
          api: widget.api,
          query: tab == SocoTab.chat ? search : '',
          requestedConversation: requestedConversation,
          createRequest: createChatRequest,
          resetRequest: chatHomeRequest,
          onUnreadChanged: (count) {
            if (mounted) {
              ref.read(mobileShellProvider.notifier).setUnreadTotal(count);
            }
          },
          onConversationChanged: (value) {
            if (mounted) {
              ref.read(mobileShellProvider.notifier).setConversationOpen(value);
            }
          },
        ),
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
        ),
        DiscoverScreen(
          key: const ValueKey('discover'),
          api: widget.api,
          query: tab == SocoTab.discover ? search : '',
        ),
        FeedScreen(
          key: const ValueKey('feed'),
          api: widget.api,
          query: tab == SocoTab.feed ? search : '',
          createRequest: createPostRequest,
          onOpenOwnProfile: () => _select(SocoTab.profile.index),
          onOpenConversation: _openChat,
        ),
        ProfileScreen(
          key: const ValueKey('profile'),
          api: widget.api,
          onLogout: widget.onLogout,
          onConnect: _connectProfile,
          onLocaleChanged: widget.onLocaleChanged,
          onCreatePost: () {
            ref.read(mobileShellProvider.notifier).select(SocoTab.feed);
            setState(() => createPostRequest++);
          },
        ),
      ],
    );
  }

  bool get _showsHeader =>
      tab == SocoTab.chat || tab == SocoTab.contacts || tab == SocoTab.feed;

  Widget _header(bool compact) {
    return Container(
      key: const ValueKey('web-appbar'),
      height: compact ? (hint.isEmpty ? 70 : 112) : 76,
      padding: EdgeInsets.fromLTRB(
        compact ? 14 : 20,
        compact ? 10 : 12,
        compact ? 14 : 20,
        compact ? 9 : 12,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFFFEFEFF),
        border: Border(bottom: BorderSide(color: socoLine)),
      ),
      child: compact
          ? Column(
              children: [
                Row(
                  children: [
                    const SocoLogo(size: 34),
                    const SizedBox(width: 7),
                    const GradientText(
                      'SocCO',
                      style: TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const Spacer(),
                    ..._headerActions(),
                  ],
                ),
                const SizedBox(height: 7),
                if (hint.isNotEmpty) _searchField(compact: true),
              ],
            )
          : Row(
              children: [
                const SocoLogo(size: 40),
                const SizedBox(width: 10),
                const GradientText(
                  'SocCO',
                  style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900),
                ),
                const SizedBox(width: 26),
                if (hint.isNotEmpty) Expanded(child: _searchField()),
                const SizedBox(width: 18),
                ..._headerActions(),
              ],
            ),
    );
  }

  List<Widget> _headerActions() {
    final style = IconButton.styleFrom(
      foregroundColor: socoBlue,
      backgroundColor: Colors.transparent,
      hoverColor: socoSoftBlue,
      minimumSize: const Size.square(40),
      maximumSize: const Size.square(40),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
    final bell = IconButton(
      tooltip: 'Thông báo',
      style: style,
      onPressed: () => showNotificationSheet(context, widget.api),
      icon: const SocoIcon(SocoIconType.bell, size: 26),
    );
    if (tab == SocoTab.feed) {
      return [
        IconButton(
          tooltip: 'Bạn bè',
          style: style,
          onPressed: () => _select(SocoTab.contacts.index),
          icon: const Icon(Icons.people_outline_rounded, size: 27),
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
              size: 35,
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
          icon: const SocoIcon(SocoIconType.plus, size: 31),
        ),
        bell,
      ];
    }
    return [
      IconButton(
        tooltip: 'Quét QR',
        style: style,
        onPressed: () => _showQr(initialScan: true),
        icon: const SocoIcon(SocoIconType.qr, size: 27),
      ),
      IconButton(
        key: const ValueKey('quick-create'),
        tooltip: 'Tạo mới',
        style: style,
        onPressed: _createChat,
        icon: const SocoIcon(SocoIconType.plus, size: 31),
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
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(mobileShellProvider);
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
                  child: Column(
                    children: [
                      if (_showsHeader &&
                          !(compact && tab == SocoTab.chat && conversationOpen))
                        _header(compact),
                      Expanded(
                        child: KeyedSubtree(key: contentKey, child: _screens()),
                      ),
                      if (!hideBottomNav) _bottomNavigation(compact),
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
