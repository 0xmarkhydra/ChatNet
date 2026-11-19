import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Only the five primary destinations rendered in HomeShell. Calls are a
/// nested Contacts screen, not a sixth bottom-navigation destination.
enum SocoTab { chat, contacts, discover, feed, profile }

class MobileShellState {
  const MobileShellState({
    this.tab = SocoTab.chat,
    this.conversationOpen = false,
    this.unreadTotal = 0,
  });

  final SocoTab tab;
  final bool conversationOpen;
  final int unreadTotal;

  bool hideBottomNavigation({required bool compact}) =>
      compact && tab == SocoTab.chat && conversationOpen;

  MobileShellState copyWith({
    SocoTab? tab,
    bool? conversationOpen,
    int? unreadTotal,
  }) => MobileShellState(
    tab: tab ?? this.tab,
    conversationOpen: conversationOpen ?? this.conversationOpen,
    unreadTotal: unreadTotal ?? this.unreadTotal,
  );
}

/// Presentation state is scoped to the authenticated Api instance through
/// the app's ProviderScope. Never retain a previous user's navigation state.
class MobileShellNotifier extends Notifier<MobileShellState> {
  @override
  MobileShellState build() => const MobileShellState();

  void select(SocoTab destination) {
    state = state.copyWith(
      tab: destination,
      conversationOpen: destination == SocoTab.chat
          ? state.conversationOpen
          : false,
    );
  }

  void openConversation() {
    state = state.copyWith(tab: SocoTab.chat);
  }

  void setConversationOpen(bool value) {
    if (state.conversationOpen == value) return;
    state = state.copyWith(conversationOpen: value);
  }

  void setUnreadTotal(int value) {
    final count = value < 0 ? 0 : value;
    if (state.unreadTotal == count) return;
    state = state.copyWith(unreadTotal: count);
  }

  void resetConversation() {
    state = state.copyWith(tab: SocoTab.chat, conversationOpen: false);
  }
}

final mobileShellProvider =
    NotifierProvider<MobileShellNotifier, MobileShellState>(
      MobileShellNotifier.new,
    );
