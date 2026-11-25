import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/api.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';

class _ResendApi extends DemoApi {
  final List<Json> messageBodies = [];
  var failNextMessage = true;

  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    if (method == 'POST' &&
        path.startsWith('/api/conversations/') &&
        path.endsWith('/messages')) {
      messageBodies.add(Map<String, dynamic>.from(body!));
      if (failNextMessage) {
        failNextMessage = false;
        throw const ApiError('Synthetic message create failure');
      }
    }
    return super.request(method, path, body);
  }
}

void main() {
  testWidgets('manual resend reuses failed message client id', (tester) async {
    final api = _ResendApi()..preferences['autoTranslate'] = false;
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: api));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('rail-room-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Th\u1ea3o lu\u1eadn chung'));
    await tester.pumpAndSettle();

    final composer = find.byWidgetPredicate(
      (widget) => widget is EditableText && widget.maxLines == 5,
    );
    await tester.enterText(composer, 'Retry this message');
    await tester.pump();
    await tester.tap(find.byTooltip('G\u1eedi'));
    await tester.pumpAndSettle();
    expect(api.messageBodies, hasLength(1));
    expect(
      tester.widget<EditableText>(composer).controller.text,
      'Retry this message',
    );

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('G\u1eedi'));
    await tester.pumpAndSettle();

    expect(api.messageBodies, hasLength(2));
    expect(api.messageBodies[1]['text'], 'Retry this message');
    expect(api.messageBodies[1]['clientId'], api.messageBodies[0]['clientId']);
  });
}
