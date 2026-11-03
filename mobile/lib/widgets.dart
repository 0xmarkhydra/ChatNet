import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';

enum SocoIconType {
  search,
  qr,
  plus,
  compose,
  bell,
  chat,
  contacts,
  discover,
  feed,
  profile,
  attach,
  send,
  photo,
  video,
  album,
  text,
}

class SocoIcon extends StatelessWidget {
  const SocoIcon(this.type, {super.key, this.size = 24});

  final SocoIconType type;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(
        painter: _SocoIconPainter(
          type,
          IconTheme.of(context).color ?? socoMuted,
        ),
      ),
    );
  }
}

class _SocoIconPainter extends CustomPainter {
  const _SocoIconPainter(this.type, this.color);

  final SocoIconType type;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 24;
    canvas.scale(scale);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.9
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    switch (type) {
      case SocoIconType.search:
        canvas.drawCircle(const Offset(11, 11), 7, paint);
        canvas.drawLine(const Offset(15.8, 15.8), const Offset(20, 20), paint);
      case SocoIconType.qr:
        final path = Path()
          ..moveTo(4, 9)
          ..lineTo(4, 4)
          ..lineTo(9, 4)
          ..moveTo(15, 4)
          ..lineTo(20, 4)
          ..lineTo(20, 9)
          ..moveTo(20, 15)
          ..lineTo(20, 20)
          ..lineTo(15, 20)
          ..moveTo(9, 20)
          ..lineTo(4, 20)
          ..lineTo(4, 15);
        canvas.drawPath(path, paint);
        canvas.drawRect(const Rect.fromLTWH(8, 8, 3, 3), paint);
        canvas.drawLine(const Offset(14, 8), const Offset(16, 8), paint);
        canvas.drawLine(const Offset(14, 11), const Offset(17, 11), paint);
        canvas.drawLine(const Offset(8, 14), const Offset(10, 14), paint);
        canvas.drawPath(
          Path()
            ..moveTo(12, 14)
            ..lineTo(16, 14)
            ..lineTo(16, 18)
            ..moveTo(8, 17)
            ..lineTo(9, 17)
            ..moveTo(18, 12)
            ..lineTo(20, 12),
          paint,
        );
      case SocoIconType.plus:
        canvas.drawLine(const Offset(12, 5), const Offset(12, 19), paint);
        canvas.drawLine(const Offset(5, 12), const Offset(19, 12), paint);
      case SocoIconType.compose:
        canvas.drawPath(
          Path()
            ..moveTo(4, 20)
            ..lineTo(8, 20)
            ..lineTo(19, 9)
            ..cubicTo(21.7, 6.3, 17.7, 2.3, 15, 5)
            ..lineTo(4, 16)
            ..close(),
          paint,
        );
        canvas.drawLine(
          const Offset(13.5, 6.5),
          const Offset(17.5, 10.5),
          paint,
        );
      case SocoIconType.bell:
        canvas.drawPath(
          Path()
            ..moveTo(18, 8)
            ..cubicTo(18, 4.5, 15.5, 2, 12, 2)
            ..cubicTo(8.5, 2, 6, 4.5, 6, 8)
            ..cubicTo(6, 15, 3, 15, 3, 17)
            ..lineTo(21, 17)
            ..cubicTo(21, 15, 18, 15, 18, 8),
          paint,
        );
        canvas.drawLine(const Offset(10, 21), const Offset(14, 21), paint);
      case SocoIconType.chat:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(4, 5, 16, 11),
            const Radius.circular(1),
          ),
          paint,
        );
        canvas.drawPath(
          Path()
            ..moveTo(9, 16)
            ..lineTo(4, 20)
            ..lineTo(4, 16),
          paint,
        );
        canvas.drawLine(const Offset(8, 9), const Offset(16, 9), paint);
        canvas.drawLine(const Offset(8, 12), const Offset(13, 12), paint);
      case SocoIconType.contacts:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(4, 3, 16, 18),
            const Radius.circular(2),
          ),
          paint,
        );
        canvas.drawCircle(const Offset(12, 9), 2.5, paint);
        canvas.drawPath(
          Path()
            ..moveTo(8, 17)
            ..cubicTo(8.7, 14.6, 10, 13.5, 12, 13.5)
            ..cubicTo(14, 13.5, 15.3, 14.6, 16, 17),
          paint,
        );
      case SocoIconType.discover:
        canvas.drawCircle(const Offset(12, 12), 9, paint);
        canvas.drawCircle(const Offset(12, 12), 5, paint);
        canvas.drawLine(const Offset(12, 12), const Offset(19, 5), paint);
        canvas.drawCircle(const Offset(12, 12), 1, paint);
      case SocoIconType.feed:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3, 5, 18, 14),
            const Radius.circular(2),
          ),
          paint,
        );
        canvas.drawLine(const Offset(7, 9), const Offset(13, 9), paint);
        canvas.drawLine(const Offset(7, 13), const Offset(17, 13), paint);
        canvas.drawCircle(const Offset(17, 9), .2, paint);
      case SocoIconType.profile:
        canvas.drawCircle(const Offset(12, 8), 4, paint);
        canvas.drawPath(
          Path()
            ..moveTo(4.5, 21)
            ..cubicTo(5.3, 16.5, 7.8, 14.5, 12, 14.5)
            ..cubicTo(16.2, 14.5, 18.7, 16.5, 19.5, 21),
          paint,
        );
      case SocoIconType.attach:
        canvas.drawPath(
          Path()
            ..moveTo(9.5, 12.5)
            ..lineTo(15.3, 6.7)
            ..cubicTo(18.3, 3.7, 22.8, 8.2, 19.8, 11.2)
            ..lineTo(11.4, 19.6)
            ..cubicTo(6.7, 24.3, -.4, 17.2, 4.3, 12.5)
            ..lineTo(12.3, 4.5),
          paint,
        );
      case SocoIconType.send:
        canvas.drawPath(
          Path()
            ..moveTo(4, 4)
            ..lineTo(21, 12)
            ..lineTo(4, 20)
            ..lineTo(7, 12)
            ..close(),
          paint,
        );
        canvas.drawLine(const Offset(7, 12), const Offset(21, 12), paint);
      case SocoIconType.photo:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3, 4, 18, 16),
            const Radius.circular(2),
          ),
          paint,
        );
        canvas.drawCircle(const Offset(9, 9), 2, paint);
        canvas.drawPath(
          Path()
            ..moveTo(5, 18)
            ..lineTo(10, 13)
            ..lineTo(13, 16)
            ..lineTo(15, 14)
            ..lineTo(19, 18),
          paint,
        );
      case SocoIconType.video:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3, 6, 13, 12),
            const Radius.circular(2),
          ),
          paint,
        );
        canvas.drawPath(
          Path()
            ..moveTo(16, 10)
            ..lineTo(21, 7)
            ..lineTo(21, 17)
            ..lineTo(16, 14),
          paint,
        );
      case SocoIconType.album:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(5, 4, 14, 16),
            const Radius.circular(2),
          ),
          paint,
        );
        canvas.drawPath(
          Path()
            ..moveTo(9, 4)
            ..lineTo(9, 2)
            ..lineTo(17, 2)
            ..cubicTo(18.1, 2, 19, 2.9, 19, 4)
            ..moveTo(8, 15)
            ..lineTo(11, 12)
            ..lineTo(15, 16)
            ..lineTo(17, 14),
          paint,
        );
      case SocoIconType.text:
        canvas.drawLine(const Offset(5, 6), const Offset(19, 6), paint);
        canvas.drawLine(const Offset(12, 6), const Offset(12, 18), paint);
        canvas.drawLine(const Offset(8, 18), const Offset(16, 18), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SocoIconPainter oldDelegate) =>
      oldDelegate.type != type || oldDelegate.color != color;
}

class SocoLogo extends StatelessWidget {
  const SocoLogo({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'SocCo',
      image: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(size * .28),
          boxShadow: const [
            BoxShadow(
              color: Color(0x241A49BC),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: SizedBox.square(
          dimension: size,
          child: CustomPaint(painter: _LogoPainter()),
        ),
      ),
    );
  }
}

class _LogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * .18
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFF126DF7),
          Color(0xFF0988F5),
          Color(0xFF8B5CF6),
          Color(0xFFEF4DBB),
          Color(0xFFFF9F0E),
        ],
      ).createShader(Offset.zero & size);
    final path = Path()
      ..moveTo(size.width * .74, size.height * .25)
      ..cubicTo(
        size.width * .63,
        size.height * .16,
        size.width * .39,
        size.height * .15,
        size.width * .29,
        size.height * .25,
      )
      ..cubicTo(
        size.width * .16,
        size.height * .40,
        size.width * .31,
        size.height * .53,
        size.width * .51,
        size.height * .52,
      )
      ..cubicTo(
        size.width * .78,
        size.height * .52,
        size.width * .79,
        size.height * .73,
        size.width * .59,
        size.height * .79,
      )
      ..cubicTo(
        size.width * .42,
        size.height * .84,
        size.width * .27,
        size.height * .75,
        size.width * .18,
        size.height * .67,
      );
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class GradientText extends StatelessWidget {
  const GradientText(this.text, {super.key, this.style});

  final String text;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      shaderCallback: socoGradient.createShader,
      blendMode: BlendMode.srcIn,
      child: Text(text, style: style),
    );
  }
}

class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.name,
    this.size = 48,
    this.online = false,
    this.group = false,
    this.imageUrl,
    this.username,
    this.fetchProfileImage = true,
    this.circular = false,
  });

  final String name;
  final double size;
  final bool online;
  final bool group;
  final String? imageUrl;
  final String? username;
  final bool fetchProfileImage;
  final bool circular;

  @override
  Widget build(BuildContext context) {
    final account = username ?? name;
    final resolvedImageUrl =
        imageUrl ??
        (fetchProfileImage &&
                !group &&
                RegExp(
                  r'^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,30}[a-zA-Z0-9]$',
                ).hasMatch(account)
            ? profileAssetUrl(account, 'avatar')
            : null);
    final initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part.characters.first.toUpperCase())
        .join();
    return SizedBox.square(
      dimension: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: group
                    ? const LinearGradient(
                        colors: [Color(0xFFEDE8FF), Color(0xFFD9E8FF)],
                      )
                    : const LinearGradient(
                        colors: [Color(0xFFE5F6FF), Color(0xFFEADFFF)],
                      ),
                shape: circular ? BoxShape.circle : BoxShape.rectangle,
                borderRadius: circular
                    ? null
                    : BorderRadius.circular(size * .34),
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x1A2F55B7),
                    blurRadius: 14,
                    offset: Offset(0, 5),
                  ),
                ],
              ),
              child: resolvedImageUrl == null
                  ? Center(
                      child: Text(
                        initials.isEmpty ? '?' : initials,
                        style: TextStyle(
                          color: group
                              ? const Color(0xFF7650DC)
                              : const Color(0xFF3556E8),
                          fontSize: size * .32,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    )
                  : ClipRRect(
                      borderRadius: circular
                          ? BorderRadius.circular(size)
                          : BorderRadius.circular(size * .32),
                      child: Image.network(
                        resolvedImageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Center(
                          child: Text(
                            initials,
                            style: TextStyle(
                              color: socoBlue,
                              fontSize: size * .32,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ),
            ),
          ),
          if (online)
            Positioned(
              right: -1,
              bottom: -1,
              child: Container(
                width: math.max(12, size * .27),
                height: math.max(12, size * .27),
                decoration: BoxDecoration(
                  color: const Color(0xFF22C55E),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2.5),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class SectionHeading extends StatelessWidget {
  const SectionHeading({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.description,
    this.action,
  });

  final String eyebrow;
  final String title;
  final String description;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  eyebrow,
                  style: const TextStyle(
                    color: socoBlue,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(title, style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 3),
                Text(description, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          ?action,
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.action,
  });

  final IconData icon;
  final String title;
  final String description;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 340),
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEFF4FF), Color(0xFFF2EEFF)],
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Icon(icon, color: socoBlue, size: 30),
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                description,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (action != null) ...[const SizedBox(height: 18), action!],
            ],
          ),
        ),
      ),
    );
  }
}

String displayTime(dynamic value) {
  final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
  if (date == null) return '';
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$hour:$minute';
}

String displayDateTime(dynamic value) {
  final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
  if (date == null) return '';
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$hour:$minute · ${date.day}/${date.month}/${date.year}';
}
