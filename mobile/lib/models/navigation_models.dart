import 'json_readers.dart';

/// React Tab includes market/notifications; Flutter HomeShell currently has
/// five primary tabs. 'calls' is a chat section, not a standalone AppTab.
enum AppTab { chat, contacts, discover, market, feed, profile, notifications }

enum MobileDestination { chat, calls, contacts, discover, feed, profile }

enum ChatListFilter { all, unread, groups }

class MobileNavigationItem {
  const MobileNavigationItem({
    required this.id,
    required this.label,
    required this.active,
    this.badge,
  });
  final MobileDestination id;
  final String label;
  final bool active;
  final String? badge;

  factory MobileNavigationItem.fromJson(JsonMap json) => MobileNavigationItem(
    id: enumField(json, 'id', MobileDestination.values, (value) => value.name),
    label: requiredField<String>(json, 'label'),
    active: requiredField<bool>(json, 'active'),
    badge: optionalField<String>(json, 'badge'),
  );
  MobileNavigationItem copyWith({
    MobileDestination? id,
    String? label,
    bool? active,
    Object? badge = absent,
  }) => MobileNavigationItem(
    id: id ?? this.id,
    label: label ?? this.label,
    active: active ?? this.active,
    badge: identical(badge, absent) ? this.badge : badge as String?,
  );
  JsonMap toJson() => {
    'id': id.name,
    'label': label,
    'active': active,
    if (badge != null) 'badge': badge,
  };
}

class MobileNavigationState {
  const MobileNavigationState({
    required this.tab,
    required this.callsActive,
    required this.unreadTotal,
    required this.pushEnabled,
  });
  final AppTab tab;
  final bool callsActive;
  final int unreadTotal;
  final bool pushEnabled;

  factory MobileNavigationState.fromJson(JsonMap json) => MobileNavigationState(
    tab: enumField(json, 'tab', AppTab.values, (value) => value.name),
    callsActive: requiredField<bool>(json, 'callsActive'),
    unreadTotal: requiredField<int>(json, 'unreadTotal'),
    pushEnabled: requiredField<bool>(json, 'pushEnabled'),
  );
  MobileNavigationState copyWith({
    AppTab? tab,
    bool? callsActive,
    int? unreadTotal,
    bool? pushEnabled,
  }) => MobileNavigationState(
    tab: tab ?? this.tab,
    callsActive: callsActive ?? this.callsActive,
    unreadTotal: unreadTotal ?? this.unreadTotal,
    pushEnabled: pushEnabled ?? this.pushEnabled,
  );
  JsonMap toJson() => {
    'tab': tab.name,
    'callsActive': callsActive,
    'unreadTotal': unreadTotal,
    'pushEnabled': pushEnabled,
  };
}
