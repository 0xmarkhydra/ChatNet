import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:soco/api.dart';
import 'package:soco/data/chat_local_state.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'durable draft and outbox restore only for the original session',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final api = Api();
      String token(String sid) =>
          'test.${base64Url.encode(utf8.encode(jsonEncode({'sid': sid, 'uid': 1})))}.sig';
      api.session = {
        'token': token('session-a'),
        'user': {'id': 1},
      };
      final first = ChatLocalState(api);
      final id = ChatLocalState.clientId();
      first.drafts['2:0'] = {'text': 'direct'};
      first.drafts['2:5'] = {'text': 'channel'};
      first.outbox.add({
        'clientId': id,
        'roomId': 2,
        'channelId': 5,
        'status': 'sending',
        'body': {'clientId': id, 'channelId': 5, 'text': 'pending'},
      });
      await first.persist();
      final restored = ChatLocalState(api);
      await restored.restore();
      expect(restored.drafts['2:0']?['text'], 'direct');
      expect(restored.drafts['2:5']?['text'], 'channel');
      expect(restored.outbox.single['clientId'], id);
      expect(restored.outbox.single['status'], 'queued');
      api.generation++;
      api.session = {
        'token': token('session-b'),
        'user': {'id': 1},
      };
      final other = ChatLocalState(api);
      await other.restore();
      expect(other.drafts, isEmpty);
      expect(other.outbox, isEmpty);
      await expectLater(first.persist(), throwsA(isA<ApiError>()));
      api.dispose();
    },
  );
}
