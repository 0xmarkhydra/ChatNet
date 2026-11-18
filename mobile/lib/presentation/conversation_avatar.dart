import 'package:flutter/material.dart';

import '../models/json_readers.dart';
import '../widgets.dart';

/// Matches React's ConversationAvatar: a real group picture takes priority;
/// otherwise show up to three participant avatars overlapping in a triangle.
class ConversationAvatarView extends StatelessWidget {
  const ConversationAvatarView({
    super.key,
    required this.room,
    required this.size,
    this.fetchProfileImage = true,
  });

  final JsonMap room;
  final double size;
  final bool fetchProfileImage;

  @override
  Widget build(BuildContext context) {
    final isGroup = room['type'] == 'group';
    final imageUrl = room['avatarUrl']?.toString();
    final members = <String>[
      if (isGroup && (imageUrl == null || imageUrl.isEmpty))
        for (final value
            in room['avatarMembers'] is List
                ? room['avatarMembers'] as List
                : const <dynamic>[])
          if (value is String && value.trim().isNotEmpty) value,
    ].take(3).toList();

    if (members.isEmpty) {
      return UserAvatar(
        name: room['name']?.toString() ?? '',
        username: isGroup ? null : room['otherUsername']?.toString(),
        group: isGroup,
        imageUrl: isGroup ? imageUrl : null,
        online: !isGroup && room['online'] == true,
        fetchProfileImage: fetchProfileImage,
        size: size,
      );
    }

    if (members.length == 1) {
      return UserAvatar(
        name: members.first,
        username: members.first,
        size: size,
        circular: true,
        fetchProfileImage: fetchProfileImage,
      );
    }

    final diameter = size * (members.length == 2 ? .76 : .65);
    return Semantics(
      image: true,
      label: 'Ảnh đại diện nhóm ${room['name'] ?? ''}',
      child: SizedBox.square(
        dimension: size,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            for (var i = 0; i < members.length; i++)
              Positioned(
                top: i == 2 || (i == 1 && members.length == 2) ? null : 0,
                bottom: i == 2 || (i == 1 && members.length == 2) ? 0 : null,
                left: i == 1
                    ? null
                    : i == 2
                    ? size * .18
                    : 0,
                right: i == 1 ? 0 : null,
                child: Container(
                  width: diameter,
                  height: diameter,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x292A315C),
                        blurRadius: 4,
                        offset: Offset(0, 1),
                      ),
                    ],
                  ),
                  child: UserAvatar(
                    name: members[i],
                    username: members[i],
                    size: diameter - 3,
                    circular: true,
                    fetchProfileImage: fetchProfileImage,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
