import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// Detects a deliberate reverse scroll even when the list is clamped at an
/// edge and produces no ScrollUpdateNotification. This also covers upward
/// trackpad/wheel scrolling on Flutter Web, which has no dragDetails.
///
/// Pointer events are observed without entering the gesture arena, so list
/// scrolling, horizontal channel sliding and pull-to-refresh remain intact.
class MobileReverseScrollRegion extends StatefulWidget {
  const MobileReverseScrollRegion({
    super.key,
    required this.child,
    this.onReverseScroll,
  });

  final Widget child;
  final VoidCallback? onReverseScroll;

  @override
  State<MobileReverseScrollRegion> createState() =>
      _MobileReverseScrollRegionState();
}

class _MobileReverseScrollRegionState extends State<MobileReverseScrollRegion> {
  int? _pointer;
  Offset? _start;
  bool _triggered = false;

  void _onDown(PointerDownEvent event) {
    if (_pointer != null) return;
    _pointer = event.pointer;
    _start = event.position;
    _triggered = false;
  }

  void _onMove(PointerMoveEvent event) {
    if (event.pointer != _pointer || _triggered || _start == null) return;
    final delta = event.position - _start!;
    // Moving the finger DOWN scrolls the content UP (reveals chrome).
    // Ignore predominantly horizontal swipes between avatar/channel panes.
    if (delta.dy >= 12 && delta.dy > delta.dx.abs() * 1.2) {
      _triggered = true;
      widget.onReverseScroll?.call();
    }
  }

  void _onEnd(PointerEvent event) {
    if (_pointer != event.pointer) return;
    _pointer = null;
    _start = null;
    _triggered = false;
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: _onDown,
      onPointerMove: _onMove,
      onPointerUp: _onEnd,
      onPointerCancel: _onEnd,
      onPointerSignal: (event) {
        if (event is PointerScrollEvent && event.scrollDelta.dy < -8) {
          widget.onReverseScroll?.call();
        }
      },
      child: widget.child,
    );
  }
}
