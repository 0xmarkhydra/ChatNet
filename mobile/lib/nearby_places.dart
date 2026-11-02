import 'dart:convert';
import 'dart:math' as math;

import 'package:http/http.dart' as http;

import 'api.dart';

const nearbyCategories = <String, String>{
  'all': 'Tất cả',
  'food': 'Ăn uống',
  'cafe': 'Cà phê',
  'services': 'Dịch vụ',
  'stay': 'Lưu trú',
  'health': 'Y tế',
  'education': 'Giáo dục',
  'shopping': 'Mua sắm',
};

List<Json> demoNearbyPlaces(double latitude, double longitude) {
  const samples = [
    ('Bếp Nhà Sài Gòn', 'food', 'Nhà hàng', 0.0021, -0.0012),
    ('The Workshop Coffee', 'cafe', 'Cà phê', -0.0014, 0.0023),
    ('Nhà thuốc Trung Tâm', 'health', 'Nhà thuốc', 0.0032, 0.0017),
    ('Nhà sách Thành Phố', 'shopping', 'Nhà sách', -0.0028, -0.0022),
    ('Thư viện Khoa học', 'education', 'Thư viện', 0.0010, 0.0038),
    ('SocCo Stay', 'stay', 'Khách sạn', -0.0036, 0.0011),
  ];
  return [
    for (var index = 0; index < samples.length; index++)
      {
        'id': 'demo:$index',
        'name': samples[index].$1,
        'category': samples[index].$2,
        'kind': samples[index].$3,
        'latitude': latitude + samples[index].$4,
        'longitude': longitude + samples[index].$5,
        'distanceKm': _distance(
          latitude,
          longitude,
          latitude + samples[index].$4,
          longitude + samples[index].$5,
        ),
        'address': '${index + 1} Nguyễn Huệ, Quận 1',
        'openingHours': index.isEven ? '08:00-22:00' : null,
      },
  ];
}

const _selectors = <String, List<String>>{
  'all': [
    '["amenity"~"restaurant|fast_food|food_court|cafe|hospital|clinic|pharmacy|doctors|dentist|school|kindergarten|college|university|library|marketplace"]',
    '["shop"]',
    '["tourism"~"hotel|hostel|guest_house|motel|apartment"]',
  ],
  'food': ['["amenity"~"restaurant|fast_food|food_court"]'],
  'cafe': ['["amenity"="cafe"]'],
  'services': [
    '["shop"~"hairdresser|beauty|laundry|dry_cleaning|car_repair|mobile_phone|computer|tailor"]',
    '["amenity"~"car_wash|bank|post_office"]',
  ],
  'stay': ['["tourism"~"hotel|hostel|guest_house|motel|apartment"]'],
  'health': ['["amenity"~"hospital|clinic|pharmacy|doctors|dentist"]'],
  'education': ['["amenity"~"school|kindergarten|college|university|library"]'],
  'shopping': ['["shop"]', '["amenity"="marketplace"]'],
};

Future<List<Json>> loadNearbyPlaces({
  required double latitude,
  required double longitude,
  required double radiusKm,
  required String category,
  http.Client? client,
}) async {
  final radius = (radiusKm * 1000).round().clamp(250, 5000);
  final selectors = _selectors[category] ?? _selectors['all']!;
  final query =
      '''[out:json][timeout:18];
(
${selectors.map((item) => 'nwr(around:$radius,$latitude,$longitude)$item;').join('\n')}
);
out center tags;''';
  final ownedClient = client == null;
  final httpClient = client ?? http.Client();
  Object? lastError;
  try {
    for (final endpoint in const [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ]) {
      try {
        final response = await httpClient
            .post(
              Uri.parse(endpoint),
              headers: {
                'Content-Type':
                    'application/x-www-form-urlencoded;charset=UTF-8',
              },
              body: {'data': query},
            )
            .timeout(const Duration(seconds: 14));
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw ApiError('OpenStreetMap trả HTTP ${response.statusCode}.');
        }
        final payload = object(jsonDecode(response.body));
        final seen = <String>{};
        final result = <Json>[];
        for (final raw in payload['elements'] as List? ?? const []) {
          final element = object(raw);
          final tags = object(element['tags'] ?? <String, dynamic>{});
          final center = object(element['center'] ?? <String, dynamic>{});
          final lat = (element['lat'] ?? center['lat']) as num?;
          final lon = (element['lon'] ?? center['lon']) as num?;
          final name =
              tags['name'] ??
              tags['name:vi'] ??
              tags['brand'] ??
              tags['operator'];
          final id = '${element['type']}:${element['id']}';
          if (lat == null || lon == null || name == null || !seen.add(id)) {
            continue;
          }
          final resolvedCategory = _classify(tags);
          result.add({
            'id': id,
            'name': name.toString(),
            'category': resolvedCategory,
            'latitude': lat.toDouble(),
            'longitude': lon.toDouble(),
            'distanceKm': _distance(
              latitude,
              longitude,
              lat.toDouble(),
              lon.toDouble(),
            ),
            'kind': _kind(tags, resolvedCategory),
            'address': [
              tags['addr:housenumber'],
              tags['addr:street'],
              tags['addr:suburb'],
              tags['addr:city'],
            ].whereType<String>().where((item) => item.isNotEmpty).join(', '),
            'openingHours': tags['opening_hours'],
          });
        }
        result.sort(
          (left, right) => (left['distanceKm'] as double).compareTo(
            right['distanceKm'] as double,
          ),
        );
        return result.take(80).toList();
      } catch (error) {
        lastError = error;
      }
    }
  } finally {
    if (ownedClient) httpClient.close();
  }
  throw ApiError(
    lastError is ApiError
        ? lastError.message
        : 'Chưa tải được địa điểm OpenStreetMap.',
  );
}

String _classify(Json tags) {
  final amenity = tags['amenity']?.toString() ?? '';
  final tourism = tags['tourism']?.toString() ?? '';
  final shop = tags['shop']?.toString() ?? '';
  if (RegExp(r'restaurant|fast_food|food_court').hasMatch(amenity)) {
    return 'food';
  }
  if (amenity == 'cafe') return 'cafe';
  if (RegExp(r'hospital|clinic|pharmacy|doctors|dentist').hasMatch(amenity)) {
    return 'health';
  }
  if (RegExp(
    r'school|kindergarten|college|university|library',
  ).hasMatch(amenity)) {
    return 'education';
  }
  if (RegExp(r'hotel|hostel|guest_house|motel|apartment').hasMatch(tourism)) {
    return 'stay';
  }
  if (shop.isNotEmpty) {
    return RegExp(
          r'hairdresser|beauty|laundry|dry_cleaning|car_repair|mobile_phone|computer|tailor',
        ).hasMatch(shop)
        ? 'services'
        : 'shopping';
  }
  if (RegExp(r'car_wash|bank|post_office').hasMatch(amenity)) {
    return 'services';
  }
  return amenity == 'marketplace' ? 'shopping' : 'all';
}

String _kind(Json tags, String category) {
  final raw =
      tags['amenity'] ??
      tags['shop'] ??
      tags['tourism'] ??
      nearbyCategories[category];
  return raw
      .toString()
      .split('_')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part.substring(0, 1).toUpperCase()}${part.substring(1)}',
      )
      .join(' ');
}

double _distance(double lat1, double lon1, double lat2, double lon2) {
  double radians(double value) => value * math.pi / 180;
  final dLat = radians(lat2 - lat1);
  final dLon = radians(lon2 - lon1);
  final a =
      math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(radians(lat1)) *
          math.cos(radians(lat2)) *
          math.sin(dLon / 2) *
          math.sin(dLon / 2);
  return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}
