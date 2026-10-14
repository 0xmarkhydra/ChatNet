import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import 'api.dart';

Future<void> openAttachment(BuildContext context, Json attachment) async {
  final kind = attachment['kind']?.toString();
  if (kind != 'image' && kind != 'video') {
    final uri = Uri.tryParse(attachment['url']?.toString() ?? '');
    if (uri != null && const {'http', 'https'}.contains(uri.scheme)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    return;
  }
  if (!context.mounted) return;
  await showDialog<void>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: .92),
    builder: (context) => Dialog.fullscreen(
      backgroundColor: Colors.black,
      child: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(child: AttachmentView(attachment: attachment)),
            Positioned(
              top: 10,
              right: 10,
              child: IconButton(
                tooltip: 'Đóng',
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded),
                style: IconButton.styleFrom(
                  foregroundColor: Colors.white,
                  backgroundColor: Colors.black54,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class AttachmentView extends StatefulWidget {
  const AttachmentView({super.key, required this.attachment});

  final Json attachment;

  @override
  State<AttachmentView> createState() => _AttachmentViewState();
}

class _AttachmentViewState extends State<AttachmentView> {
  VideoPlayerController? controller;
  Future<void>? initializing;

  @override
  void initState() {
    super.initState();
    if (widget.attachment['kind'] == 'video') {
      final uri = Uri.tryParse(widget.attachment['url']?.toString() ?? '');
      if (uri != null) {
        controller = VideoPlayerController.networkUrl(uri);
        initializing = controller!.initialize().then((_) {
          if (mounted) setState(() {});
        });
      }
    }
  }

  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.attachment['kind'] == 'image') {
      return InteractiveViewer(
        minScale: .8,
        maxScale: 5,
        child: Center(
          child: Image.network(
            widget.attachment['url']?.toString() ?? '',
            fit: BoxFit.contain,
            errorBuilder: (_, _, _) => const Icon(
              Icons.broken_image_outlined,
              color: Colors.white70,
              size: 64,
            ),
          ),
        ),
      );
    }
    final video = controller;
    if (video == null) {
      return const Center(
        child: Icon(Icons.videocam_off_outlined, color: Colors.white, size: 64),
      );
    }
    return FutureBuilder<void>(
      future: initializing,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError || !video.value.isInitialized) {
          return const Center(
            child: Icon(
              Icons.videocam_off_outlined,
              color: Colors.white,
              size: 64,
            ),
          );
        }
        return Column(
          children: [
            Expanded(
              child: Center(
                child: AspectRatio(
                  aspectRatio: video.value.aspectRatio,
                  child: VideoPlayer(video),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
              child: Row(
                children: [
                  IconButton(
                    tooltip: video.value.isPlaying ? 'Tạm dừng' : 'Phát',
                    onPressed: () {
                      video.value.isPlaying ? video.pause() : video.play();
                      setState(() {});
                    },
                    icon: Icon(
                      video.value.isPlaying
                          ? Icons.pause_rounded
                          : Icons.play_arrow_rounded,
                    ),
                    color: Colors.white,
                  ),
                  Expanded(
                    child: VideoProgressIndicator(
                      video,
                      allowScrubbing: true,
                      colors: const VideoProgressColors(
                        playedColor: Colors.white,
                        bufferedColor: Colors.white38,
                        backgroundColor: Colors.white24,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
