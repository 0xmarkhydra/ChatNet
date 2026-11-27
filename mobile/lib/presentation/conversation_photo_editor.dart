import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:mime/mime.dart';
import '../api.dart';
import '../widgets.dart';

/// Shared group/channel photo editor. Preview changes locally and only close
/// after the server has confirmed the update.
Future<Json?> showConversationPhotoEditor(
  BuildContext context, {
  required Api api,
  required int groupId,
  required int channelId,
  required String name,
  required String avatarUrl,
}) => showDialog<Json>(
  context: context,
  barrierDismissible: false,
  builder: (_) => _ConversationPhotoEditor(
    api: api,
    groupId: groupId,
    channelId: channelId,
    name: name,
    avatarUrl: avatarUrl,
  ),
);

class _ConversationPhotoEditor extends StatefulWidget {
  const _ConversationPhotoEditor({
    required this.api,
    required this.groupId,
    required this.channelId,
    required this.name,
    required this.avatarUrl,
  });
  final Api api;
  final int groupId, channelId;
  final String name, avatarUrl;
  @override
  State<_ConversationPhotoEditor> createState() =>
      _ConversationPhotoEditorState();
}

class _ConversationPhotoEditorState extends State<_ConversationPhotoEditor> {
  Uint8List? bytes;
  String filename = '', mime = '', error = '';
  bool remove = false, busy = false;
  String get label => widget.channelId == 0 ? 'ảnh nhóm' : 'ảnh kênh';
  String get path =>
      '/api/conversations/${widget.groupId}${widget.channelId == 0 ? '' : '/channels/${widget.channelId}'}/avatar';

  Future<void> choose() async {
    try {
      final file = await FilePicker.pickFile(type: FileType.image);
      if (file == null || !mounted) return;
      if ((await file.length() ?? 0) > 12 * 1024 * 1024) {
        throw const ApiError('Ảnh vượt quá giới hạn 12 MB.');
      }
      final data = await file.readAsBytes();
      final type = lookupMimeType(file.name, headerBytes: data) ?? '';
      if (data.isEmpty ||
          data.length > 12 * 1024 * 1024 ||
          ![
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/heic',
            'image/heif',
          ].contains(type)) {
        throw const ApiError(
          'Chỉ chọn ảnh JPG, PNG, WebP, GIF, HEIC tối đa 12 MB.',
        );
      }
      if (!mounted) return;
      setState(() {
        bytes = data;
        filename = file.name;
        mime = type;
        remove = false;
        error = '';
      });
    } catch (value) {
      if (mounted) {
        setState(() {
          bytes = null;
          remove = false;
          error = value.toString();
        });
      }
    }
  }

  Future<void> save() async {
    if (busy || (!remove && bytes == null)) return;
    setState(() {
      busy = true;
      error = '';
    });
    final generation = widget.api.generation;
    try {
      final permission = object(await widget.api.request('GET', path));
      if (permission['canUpdateAvatar'] != true) {
        throw ApiError('Không có quyền đổi $label.');
      }
      if (generation != widget.api.generation) {
        throw const ApiError('Phiên đăng nhập đã thay đổi.');
      }
      final attachment = remove
          ? null
          : await widget.api.upload('profile', filename, mime, bytes!);
      if (generation != widget.api.generation) {
        throw const ApiError('Phiên đăng nhập đã thay đổi.');
      }
      final result = object(
        await widget.api.request('PUT', path, {'attachment': attachment}),
      );
      if (result['conversationId'] != widget.groupId ||
          (widget.channelId != 0 && result['channelId'] != widget.channelId) ||
          result['avatarSet'] is! bool) {
        throw const ApiError('Phản hồi lưu ảnh không hợp lệ.');
      }
      if (mounted && generation == widget.api.generation) {
        Navigator.pop(context, result);
      }
    } catch (value) {
      if (mounted) setState(() => error = value.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: AlertDialog(
      title: Text('Đổi $label'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.name, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            InkWell(
              onTap: busy ? null : choose,
              borderRadius: BorderRadius.circular(18),
              child: bytes != null && !remove
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: Image.memory(
                        bytes!,
                        width: 136,
                        height: 136,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const SizedBox.square(
                          dimension: 136,
                          child: Icon(Icons.image_outlined),
                        ),
                      ),
                    )
                  : UserAvatar(
                      name: widget.name,
                      group: true,
                      size: 136,
                      imageUrl: remove ? null : widget.avatarUrl,
                      fetchProfileImage: false,
                    ),
            ),
            TextButton.icon(
              onPressed: busy ? null : choose,
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: Text(bytes == null ? 'Chọn ảnh' : 'Chọn ảnh khác'),
            ),
            const Text(
              'JPG, PNG, WebP, GIF, HEIC · tối đa 12 MB',
              textAlign: TextAlign.center,
            ),
            if (bytes != null)
              Text(filename, maxLines: 1, overflow: TextOverflow.ellipsis),
            if (remove) const Text('Ảnh sẽ được gỡ sau khi bạn nhấn Lưu.'),
            if (widget.avatarUrl.isNotEmpty && !remove)
              TextButton.icon(
                onPressed: busy
                    ? null
                    : () => setState(() {
                        bytes = null;
                        remove = true;
                        error = '';
                      }),
                icon: const Icon(Icons.delete_outline),
                label: const Text('Gỡ ảnh'),
              ),
            if (bytes != null || remove)
              TextButton(
                onPressed: busy
                    ? null
                    : () => setState(() {
                        bytes = null;
                        remove = false;
                        error = '';
                      }),
                child: const Text('Hoàn tác'),
              ),
            if (error.isNotEmpty)
              Text(
                error,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: busy ? null : () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: busy || (!remove && bytes == null) ? null : save,
          child: Text(busy ? 'Đang lưu...' : 'Lưu ảnh'),
        ),
      ],
    ),
  );
}
