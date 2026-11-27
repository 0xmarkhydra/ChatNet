import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:record/record.dart';
import '../theme.dart';

const giphyApiKey = String.fromEnvironment('GIPHY_API_KEY');
bool isGiphyMedia(String value) {
  final url = Uri.tryParse(value);
  return url != null &&
      url.scheme == 'https' &&
      url.userInfo.isEmpty &&
      !url.hasPort &&
      RegExp(r'^(?:media[0-9]*|i)\.giphy\.com$').hasMatch(url.host) &&
      url.path.endsWith('.gif');
}

// Matches frontend/src/features/chat/utils/chatEmojiCatalog.ts.
const chatStickerLabels = <String, String>{
  '😀': 'Cười',
  '😃': 'Cười tươi',
  '😄': 'Vui vẻ',
  '😁': 'Cười rạng rỡ',
  '😆': 'Cười lớn',
  '😅': 'Cười trừ',
  '🤣': 'Cười lăn',
  '😂': 'Haha',
  '🙂': 'Mỉm cười',
  '😊': 'Hạnh phúc',
  '😇': 'Thiên thần',
  '🥰': 'Yêu thương',
  '😍': 'Mắt trái tim',
  '😘': 'Hôn',
  '😋': 'Ngon miệng',
  '😜': 'Nháy mắt',
  '🤪': 'Tinh nghịch',
  '😎': 'Ngầu',
  '🤩': 'Thích thú',
  '🥳': 'Ăn mừng',
  '😏': 'Cười nhếch',
  '😒': 'Không hài lòng',
  '😔': 'Buồn',
  '😢': 'Khóc',
  '😭': 'Khóc lớn',
  '😤': 'Bực mình',
  '😡': 'Tức giận',
  '😱': 'Sợ hãi',
  '😮': 'Bất ngờ',
  '😲': 'Ngạc nhiên',
  '🥺': 'Năn nỉ',
  '🤔': 'Suy nghĩ',
  '🫢': 'Che miệng',
  '🤗': 'Ôm',
  '😴': 'Buồn ngủ',
  '🤯': 'Bùng nổ',
  '👍': 'Thích',
  '👎': 'Không thích',
  '👏': 'Vỗ tay',
  '🙌': 'Giơ tay vui mừng',
  '👋': 'Vẫy tay',
  '👌': 'OK',
  '✌️': 'Chiến thắng',
  '🤞': 'Chúc may mắn',
  '🤟': 'Yêu bạn',
  '🤘': 'Rock',
  '🤝': 'Bắt tay',
  '🙏': 'Cảm ơn',
  '💪': 'Mạnh mẽ',
  '👀': 'Đôi mắt',
  '💋': 'Dấu hôn',
  '🫶': 'Tạo hình trái tim',
  '❤️': 'Yêu thích',
  '🩷': 'Tim hồng',
  '🧡': 'Tim cam',
  '💛': 'Tim vàng',
  '💚': 'Tim xanh lá',
  '💙': 'Tim xanh dương',
  '💜': 'Tim tím',
  '🖤': 'Tim đen',
  '🤍': 'Tim trắng',
  '💔': 'Tan vỡ',
  '💕': 'Hai trái tim',
  '💖': 'Tim lấp lánh',
  '💘': 'Mũi tên tình yêu',
  '💯': 'Một trăm điểm',
  '🐶': 'Chó',
  '🐱': 'Mèo',
  '🐭': 'Chuột',
  '🐰': 'Thỏ',
  '🦊': 'Cáo',
  '🐻': 'Gấu',
  '🐼': 'Gấu trúc',
  '🐨': 'Gấu koala',
  '🐯': 'Hổ',
  '🦁': 'Sư tử',
  '🐸': 'Ếch',
  '🐷': 'Heo',
  '🐧': 'Chim cánh cụt',
  '🦄': 'Kỳ lân',
  '🐝': 'Ong',
  '🦋': 'Bướm',
  '🍎': 'Táo',
  '🍓': 'Dâu tây',
  '🍉': 'Dưa hấu',
  '🍌': 'Chuối',
  '🍔': 'Burger',
  '🍟': 'Khoai tây chiên',
  '🍕': 'Pizza',
  '🍣': 'Sushi',
  '🍜': 'Mì',
  '🍰': 'Bánh ngọt',
  '🎂': 'Bánh sinh nhật',
  '🍩': 'Bánh vòng',
  '☕': 'Cà phê',
  '🧋': 'Trà sữa',
  '🍺': 'Bia',
  '🥂': 'Cụng ly',
  '🎉': 'Chúc mừng',
  '🎊': 'Pháo giấy',
  '🎁': 'Quà tặng',
  '🎈': 'Bóng bay',
  '🏆': 'Cúp',
  '⚽': 'Bóng đá',
  '🏀': 'Bóng rổ',
  '🎮': 'Trò chơi',
  '🎵': 'Âm nhạc',
  '🎸': 'Đàn guitar',
  '🎨': 'Hội họa',
  '🚀': 'Tên lửa',
  '✨': 'Lấp lánh',
  '🔥': 'Bùng cháy',
  '⭐': 'Ngôi sao',
  '🌈': 'Cầu vồng',
  '✅': 'Đồng ý',
  '❌': 'Không',
  '❗': 'Chú ý',
  '❓': 'Câu hỏi',
  '💡': 'Ý tưởng',
  '💬': 'Trò chuyện',
  '🔔': 'Thông báo',
  '📌': 'Ghim',
  '📅': 'Lịch',
  '📷': 'Máy ảnh',
  '💻': 'Máy tính',
  '📱': 'Điện thoại',
  '🔒': 'Khóa',
  '💎': 'Kim cương',
  '☀️': 'Mặt trời',
  '🌙': 'Mặt trăng',
};
final chatStickers = chatStickerLabels.keys.toList(growable: false);
Future<Uint8List> createStickerPng(String emoji) async {
  if (!chatStickers.contains(emoji)) {
    throw ArgumentError('Sticker không hợp lệ');
  }
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final painter = TextPainter(
    text: TextSpan(
      text: emoji,
      style: const TextStyle(
        fontSize: 180,
        fontFamilyFallback: [
          'Apple Color Emoji',
          'Noto Color Emoji',
          'Segoe UI Emoji',
        ],
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();
  painter.paint(
    canvas,
    Offset((256 - painter.width) / 2, (256 - painter.height) / 2),
  );
  painter.dispose();
  final picture = recorder.endRecording();
  try {
    final image = await picture.toImage(256, 256);
    try {
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      if (data == null) throw StateError('Không tạo được sticker');
      return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
    } finally {
      image.dispose();
    }
  } finally {
    picture.dispose();
  }
}

Future<String?> showStickerPicker(BuildContext context) =>
    showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => const _StickerPicker(),
    );

class _StickerPicker extends StatefulWidget {
  const _StickerPicker();
  @override
  State<_StickerPicker> createState() => _StickerPickerState();
}

class _StickerPickerState extends State<_StickerPicker> {
  String query = '';
  @override
  Widget build(BuildContext context) {
    final results = chatStickerLabels.entries
        .where(
          (item) =>
              query.isEmpty ||
              item.value.toLowerCase().contains(query.toLowerCase()) ||
              item.key.contains(query),
        )
        .toList();
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: FractionallySizedBox(
          heightFactor: .72,
          child: Column(
            children: [
              const Text(
                'Chọn sticker',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: TextField(
                  onChanged: (value) => setState(() => query = value.trim()),
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Tìm sticker...',
                  ),
                ),
              ),
              if (results.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(10),
                  child: Text('Không tìm thấy sticker'),
                ),
              Expanded(
                child: GridView.count(
                  crossAxisCount: 5,
                  padding: const EdgeInsets.all(12),
                  children: [
                    for (final item in results)
                      Semantics(
                        button: true,
                        label: item.value,
                        child: InkWell(
                          key: ValueKey('sticker-${item.key}'),
                          onTap: () => Navigator.pop(context, item.key),
                          child: Center(
                            child: Text(
                              item.key,
                              style: const TextStyle(fontSize: 40),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<String?> showGiphyPicker(BuildContext context) =>
    showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _GiphyPicker(),
    );

class _GiphyPicker extends StatefulWidget {
  const _GiphyPicker();
  @override
  State<_GiphyPicker> createState() => _GiphyPickerState();
}

class _GiphyPickerState extends State<_GiphyPicker> {
  final query = TextEditingController();
  String kind = 'stickers', error = '';
  List<Map<String, String>> items = [];
  bool loading = false;
  Timer? debounce;
  int revision = 0;
  final client = http.Client();
  @override
  void initState() {
    super.initState();
    if (giphyApiKey.isNotEmpty) _load();
  }

  @override
  void dispose() {
    debounce?.cancel();
    revision++;
    client.close();
    query.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (giphyApiKey.isEmpty) return;
    final id = ++revision;
    setState(() {
      loading = true;
      error = '';
      items = [];
    });
    try {
      final q = query.text.trim();
      final uri = Uri.https(
        'api.giphy.com',
        '/v1/$kind/${q.isEmpty ? 'trending' : 'search'}',
        {
          'api_key': giphyApiKey,
          'limit': '24',
          'rating': 'g',
          'lang': 'vi',
          if (q.isNotEmpty) 'q': q,
        },
      );
      final response = await client
          .get(uri)
          .timeout(const Duration(seconds: 12));
      if (response.statusCode != 200) {
        throw StateError('Không tải được GIPHY. Thử lại sau.');
      }
      final data = jsonDecode(response.body);
      final results = <Map<String, String>>[];
      for (final item in (data['data'] as List? ?? [])) {
        final images = item['images'];
        final preview = images?['fixed_width_small']?['url']?.toString() ?? '';
        final url = images?['original']?['url']?.toString() ?? '';
        if (isGiphyMedia(preview) && isGiphyMedia(url)) {
          results.add({
            'preview': preview,
            'url': url,
            'title': item['title']?.toString() ?? 'GIPHY',
          });
        }
      }
      if (mounted && id == revision) setState(() => items = results);
    } catch (_) {
      if (mounted && id == revision) {
        setState(() => error = 'Không tải được GIPHY. Vui lòng thử lại.');
      }
    } finally {
      if (mounted && id == revision) setState(() => loading = false);
    }
  }

  void _search() {
    revision++;
    debounce?.cancel();
    setState(() {
      items = [];
      loading = true;
    });
    debounce = Timer(const Duration(milliseconds: 350), _load);
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: FractionallySizedBox(
        heightFactor: .78,
        child: Column(
          children: [
            const Text(
              'GIF / Sticker động',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            if (giphyApiKey.isEmpty)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Text('Chưa cấu hình API key GIPHY.'),
              )
            else ...[
              Wrap(
                spacing: 8,
                children: [
                  for (final type in ['stickers', 'gifs'])
                    ChoiceChip(
                      label: Text(type == 'gifs' ? 'GIF' : 'Sticker động'),
                      selected: kind == type,
                      onSelected: (_) {
                        setState(() => kind = type);
                        _search();
                      },
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: TextField(
                  controller: query,
                  onChanged: (_) => _search(),
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Tìm GIF hoặc sticker...',
                  ),
                ),
              ),
              if (loading) const LinearProgressIndicator(),
              if (error.isNotEmpty)
                TextButton(onPressed: _load, child: Text('$error · Thử lại')),
              if (!loading && error.isEmpty && items.isEmpty)
                const Text('Không tìm thấy kết quả.'),
              Expanded(
                child: GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 6,
                    crossAxisSpacing: 6,
                  ),
                  itemCount: items.length,
                  itemBuilder: (ctx, i) => InkWell(
                    onTap: () => Navigator.pop(context, items[i]['url']),
                    child: Image.network(
                      items[i]['preview']!,
                      fit: BoxFit.contain,
                      semanticLabel: items[i]['title'],
                      errorBuilder: (_, _, _) =>
                          const Icon(Icons.broken_image_outlined),
                    ),
                  ),
                ),
              ),
            ],
            const Padding(
              padding: EdgeInsets.all(8),
              child: Text(
                'Powered by GIPHY',
                style: TextStyle(fontSize: 11, color: socoMuted),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

/// Wrap PCM16 mono at 16 kHz into a portable WAV container.
Uint8List pcmVoiceWav(Uint8List pcm) {
  if (pcm.isEmpty || pcm.length.isOdd || pcm.length > 16000 * 2 * 120) {
    throw ArgumentError('Bản ghi không hợp lệ');
  }
  final bytes = Uint8List(44 + pcm.length);
  final data = ByteData.sublistView(bytes);
  void tag(int offset, String value) =>
      bytes.setRange(offset, offset + value.length, ascii.encode(value));
  tag(0, 'RIFF');
  data.setUint32(4, 36 + pcm.length, Endian.little);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  data.setUint32(16, 16, Endian.little);
  data.setUint16(20, 1, Endian.little);
  data.setUint16(22, 1, Endian.little);
  data.setUint32(24, 16000, Endian.little);
  data.setUint32(28, 32000, Endian.little);
  data.setUint16(32, 2, Endian.little);
  data.setUint16(34, 16, Endian.little);
  tag(36, 'data');
  data.setUint32(40, pcm.length, Endian.little);
  bytes.setRange(44, bytes.length, pcm);
  return bytes;
}

Future<Uint8List?> showVoiceRecorder(BuildContext context) =>
    showModalBottomSheet<Uint8List>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      showDragHandle: false,
      builder: (_) => const _VoiceRecorder(),
    );

class _VoiceRecorder extends StatefulWidget {
  const _VoiceRecorder();
  @override
  State<_VoiceRecorder> createState() => _VoiceRecorderState();
}

class _VoiceRecorderState extends State<_VoiceRecorder>
    with WidgetsBindingObserver {
  final recorder = AudioRecorder();
  final player = AudioPlayer();
  final bytes = BytesBuilder(copy: false);
  StreamSubscription<Uint8List>? subscription;
  StreamSubscription<void>? previewComplete;
  Timer? clock;
  int seconds = 0;
  bool recording = false, busy = false, playing = false;
  Uint8List? wav;
  String error = '';
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    previewComplete = player.onPlayerComplete.listen((_) {
      if (mounted) setState(() => playing = false);
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed && recording) unawaited(_stop());
  }

  Future<void> _start() async {
    setState(() {
      busy = true;
      error = '';
    });
    try {
      if (!await recorder.hasPermission()) {
        throw StateError('Cần cấp quyền microphone.');
      }
      if (!mounted) return;
      if (!await recorder.isEncoderSupported(AudioEncoder.pcm16bits)) {
        throw StateError('Thiết bị không hỗ trợ ghi âm PCM.');
      }
      final stream = await recorder.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: 16000,
          numChannels: 1,
        ),
      );
      if (!mounted) {
        await recorder.stop();
        return;
      }
      bytes.clear();
      seconds = 0;
      subscription = stream.listen(
        (chunk) {
          if (bytes.length + chunk.length <= 16000 * 2 * 120) {
            bytes.add(chunk);
          } else {
            unawaited(_stop());
          }
        },
        onError: (Object e) {
          if (mounted) setState(() => error = 'Ghi âm bị gián đoạn.');
          unawaited(_stop());
        },
      );
      setState(() {
        recording = true;
        wav = null;
      });
      clock = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => seconds++);
        if (seconds >= 120) unawaited(_stop());
      });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _stop() async {
    if (!recording || busy) return;
    setState(() => busy = true);
    clock?.cancel();
    try {
      await recorder.stop();
      await subscription?.cancel();
      subscription = null;
      final pcm = bytes.takeBytes();
      if (mounted) setState(() => wav = pcmVoiceWav(pcm));
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) {
        setState(() {
          recording = false;
          busy = false;
        });
      }
    }
  }

  Future<void> _preview() async {
    try {
      if (playing) {
        await player.stop();
        if (mounted) setState(() => playing = false);
        return;
      }
      final data = wav;
      if (data == null) return;
      await player.play(BytesSource(data, mimeType: 'audio/wav'));
      if (mounted) setState(() => playing = true);
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Không phát được bản ghi trên thiết bị.');
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(previewComplete?.cancel() ?? Future<void>.value());
    clock?.cancel();
    unawaited(subscription?.cancel() ?? Future<void>.value());
    unawaited(recorder.dispose());
    unawaited(player.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !recording && !busy,
    child: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Tin nhắn thoại',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Icon(
              recording ? Icons.mic : Icons.graphic_eq,
              size: 48,
              color: recording ? Colors.red : socoBlue,
            ),
            Text(
              '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}',
            ),
            const Text('Tối đa 2 phút · Chỉ tải lên khi xác nhận'),
            if (error.isNotEmpty)
              Text(error, style: const TextStyle(color: Colors.red)),
            if (recording)
              FilledButton.icon(
                onPressed: busy ? null : _stop,
                icon: const Icon(Icons.stop),
                label: const Text('Dừng ghi âm'),
              )
            else if (wav == null)
              FilledButton.icon(
                onPressed: busy ? null : _start,
                icon: const Icon(Icons.mic),
                label: const Text('Bắt đầu ghi âm'),
              )
            else ...[
              OutlinedButton(
                onPressed: _preview,
                child: Text(playing ? 'Dừng nghe' : 'Nghe thử'),
              ),
              FilledButton(
                onPressed: busy ? null : () => Navigator.pop(context, wav),
                child: const Text('Đính kèm bản ghi'),
              ),
              TextButton(
                onPressed: busy
                    ? null
                    : () async {
                        await player.stop();
                        if (mounted) {
                          setState(() {
                            wav = null;
                            playing = false;
                            seconds = 0;
                          });
                        }
                      },
                child: const Text('Ghi lại'),
              ),
            ],
            TextButton(
              onPressed: recording || busy
                  ? null
                  : () => Navigator.pop(context),
              child: const Text('Hủy'),
            ),
          ],
        ),
      ),
    ),
  );
}

class ChatAudioAttachment extends StatefulWidget {
  const ChatAudioAttachment({super.key, required this.url, required this.name});
  final String url, name;
  @override
  State<ChatAudioAttachment> createState() => _ChatAudioAttachmentState();
}

class _ChatAudioAttachmentState extends State<ChatAudioAttachment> {
  AudioPlayer? player;
  StreamSubscription<void>? completion;
  bool playing = false, busy = false;
  Future<void> _toggle() async {
    if (busy) return;
    final uri = Uri.tryParse(widget.url);
    if (uri == null || uri.scheme != 'https' || uri.userInfo.isNotEmpty) return;
    setState(() => busy = true);
    try {
      final p = player ??= AudioPlayer();
      completion ??= p.onPlayerComplete.listen((_) {
        if (mounted) setState(() => playing = false);
      });
      if (playing) {
        await p.pause();
        if (mounted) setState(() => playing = false);
      } else {
        if (p.state == PlayerState.paused) {
          await p.resume();
        } else {
          await p.play(UrlSource(widget.url));
        }
        if (mounted) setState(() => playing = true);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không phát được tin nhắn thoại.')),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    unawaited(completion?.cancel() ?? Future<void>.value());
    unawaited(player?.dispose() ?? Future<void>.value());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ActionChip(
    avatar: Icon(playing ? Icons.pause : Icons.play_arrow),
    label: Text(playing ? 'Tạm dừng' : 'Tin nhắn thoại'),
    onPressed: busy ? null : _toggle,
  );
}
