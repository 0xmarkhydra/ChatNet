import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';
import 'widgets.dart';

Future<void> showNotificationSheet(BuildContext context, Api api) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _NotificationSheet(api: api),
  );
}

class _NotificationSheet extends StatefulWidget {
  const _NotificationSheet({required this.api});

  final Api api;

  @override
  State<_NotificationSheet> createState() => _NotificationSheetState();
}

class _NotificationSheetState extends State<_NotificationSheet> {
  bool messages = true;
  bool friends = true;
  bool calls = true;

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height * .78;
    return SafeArea(
      child: SizedBox(
        height: height.clamp(460, 700),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Thông báo',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Đóng',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                children: [
                  _NotificationToggle(
                    icon: Icons.chat_bubble_outline_rounded,
                    title: 'Tin nhắn mới',
                    value: messages,
                    onChanged: (value) => setState(() => messages = value),
                  ),
                  _NotificationToggle(
                    icon: Icons.person_add_alt_1_rounded,
                    title: 'Kết bạn',
                    value: friends,
                    onChanged: (value) => setState(() => friends = value),
                  ),
                  _NotificationToggle(
                    icon: Icons.call_outlined,
                    title: 'Cuộc gọi',
                    value: calls,
                    onChanged: (value) => setState(() => calls = value),
                  ),
                  const Padding(
                    padding: EdgeInsets.fromLTRB(4, 20, 4, 8),
                    child: Text(
                      'GẦN ĐÂY',
                      style: TextStyle(
                        color: socoMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  if (widget.api.isDemo) ...const [
                    _NotificationItem(
                      icon: Icons.chat_bubble_outline_rounded,
                      title: 'Linh Nguyễn',
                      detail: 'Mình vừa cập nhật bảng màu mới.',
                      time: '2 phút',
                    ),
                    _NotificationItem(
                      icon: Icons.person_add_alt_1_rounded,
                      title: 'Phương Thảo',
                      detail: 'đã gửi cho bạn lời mời kết bạn.',
                      time: '18 phút',
                    ),
                    _NotificationItem(
                      icon: Icons.groups_outlined,
                      title: 'SOCO Design Team',
                      detail: 'Chốt bản demo sáng mai nhé!',
                      time: '1 giờ',
                    ),
                  ] else
                    const EmptyState(
                      icon: Icons.notifications_none_rounded,
                      title: 'Chưa có thông báo mới',
                      description:
                          'Thông báo tin nhắn, kết bạn và cuộc gọi sẽ xuất hiện tại đây.',
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

class _NotificationToggle extends StatelessWidget {
  const _NotificationToggle({
    required this.icon,
    required this.title,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      secondary: Icon(icon, color: socoBlue),
      title: Text(title),
      value: value,
      onChanged: onChanged,
    );
  }
}

class _NotificationItem extends StatelessWidget {
  const _NotificationItem({
    required this.icon,
    required this.title,
    required this.detail,
    required this.time,
  });

  final IconData icon;
  final String title;
  final String detail;
  final String time;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: socoLine),
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: socoSoftBlue,
          foregroundColor: socoBlue,
          child: Icon(icon),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(detail),
        trailing: Text(time, style: Theme.of(context).textTheme.bodySmall),
      ),
    );
  }
}
