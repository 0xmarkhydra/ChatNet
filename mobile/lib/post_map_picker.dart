import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import 'public_post_location.dart';

Future<String?> choosePostMapLocation(BuildContext context, String previous) =>
    showDialog<String>(
      context: context,
      builder: (_) => _PostMapPicker(previous: previous),
    );

class _PostMapPicker extends StatefulWidget {
  const _PostMapPicker({required this.previous});
  final String previous;
  @override
  State<_PostMapPicker> createState() => _PostMapPickerState();
}

class _PostMapPickerState extends State<_PostMapPicker> {
  final controller = MapController();
  late final TextEditingController name;
  LatLng? selected;
  bool locating = false;
  String error = '';

  @override
  void initState() {
    super.initState();
    final pin = parseMapCheckIn(widget.previous);
    selected = pin == null ? null : LatLng(pin.latitude, pin.longitude);
    name = TextEditingController(text: pin?.name ?? '');
  }

  @override
  void dispose() {
    name.dispose();
    controller.dispose();
    super.dispose();
  }

  Future<void> locate() async {
    setState(() {
      locating = true;
      error = '';
    });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception('Location denied');
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          timeLimit: Duration(seconds: 8),
        ),
      );
      if (mounted) {
        controller.move(LatLng(position.latitude, position.longitude), 15);
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => error =
              'Không lấy được vị trí hiện tại. Bạn vẫn có thể chọn trên bản đồ.',
        );
      }
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final point = selected;
    return AlertDialog(
      title: const Text('Chọn vị trí trên bản đồ'),
      contentPadding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Di chuyển bản đồ và chạm để ghim. Không cần bật GPS.',
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 280,
                child: Stack(
                  children: [
                    FlutterMap(
                      mapController: controller,
                      options: MapOptions(
                        initialCenter: point ?? const LatLng(21.03, 105.85),
                        initialZoom: 13,
                        minZoom: 3,
                        maxZoom: 19,
                        onTap: (_, location) => setState(() {
                          selected = location;
                          name.clear();
                        }),
                      ),
                      children: [
                        TileLayer(
                          urlTemplate:
                              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'vn.soco.mobile',
                        ),
                        if (point != null)
                          MarkerLayer(
                            markers: [
                              Marker(
                                point: point,
                                width: 42,
                                height: 42,
                                child: const Icon(
                                  Icons.location_on,
                                  size: 38,
                                  color: Color(0xFF2464BA),
                                ),
                              ),
                            ],
                          ),
                        const Positioned(
                          right: 4,
                          bottom: 4,
                          child: ColoredBox(
                            color: Colors.white,
                            child: Text(
                              '© OpenStreetMap contributors',
                              style: TextStyle(fontSize: 10),
                            ),
                          ),
                        ),
                      ],
                    ),
                    Positioned(
                      left: 8,
                      top: 8,
                      child: Material(
                        color: Colors.white,
                        shape: const CircleBorder(),
                        child: IconButton(
                          tooltip: 'Về vị trí của tôi',
                          onPressed: locating ? null : locate,
                          icon: const Icon(Icons.my_location),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (error.isNotEmpty) Text(error),
              if (point != null)
                Text(
                  '${point.latitude.toStringAsFixed(6)}, ${point.longitude.toStringAsFixed(6)}',
                ),
              TextField(
                controller: name,
                enabled: point != null,
                maxLength: 120,
                decoration: const InputDecoration(
                  labelText: 'Tên địa điểm (không bắt buộc)',
                ),
              ),
              const Text('Chỉ người có quyền xem bài viết mới thấy vị trí.'),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context, ''),
          child: const Text('Xóa'),
        ),
        FilledButton(
          onPressed: point == null
              ? null
              : () => Navigator.pop(
                  context,
                  formatMapCheckIn(
                    MapCheckIn(name.text, point.latitude, point.longitude),
                  ),
                ),
          child: const Text('Xác nhận'),
        ),
      ],
    );
  }
}