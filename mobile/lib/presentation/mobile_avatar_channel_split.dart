import 'package:flutter/material.dart';

/// Two adjacent viewports share one animated boundary. Keeping both panes
/// mounted during the transition preserves scroll positions, text input and
/// channel selection exactly as the mobile PWA does.
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
    // The panes are constructed outside the animation builder; their widget
    // subtrees no longer rebuild on every animation frame.
    return AnimatedBuilder(
      animation: animation,
      builder: (context, child) {
        final railWidth = showChannels
            ? compactRailWidth + (width - compactRailWidth) * animation.value
            : width;
        return Row(
          key: const ValueKey('mobile-avatar-channel-split'),
          children: [
            SizedBox(
              key: const ValueKey('mobile-avatar-viewport'),
              width: railWidth,
              child: ClipRect(
                child: OverflowBox(
                  alignment: Alignment.topLeft,
                  minWidth: width,
                  maxWidth: width,
                  child: avatarRail,
                ),
              ),
            ),
            if (showChannels)
              SizedBox(
                key: const ValueKey('mobile-channel-viewport'),
                width: width - railWidth,
                child: ClipRect(
                  child: OverflowBox(
                    alignment: Alignment.topLeft,
                    minWidth: width - compactRailWidth,
                    maxWidth: width - compactRailWidth,
                    child: Material(
                      color: Colors.white,
                      child: channelPicker ?? const SizedBox.shrink(),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
