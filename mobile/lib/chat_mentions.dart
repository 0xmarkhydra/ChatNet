/// Dart port of frontend/src/features/chat/utils/mentions.ts.
///
/// Keep the wire representation of chat mentions as plain @username tokens.
/// React and Flutter therefore send the same message text to the Go API.
class MentionQuery {
  const MentionQuery(this.start, this.end, this.query);
  final int start;
  final int end;
  final String query;
}

class MentionCandidate {
  const MentionCandidate({
    required this.username,
    required this.displayName,
    this.userId,
    this.online = false,
    this.all = false,
  });

  final String username;
  final String displayName;
  final int? userId;
  final bool online;
  final bool all;

  factory MentionCandidate.fromJson(Map<String, dynamic> item) {
    final name = item['username']?.toString() ?? '';
    return MentionCandidate(
      username: name,
      displayName: item['displayName']?.toString().isNotEmpty == true
          ? item['displayName'].toString()
          : name,
      userId: (item['id'] as num?)?.toInt(),
      online: item['online'] == true,
    );
  }
}

class MentionInsertion {
  const MentionInsertion(this.text, this.cursor);
  final String text;
  final int cursor;
}

class MentionSegment {
  const MentionSegment(this.text, {this.username, this.all = false});
  final String text;
  final String? username;
  final bool all;
  bool get isMention => username != null || all;
}

final RegExp _mentionPattern = RegExp(
  r'(^|\s)@([a-zA-Z0-9_.-]+)(?![a-zA-Z0-9_.-])',
);
final RegExp _mentionCursorPattern = RegExp(r'(^|\s)@([^\s@]*)$');
final RegExp _mentionSuffixPattern = RegExp(r'^[a-zA-Z0-9_.-]*');

/// Emails and @-fragments inside a word must remain normal text.
MentionQuery? findMentionQuery(String text, int cursor) {
  if (cursor < 0 || cursor > text.length) return null;
  final match = _mentionCursorPattern.firstMatch(text.substring(0, cursor));
  if (match == null) return null;
  final suffix =
      _mentionSuffixPattern.firstMatch(text.substring(cursor))?.group(0) ?? '';
  final name = match.group(2) ?? '';
  return MentionQuery(cursor - name.length - 1, cursor + suffix.length, name);
}

Set<String> mentionedUsernames(String text) => {
  for (final match in _mentionPattern.allMatches(text))
    (match.group(2) ?? '').toLowerCase(),
};

const Map<String, String> _diacritics = {
  'a': 'àáạảãâầấậẩẫăằắặẳẵ',
  'e': 'èéẹẻẽêềếệểễ',
  'i': 'ìíịỉĩ',
  'o': 'òóọỏõôồốộổỗơờớợởỡ',
  'u': 'ùúụủũưừứựửữ',
  'y': 'ỳýỵỷỹ',
  'd': 'đ',
};

String foldMentionText(String value) {
  final normal = value.toLowerCase();
  final output = StringBuffer();
  for (final rune in normal.runes) {
    final char = String.fromCharCode(rune);
    var converted = char;
    for (final entry in _diacritics.entries) {
      if (entry.value.contains(char)) {
        converted = entry.key;
        break;
      }
    }
    output.write(converted);
  }
  return output.toString().replaceAll(RegExp(r'[\u0300-\u036f]'), '');
}

/// Like the React picker: @all first, then matching non-duplicate group members.
List<MentionCandidate> matchMentionMembers(
  List<MentionCandidate> members,
  String text,
  MentionQuery mention, {
  int limit = 8,
}) {
  final before =
      text.substring(0, mention.start) +
      ' ' * (mention.end - mention.start) +
      text.substring(mention.end);
  final used = mentionedUsernames(before);
  final needle = foldMentionText(mention.query);
  final matches =
      members.where((member) {
        if (member.username.isEmpty ||
            used.contains(member.username.toLowerCase())) {
          return false;
        }
        return foldMentionText(member.username).contains(needle) ||
            foldMentionText(member.displayName).contains(needle);
      }).toList()..sort(
        (a, b) =>
            a.displayName.toLowerCase().compareTo(b.displayName.toLowerCase()),
      );
  final results = <MentionCandidate>[
    if (!used.contains('all') && 'all'.contains(needle))
      const MentionCandidate(
        username: 'all',
        displayName: 'Tất cả thành viên',
        all: true,
      ),
    ...matches,
  ];
  return results.take(limit).toList();
}

MentionInsertion insertMention(
  String text,
  MentionQuery query,
  String username,
) {
  final suffix = text.substring(query.end);
  final separator = suffix.isNotEmpty && RegExp(r'^\s').hasMatch(suffix)
      ? ''
      : ' ';
  final inserted = '@$username$separator';
  return MentionInsertion(
    text.substring(0, query.start) + inserted + suffix,
    query.start + inserted.length,
  );
}

List<MentionSegment> splitMessageMentions(
  String text,
  List<MentionCandidate> members,
) {
  final known = members.map((member) => member.username.toLowerCase()).toSet();
  final parts = <MentionSegment>[];
  var cursor = 0;
  for (final match in _mentionPattern.allMatches(text)) {
    final username = match.group(2)!;
    final all = username.toLowerCase() == 'all';
    if (!all && !known.contains(username.toLowerCase())) continue;
    final start = match.start + (match.group(1)?.length ?? 0);
    if (start > cursor) {
      parts.add(MentionSegment(text.substring(cursor, start)));
    }
    parts.add(
      MentionSegment('@$username', username: all ? null : username, all: all),
    );
    cursor = start + username.length + 1;
  }
  if (cursor < text.length) parts.add(MentionSegment(text.substring(cursor)));
  return parts;
}
