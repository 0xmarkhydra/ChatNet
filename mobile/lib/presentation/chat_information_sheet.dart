import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'conversation_avatar.dart';

enum ChatInfoAction {
  shared,
  notifications,
  manageGroup,
  nickname,
  commonGroups,
  groupBoard,
  wallpaper,
  createChannel,
  clearHistory,
  renameChannel,
  editChannelTopic,
  channelNotifications,
  deleteChannel,
}

/// One information surface for direct conversations, groups and subchannels.
/// Actions return to ChatScreen so API mutations keep their original guards.
Future<ChatInfoAction?> showChatInformationSheet(
  BuildContext context, {
  required Json conversation,
  required int channelId,
  Json? selectedChannel,
  required bool isDemo,
  bool canManageChannel = false,
  bool canCreateChannel = false,
}) {
  return showModalBottomSheet<ChatInfoAction>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) {
      final group = conversation['type'] == 'group';
      final channel = group && channelId != 0;
      final name = channel
          ? (selectedChannel?['name']?.toString() ?? 'Kênh hội thoại')
          : (conversation['name']?.toString() ?? 'Cuộc trò chuyện');
      final title = channel
          ? 'Thông tin kênh'
          : group
          ? 'Thông tin nhóm'
          : 'Thông tin hội thoại';
      final secondary = channel
          ? 'Thuộc nhóm ${conversation['name'] ?? ''}'
          : group
          ? '${conversation['memberCount'] ?? 0} thành viên'
          : conversation['online'] == true
          ? 'Đang hoạt động'
          : 'Chat riêng';
      void choose(ChatInfoAction action) => Navigator.pop(sheetContext, action);

      Widget option(
        ChatInfoAction action,
        IconData icon,
        String label, {
        bool danger = false,
      }) => ListTile(
        dense: true,
        leading: Icon(icon, size: 21, color: danger ? Colors.red : socoBlue),
        title: Text(
          label,
          style: TextStyle(color: danger ? Colors.red : socoText),
        ),
        trailing: const Icon(Icons.chevron_right_rounded, size: 18),
        onTap: () => choose(action),
      );

      return FractionallySizedBox(
        heightFactor: .76,
        child: Column(
          children: [
            ChatSheetHeader(
              title: title,
              closeKey: const ValueKey('chat-info-close'),
              closeLabel: 'Đóng thông tin hội thoại',
              onClose: () => Navigator.pop(sheetContext),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 18),
                children: [
                  Column(
                    children: [
                      if (channel)
                        UserAvatar(
                          name: name,
                          imageUrl: selectedChannel?['avatarUrl']?.toString(),
                          size: 66,
                          group: true,
                          fetchProfileImage: false,
                        )
                      else
                        ConversationAvatarView(
                          room: conversation,
                          size: 66,
                          fetchProfileImage: !isDemo,
                        ),
                      const SizedBox(height: 10),
                      Text(
                        name,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: socoNavy,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        secondary,
                        style: const TextStyle(fontSize: 12, color: socoMuted),
                      ),
                      if (channel &&
                          (selectedChannel?['description']
                                  ?.toString()
                                  .isNotEmpty ??
                              false))
                        Padding(
                          padding: const EdgeInsets.only(top: 7),
                          child: Text(
                            selectedChannel!['description'].toString(),
                            style: const TextStyle(
                              fontSize: 12,
                              color: socoMuted,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Divider(),
                  option(
                    ChatInfoAction.shared,
                    Icons.perm_media_outlined,
                    'File phương tiện',
                  ),
                  const Divider(),
                  if (channel) ...[
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 8, 0, 4),
                      child: Text(
                        'Quản lý kênh',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    option(
                      ChatInfoAction.channelNotifications,
                      selectedChannel?['muted'] == true
                          ? Icons.notifications_active_outlined
                          : Icons.notifications_off_outlined,
                      selectedChannel?['muted'] == true
                          ? 'Bật thông báo kênh'
                          : 'Tắt thông báo kênh',
                    ),
                    if (canManageChannel) ...[
                      option(
                        ChatInfoAction.renameChannel,
                        Icons.edit_outlined,
                        'Đổi tên kênh',
                      ),
                      option(
                        ChatInfoAction.editChannelTopic,
                        Icons.subject_rounded,
                        'Sửa chủ đề kênh',
                      ),
                      option(
                        ChatInfoAction.deleteChannel,
                        Icons.delete_outline_rounded,
                        'Xóa kênh',
                        danger: true,
                      ),
                    ],
                  ] else if (group) ...[
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 8, 0, 4),
                      child: Text(
                        'Quản lý nhóm',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    option(
                      ChatInfoAction.manageGroup,
                      Icons.groups_outlined,
                      'Thành viên và quản lý nhóm',
                    ),
                    if (canCreateChannel)
                      option(
                        ChatInfoAction.createChannel,
                        Icons.add_circle_outline_rounded,
                        'Tạo kênh',
                      ),
                    option(
                      ChatInfoAction.notifications,
                      conversation['muted'] == true
                          ? Icons.notifications_active_outlined
                          : Icons.notifications_off_outlined,
                      conversation['muted'] == true
                          ? 'Bật thông báo nhóm'
                          : 'Tắt thông báo nhóm',
                    ),
                    option(
                      ChatInfoAction.groupBoard,
                      Icons.assignment_outlined,
                      'Bảng tin nhóm',
                    ),
                  ] else ...[
                    if (conversation['otherUserId'] != null &&
                        conversation['blockedByMe'] != true &&
                        conversation['blockedByOther'] != true) ...[
                      option(
                        ChatInfoAction.nickname,
                        Icons.edit_outlined,
                        'Đặt tên gợi nhớ',
                      ),
                      option(
                        ChatInfoAction.commonGroups,
                        Icons.groups_outlined,
                        'Nhóm chung',
                      ),
                    ],
                    option(
                      ChatInfoAction.notifications,
                      conversation['muted'] == true
                          ? Icons.notifications_active_outlined
                          : Icons.notifications_off_outlined,
                      conversation['muted'] == true
                          ? 'Bật thông báo hội thoại'
                          : 'Tắt thông báo hội thoại',
                    ),
                    option(
                      ChatInfoAction.clearHistory,
                      Icons.delete_outline_rounded,
                      'Xóa lịch sử trò chuyện',
                      danger: true,
                    ),
                  ],
                  const Divider(),
                  option(
                    ChatInfoAction.wallpaper,
                    Icons.palette_outlined,
                    'Đổi hình nền hội thoại',
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    },
  );
}

/// Shared heading and close control for chat information and option sheets.
class ChatSheetHeader extends StatelessWidget {
  const ChatSheetHeader({
    super.key,
    required this.title,
    required this.onClose,
    this.action,
    this.closeKey,
    this.closeLabel = 'Đóng',
  });
  final String title;
  final VoidCallback onClose;
  final Widget? action;
  final Key? closeKey;
  final String closeLabel;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 0, 12, 12),
    child: Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: socoNavy,
            ),
          ),
        ),
        ?action,
        IconButton(
          key: closeKey,
          tooltip: closeLabel,
          onPressed: onClose,
          icon: const Icon(Icons.close_rounded),
        ),
      ],
    ),
  );
}

class ChatSheetChoice<T> {
  const ChatSheetChoice({
    required this.value,
    required this.label,
    required this.leading,
  });
  final T value;
  final String label;
  final Widget leading;
}

/// Same list layout for classification, notification duration and wallpaper.
Future<T?> showChatChoiceSheet<T>(
  BuildContext context, {
  required String title,
  required List<ChatSheetChoice<T>> options,
  T? selected,
}) => showModalBottomSheet<T>(
  context: context,
  showDragHandle: true,
  isScrollControlled: true,
  useSafeArea: true,
  builder: (sheetContext) => ConstrainedBox(
    constraints: BoxConstraints(
      maxHeight: MediaQuery.sizeOf(sheetContext).height * .72,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ChatSheetHeader(
          title: title,
          onClose: () => Navigator.pop(sheetContext),
        ),
        Flexible(
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.only(bottom: 12),
            children: [
              for (final option in options)
                ListTile(
                  leading: option.leading,
                  title: Text(option.label),
                  trailing: selected == option.value
                      ? const Icon(Icons.check_rounded, color: socoBlue)
                      : null,
                  onTap: () => Navigator.pop(sheetContext, option.value),
                ),
            ],
          ),
        ),
      ],
    ),
  ),
);
