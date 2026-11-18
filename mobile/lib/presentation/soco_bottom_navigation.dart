import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets.dart';
import 'mobile_shell_state.dart';

/// Native five-tab PWA navigation. A single animated indicator glides between
/// destinations; unchanged children retain their element identity and state.
class SocoBottomNavigationBar extends StatelessWidget {
  const SocoBottomNavigationBar({
    super.key,
    required this.selected,
    required this.onSelected,
    required this.unreadTotal,
    required this.compact,
  });

  final SocoTab selected;
  final ValueChanged<SocoTab> onSelected;
  final int unreadTotal;
  final bool compact;

  static const _destinations =
      <({SocoTab tab, String label, SocoIconType icon})>[
        (tab: SocoTab.chat, label: 'Messages', icon: SocoIconType.chat),
        (tab: SocoTab.contacts, label: 'Friends', icon: SocoIconType.contacts),
        (tab: SocoTab.discover, label: 'Nearby', icon: SocoIconType.discover),
        (tab: SocoTab.feed, label: 'Feed', icon: SocoIconType.feed),
        (tab: SocoTab.profile, label: 'Profile', icon: SocoIconType.profile),
      ];

  @override
  Widget build(BuildContext context) {
    final index = selected.index;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return Container(
      key: const ValueKey('bottom-navigation'),
      height: compact ? 69 : 74,
      decoration: const BoxDecoration(
        color: Color(0xFFFEFEFF),
        border: Border(top: BorderSide(color: socoLine)),
        boxShadow: [
          BoxShadow(
            color: Color(0x0B223E74),
            blurRadius: 12,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Stack(
            children: [
              AnimatedAlign(
                duration: reduceMotion
                    ? Duration.zero
                    : const Duration(milliseconds: 260),
                curve: Curves.easeOutCubic,
                alignment: Alignment(-1 + index * .5, -.4),
                child: FractionallySizedBox(
                  widthFactor: 1 / _destinations.length,
                  child: Center(
                    child: Container(
                      key: const ValueKey('nav-selection-indicator'),
                      width: compact ? 49 : 56,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE7EEFF),
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ),
              Row(
                children: [
                  for (final item in _destinations)
                    Expanded(
                      child: Semantics(
                        button: true,
                        selected: selected == item.tab,
                        label: item.label,
                        child: InkWell(
                          key: ValueKey('nav-${item.tab.name}'),
                          onTap: () => onSelected(item.tab),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: compact ? 49 : 56,
                                height: 36,
                                child: Stack(
                                  clipBehavior: Clip.none,
                                  alignment: Alignment.center,
                                  children: [
                                    IconTheme(
                                      data: IconThemeData(
                                        color: selected == item.tab
                                            ? socoBlue
                                            : const Color(0xFF8893A9),
                                        size: 25,
                                      ),
                                      child: SocoIcon(item.icon),
                                    ),
                                    if (item.tab == SocoTab.chat &&
                                        unreadTotal > 0)
                                      Positioned(
                                        right: -2,
                                        top: -3,
                                        child: Container(
                                          constraints: const BoxConstraints(
                                            minWidth: 18,
                                            minHeight: 18,
                                          ),
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 3,
                                          ),
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFEA4759),
                                            border: Border.all(
                                              color: Colors.white,
                                              width: 2,
                                            ),
                                            borderRadius: BorderRadius.circular(
                                              12,
                                            ),
                                          ),
                                          child: Text(
                                            unreadTotal > 99
                                                ? '99+'
                                                : '$unreadTotal',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 9,
                                              height: 1,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 3),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 2,
                                ),
                                child: Text(
                                  item.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: compact ? 10 : 11,
                                    height: 1.1,
                                    color: selected == item.tab
                                        ? socoBlue
                                        : socoMuted,
                                    fontWeight: selected == item.tab
                                        ? FontWeight.w800
                                        : FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
