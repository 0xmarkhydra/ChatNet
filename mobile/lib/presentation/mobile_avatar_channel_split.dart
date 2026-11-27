import 'package:flutter/material.dart';

/// Stable, independently painted panes. Only the clip and translation change
/// while the shared seam moves; the lists keep their layout and scroll state.
class MobileAvatarChannelSplit extends StatelessWidget {
  const MobileAvatarChannelSplit({
    super.key,
    required this.animation,
    required this.width,
    required this.compactRailWidth,
    required this.showChannels,
    required this.avatarRail,
    this.channelPicker,
  });

  final Animation<double> animation;
  final double width;
  final double compactRailWidth;
  final bool showChannels;
  final Widget avatarRail;
  final Widget? channelPicker;

  @override
  Widget build(BuildContext context) {
    final rail = RepaintBoundary(child: avatarRail);
    final channels = RepaintBoundary(
      child: Material(
        color: Colors.white,
        child: channelPicker ?? const SizedBox.shrink(),
      ),
    );
    return ClipRect(
      child: AnimatedBuilder(
        animation: animation,
        builder: (context, _) {
          final travel = (width - compactRailWidth) * animation.value;
          final seam = showChannels ? compactRailWidth + travel : width;
          return Stack(
            key: const ValueKey('mobile-avatar-channel-split'),
            fit: StackFit.expand,
            children: [
              ClipRect(
                key: const ValueKey('mobile-avatar-viewport'),
                clipper: _AvatarViewportClip(seam),
                child: rail,
              ),
              if (showChannels)
                Positioned(
                  left: compactRailWidth,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  child: Transform.translate(
                    key: const ValueKey('mobile-channel-viewport'),
                    offset: Offset(travel, 0),
                    child: channels,
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _AvatarViewportClip extends CustomClipper<Rect> {
  const _AvatarViewportClip(this.seam);
  final double seam;
  @override
  Rect getClip(Size size) =>
      Rect.fromLTWH(0, 0, seam.clamp(0.0, size.width).toDouble(), size.height);
  @override
  bool shouldReclip(covariant _AvatarViewportClip oldClipper) =>
      seam != oldClipper.seam;
}
