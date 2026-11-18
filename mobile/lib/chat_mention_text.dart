import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'chat_mentions.dart';

/// Native Flutter equivalent of React's MessageMentionText.
/// Keeps mentions and links inline, selectable by touch, and accessible.
class ChatMentionText extends StatelessWidget {
  const ChatMentionText({
    super.key,
    required this.text,
    required this.members,
    required this.style,
    this.onMemberTap,
  });

  final String text;
  final List<MentionCandidate> members;
  final TextStyle style;
  final ValueChanged<MentionCandidate>? onMemberTap;

  static final _urlPattern = RegExp(r'https?://[^\s<>"]+');

  List<InlineSpan> _plainOrLinks(String raw) {
    final children = <InlineSpan>[];
    var index = 0;
    for (final match in _urlPattern.allMatches(raw)) {
      if (match.start > index) {
        children.add(TextSpan(text: raw.substring(index, match.start)));
      }
      final url = match.group(0)!;
      children.add(
        _inlineAction(
          text: url,
          hint: 'Mở liên kết $url',
          onTap: () async {
            final uri = Uri.tryParse(url);
            if (uri == null ||
                !(uri.scheme == 'http' || uri.scheme == 'https')) {
              return;
            }
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          },
          underline: true,
        ),
      );
      index = match.end;
    }
    if (index < raw.length) {
      children.add(TextSpan(text: raw.substring(index)));
    }
    return children;
  }

  InlineSpan _inlineAction({
    required String text,
    required String hint,
    required VoidCallback onTap,
    bool underline = false,
  }) {
    return WidgetSpan(
      alignment: PlaceholderAlignment.baseline,
      baseline: TextBaseline.alphabetic,
      child: Semantics(
        button: true,
        label: hint,
        child: GestureDetector(
          onTap: onTap,
          child: Text(
            text,
            style: style.copyWith(
              fontWeight: FontWeight.w700,
              color: style.color == Colors.white
                  ? Colors.white
                  : const Color(0xFF3164E8),
              decoration: underline
                  ? TextDecoration.underline
                  : TextDecoration.none,
              decorationColor: style.color == Colors.white
                  ? Colors.white
                  : const Color(0xFF3164E8),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final children = <InlineSpan>[];
    for (final part in splitMessageMentions(text, members)) {
      if (part.isMention) {
        final candidate = members.cast<MentionCandidate?>().firstWhere(
          (member) =>
              member?.username.toLowerCase() == part.username?.toLowerCase(),
          orElse: () => null,
        );
        if (part.all || candidate == null || onMemberTap == null) {
          children.add(
            TextSpan(
              text: part.text,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          );
        } else {
          children.add(
            _inlineAction(
              text: part.text,
              hint: 'Xem hồ sơ @${candidate.username}',
              onTap: () => onMemberTap!(candidate),
            ),
          );
        }
      } else {
        children.addAll(_plainOrLinks(part.text));
      }
    }
    return Text.rich(TextSpan(children: children), style: style);
  }
}
