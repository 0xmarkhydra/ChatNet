import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:soco/demo.dart';
import 'package:soco/presentation/chat_rich_actions.dart';
import 'package:soco/presentation/chat_rich_media.dart';
import 'package:soco/state/app_providers.dart';
import 'message_screen_parity_test.dart' show openChatParityDemo;

void main() {
  test('voice WAV uses mono PCM16 at 16 kHz and correct byte lengths', () {
    final bytes = pcmVoiceWav(Uint8List.fromList([1, 2, 3, 4]));
    final data = ByteData.sublistView(bytes);
    expect(String.fromCharCodes(bytes.sublist(0, 4)), 'RIFF');
    expect(data.getUint32(4, Endian.little), 40);
    expect(data.getUint32(24, Endian.little), 16000);
    expect(data.getUint16(22, Endian.little), 1);
    expect(data.getUint32(40, Endian.little), 4);
    expect(bytes.sublist(44), [1, 2, 3, 4]);
    expect(() => pcmVoiceWav(Uint8List(1)), throwsArgumentError);
  });
  test('GIPHY media URL validation matches Web', () {
    expect(
      isGiphyMedia('https://media1.giphy.com/media/abc/giphy.gif'),
      isTrue,
    );
    for (final url in [
      'http://media1.giphy.com/media/abc/giphy.gif',
      'https://media1.giphy.com.evil.test/a.gif',
      'https://user@media1.giphy.com/a.gif',
      'https://media1.giphy.com:444/a.gif',
      'https://media1.giphy.com/a.png',
    ]) {
      expect(isGiphyMedia(url), isFalse, reason: url);
    }
  });
  test('schedule time validates future and 365-day limit', () {
    final now = DateTime.utc(2026, 11, 27);
    expect(validScheduleTime(now, now), isFalse);
    expect(validScheduleTime(now.add(const Duration(days: 1)), now), isTrue);
    expect(validScheduleTime(now.add(const Duration(days: 366)), now), isFalse);
  });
  testWidgets(
    'composer schedules a message for the selected channel and cancels it',
    (tester) async {
      final api = DemoApi()..preferences['autoTranslate'] = false;
      await openChatParityDemo(tester, api);
      await tester.tap(find.text('SocCO Design Team').first);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('mobile-channel-5')));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Thêm ảnh, file, emoji'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Hẹn giờ gửi'));
      await tester.tap(find.text('Hẹn giờ gửi'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextField, 'Nội dung hẹn giờ'),
        'Gửi sau ở kênh UI',
      );
      await tester.pump();
      await tester.tap(find.text('Tạo lịch gửi'));
      await tester.pumpAndSettle();
      expect(api.scheduledChats[1]!.single['channelId'], 5);
      expect(api.scheduledChats[1]!.single['text'], 'Gửi sau ở kênh UI');
      expect(api.scheduledChats[1]!.single['clientId'], isNotEmpty);
      await tester.ensureVisible(find.byTooltip('Hủy lịch gửi'));
      await tester.tap(find.byTooltip('Hủy lịch gửi'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hủy lịch'));
      await tester.pumpAndSettle();
      expect(api.scheduledChats[1], isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    },
  );
  testWidgets(
    'group activities create poll, vote, pin and create notes and reminders',
    (tester) async {
      final api = DemoApi();
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [apiProvider.overrideWithValue(api)],
          child: MaterialApp(
            home: Builder(
              builder: (ctx) => Scaffold(
                body: TextButton(
                  onPressed: () => showGroupActivities(
                    ctx,
                    api: api,
                    roomId: 1,
                    createKind: 'poll',
                  ),
                  child: const Text('Open'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('poll-option-0')), 'A');
      await tester.enterText(find.byKey(const ValueKey('poll-option-1')), 'B');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Tạo mới'),
        180,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Tạo mới'));
      await tester.pumpAndSettle();
      expect(api.groupActivities[1]!.single['kind'], 'poll');
      await tester.scrollUntilVisible(
        find.text('A'),
        150,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('A'));
      await tester.pumpAndSettle();
      expect(api.groupActivities[1]!.single['myVote'], 0);
      await tester.ensureVisible(find.byTooltip('Ghim hoạt động'));
      await tester.tap(find.byTooltip('Ghim hoạt động'));
      await tester.pumpAndSettle();
      expect(api.groupActivities[1]!.single['pinnedAt'], isNotNull);
      await tester.ensureVisible(find.text('+ Ghi chú nhóm'));
      await tester.tap(find.text('+ Ghi chú nhóm'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextField, 'Nội dung'),
        'Ghi chú thử',
      );
      await tester.tap(find.text('Tạo mới'));
      await tester.pumpAndSettle();
      expect(
        api.groupActivities[1]!.any(
          (x) => x['kind'] == 'note' && x['body'] == 'Ghi chú thử',
        ),
        isTrue,
      );
      await tester.ensureVisible(find.text('+ Nhắc hẹn nhóm'));
      await tester.tap(find.text('+ Nhắc hẹn nhóm'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Tạo mới'));
      await tester.tap(find.text('Tạo mới'));
      await tester.pumpAndSettle();
      expect(
        api.groupActivities[1]!.any(
          (x) => x['kind'] == 'reminder' && x['scheduledAt'] != null,
        ),
        isTrue,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    },
  );
}
