import 'dart:convert';
import 'dart:typed_data';

import 'api.dart';

class DemoApi extends Api {
  DemoApi() {
    session = {
      'user': {
        'id': 1,
        'username': 'minhanh',
        'displayName': 'Minh Anh',
        'email': 'demo@soco.local',
      },
    };
  }
  @override
  bool get isDemo => true;
  int serial = 100;
  final Json preferences = {
    'targetLanguage': 'vi',
    'autoTranslate': true,
    'appLocale': 'vi',
  };
  final List<Json> people = [
    {
      'id': 2,
      'username': 'linhnguyen',
      'displayName': 'Linh Nguyễn',
      'online': true,
    },
    {
      'id': 3,
      'username': 'alexchen',
      'displayName': 'Alex Chen',
      'online': true,
    },
    {
      'id': 4,
      'username': 'hoangnam',
      'displayName': 'Hoàng Nam',
      'online': false,
    },
    {'id': 5, 'username': 'thao', 'displayName': 'Phương Thảo', 'online': true},
  ];
  late final List<Json> friends = [
    {...people[0], 'status': 'accepted'},
    {...people[1], 'status': 'accepted'},
    {...people[3], 'status': 'pending', 'direction': 'incoming'},
  ];
  final List<Json> rooms = [
    {
      'id': 1,
      'type': 'group',
      'name': 'SOCO Design Team',
      'memberCount': 4,
      'unreadCount': 0,
      'online': true,
      'lastMessage': 'Chốt bản demo sáng mai nhé!',
      'lastMessageAt': '2026-10-15T14:00:00+07:00',
    },
    {
      'id': 2,
      'type': 'direct',
      'name': 'Linh Nguyễn',
      'otherUserId': 2,
      'memberCount': 2,
      'unreadCount': 2,
      'online': true,
      'lastMessage': 'Mình vừa cập nhật bảng màu mới.',
      'lastMessageAt': '2026-10-15T14:00:00+07:00',
    },
    {
      'id': 3,
      'type': 'direct',
      'name': 'Alex Chen',
      'otherUserId': 3,
      'memberCount': 2,
      'unreadCount': 0,
      'online': true,
      'lastMessage': 'See you tomorrow!',
      'lastMessageAt': '2026-10-15T14:00:00+07:00',
    },
  ];
  late final Map<int, List<Json>> groupMembers = {
    1: [
      {
        'id': 1,
        'username': 'minhanh',
        'displayName': 'Minh Anh',
        'role': 'owner',
        'online': true,
      },
      for (final person in people.take(3)) {...person, 'role': 'member'},
    ],
  };
  late final Map<int, List<Json>> messages = {
    1: [
      message(
        10,
        1,
        2,
        'Linh Nguyễn',
        'Chào mọi người! Giao diện mới lên rồi.',
      ),
      message(
        11,
        1,
        3,
        'Alex Chen',
        'The new design looks great. Ready for tomorrow?',
        translation: 'Thiết kế mới rất đẹp. Sẵn sàng cho ngày mai chưa?',
      ),
      message(
        12,
        1,
        1,
        'Minh Anh',
        'Sẵn sàng! Chat, Feed và hồ sơ dùng được trên mọi màn hình.',
      ),
      message(
          13,
          1,
          2,
          'Linh Nguyễn',
          'Chốt bản demo sáng mai nhé! https://chat.codelocal.cloud',
        )
        ..['attachments'] = [
          {
            'kind': 'file',
            'name': 'SOCO-demo-checklist.pdf',
            'contentType': 'application/pdf',
            'sizeBytes': 284000,
            'url': 'https://chat.codelocal.cloud',
          },
        ],
    ],
    2: [message(20, 2, 2, 'Linh Nguyễn', 'Mình vừa cập nhật bảng màu mới.')],
    3: [
      message(
        30,
        3,
        3,
        'Alex Chen',
        'See you tomorrow!',
        translation: 'Hẹn gặp bạn ngày mai!',
      ),
    ],
  };
  late final List<Json> posts = [
    {
      'id': 1,
      'author': 'Linh Nguyễn',
      'content':
          'Một góc làm việc, một ý tưởng mới.\nHẹn cả nhóm ở buổi demo SOCO sáng mai!',
      'likes': 24,
      'liked': false,
      'comments': [
        {
          'id': 1,
          'author': 'Alex Chen',
          'content': 'Looking forward to it!',
          'parentId': null,
        },
      ],
      'attachments': [
        {
          'kind': 'image',
          'name': 'Studio',
          'url':
              'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=85',
        },
      ],
      'createdAt': DateTime.now()
          .subtract(const Duration(minutes: 32))
          .toIso8601String(),
    },
    {
      'id': 2,
      'author': 'Alex Chen',
      'content':
          'Different languages. One conversation.\nThật vui khi cả nhóm kết nối dễ dàng hơn mỗi ngày.',
      'likes': 12,
      'liked': true,
      'comments': [],
      'attachments': [],
      'createdAt': DateTime.now()
          .subtract(const Duration(hours: 2))
          .toIso8601String(),
    },
  ];
  late final List<Json> stories = [
    {
      'id': 1,
      'author': 'Linh Nguyễn',
      'attachment': {
        'kind': 'image',
        'name': 'Một ngày mới',
        'url':
            'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=900&q=85',
      },
      'expiresAt': DateTime.now()
          .add(const Duration(hours: 20))
          .toIso8601String(),
    },
  ];
  Json profile = {
    'username': 'minhanh',
    'displayName': 'Minh Anh',
    'avatarSet': false,
    'coverSet': false,
  };

  Json message(
    int id,
    int room,
    int sender,
    String name,
    String text, {
    String? translation,
  }) => {
    'id': id,
    'conversationId': room,
    'senderId': sender,
    'sender': name,
    'text': text,
    'attachments': <Json>[],
    'reactions': <Json>[],
    'readByUserIds': [1, 2],
    'translatedText': translation,
    if (translation != null) 'translationLanguage': 'vi',
    'createdAt': DateTime.now()
        .subtract(Duration(minutes: 20 - id % 10))
        .toIso8601String(),
  };

  @override
  Stream<void> events() => const Stream.empty();
  @override
  Future<void> restore() async {}
  @override
  Future<void> logout() async {
    session = null;
    generation++;
  }

  @override
  Future<void> updateUser(Json profile) async {
    session = {
      'user': {...user, ...profile},
    };
  }

  @override
  Future<Json> upload(
    String scope,
    String name,
    String contentType,
    Uint8List bytes,
  ) async => {
    'kind': contentType.split('/').first,
    'name': name,
    'contentType': contentType,
    'sizeBytes': bytes.length,
    'url': 'data:$contentType;base64,${base64Encode(bytes)}',
  };

  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    if (path == '/api/translate') {
      return {
        'translatedText':
            'Bản dịch minh họa. Đăng nhập để dịch AI thật: ${body?['text']}',
      };
    }
    await Future<void>.delayed(const Duration(milliseconds: 160));
    final uri = Uri.parse(path);
    final parts = uri.path.split('/').where((s) => s.isNotEmpty).toList();
    final data = body ?? {};
    if (path == '/api/auth/me') return user;
    if (path == '/api/preferences') {
      if (method == 'PUT') preferences.addAll(data);
      return {...preferences};
    }
    if (path == '/api/profile') {
      if (method == 'PUT') profile.addAll(data);
      return {...profile};
    }
    if (path == '/api/profile/media') {
      profile['${data['kind']}Set'] = true;
      profile['${data['kind']}Url'] = object(data['attachment'])['url'];
      return {...profile};
    }
    if (parts[1] == 'conversations') {
      if (parts.length == 2) return rooms;
      if (parts[2] == 'groups' || parts[2] == 'direct') {
        final group = parts[2] == 'groups';
        if (!group) {
          final username = data['username']?.toString().toLowerCase() ?? '';
          final person = people.firstWhere(
            (item) => item['username'].toString().toLowerCase() == username,
            orElse: () => {
              'id': ++serial,
              'username': username,
              'displayName': username,
              'online': false,
            },
          );
          final existing = rooms.where(
            (item) =>
                item['type'] == 'direct' && item['otherUserId'] == person['id'],
          );
          if (existing.isNotEmpty) return existing.first;
          final room = {
            'id': ++serial,
            'type': 'direct',
            'name': person['displayName'],
            'otherUserId': person['id'],
            'memberCount': 2,
            'unreadCount': 0,
            'lastMessage': '',
            'online': person['online'] == true,
          };
          rooms.insert(0, room);
          messages[room['id'] as int] = [];
          return room;
        }
        final usernames = (data['usernames'] as List).cast<String>();
        final room = {
          'id': ++serial,
          'type': 'group',
          'name': data['name'],
          'memberCount': usernames.length + 1,
          'unreadCount': 0,
          'lastMessage': '',
          'online': true,
        };
        rooms.insert(0, room);
        messages[serial] = [];
        groupMembers[serial] = [
          {
            'id': 1,
            'username': 'minhanh',
            'displayName': 'Minh Anh',
            'role': 'owner',
            'online': true,
          },
          for (final username in usernames)
            {
              ...people.firstWhere((person) => person['username'] == username),
              'role': 'member',
            },
        ];
        return room;
      }
      final id = int.parse(parts[2]);
      final room = rooms.firstWhere((r) => r['id'] == id);
      if (parts.length == 3 && method == 'PATCH') {
        room.addAll(data);
        return room;
      }
      if (parts[3] == 'read') {
        room['unreadCount'] = 0;
        return {};
      }
      if (parts[3] == 'members') {
        final members = groupMembers.putIfAbsent(id, () => []);
        if (parts.length == 4 && method == 'GET') return members;
        if (parts.length == 4 && method == 'POST') {
          final usernames = (data['usernames'] as List).cast<String>();
          for (final username in usernames) {
            if (members.any((item) => item['username'] == username)) continue;
            members.add({
              ...people.firstWhere((person) => person['username'] == username),
              'role': 'member',
            });
          }
          room['memberCount'] = members.length;
          return members;
        }
        final memberId = int.parse(parts[4]);
        final member = members.firstWhere((item) => item['id'] == memberId);
        if (method == 'PATCH') {
          if (data['role'] == 'owner') {
            for (final item in members.where(
              (item) => item['role'] == 'owner',
            )) {
              item['role'] = 'admin';
            }
          }
          member['role'] = data['role'];
        } else if (method == 'DELETE') {
          members.remove(member);
          room['memberCount'] = members.length;
          if (memberId == user['id']) {
            rooms.remove(room);
            messages.remove(id);
            groupMembers.remove(id);
          }
        }
        return members;
      }
      if (parts[3] == 'shared') {
        final kind = uri.queryParameters['kind'] ?? 'media';
        final link = RegExp(r'https?://[^\s<>"]+', caseSensitive: false);
        return {
          'items': messages[id]!.where((message) {
            if (kind == 'links') {
              return link.hasMatch(message['text']?.toString() ?? '');
            }
            return objects(message['attachments']).any((attachment) {
              final attachmentKind = attachment['kind'];
              return kind == 'media'
                  ? attachmentKind == 'image' || attachmentKind == 'video'
                  : attachmentKind == 'file' || attachmentKind == 'audio';
            });
          }).toList(),
        };
      }
      if (parts[3] == 'messages') {
        if (method == 'POST') {
          final m = message(
            ++serial,
            id,
            1,
            user['displayName'],
            data['text'] ?? '',
          );
          m.addAll(data);
          final reply = messages[id]!
              .where((m) => m['id'] == data['replyToMessageId'])
              .firstOrNull;
          if (reply != null) {
            m['replyToText'] = reply['text'];
            m['replyToSender'] = reply['sender'];
          }
          messages[id]!.add(m);
          room['lastMessage'] = data['text'];
          return m;
        }
        return messages[id] ?? [];
      }
    }
    if (parts[1] == 'messages') {
      final m = messages.values
          .expand((v) => v)
          .firstWhere((m) => '${m['id']}' == parts[2]);
      if (method == 'DELETE') {
        m.addAll({
          'deleted': true,
          'text': '',
          'attachments': [],
          'reactions': [],
        });
      } else if (method == 'PATCH') {
        m.addAll({
          'text': data['text'],
          'editedAt': DateTime.now().toIso8601String(),
        });
      } else {
        final reactions = objects(m['reactions']);
        final old = reactions
            .where((r) => r['emoji'] == data['emoji'])
            .firstOrNull;
        if (old != null) {
          reactions.remove(old);
        } else {
          reactions.add({'emoji': data['emoji'], 'count': 1, 'mine': true});
        }
        m['reactions'] = reactions;
      }
      return m;
    }
    if (parts[1] == 'friends') {
      if (method == 'GET') {
        return friends
            .where(
              (f) =>
                  f['status'] == (parts.length == 2 ? 'accepted' : 'pending'),
            )
            .toList();
      }
      final id = int.parse(parts[2]);
      if (method == 'DELETE') {
        friends.removeWhere((f) => f['id'] == id);
        return {};
      }
      friends.removeWhere((f) => f['id'] == id);
      friends.add({
        ...people.firstWhere((p) => p['id'] == id),
        'status': parts.length > 3 ? 'accepted' : 'pending',
        'direction': 'outgoing',
      });
      return {};
    }
    if (parts[1] == 'users') {
      if (parts[2] == 'nearby') {
        return {
          'users': people.map((p) => {...p, 'distanceKm': 0.8}).toList(),
        };
      }
      final query = uri.queryParameters['q'] ?? '';
      return people.where((p) => '${p['username']}'.contains(query)).toList();
    }
    if (parts[1] == 'posts') {
      if (parts.length == 2) {
        if (method == 'POST') {
          final p = {
            'id': ++serial,
            'author': user['displayName'],
            ...data,
            'likes': 0,
            'liked': false,
            'comments': [],
            'createdAt': DateTime.now().toIso8601String(),
          };
          posts.insert(0, p);
          return p;
        }
        return posts;
      }
      final p = posts.firstWhere((p) => '${p['id']}' == parts[2]);
      if (parts[3] == 'like') {
        p['liked'] = p['liked'] != true;
        p['likes'] += p['liked'] == true ? 1 : -1;
        return p;
      }
      final comment = {
        'id': ++serial,
        'author': user['displayName'],
        ...data,
        'createdAt': DateTime.now().toIso8601String(),
      };
      (p['comments'] as List).add(comment);
      return p;
    }
    if (parts[1] == 'stories') {
      if (method == 'DELETE') {
        stories.removeWhere((s) => '${s['id']}' == parts.last);
        return {};
      }
      if (method == 'POST') {
        final s = {
          'id': ++serial,
          'author': user['username'],
          ...data,
          'expiresAt': DateTime.now()
              .add(const Duration(hours: 24))
              .toIso8601String(),
        };
        stories.insert(0, s);
        return s;
      }
      return stories;
    }
    throw const ApiError('Thao tác này cần đăng nhập tài khoản thật.');
  }
}
