import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

const storyBackgrounds = <String, List<Color>>{
  'berry': [Color(0xFFB82C78), Color(0xFF702F9D)],
  'indigo': [Color(0xFF3949AB), Color(0xFF6C4DC5)],
  'teal': [Color(0xFF087F8C), Color(0xFF22A88A)],
  'sunset': [Color(0xFFF17A41), Color(0xFFD94E86)],
};
const storyBackgroundNames = <String, String>{
  'berry': 'Tím hồng',
  'indigo': 'Xanh tím',
  'teal': 'Xanh ngọc',
  'sunset': 'Cam hoàng hôn',
};

String? validateStoryMedia(String name, int? size) {
  const images = {'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'};
  const videos = {'mp4', 'mov', 'm4v', 'webm'};
  final extension = name.split('.').last.toLowerCase();
  if (!images.contains(extension) && !videos.contains(extension)) {
    return 'Chỉ hỗ trợ ảnh JPG, PNG, WebP, GIF, HEIC hoặc video MP4, MOV, M4V, WebM.';
  }
  final maxMB = videos.contains(extension) ? 150 : 20;
  if (size == null || size <= 0 || size > maxMB * 1024 * 1024) {
    return 'Dung lượng tối đa cho ${videos.contains(extension) ? 'video' : 'ảnh'} là $maxMB MB.';
  }
  return null;
}

class FeedStoryCreateSheet extends StatefulWidget {
  const FeedStoryCreateSheet({
    super.key,
    required this.onCreateMedia,
    required this.onCreateText,
  });

  final Future<bool> Function(PlatformFile file) onCreateMedia;
  final Future<bool> Function(String text, String background) onCreateText;

  @override
  State<FeedStoryCreateSheet> createState() => _FeedStoryCreateSheetState();
}

class _FeedStoryCreateSheetState extends State<FeedStoryCreateSheet> {
  final textController = TextEditingController();
  bool editingText = false;
  bool busy = false;
  String background = 'berry';
  String error = '';
  PlatformFile? selectedMedia;
  int? selectedSize;
  Future<Uint8List>? previewImageBytes;
  VideoPlayerController? videoController;
  Future<void>? initializingVideo;

  @override
  void dispose() {
    videoController?.dispose();
    textController.dispose();
    super.dispose();
  }

  Future<void> _chooseMedia() async {
    if (busy) return;
    try {
      final file = await FilePicker.pickFile(type: FileType.media);
      if (!mounted || file == null) return;
      int? size;
      try {
        size = file.lengthSync();
      } catch (_) {
        // Some file picker backends only support asynchronous size lookup.
      }
      size ??= await file.length();
      if (!mounted) return;
      final issue = validateStoryMedia(file.name, size);
      if (issue != null) {
        setState(() => error = issue);
        return;
      }
      final previous = videoController;
      final ext = file.name.split('.').last.toLowerCase();
      final isVideo = {'mp4', 'mov', 'm4v', 'webm'}.contains(ext);
      final video = isVideo && file.path != null
          ? VideoPlayerController.file(File(file.path!))
          : null;
      setState(() {
        selectedMedia = file;
        selectedSize = size;
        previewImageBytes = !isVideo && file.path == null ? file.readAsBytes() : null;
        videoController = video;
        initializingVideo = video?.initialize();
        error = '';
      });
      await previous?.dispose();
    } catch (_) {
      if (mounted) setState(() => error = 'Không thể đọc tệp. Hãy chọn lại ảnh hoặc video.');
    }
  }

  void _backToChoice() {
    if (busy) return;
    videoController?.dispose();
    setState(() {
      editingText = false;
      selectedMedia = null;
      selectedSize = null;
      previewImageBytes = null;
      videoController = null;
      initializingVideo = null;
      error = '';
    });
  }

  Widget _mediaPreview(PlatformFile file) {
    final extension = file.name.split('.').last.toLowerCase();
    final isVideo = {'mp4', 'mov', 'm4v', 'webm'}.contains(extension);
    final controller = videoController;
    final Widget content;
    if (!isVideo) {
      content = file.path != null
          ? Image.file(File(file.path!), fit: BoxFit.contain,
              errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined, color: Colors.white, size: 64))
          : FutureBuilder<Uint8List>(
              future: previewImageBytes,
              builder: (context, snapshot) {
                if (snapshot.hasData) {
                  return Image.memory(snapshot.data!, fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined, color: Colors.white));
                }
                if (snapshot.hasError) {
                  return const Center(child: Text('Không thể xem trước ảnh này.', style: TextStyle(color: Colors.white)));
                }
                return const Center(child: CircularProgressIndicator());
              },
            );
    } else if (controller == null) {
      content = const Center(child: Text('Không thể xem trước video trên thiết bị này.', style: TextStyle(color: Colors.white)));
    } else {
      content = FutureBuilder<void>(
        future: initializingVideo,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !controller.value.isInitialized) {
            return const Center(child: Text('Không thể xem trước video này.', style: TextStyle(color: Colors.white)));
          }
          return Stack(
            alignment: Alignment.center,
            children: [
              Center(child: AspectRatio(
                aspectRatio: controller.value.aspectRatio,
                child: VideoPlayer(controller),
              )),
              IconButton.filledTonal(
                tooltip: controller.value.isPlaying ? 'Tạm dừng' : 'Phát video',
                onPressed: () {
                  controller.value.isPlaying ? controller.pause() : controller.play();
                  setState(() {});
                },
                icon: Icon(controller.value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded),
              ),
            ],
          );
        },
      );
    }
    return ClipRRect(
      key: const ValueKey('story-media-preview'),
      borderRadius: BorderRadius.circular(16),
      child: ColoredBox(
        color: Colors.black87,
        child: SizedBox(height: 230, width: double.infinity, child: content),
      ),
    );
  }

  Future<void> _submit({bool media = false}) async {
    if (busy) return;
    final text = textController.text.trim();
    if (!media && (text.isEmpty || text.runes.length > 200)) return;
    if (media && selectedMedia == null) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final ok = media
          ? await widget.onCreateMedia(selectedMedia!)
          : await widget.onCreateText(text, background);
      if (!mounted) return;
      if (ok) {
        Navigator.of(context).pop();
      } else {
        setState(() => error = 'Chưa đăng được Story. Bản nháp vẫn được giữ.');
      }
    } catch (_) {
      if (mounted) setState(() => error = 'Không thể đăng Story. Thử lại sau.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = textController.text.trim();
    final length = text.runes.length;
    final validText = length > 0 && length <= 200;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          0,
          16,
          MediaQuery.viewInsetsOf(context).bottom + 16,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  if (editingText || selectedMedia != null)
                    IconButton(
                      key: const ValueKey('story-back-to-choice'),
                      tooltip: 'Quay lại chọn loại tin',
                      onPressed: busy
                          ? null
                          : _backToChoice,
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                  Expanded(
                    child: Text(
                      editingText ? 'Story dạng văn bản' : 'Tạo Story',
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Đóng',
                    onPressed: busy ? null : () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (selectedMedia != null && !editingText) ...[
                _mediaPreview(selectedMedia!),
                const SizedBox(height: 10),
                Text(selectedMedia!.name, maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
                Text('${((selectedSize ?? 0) / (1024 * 1024)).toStringAsFixed(1)} MB · Story hiển thị trong 24 giờ.'),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: busy ? null : _chooseMedia,
                    icon: const Icon(Icons.image_outlined),
                    label: const Text('Chọn tệp khác'),
                  ),
                ),
                FilledButton.icon(
                  key: const ValueKey('story-media-publish'),
                  onPressed: busy ? null : () => _submit(media: true),
                  icon: const Icon(Icons.send_rounded),
                  label: Text(busy ? 'Đang đăng...' : 'Đăng Story'),
                ),
              ] else if (!editingText) ...[
                Row(
                  children: [
                    Expanded(
                      child: _storyChoice(
                        key: const ValueKey('story-media-choice'),
                        title: 'Tạo tin có ảnh hoặc video',
                        icon: Icons.photo_library_outlined,
                        colors: storyBackgrounds['indigo']!,
                        onTap: busy ? null : _chooseMedia,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _storyChoice(
                        key: const ValueKey('story-text-choice'),
                        title: 'Tạo tin dạng văn bản',
                        icon: Icons.text_fields_rounded,
                        colors: storyBackgrounds['berry']!,
                        onTap: busy
                            ? null
                            : () => setState(() => editingText = true),
                      ),
                    ),
                  ],
                ),
              ] else ...[
                const Text(
                  'Nội dung tin',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                TextField(
                  key: const ValueKey('story-text-input'),
                  controller: textController,
                  maxLines: 3,
                  minLines: 2,
                  autofocus: true,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    hintText: 'Bạn muốn chia sẻ điều gì?',
                  ),
                ),
                Text(
                  '$length / 200 ký tự',
                  style: TextStyle(
                    color: length > 200 ? Colors.red : Colors.grey,
                  ),
                  textAlign: TextAlign.end,
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final entry in storyBackgrounds.entries)
                      Tooltip(
                        message: storyBackgroundNames[entry.key]!,
                        child: ChoiceChip(
                          key: ValueKey('story-color-${entry.key}'),
                          label: Text(storyBackgroundNames[entry.key]!),
                          selected: background == entry.key,
                          onSelected: busy
                              ? null
                              : (_) => setState(() => background = entry.key),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  key: const ValueKey('story-text-preview'),
                  height: 185,
                  alignment: Alignment.center,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: storyBackgrounds[background]!,
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    text.isEmpty ? 'Nội dung tin sẽ hiện ở đây' : text,
                    textAlign: TextAlign.center,
                    maxLines: 7,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                const Text('Tin sẽ hiển thị trong 24 giờ.'),
                const SizedBox(height: 12),
                FilledButton.icon(
                  key: const ValueKey('story-text-publish'),
                  onPressed: busy || !validText ? null : _submit,
                  icon: const Icon(Icons.send_rounded),
                  label: Text(busy ? 'Đang đăng...' : 'Đăng Story'),
                ),
              ],
              if (busy)
                const Padding(
                  padding: EdgeInsets.only(top: 10),
                  child: Center(child: CircularProgressIndicator()),
                ),
              if (error.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(error, style: const TextStyle(color: Colors.red)),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _storyChoice({
    required Key key,
    required String title,
    required IconData icon,
    required List<Color> colors,
    required VoidCallback? onTap,
  }) => InkWell(
    key: key,
    onTap: onTap,
    borderRadius: BorderRadius.circular(14),
    child: Container(
      height: 150,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: colors),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircleAvatar(
            backgroundColor: Colors.white,
            child: Icon(icon, color: Colors.black87),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
