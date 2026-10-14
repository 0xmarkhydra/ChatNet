import 'package:flutter/material.dart';

import 'api.dart';
import 'chat_screen.dart';
import 'contacts_screen.dart';
import 'discover_screen.dart';
import 'feed_screen.dart';
import 'localization.dart';
import 'notification_sheet.dart';
import 'profile_qr.dart';
import 'profile_screen.dart';
import 'theme.dart';
import 'widgets.dart';

enum SocoTab { chat, contacts, discover, feed, profile }

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
  String search = '';
  bool conversationOpen = false;
  Json? requestedConversation;
  int createChatRequest = 0;
  final contentKey = GlobalKey();
  late final TextEditingController searchController = TextEditingController();

  List<NavigationDestination> destinations(BuildContext context) => [
    NavigationDestination(
      icon: const SocoIcon(SocoIconType.chat),
      label: tr(context, 'nav.chat'),
    ),
    NavigationDestination(
      icon: const SocoIcon(SocoIconType.contacts),
      label: tr(context, 'nav.contacts'),
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
      if (tab != SocoTab.chat) conversationOpen = false;
    });
  }

  String get hint => switch (tab) {
    SocoTab.chat => 'Tìm cuộc trò chuyện',
    SocoTab.contacts => 'Tên, @username hoặc email',
    SocoTab.feed => 'Tìm tác giả hoặc nội dung',
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
          onConversationChanged: (value) {
            if (conversationOpen != value && mounted) {
              setState(() => conversationOpen = value);
            }
          },
        ),
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
          onAddFriend: () {
            setState(() {
              tab = SocoTab.chat;
              createChatRequest++;
            });
          },
          onCreateGroup: () {
            setState(() {
              tab = SocoTab.chat;
              createChatRequest++;
            });
          },
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
        ),
        ProfileScreen(
          key: const ValueKey('profile'),
          api: widget.api,
          onLogout: widget.onLogout,
          onConnect: _connectProfile,
          onLocaleChanged: widget.onLocaleChanged,
        ),
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
                      'SOCO',
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
                  'SOCO',
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
          onPressed: () {},
          icon: const SocoIcon(SocoIconType.compose, size: 27),
        ),
        IconButton(
          tooltip: 'Thông báo',
          style: style,
          onPressed: () => showNotificationSheet(context, widget.api),
          icon: const SocoIcon(SocoIconType.bell, size: 27),
        ),
      ];
    }
    if (tab == SocoTab.contacts) {
      return [
        IconButton(
          tooltip: 'Thêm bạn',
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
    return [
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

  @override
  void dispose() {
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
                      if (_showsHeader) _header(compact),
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
      height: compact ? 58 : 66,
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
                          height: compact ? 48 : 52,
                          margin: EdgeInsets.symmetric(
                            horizontal: compact ? 3 : 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: tab.index == index
                                ? const Color(0xFFE5EDFF)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              if (tab.index == index)
                                const Positioned(
                                  top: 0,
                                  child: SizedBox(
                                    width: 28,
                                    child: Divider(
                                      height: 3,
                                      thickness: 3,
                                      color: socoBlue,
                                    ),
                                  ),
                                ),
                              Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  IconTheme(
                                    data: IconThemeData(
                                      color: tab.index == index
                                          ? socoBlue
                                          : const Color(0xFF8792A8),
                                      size: compact ? 25 : 26,
                                    ),
                                    child: items[index].icon,
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
