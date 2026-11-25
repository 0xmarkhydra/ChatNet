import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

const publicPostLocationNotice =
    'Khi đăng công khai, vị trí tốt nhất từ GPS hoặc mạng sẽ được chia sẻ. Nếu chưa đạt 10 m, tên khu vực có thể thiếu chính xác; sai số được lưu kèm vị trí. Tọa độ được gửi đến BigDataCloud để lấy tên khu vực. Chọn Bạn bè hoặc Chỉ mình tôi nếu không muốn chia sẻ.';

Future<Map<String, dynamic>> capturePublicPostLocation() async {
  if (!kIsWeb) {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw Exception('Bạn cần cấp quyền vị trí để đăng bài công khai.');
    }
  }
  final completer = Completer<Map<String, dynamic>>();
  Position? best;
  StreamSubscription<Position>? subscription;
  Timer? deadline;
  Timer? improvement;
  void finish([Object? error]) {
    if (completer.isCompleted) return;
    deadline?.cancel();
    improvement?.cancel();
    unawaited(subscription?.cancel());
    final position = best;
    if (error != null) {
      completer.completeError(error);
    } else if (position == null) {
      completer.completeError(
        Exception(
          'Không xác định được vị trí. Hãy bật dịch vụ vị trí, Wi-Fi hoặc dữ liệu di động và thử lại.',
        ),
      );
    } else {
      completer.complete({
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'capturedAt': position.timestamp.toUtc().toIso8601String(),
      });
    }
  }

  void accept(Position position) {
    if (completer.isCompleted) return;
    final age = DateTime.now().difference(position.timestamp);
    if (!position.latitude.isFinite ||
        !position.longitude.isFinite ||
        position.latitude.abs() > 90 ||
        position.longitude.abs() > 180 ||
        !position.accuracy.isFinite ||
        position.accuracy <= 0 ||
        position.accuracy > 20040000 ||
        position.isMocked ||
        age > const Duration(minutes: 2) ||
        age < const Duration(seconds: -15)) {
      return;
    }
    if (best == null || position.accuracy < best!.accuracy) best = position;
    if (best!.accuracy <= 10) {
      finish();
    } else {
      improvement ??= Timer(const Duration(seconds: 5), finish);
    }
  }

  void handleError(Object error) {
    if (error is PermissionDeniedException) {
      finish(Exception('Bạn cần cấp quyền vị trí để đăng bài công khai.'));
    }
  }

  deadline = Timer(const Duration(seconds: 20), finish);
  try {
    subscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.best),
    ).listen(accept, onError: handleError);
  } catch (error) {
    handleError(error);
  }
  if (!completer.isCompleted) {
    unawaited(() async {
      try {
        accept(
          await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.medium,
              timeLimit: Duration(seconds: 20),
            ),
          ),
        );
      } catch (error) {
        handleError(error);
      }
    }());
  }
  return resolvePublishPlace(await completer.future);
}

String locationPlaceName(Map<dynamic, dynamic> data, num accuracy) {
  final keys = accuracy > 50000
      ? ['principalSubdivision', 'countryName']
      : accuracy > 10000
      ? ['city', 'principalSubdivision', 'countryName']
      : ['locality', 'city', 'principalSubdivision', 'countryName'];
  final names = <String>{};
  for (final key in keys) {
    final value = data[key];
    if (value is String && value.trim().isNotEmpty) names.add(value.trim());
  }
  return String.fromCharCodes(names.take(2).join(', ').runes.take(160));
}

Future<Map<String, dynamic>> resolvePublishPlace(
  Map<String, dynamic> location,
) async {
  final client = http.Client();
  try {
    final response = await client
        .get(
          Uri.https('api.bigdatacloud.net', '/data/reverse-geocode-client', {
            'latitude': location['latitude'].toString(),
            'longitude': location['longitude'].toString(),
            'localityLanguage': 'vi',
          }),
        )
        .timeout(const Duration(milliseconds: 3500));
    if (response.statusCode != 200) return location;
    final data = jsonDecode(utf8.decode(response.bodyBytes));
    if (data is! Map) return location;
    final name = locationPlaceName(data, location['accuracy'] as num);
    return name.isEmpty ? location : {...location, 'placeName': name};
  } catch (_) {
    return location;
  } finally {
    client.close();
  }
}

class PublicPostLocationLink extends StatelessWidget {
  const PublicPostLocationLink({super.key, required this.post});
  final Map<String, dynamic> post;
  @override
  Widget build(BuildContext context) {
    final location = post['publishLocation'];
    if (post['visibility'] != 'public' || location is! Map) {
      return const SizedBox.shrink();
    }
    final latitude = location['latitude'];
    final longitude = location['longitude'];
    final accuracy = location['accuracy'];
    if (latitude is! num ||
        longitude is! num ||
        accuracy is! num ||
        !accuracy.isFinite) {
      return const SizedBox.shrink();
    }
    final name = location['placeName'];
    final label = name is String && name.trim().isNotEmpty
        ? 'Đang ở ${name.trim()}'
        : 'Đang ở vị trí đã chia sẻ';
    return ActionChip(
      avatar: const Icon(Icons.location_on_outlined, size: 16),
      tooltip: 'Sai số ±${accuracy.ceil()} m · Mở bản đồ',
      onPressed: () => launchUrl(
        Uri.https('www.google.com', '/maps/search/', {
          'api': '1',
          'query': '$latitude,$longitude',
        }),
      ),
      label: Text(
        label,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodySmall,
      ),
    );
  }
}
