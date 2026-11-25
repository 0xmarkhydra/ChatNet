import 'dart:math' as math;

/// Mirrors the PWA's shared mobile scroll chrome: hide after meaningful
/// downward content travel, reveal on a deliberate reverse gesture, never
/// automatically reveal merely because the list reached its last item.
class MobileScrollChrome {
  bool hidden = false;
  double _distance = 0;
  int _lastDirection = 0;
  double? _lastRange;
  double? _lastTop;
  String? _lastSource;

  void resetMomentum() {
    _distance = 0;
    _lastDirection = 0;
  }

  void reset() {
    hidden = false;
    _lastRange = null;
    _lastTop = null;
    _lastSource = null;
    resetMomentum();
  }

  bool reveal() {
    if (!hidden) return false;
    hidden = false;
    resetMomentum();
    return true;
  }

  /// Returns true only if the header/footer visibility actually changed.
  ///
  /// [isUserDrag] distinguishes direct touch movement from post-fling bounce.
  /// [isChat] prevents inert nested scrollables or end-of-list rubber banding
  /// from unexpectedly showing bars after the Chat list was collapsed.
  bool update({
    required double offset,
    required double scrollRange,
    required double delta,
    bool isUserDrag = false,
    bool isChat = false,
    String source = 'page',
  }) {
    // In Chat, the avatar rail and channel list are independent scrollports.
    // Mixing their offsets and ranges causes phantom hide/reveal transitions.
    if (_lastSource != source) {
      _lastSource = source;
      _lastRange = null;
      _lastTop = null;
      resetMomentum();
    }
    final wasHidden = hidden;
    final range = math.max(0.0, scrollRange);
    final top = offset.clamp(0.0, range).toDouble();
    final previousRange = _lastRange;
    final previousTop = _lastTop;
    _lastRange = range;
    _lastTop = top;

    if (range <= 2) {
      // When a short inbox cannot move at all, a direct upward-scroll
      // gesture still needs to recover hidden chrome. Never use ballistic
      // rubber-band events to reveal the Chat bars.
      if (!isChat || !hidden || (isUserDrag && delta < -6)) {
        reveal();
      }
      return wasHidden != hidden;
    }

    // Header animation changes the viewport extent. Discard synthetic
    // ballistic/programmatic corrections, but never swallow an intentional
    // finger swipe just because the preceding gesture toggled the chrome.
    if (previousRange != null && (range - previousRange).abs() > 2) {
      resetMomentum();
      if (!isUserDrag) return false;
    }

    if (isChat &&
        hidden &&
        !isUserDrag &&
        previousTop != null &&
        top >= range - 12 &&
        previousTop >= previousRange! - 12) {
      resetMomentum();
      return false;
    }

    if (delta.abs() < 1) return false;
    final direction = delta > 0 ? 1 : -1;

    // A genuine reverse drag can reveal chrome even at the edge of a short
    // list. Never interpret ballistic bounce on Chat as that gesture.
    if (isChat && hidden && direction < 0 && !isUserDrag) {
      resetMomentum();
      return false;
    }

    _distance = _lastDirection == direction
        ? _distance + math.min(delta.abs(), 60)
        : math.min(delta.abs(), 60);
    _lastDirection = direction;
    final hideAfter = math.min(90.0, math.max(20.0, range * .3));
    if (direction > 0 && top > hideAfter && _distance >= 20) {
      hidden = true;
      resetMomentum();
    } else if (direction < 0 &&
        (top <= 1 || _distance >= math.min(20.0, math.max(6.0, range * .2)))) {
      reveal();
    }
    return hidden != wasHidden;
  }
}
