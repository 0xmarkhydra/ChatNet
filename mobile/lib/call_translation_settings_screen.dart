import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api.dart';
import 'theme.dart';

/// Matches the PWA CallCenter translation settings nested under Danh bạ.
/// Preferences are device-local (never silently enable voice processing).
class CallTranslationSettingsScreen extends StatefulWidget {
  const CallTranslationSettingsScreen({
    super.key,
    required this.api,
    required this.onBack,
  });

  final Api api;
  final VoidCallback onBack;

  @override
  State<CallTranslationSettingsScreen> createState() =>
      _CallTranslationSettingsScreenState();
}

class _CallTranslationSettingsScreenState
    extends State<CallTranslationSettingsScreen> {
  static const _storage = FlutterSecureStorage();
  static const _enabledKey = 'chatnet.call.translation.autostart.v1';
  static const _languageKey = 'chatnet.call.target-language.v1';
  static const _captionKey = 'chatnet.call.subtitle-mode.v1';

  bool enabled = false;
  bool saving = false;
  String language = 'vi';
  String captions = 'both';
  String feedback = '';
  List<String> languages = const ['vi', 'en', 'ja', 'ko'];

  static const labels = {
    'vi': 'Tiếng Việt',
    'en': 'English (United States)',
    'ja': '日本語 (Nhật)',
    'ko': '한국어 (Hàn)',
    'zh': '中文 (Trung)',
    'fr': 'Français (Pháp)',
    'de': 'Deutsch (Đức)',
    'es': 'Español (Tây Ban Nha)',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final saved = await Future.wait([
        _storage.read(key: _enabledKey),
        _storage.read(key: _languageKey),
        _storage.read(key: _captionKey),
      ]);
      if (mounted) {
        setState(() {
          enabled = saved[0] == 'true';
          language = saved[1] ?? 'vi';
          captions = saved[2] ?? 'both';
        });
      }
    } catch (_) {
      // A device without secure storage can still render these controls.
    }
    try {
      final result = object(
        await widget.api.request('GET', '/api/calls/translation/languages'),
      );
      final values = result['languages'];
      if (!mounted || values is! List) return;
      setState(() {
        languages = [
          ...{...languages, ...values.whereType<String>(), language},
        ];
      });
    } catch (_) {
      // Keep the local language catalog if the AI service is offline.
    }
  }

  Future<void> _save() async {
    if (saving) return;
    setState(() {
      saving = true;
      feedback = '';
    });
    try {
      await _storage.write(key: _enabledKey, value: enabled.toString());
      await _storage.write(key: _languageKey, value: language);
      await _storage.write(key: _captionKey, value: captions);
      if (mounted) {
        setState(
          () =>
              feedback = 'Đã lưu trên thiết bị. Áp dụng từ cuộc gọi tiếp theo.',
        );
      }
    } catch (error) {
      if (mounted) {
        setState(() => feedback = 'Không lưu được cài đặt: $error');
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget field(String title, Widget child, {String? hint}) => Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: socoNavy,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          child,
          if (hint != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                hint,
                style: const TextStyle(fontSize: 12, color: socoMuted),
              ),
            ),
        ],
      ),
    );

    return ListView(
      key: const ValueKey('call-translation-screen'),
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 36),
      children: [
        Text('Dịch AI cuộc gọi', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        const Text(
          'Điều chỉnh dịch giọng nói và phụ đề khi gọi.',
          style: TextStyle(color: socoMuted),
        ),
        const SizedBox(height: 16),
        Card(
          color: Colors.white,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Dịch thời gian thực',
                  style: TextStyle(
                    fontSize: 17,
                    color: socoNavy,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Nghe và đọc phụ đề bằng ngôn ngữ phù hợp.',
                  style: TextStyle(fontSize: 12, color: socoMuted),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  key: const ValueKey('call-translation-auto'),
                  contentPadding: EdgeInsets.zero,
                  title: const Text(
                    'Tự động bật dịch AI khi tham gia cuộc gọi',
                  ),
                  subtitle: const Text(
                    'Chỉ gửi giọng nói tới AI khi từng người tham gia cho phép.',
                  ),
                  value: enabled,
                  onChanged: (next) => setState(() => enabled = next),
                ),
                const Divider(),
                field(
                  'Ngôn ngữ nói',
                  const InputDecorator(
                    decoration: InputDecoration(border: OutlineInputBorder()),
                    child: Text(
                      'Tự động nhận diện giọng nói',
                      style: TextStyle(color: socoMuted),
                    ),
                  ),
                ),
                field(
                  'Ngôn ngữ nhận bản dịch',
                  DropdownButtonFormField<String>(
                    key: const ValueKey('call-translation-language'),
                    initialValue: languages.contains(language)
                        ? language
                        : languages.first,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      for (final code in languages)
                        DropdownMenuItem<String>(
                          value: code,
                          child: Text(labels[code] ?? code),
                        ),
                    ],
                    onChanged: (value) {
                      if (value != null) setState(() => language = value);
                    },
                  ),
                  hint: 'Danh sách ngôn ngữ do dịch vụ dịch cung cấp.',
                ),
                field(
                  'Chế độ phụ đề',
                  DropdownButtonFormField<String>(
                    key: const ValueKey('call-translation-captions'),
                    initialValue: captions,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'both',
                        child: Text('Gốc + bản dịch'),
                      ),
                      DropdownMenuItem(
                        value: 'translated',
                        child: Text('Chỉ bản dịch'),
                      ),
                    ],
                    onChanged: (value) {
                      if (value != null) setState(() => captions = value);
                    },
                  ),
                ),
                field(
                  'Giọng đọc bản dịch',
                  const InputDecorator(
                    decoration: InputDecoration(border: OutlineInputBorder()),
                    child: Text(
                      'Chưa hỗ trợ đọc thành tiếng',
                      style: TextStyle(color: socoMuted),
                    ),
                  ),
                ),
                Wrap(
                  alignment: WrapAlignment.end,
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    TextButton(
                      onPressed: widget.onBack,
                      child: const Text('Hủy'),
                    ),
                    const SizedBox(width: 8),
                    FilledButton.icon(
                      key: const ValueKey('call-translation-save'),
                      onPressed: saving ? null : _save,
                      icon: const Icon(Icons.check_rounded),
                      label: Text(saving ? 'Đang lưu...' : 'Áp dụng thay đổi'),
                    ),
                  ],
                ),
                if (feedback.isNotEmpty)
                  Text(
                    feedback,
                    style: const TextStyle(color: socoMuted, fontSize: 12),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          color: Colors.white,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Xem trước phụ đề',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: socoNavy,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Người tham gia · ĐANG NÓI',
                  style: TextStyle(color: socoMuted, fontSize: 12),
                ),
                if (captions == 'both') const Text('Hi! Can you hear me?'),
                const SizedBox(height: 6),
                const Text(
                  'BẢN DỊCH · VIỆT',
                  style: TextStyle(color: socoBlue, fontSize: 11),
                ),
                const Text('Chào! Bạn nghe thấy mình không?'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        const Card(
          color: Colors.white,
          child: ListTile(
            leading: Icon(Icons.shield_outlined, color: socoBlue),
            title: Text('Minh bạch về dữ liệu'),
            subtitle: Text(
              'Dịch giọng nói chỉ hoạt động khi người tham gia đã đồng ý. '
              'Có thể thu hồi quyền bất kỳ lúc nào.',
            ),
          ),
        ),
      ],
    );
  }
}
