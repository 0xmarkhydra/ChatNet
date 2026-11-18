import 'package:flutter/material.dart';

import '../api.dart';
import '../call_surface.dart';
import '../theme.dart';
import '../widgets.dart';

/// PWA ContactsView / ContactFriendProfile mobile layout:
/// avatar/name, icon-only message/call actions, and contact options.
class ContactFriendProfileSheet extends StatelessWidget {
  const ContactFriendProfileSheet({
    super.key,
    required this.person,
    required this.metadata,
    required this.api,
    required this.onMessage,
    required this.onUpdateMetadata,
    required this.onUnfriend,
    required this.onBlock,
    required this.onReport,
  });

  final Json person;
  final Json metadata;
  final Api api;
  final VoidCallback onMessage;
  final Future<void> Function(String field) onUpdateMetadata;
  final Future<void> Function() onUnfriend;
  final Future<void> Function() onBlock;
  final Future<void> Function() onReport;

  @override
  Widget build(BuildContext context) {
    final name = (metadata['nickname']?.toString().isNotEmpty ?? false)
        ? metadata['nickname'].toString()
        : (person['displayName']?.toString() ??
              person['username']?.toString() ??
              '');
    final blocked =
        person['blockedByMe'] == true || person['blockedByOther'] == true;
    final note = metadata['note']?.toString() ?? '';
    final favorite = metadata['favorite'] == true;

    Widget actionButton({
      required IconData icon,
      required String tooltip,
      required VoidCallback? onTap,
    }) => IconButton.filledTonal(
      tooltip: tooltip,
      onPressed: onTap,
      style: IconButton.styleFrom(
        minimumSize: const Size(46, 42),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      icon: Icon(icon, color: socoBlue),
    );

    Widget option({
      required String title,
      required IconData icon,
      required VoidCallback onTap,
      bool danger = false,
    }) => ListTile(
      dense: true,
      leading: Icon(icon, size: 20, color: danger ? Colors.red : socoBlue),
      title: Text(
        title,
        style: TextStyle(color: danger ? Colors.red : socoText),
      ),
      onTap: onTap,
    );

    return SafeArea(
      top: false,
      child: FractionallySizedBox(
        heightFactor: .79,
        child: Column(
          children: [
            Row(
              children: [
                const SizedBox(width: 16),
                const Expanded(
                  child: Text(
                    'Thông tin bạn bè',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                      color: socoNavy,
                    ),
                  ),
                ),
                IconButton(
                  key: const ValueKey('friend-profile-close'),
                  tooltip: 'Đóng hồ sơ bạn bè',
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
                const SizedBox(width: 8),
              ],
            ),
            Expanded(
              child: ListView(
                key: const ValueKey('friend-profile-content'),
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 20),
                children: [
                  Container(
                    height: 64,
                    decoration: BoxDecoration(
                      gradient: socoGradient,
                      borderRadius: BorderRadius.circular(15),
                    ),
                  ),
                  Transform.translate(
                    offset: const Offset(0, -27),
                    child: Column(
                      children: [
                        UserAvatar(
                          name: name,
                          username: person['username']?.toString(),
                          online: person['online'] == true && !blocked,
                          size: 72,
                          fetchProfileImage: !api.isDemo,
                        ),
                        const SizedBox(height: 7),
                        Text(
                          name,
                          style: const TextStyle(
                            color: socoNavy,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          person['blockedByOther'] == true
                              ? 'Bạn đã bị chặn'
                              : person['blockedByMe'] == true
                              ? 'Bạn đã chặn người này'
                              : person['online'] == true
                              ? 'Đang hoạt động'
                              : 'Ngoại tuyến',
                          style: const TextStyle(
                            fontSize: 12,
                            color: socoMuted,
                          ),
                        ),
                        if (person['mutualGroups'] is num)
                          Text(
                            '${person['mutualGroups']} nhóm chung',
                            style: const TextStyle(
                              fontSize: 12,
                              color: socoMuted,
                            ),
                          ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            actionButton(
                              icon: Icons.chat_bubble_outline_rounded,
                              tooltip: 'Nhắn tin',
                              onTap: onMessage,
                            ),
                            const SizedBox(width: 12),
                            actionButton(
                              icon: Icons.call_outlined,
                              tooltip: 'Gọi thoại',
                              onTap: blocked
                                  ? null
                                  : () async {
                                      try {
                                        final conversation = object(
                                          await api.request(
                                            'POST',
                                            '/api/conversations/direct',
                                            {'username': person['username']},
                                          ),
                                        );
                                        if (!context.mounted) return;
                                        await showCallSurface(
                                          context,
                                          api: api,
                                          conversation: conversation,
                                          video: false,
                                        );
                                      } catch (error) {
                                        if (context.mounted) {
                                          ScaffoldMessenger.of(
                                            context,
                                          ).showSnackBar(
                                            SnackBar(content: Text('$error')),
                                          );
                                        }
                                      }
                                    },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const Text(
                    'Thông tin bạn bè',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: socoNavy,
                    ),
                  ),
                  const SizedBox(height: 6),
                  ListTile(
                    leading: const Icon(Icons.person_outline_rounded),
                    title: Text('@${person['username'] ?? ''}'),
                    dense: true,
                  ),
                  if (note.isNotEmpty)
                    ListTile(
                      leading: const Icon(Icons.notes_outlined),
                      title: Text(note),
                      dense: true,
                    ),
                  const Divider(),
                  const Text(
                    'Tùy chọn',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: socoNavy,
                    ),
                  ),
                  option(
                    title: 'Đặt biệt danh',
                    icon: Icons.drive_file_rename_outline_rounded,
                    onTap: () => onUpdateMetadata('nickname'),
                  ),
                  option(
                    title: 'Ghi chú riêng',
                    icon: Icons.note_alt_outlined,
                    onTap: () => onUpdateMetadata('note'),
                  ),
                  option(
                    title: favorite ? 'Bỏ yêu thích' : 'Ghim',
                    icon: favorite ? Icons.favorite : Icons.favorite_border,
                    onTap: () => onUpdateMetadata('favorite'),
                  ),
                  if (person['blockedByOther'] != true)
                    option(
                      title: person['blockedByMe'] == true ? 'Bỏ chặn' : 'Chặn',
                      icon: Icons.block_outlined,
                      onTap: onBlock,
                      danger: person['blockedByMe'] != true,
                    ),
                  option(
                    title: 'Báo cáo',
                    icon: Icons.flag_outlined,
                    onTap: onReport,
                  ),
                  option(
                    title: 'Hủy kết bạn',
                    icon: Icons.person_remove_outlined,
                    onTap: onUnfriend,
                    danger: true,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
