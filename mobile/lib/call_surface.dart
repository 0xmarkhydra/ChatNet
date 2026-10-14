import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';
import 'widgets.dart';

Future<void> showCallSurface(
  BuildContext context, {
  required Json conversation,
  required bool video,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (context) =>
        _CallSurface(conversation: conversation, video: video),
  );
}

class _CallSurface extends StatefulWidget {
  const _CallSurface({required this.conversation, required this.video});

  final Json conversation;
  final bool video;

  @override
  State<_CallSurface> createState() => _CallSurfaceState();
}

class _CallSurfaceState extends State<_CallSurface> {
  Timer? connectingTimer;
  Timer? durationTimer;
  int seconds = 0;
  bool connected = false;
  bool micOn = true;
  bool cameraOn = true;
  bool speakerOn = true;

  @override
  void initState() {
    super.initState();
    cameraOn = widget.video;
    connectingTimer = Timer(const Duration(milliseconds: 1200), () {
      if (!mounted) return;
      setState(() => connected = true);
      durationTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => seconds++);
      });
    });
  }

  @override
  void dispose() {
    connectingTimer?.cancel();
    durationTimer?.cancel();
    super.dispose();
  }

  String get duration {
    final minutes = seconds ~/ 60;
    final remainder = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:'
        '${remainder.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.conversation['name']?.toString() ?? 'Cuộc trò chuyện';
    final group = widget.conversation['type'] == 'group';
    return Dialog.fullscreen(
      backgroundColor: const Color(0xFF101827),
      child: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(child: CustomPaint(painter: _CallBackdrop())),
            Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.lock_outline_rounded,
                        color: Color(0xFF63E6BE),
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'SOCO SECURE CALL',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        connected ? duration : 'Đang kết nối...',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 880),
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: widget.video && cameraOn
                            ? _VideoStage(
                                name: name,
                                group: group,
                                connected: connected,
                              )
                            : _AudioStage(
                                name: name,
                                group: group,
                                connected: connected,
                              ),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
                  child: Wrap(
                    spacing: 14,
                    runSpacing: 10,
                    alignment: WrapAlignment.center,
                    children: [
                      _CallButton(
                        label: micOn ? 'Tắt mic' : 'Bật mic',
                        icon: micOn ? Icons.mic_rounded : Icons.mic_off_rounded,
                        active: micOn,
                        onPressed: () => setState(() => micOn = !micOn),
                      ),
                      if (widget.video)
                        _CallButton(
                          label: cameraOn ? 'Tắt camera' : 'Bật camera',
                          icon: cameraOn
                              ? Icons.videocam_rounded
                              : Icons.videocam_off_rounded,
                          active: cameraOn,
                          onPressed: () => setState(() => cameraOn = !cameraOn),
                        ),
                      _CallButton(
                        label: speakerOn ? 'Loa' : 'Im lặng',
                        icon: speakerOn
                            ? Icons.volume_up_rounded
                            : Icons.volume_off_rounded,
                        active: speakerOn,
                        onPressed: () => setState(() => speakerOn = !speakerOn),
                      ),
                      if (widget.video)
                        _CallButton(
                          label: 'Đổi camera',
                          icon: Icons.cameraswitch_rounded,
                          active: true,
                          onPressed: () {},
                        ),
                      _CallButton(
                        label: 'Kết thúc',
                        icon: Icons.call_end_rounded,
                        danger: true,
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AudioStage extends StatelessWidget {
  const _AudioStage({
    required this.name,
    required this.group,
    required this.connected,
  });

  final String name;
  final bool group;
  final bool connected;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        UserAvatar(name: name, size: 132, group: group, online: connected),
        const SizedBox(height: 24),
        Text(
          name,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 28,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          connected ? 'Đã kết nối' : 'Đang gọi...',
          style: const TextStyle(color: Colors.white60, fontSize: 16),
        ),
      ],
    );
  }
}

class _VideoStage extends StatelessWidget {
  const _VideoStage({
    required this.name,
    required this.group,
    required this.connected,
  });

  final String name;
  final bool group;
  final bool connected;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 4 / 3,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFF1D293A),
          border: Border.all(color: Colors.white12),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Stack(
          children: [
            Center(
              child: _AudioStage(
                name: name,
                group: group,
                connected: connected,
              ),
            ),
            Positioned(
              top: 14,
              right: 14,
              child: Container(
                width: 112,
                height: 150,
                decoration: BoxDecoration(
                  color: const Color(0xFF26364D),
                  border: Border.all(color: Colors.white24),
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: const Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: socoBlue,
                      child: Text(
                        'MA',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    SizedBox(height: 8),
                    Text('Bạn', style: TextStyle(color: Colors.white70)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CallButton extends StatelessWidget {
  const _CallButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.active = false,
    this.danger = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool active;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger
        ? const Color(0xFFE11D48)
        : active
        ? Colors.white
        : Colors.white24;
    return Semantics(
      button: true,
      label: label,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            tooltip: label,
            onPressed: onPressed,
            icon: Icon(icon),
            style: IconButton.styleFrom(
              minimumSize: const Size.square(56),
              foregroundColor: danger ? Colors.white : const Color(0xFF101827),
              backgroundColor: color,
              shape: const CircleBorder(),
            ),
          ),
          const SizedBox(height: 5),
          Text(
            label,
            style: const TextStyle(color: Colors.white70, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _CallBackdrop extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader = const RadialGradient(
        center: Alignment.topLeft,
        radius: 1.4,
        colors: [Color(0xFF244C88), Color(0xFF101827)],
      ).createShader(Offset.zero & size);
    canvas.drawRect(Offset.zero & size, paint);
    final grid = Paint()
      ..color = Colors.white.withValues(alpha: .035)
      ..strokeWidth = 1;
    for (var x = 0.0; x < size.width; x += 48) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (var y = 0.0; y < size.height; y += 48) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
