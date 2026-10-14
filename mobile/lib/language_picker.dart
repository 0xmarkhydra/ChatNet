import 'package:flutter/material.dart';

import 'localization.dart';
import 'theme.dart';

const languageCatalog = <String, (String, String)>{
  'vi': ('Tiếng Việt', 'Việt Nam'),
  'en': ('English', 'United States'),
  'zh': ('中文', '中国'),
  'ja': ('日本語', '日本'),
  'ko': ('한국어', '대한민국'),
  'th': ('ไทย', 'ประเทศไทย'),
  'id': ('Bahasa Indonesia', 'Indonesia'),
  'ms': ('Bahasa Melayu', 'Malaysia'),
  'fil': ('Filipino', 'Philippines'),
  'fr': ('Français', 'France'),
  'de': ('Deutsch', 'Deutschland'),
  'es': ('Español', 'España'),
  'pt': ('Português', 'Brasil'),
  'it': ('Italiano', 'Italia'),
  'nl': ('Nederlands', 'Nederland'),
  'pl': ('Polski', 'Polska'),
  'ru': ('Русский', 'Россия'),
  'uk': ('Українська', 'Україна'),
  'tr': ('Türkçe', 'Türkiye'),
  'ar': ('العربية', 'العالم العربي'),
  'hi': ('हिन्दी', 'भारत'),
  'bn': ('বাংলা', 'বাংলাদেশ'),
  'ur': ('اردو', 'پاکستان'),
  'fa': ('فارسی', 'ایران'),
  'he': ('עברית', 'ישראל'),
  'sv': ('Svenska', 'Sverige'),
  'da': ('Dansk', 'Danmark'),
  'no': ('Norsk', 'Norge'),
  'fi': ('Suomi', 'Suomi'),
  'cs': ('Čeština', 'Česko'),
  'hu': ('Magyar', 'Magyarország'),
  'ro': ('Română', 'România'),
  'el': ('Ελληνικά', 'Ελλάδα'),
};

String languageName(String? code) {
  if (code == 'auto') return 'Theo thiết bị';
  return languageCatalog[code]?.$1 ?? (code?.toUpperCase() ?? 'Tiếng Việt');
}

Future<String?> showLanguagePicker(
  BuildContext context, {
  required String selected,
  required String title,
  bool allowAuto = false,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    builder: (context) =>
        _LanguagePicker(selected: selected, title: title, allowAuto: allowAuto),
  );
}

class _LanguagePicker extends StatefulWidget {
  const _LanguagePicker({
    required this.selected,
    required this.title,
    required this.allowAuto,
  });

  final String selected;
  final String title;
  final bool allowAuto;

  @override
  State<_LanguagePicker> createState() => _LanguagePickerState();
}

class _LanguagePickerState extends State<_LanguagePicker> {
  String query = '';

  @override
  Widget build(BuildContext context) {
    final normalized = query.trim().toLowerCase();
    final entries = languageCatalog.entries.where((entry) {
      return normalized.isEmpty ||
          '${entry.key} ${entry.value.$1} ${entry.value.$2}'
              .toLowerCase()
              .contains(normalized);
    }).toList();
    return SafeArea(
      child: SizedBox(
        height: (MediaQuery.sizeOf(context).height * .82).clamp(420, 760),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  IconButton(
                    tooltip: tr(context, 'common.close'),
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: TextField(
                autofocus: true,
                onChanged: (value) => setState(() => query = value),
                decoration: InputDecoration(
                  hintText: tr(context, 'locale.searchPlaceholder'),
                  prefixIcon: const Icon(Icons.search_rounded),
                ),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
                children: [
                  if (widget.allowAuto && normalized.isEmpty)
                    _LanguageTile(
                      code: 'auto',
                      name: tr(context, 'locale.device'),
                      region: tr(context, 'locale.deviceHint'),
                      selected: widget.selected == 'auto',
                    ),
                  for (final entry in entries)
                    _LanguageTile(
                      code: entry.key,
                      name: entry.value.$1,
                      region: entry.value.$2,
                      selected: widget.selected == entry.key,
                    ),
                  if (entries.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(28),
                      child: Text(
                        tr(context, 'locale.noResults'),
                        textAlign: TextAlign.center,
                        style: TextStyle(color: socoMuted),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LanguageTile extends StatelessWidget {
  const _LanguageTile({
    required this.code,
    required this.name,
    required this.region,
    required this.selected,
  });

  final String code;
  final String name;
  final String region;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      selected: selected,
      selectedTileColor: socoSoftBlue,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      leading: CircleAvatar(
        backgroundColor: selected ? socoBlue : const Color(0xFFF2F5FA),
        foregroundColor: selected ? Colors.white : socoMuted,
        child: Text(
          code == 'auto' ? 'A' : code.toUpperCase(),
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
        ),
      ),
      title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text(region),
      trailing: selected
          ? const Icon(Icons.check_circle_rounded, color: socoBlue)
          : null,
      onTap: () => Navigator.pop(context, code),
    );
  }
}
