import 'package:flutter/material.dart';

import 'api.dart';
import 'chat_screen.dart';
import 'contacts_screen.dart';
import 'discover_screen.dart';
import 'feed_screen.dart';
import 'groups_screen.dart';
import 'localization.dart';
import 'notification_sheet.dart';
import 'profile_qr.dart';
import 'profile_screen.dart';
import 'theme.dart';
import 'widgets.dart';

enum SocoTab { chat, contacts, groups, discover, feed, profile }

class HomeShell extends StatefulWidget {
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
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  SocoTab tab = SocoTab.chat;
  final Set<SocoTab> openedTabs = {SocoTab.chat};
  String search = '';
  bool conversationOpen = false;
  Json? requestedConversation;
  int createChatRequest = 0;
  int composeFeedRequest = 0;
  int unreadTotal = 0;
  final searchFocusNode = FocusNode();
  final contentKey = GlobalKey();
  late final TextEditingController searchController = TextEditingController();

  List<NavigationDestination> destinations(BuildContext context) => [
    NavigationDestination(
      icon: const SocoIcon(SocoIconType.chat),
      label: 'Tin nhắn',
    ),
    NavigationDestination(
      icon: const SocoIcon(SocoIconType.contacts),
      label: tr(context, 'nav.contacts'),
    ),
    const NavigationDestination(
      icon: Icon(Icons.groups_2_outlined),
      label: 'Nhóm',
    ),
    NavigationDestination(
      icon: const SocoIcon(SocoIconType.discover),
      label: tr(context, 'nav.discover'),
    ),
    NavigationDestination(
      icon: const SocoIcon(SocoIconType.feed),
      label: tr(context, 'nav.feed'),
    ),
    NavigationDestination(
      icon: const SocoIcon(SocoIconType.profile),
      label: tr(context, 'nav.profile'),
    ),
  ];

  void _select(int index) {
    setState(() {
      tab = SocoTab.values[index];
      search = '';
      searchController.clear();
      // Keep the chat detail state when switching tabs; hide its nav on return.
    });
  }

  String get hint => switch (tab) {
    SocoTab.chat => 'Tìm cuộc trò chuyện',
    SocoTab.contacts => 'Tên, @username hoặc email',
    SocoTab.groups => '',
    SocoTab.feed => 'Tìm tác giả hoặc nội dung',
    SocoTab.discover => 'Tìm địa điểm quanh đây',
    SocoTab.profile => '',
  };

  Widget _screens() {
    // Mount each tab on first visit; keep its scroll/form state afterward.
    openedTabs.add(tab);
    return IndexedStack(
      index: tab.index,
      children: [
        ChatScreen(
          key: const ValueKey('chat'),
          api: widget.api,
          query: tab == SocoTab.chat ? search : '',
          requestedConversation: requestedConversation,
          createRequest: createChatRequest,
          foreground: tab == SocoTab.chat,
          onUnreadChanged: (count) {
            if (mounted && count != unreadTotal) {
              setState(() => unreadTotal = count);
            }
          },
          onConversationChanged: (value) {
            if (conversationOpen != value && mounted) {
              setState(() => conversationOpen = value);
            }
          },
        ),
        if (openedTabs.contains(SocoTab.contacts))
          ContactsScreen(
            key: const ValueKey('contacts'),
            api: widget.api,
            query: tab == SocoTab.contacts ? search : '',
            onOpenConversation: (room) {
              setState(() {
                requestedConversation = room;
                tab = SocoTab.chat;
                search = '';
                searchController.clear();
              });
            },
            onAddFriend: _focusContactSearch,
            onCreateGroup: () => setState(() => tab = SocoTab.groups),
          )
        else
          const SizedBox.shrink(),
        if (openedTabs.contains(SocoTab.groups))
          GroupsScreen(
            key: const ValueKey('groups'),
            api: widget.api,
            onOpenConversation: _openConversation,
          )
        else
          const SizedBox.shrink(),
        if (openedTabs.contains(SocoTab.discover))
          DiscoverScreen(
            key: const ValueKey('discover'),
            api: widget.api,
            query: tab == SocoTab.discover ? search : '',
          )
        else
          const SizedBox.shrink(),
        if (openedTabs.contains(SocoTab.feed))
          FeedScreen(
            key: const ValueKey('feed'),
            api: widget.api,
            query: tab == SocoTab.feed ? search : '',
            composeRequest: composeFeedRequest,
          )
        else
          const SizedBox.shrink(),
        if (openedTabs.contains(SocoTab.profile))
          ProfileScreen(
            key: const ValueKey('profile'),
            api: widget.api,
            onLogout: widget.onLogout,
            onConnect: _connectProfile,
            onLocaleChanged: widget.onLocaleChanged,
          )
        else
          const SizedBox.shrink(),
      ],
    );
  }

  bool get _showsHeader =>
      tab == SocoTab.chat || tab == SocoTab.contacts || tab == SocoTab.feed;

  Widget _header(bool compact) {
    return Container(
      key: const ValueKey('web-appbar'),
      height: compact ? 112 : 76,
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
    if (tab == SocoTab.feed) {
      return [
        IconButton(
          tooltip: 'Tạo bài viết',
          style: style,
          onPressed: () => setState(() => composeFeedRequest++),
          icon: const SocoIcon(SocoIconType.compose, size: 27),
        ),
        IconButton(
          tooltip: 'Thông báo',
          style: style,
          onPressed: _openNotifications,
          icon: const SocoIcon(SocoIconType.bell, size: 27),
        ),
      ];
    }
    if (tab == SocoTab.contacts) {
      return [
        IconButton(
          tooltip: 'Thêm bạn',
          style: style,
          onPressed: _focusContactSearch,
          icon: const SocoIcon(SocoIconType.plus, size: 31),
        ),
      ];
    }
    return [
      IconButton(
        tooltip: 'Thông báo',
        style: style,
        onPressed: _openNotifications,
        icon: const SocoIcon(SocoIconType.bell, size: 26),
      ),
      IconButton(
        tooltip: 'Quét QR',
        style: style,
        onPressed: () => _showQr(initialScan: true),
        icon: const SocoIcon(SocoIconType.qr, size: 28),
      ),
      IconButton(
        key: const ValueKey('quick-create'),
        tooltip: 'Tạo mới',
        style: style,
        onPressed: () {
          setState(() {
            tab = SocoTab.chat;
            createChatRequest++;
          });
        },
        icon: const SocoIcon(SocoIconType.plus, size: 31),
      ),
    ];
  }

  Widget _searchField({bool compact = false}) {
    return SizedBox(
      height: compact ? 41 : 46,
      child: TextField(
        controller: searchController,
        focusNode: searchFocusNode,
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
    setState(() {
      tab = SocoTab.contacts;
      search = username;
      searchController.text = username;
      conversationOpen = false;
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

  void _openConversation(Json room) {
    setState(() {
      requestedConversation = room;
      tab = SocoTab.chat;
      search = '';
      searchController.clear();
    });
  }

  void _focusContactSearch() {
    setState(() => tab = SocoTab.contacts);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) searchFocusNode.requestFocus();
    });
  }

  void _openNotifications() {
    showNotificationSheet(
      context,
      widget.api,
      onOpenConversation: _openConversation,
      onOpenInvitations: () => setState(() => tab = SocoTab.contacts),
    );
  }

  @override
  void dispose() {
    searchFocusNode.dispose();
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
                      // Zalo-style conversation detail owns its own compact header.
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
    final items = destinations(context);
    return Container(
      key: const ValueKey('bottom-navigation'),
      height: compact ? 66 : 70,
      decoration: const BoxDecoration(
        color: Color(0xFFFEFEFF),
        border: Border(top: BorderSide(color: socoLine)),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Row(
            children: [
              for (var index = 0; index < items.length; index++)
                Expanded(
                  child: Semantics(
                    button: true,
                    selected: tab.index == index,
                    label: items[index].label,
                    child: InkWell(
                      key: ValueKey('nav-${SocoTab.values[index].name}'),
                      onTap: () => _select(index),
                      child: Center(
                        child: Container(
                          height: compact ? 60 : 62,
                          margin: EdgeInsets.symmetric(
                            horizontal: compact ? 3 : 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.transparent,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Stack(
                                    clipBehavior: Clip.none,
                                    children: [
                                      IconTheme(
                                        data: IconThemeData(
                                          color: tab.index == index
                                              ? socoBlue
                                              : const Color(0xFF8792A8),
                                          size: compact ? 24 : 26,
                                        ),
                                        child: items[index].icon,
                                      ),
                                      if (index == SocoTab.chat.index &&
                                          unreadTotal > 0)
                                        Positioned(
                                          top: -7,
                                          right: -11,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 4,
                                              vertical: 2,
                                            ),
                                            constraints: const BoxConstraints(
                                              minWidth: 17,
                                              minHeight: 17,
                                            ),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFF04452),
                                              borderRadius:
                                                  BorderRadius.circular(11),
                                              border: Border.all(
                                                color: Colors.white,
                                              ),
                                            ),
                                            child: Text(
                                              unreadTotal > 99
                                                  ? '99+'
                                                  : '$unreadTotal',
                                              textAlign: TextAlign.center,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 9,
                                                fontWeight: FontWeight.w800,
                                                height: 1,
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    items[index].label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: compact ? 9.5 : 11,
                                      fontWeight: tab.index == index
                                          ? FontWeight.w800
                                          : FontWeight.w500,
                                      color: tab.index == index
                                          ? socoBlue
                                          : const Color(0xFF8792A8),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
