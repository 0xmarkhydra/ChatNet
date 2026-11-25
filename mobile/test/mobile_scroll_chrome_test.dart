import 'package:flutter_test/flutter_test.dart';
import 'package:soco/presentation/mobile_scroll_chrome.dart';

void main() {
  test(
    'PWA parity: scroll down hides, bottom does NOT reveal automatically',
    () {
      final chrome = MobileScrollChrome();
      expect(chrome.update(offset: 0, scrollRange: 900, delta: 0), isFalse);
      expect(chrome.update(offset: 60, scrollRange: 900, delta: 60), isFalse);
      expect(chrome.update(offset: 98, scrollRange: 900, delta: 38), isTrue);
      expect(chrome.hidden, isTrue);
      expect(chrome.update(offset: 900, scrollRange: 900, delta: 802), isFalse);
      expect(chrome.hidden, isTrue);
      expect(
        chrome.update(offset: 889, scrollRange: 900, delta: -11, isChat: true),
        isFalse,
      );
      expect(chrome.hidden, isTrue);
    },
  );

  test('direct upward user drag reveals hidden Chat chrome at the end', () {
    final chrome = MobileScrollChrome();
    expect(
      chrome.update(offset: 250, scrollRange: 900, delta: 250, isChat: true),
      isTrue,
    );
    expect(
      chrome.update(offset: 900, scrollRange: 900, delta: 650, isChat: true),
      isFalse,
    );
    expect(
      chrome.update(
        offset: 867,
        scrollRange: 900,
        delta: -33,
        isChat: true,
        isUserDrag: true,
      ),
      isTrue,
    );
    expect(chrome.hidden, isFalse);
  });

  test('ballistic bounce cannot reveal Chat, but a touch reversal can', () {
    final chrome = MobileScrollChrome();
    chrome.update(offset: 140, scrollRange: 600, delta: 140, isChat: true);
    expect(chrome.hidden, isTrue);
    expect(
      chrome.update(offset: 600, scrollRange: 600, delta: 460, isChat: true),
      isFalse,
    );
    expect(
      chrome.update(offset: 595, scrollRange: 600, delta: -5, isChat: true),
      isFalse,
    );
    expect(
      chrome.update(offset: 580, scrollRange: 600, delta: -15, isChat: true),
      isFalse,
    );
    expect(chrome.hidden, isTrue);
    expect(
      chrome.update(
        offset: 540,
        scrollRange: 600,
        delta: -40,
        isChat: true,
        isUserDrag: true,
      ),
      isTrue,
    );
  });

  test('short nonchat lists reveal on a genuine reverse scroll', () {
    final chrome = MobileScrollChrome();
    chrome.update(offset: 24, scrollRange: 80, delta: 24);
    expect(chrome.update(offset: 47, scrollRange: 80, delta: 23), isTrue);
    expect(chrome.hidden, isTrue);
    expect(chrome.update(offset: 70, scrollRange: 80, delta: 23), isFalse);
    expect(chrome.hidden, isTrue);
    expect(
      chrome.update(offset: 48, scrollRange: 80, delta: -22, isUserDrag: true),
      isTrue,
    );
    expect(chrome.hidden, isFalse);
  });

  test('a changed scroll range never causes chrome to jitter', () {
    final chrome = MobileScrollChrome();
    chrome.update(offset: 200, scrollRange: 800, delta: 200);
    expect(chrome.hidden, isTrue);
    expect(chrome.update(offset: 170, scrollRange: 860, delta: -30), isFalse);
    expect(chrome.hidden, isTrue);
  });

  test('tab reset and non-scrollable list are stable', () {
    final chrome = MobileScrollChrome();
    chrome.update(offset: 180, scrollRange: 400, delta: 180);
    expect(chrome.hidden, isTrue);
    chrome.reset();
    expect(chrome.hidden, isFalse);
    chrome.update(offset: 180, scrollRange: 400, delta: 180);
    expect(chrome.update(offset: 0, scrollRange: 0, delta: 0), isTrue);
    expect(chrome.hidden, isFalse);
  });
  test('separate Chat rail and channel scroll sources do not mix ranges', () {
    final chrome = MobileScrollChrome();
    expect(
      chrome.update(
        offset: 180,
        scrollRange: 780,
        delta: 180,
        isChat: true,
        isUserDrag: true,
        source: 'chat-inbox',
      ),
      isTrue,
    );
    expect(chrome.hidden, isTrue);

    // A channel list has a different scroll extent. Its initial position
    // must not be measured against the previous inbox rail metrics.
    expect(
      chrome.update(
        offset: 12,
        scrollRange: 62,
        delta: 8,
        isChat: true,
        isUserDrag: true,
        source: 'chat-channels',
      ),
      isFalse,
    );
    expect(chrome.hidden, isTrue);
    expect(
      chrome.update(
        offset: 0,
        scrollRange: 62,
        delta: -12,
        isChat: true,
        isUserDrag: true,
        source: 'chat-channels',
      ),
      isTrue,
    );
    expect(chrome.hidden, isFalse);
  });

  test('a direct reverse drag recovers chrome on a non-scrollable inbox', () {
    final chrome = MobileScrollChrome();
    chrome.update(
      offset: 110,
      scrollRange: 600,
      delta: 110,
      isChat: true,
      isUserDrag: true,
      source: 'chat-inbox',
    );
    expect(chrome.hidden, isTrue);

    expect(
      chrome.update(
        offset: 0,
        scrollRange: 0,
        delta: -12,
        isChat: true,
        isUserDrag: false,
        source: 'chat-inbox',
      ),
      isFalse,
    );
    expect(chrome.hidden, isTrue);
    expect(
      chrome.update(
        offset: 0,
        scrollRange: 0,
        delta: -12,
        isChat: true,
        isUserDrag: true,
        source: 'chat-inbox',
      ),
      isTrue,
    );
    expect(chrome.hidden, isFalse);
  });
}
