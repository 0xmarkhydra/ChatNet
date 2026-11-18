import 'package:flutter_test/flutter_test.dart';
import 'package:soco/chat_mentions.dart';

void main() {
  const members = [
    MentionCandidate(
      username: 'linhnguyen',
      displayName: 'Linh Nguyễn',
      userId: 2,
    ),
    MentionCandidate(username: 'hoangnam', displayName: 'Hoàng Nam', userId: 4),
    MentionCandidate(username: 'thao', displayName: 'Phương Thảo', userId: 5),
  ];

  test('mention begins only after whitespace, never inside email', () {
    expect(findMentionQuery('email@example.com', 17), isNull);
    expect(findMentionQuery('hello@hoangnam', 14), isNull);
    final query = findMentionQuery('Chào @hoan', 'Chào @hoan'.length);
    expect(query, isNotNull);
    expect(query!.query, 'hoan');
    expect(query.start, 5);
  });

  test('editing a mention in the middle replaces its entire suffix', () {
    const text = 'Mời @hoangnam tham dự';
    final query = findMentionQuery(text, 'Mời @hoa'.length)!;
    expect(query.start, 4);
    expect(query.end, 13);
    final edit = insertMention(text, query, 'linhnguyen');
    expect(edit.text, 'Mời @linhnguyen tham dự');
    expect(edit.cursor, 4 + '@linhnguyen'.length);
  });

  test('Vietnamese accent-insensitive matching and @all work as React', () {
    final query = findMentionQuery(
      'Xin chào @hoang',
      'Xin chào @hoang'.length,
    )!;
    final result = matchMentionMembers(members, 'Xin chào @hoang', query);
    expect(result.map((item) => item.username), ['hoangnam']);

    final allQuery = findMentionQuery('@', 1)!;
    final all = matchMentionMembers(members, '@', allQuery);
    expect(all.first.username, 'all');

    final filtered = findMentionQuery('@all @', '@all @'.length)!;
    final choices = matchMentionMembers(members, '@all @', filtered);
    expect(choices.any((item) => item.all), isFalse);
  });

  test('already used members do not appear twice', () {
    final active = findMentionQuery('@hoangnam xin chào @ho', 22)!;
    final choices = matchMentionMembers(
      members,
      '@hoangnam xin chào @ho',
      active,
    );
    expect(choices.any((item) => item.username == 'hoangnam'), isFalse);
  });

  test(
    'mention text preserves whitespace and does not classify unknown tags',
    () {
      final parts = splitMessageMentions(
        'Xin chào @all! \n@linhnguyen và @unknown, a@hoangnam.com',
        members,
      );
      expect(parts.where((part) => part.isMention).map((part) => part.text), [
        '@all',
        '@linhnguyen',
      ]);
      expect(
        parts.map((part) => part.text).join(),
        'Xin chào @all! \n@linhnguyen và @unknown, a@hoangnam.com',
      );
    },
  );

  test('insert appends a space only when next character is not whitespace', () {
    final atEnd = findMentionQuery('Hi @', 4)!;
    final result = insertMention('Hi @', atEnd, 'all');
    expect(result.text, 'Hi @all ');
    final beforeSpace = findMentionQuery('Hi @ ', 4)!;
    expect(insertMention('Hi @ ', beforeSpace, 'all').text, 'Hi @all ');
  });
}
