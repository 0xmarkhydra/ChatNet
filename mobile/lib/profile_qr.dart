import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'api.dart';
import 'theme.dart';

Future<void> showProfileQr(
  BuildContext context, {
  required String username,
  required String displayName,
  required ValueChanged<String> onConnect,
  bool initialScan = false,
}) {
  return showDialog<void>(
    context: context,
    builder: (context) => _ProfileQrDialog(
      username: username,
      displayName: displayName,
      onConnect: onConnect,
      initialScan: initialScan,
    ),
  );
}

String profileFromQr(String value, String ownUsername) {
  final url = Uri.tryParse(value.trim());
  final origin = Uri.parse(Api.siteUrl);
  if (url == null ||
      !url.hasAuthority ||
      !const {'http', 'https'}.contains(url.scheme) ||
      url.userInfo.isNotEmpty ||
      url.scheme != origin.scheme ||
      url.host != origin.host ||
      url.port != origin.port ||
      url.queryParametersAll['connect']?.length != 1) {
    throw const FormatException('Link không phải hồ sơ SocCo hợp lệ.');
  }
  final username = url.queryParameters['connect'] ?? '';
  if (!RegExp(
    r'^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,30}[a-zA-Z0-9]$',
  ).hasMatch(username)) {
    throw const FormatException('Link không chứa username hợp lệ.');
  }
  if (username.toLowerCase() == ownUsername.toLowerCase()) {
    throw const FormatException('Đây là QR của bạn.');
  }
  return username;
}

class _ProfileQrDialog extends StatefulWidget {
  const _ProfileQrDialog({
    required this.username,
    required this.displayName,
    required this.onConnect,
    required this.initialScan,
  });

  final String username;
  final String displayName;
  final ValueChanged<String> onConnect;
  final bool initialScan;

  @override
  State<_ProfileQrDialog> createState() => _ProfileQrDialogState();
}

class _ProfileQrDialogState extends State<_ProfileQrDialog> {
  late String mode = widget.initialScan ? 'scan' : 'mine';
  late bool camera = widget.initialScan;
  final controller = TextEditingController();
  final scanner = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  String match = '';
  String message = '';
  bool reading = false;

  String get url => '${Api.siteUrl}/?connect=${widget.username}';

  void _read() {
    _readValue(controller.text);
  }

  void _readValue(String value) {
    try {
      final username = profileFromQr(value, widget.username);
      setState(() {
        controller.text = value;
        match = username;
        message = '';
        camera = false;
      });
      scanner.stop();
    } on FormatException catch (error) {
      setState(() {
        match = '';
        message = error.message;
      });
    }
  }

  Future<void> _paste() async {
    final value = await Clipboard.getData(Clipboard.kTextPlain);
    if (!mounted) return;
    controller.text = value?.text ?? '';
    _read();
  }

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: url));
    if (mounted) setState(() => message = 'Đã sao chép link hồ sơ.');
  }

  void _detect(BarcodeCapture capture) {
    if (capture.barcodes.isEmpty) return;
    final value = capture.barcodes.first.rawValue;
    if (value != null && value.isNotEmpty) _readValue(value);
  }

  Future<void> _pickQr() async {
    if (kIsWeb) {
      setState(
        () => message =
            'Bản web dùng camera hoặc dán link. Ứng dụng native đọc được ảnh QR.',
      );
      return;
    }
    final file = await FilePicker.pickFile(type: FileType.image);
    final path = file?.path;
    if (path == null || !mounted) return;
    setState(() => reading = true);
    try {
      final capture = await scanner.analyzeImage(path);
      final value = capture?.barcodes.firstOrNull?.rawValue;
      if (value == null || value.isEmpty) {
        throw const FormatException('Không tìm thấy mã QR trong ảnh.');
      }
      _readValue(value);
    } on FormatException catch (error) {
      if (mounted) setState(() => message = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => message = 'Không đọc được ảnh QR này.');
      }
    } finally {
      if (mounted) setState(() => reading = false);
    }
  }

  @override
  void dispose() {
    controller.dispose();
    scanner.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Kết nối bằng QR'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                    value: 'mine',
                    icon: Icon(Icons.qr_code_2_rounded),
                    label: Text('QR của tôi'),
                  ),
                  ButtonSegment(
                    value: 'scan',
                    icon: Icon(Icons.qr_code_scanner_rounded),
                    label: Text('Kết nối'),
                  ),
                ],
                selected: {mode},
                onSelectionChanged: (value) {
                  setState(() {
                    mode = value.first;
                    camera = value.first == 'scan';
                    match = '';
                    message = '';
                  });
                },
              ),
              const SizedBox(height: 20),
              if (mode == 'mine') ...[
                Text(
                  widget.displayName,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Text(
                  '@${widget.username}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 14),
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: socoLine),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: QrImageView(
                      data: url,
                      size: 230,
                      eyeStyle: const QrEyeStyle(
                        eyeShape: QrEyeShape.square,
                        color: socoBlue,
                      ),
                      dataModuleStyle: const QrDataModuleStyle(
                        dataModuleShape: QrDataModuleShape.square,
                        color: socoNavy,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: _copy,
                  icon: const Icon(Icons.link_rounded),
                  label: const Text('Sao chép link hồ sơ'),
                ),
              ] else ...[
                if (camera)
                  AspectRatio(
                    aspectRatio: 4 / 3,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          MobileScanner(
                            controller: scanner,
                            onDetect: _detect,
                            errorBuilder: (_, error) => ColoredBox(
                              color: socoNavy,
                              child: Center(
                                child: Padding(
                                  padding: const EdgeInsets.all(20),
                                  child: Text(
                                    'Không mở được camera: ${error.errorCode.name}',
                                    style: const TextStyle(color: Colors.white),
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Center(
                            child: Container(
                              width: 190,
                              height: 190,
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: Colors.white,
                                  width: 3,
                                ),
                                borderRadius: BorderRadius.circular(18),
                              ),
                            ),
                          ),
                          Positioned(
                            right: 8,
                            top: 8,
                            child: IconButton(
                              tooltip: 'Tắt camera',
                              onPressed: () {
                                scanner.stop();
                                setState(() => camera = false);
                              },
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
                  )
                else
                  OutlinedButton.icon(
                    onPressed: () {
                      setState(() => camera = true);
                      scanner.start();
                    },
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('Mở camera quét QR'),
                  ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: reading ? null : _pickQr,
                        icon: const Icon(Icons.image_outlined),
                        label: Text(reading ? 'Đang đọc...' : 'Chọn ảnh QR'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _paste,
                        icon: const Icon(Icons.content_paste_rounded),
                        label: const Text('Dán link'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: controller,
                  keyboardType: TextInputType.url,
                  onSubmitted: (_) => _read(),
                  decoration: InputDecoration(
                    labelText: 'Link hồ sơ SocCo',
                    hintText: '${Api.siteUrl}/?connect=username',
                    suffixIcon: IconButton(
                      tooltip: 'Dán từ clipboard',
                      onPressed: _paste,
                      icon: const Icon(Icons.content_paste_rounded),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: match.isEmpty
                      ? FilledButton.icon(
                          onPressed: _read,
                          icon: const Icon(Icons.search_rounded),
                          label: const Text('Kiểm tra link'),
                        )
                      : FilledButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            widget.onConnect(match);
                          },
                          icon: const Icon(Icons.person_add_alt_1_rounded),
                          label: Text('Kết nối @$match'),
                        ),
                ),
              ],
              if (message.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    message,
                    style: TextStyle(
                      color: message.startsWith('Đã')
                          ? const Color(0xFF15803D)
                          : const Color(0xFFBE123C),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Đóng'),
        ),
      ],
    );
  }
}
