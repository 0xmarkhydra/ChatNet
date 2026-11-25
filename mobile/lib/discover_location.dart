import 'package:geolocator/geolocator.dart';

import 'api.dart';

Future<({double latitude, double longitude})> resolveDiscoverPosition({
  required bool isDemo,
}) async {
  if (isDemo) {
    return (latitude: 10.7769, longitude: 106.7009);
  }
  if (!await Geolocator.isLocationServiceEnabled()) {
    throw const ApiError(
      'Dịch vụ vị trí đang tắt. Bật GPS để khám phá quanh đây.',
    );
  }
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    throw const ApiError('Cần quyền vị trí để khám phá quanh đây.');
  }
  final value = await Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      timeLimit: Duration(seconds: 15),
    ),
  );
  if (!value.latitude.isFinite ||
      !value.longitude.isFinite ||
      value.latitude.abs() > 85.05112878 ||
      value.longitude.abs() > 180) {
    throw const ApiError(
      'Tọa độ thiết bị không hợp lệ. Kiểm tra vị trí giả lập.',
    );
  }
  return (latitude: value.latitude, longitude: value.longitude);
}
