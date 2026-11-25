import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:soco/api.dart';
import 'package:soco/nearby_places.dart';

void main() {
  test('posts filtered query and maps valid Overpass places', () async {
    final requests = <http.Request>[];
    final client = MockClient((request) async {
      requests.add(request);
      return http.Response(
        jsonEncode({
          'elements': [
            {
              'type': 'node',
              'id': 1,
              'lat': 21.0285,
              'lon': 105.8542,
              'tags': {
                'name': 'Cafe One',
                'amenity': 'cafe',
                'addr:housenumber': '12',
                'addr:street': 'Hang Bai',
                'addr:suburb': 'Hoan Kiem',
                'addr:city': 'Hanoi',
                'opening_hours': 'Mo-Su 08:00-22:00',
              },
            },
            {
              'type': 'way',
              'id': 2,
              'center': {'lat': 21.0286, 'lon': 105.8543},
              'tags': {'name:vi': 'Hieu sach', 'shop': 'books'},
            },
            {
              'type': 'way',
              'id': 2,
              'center': {'lat': 22.0, 'lon': 106.0},
              'tags': {'name': 'Duplicate', 'shop': 'books'},
            },
            {
              'type': 'node',
              'id': 3,
              'lat': 21.0287,
              'lon': 105.8544,
              'tags': {'shop': 'books'},
            },
            {
              'type': 'node',
              'id': 4,
              'tags': {'name': 'Missing coordinates', 'shop': 'books'},
            },
          ],
        }),
        200,
      );
    });
    addTearDown(client.close);

    final places = await loadNearbyPlaces(
      latitude: 21.0285,
      longitude: 105.8542,
      radiusKm: 0.1,
      category: 'cafe',
      client: client,
    );

    expect(requests, hasLength(1));
    final request = requests.single;
    expect(request.method, 'POST');
    expect(request.url.toString(), 'https://overpass-api.de/api/interpreter');
    expect(
      request.headers.entries.any(
        (entry) =>
            entry.key.toLowerCase() == 'content-type' &&
            entry.value == 'application/x-www-form-urlencoded;charset=UTF-8',
      ),
      isTrue,
    );
    final query = request.bodyFields['data']!;
    expect(query, startsWith('[out:json][timeout:18];'));
    expect(
      query,
      contains('nwr(around:250,21.0285,105.8542)["amenity"="cafe"];'),
    );
    expect(query, endsWith('out center tags;'));

    expect(places.map((place) => place['id']), ['node:1', 'way:2']);
    expect(places.first, {
      'id': 'node:1',
      'name': 'Cafe One',
      'category': 'cafe',
      'latitude': 21.0285,
      'longitude': 105.8542,
      'distanceKm': 0.0,
      'kind': 'Cafe',
      'address': '12, Hang Bai, Hoan Kiem, Hanoi',
      'openingHours': 'Mo-Su 08:00-22:00',
    });
    expect(places[1]['name'], 'Hieu sach');
    expect(places[1]['category'], 'shopping');
    expect(places[1]['latitude'], 21.0286);
    expect(places[1]['longitude'], 105.8543);
  });

  test('retries secondary endpoint after primary failure', () async {
    final requests = <http.Request>[];
    final client = MockClient((request) async {
      requests.add(request);
      if (requests.length == 1) return http.Response('busy', 503);
      return http.Response(jsonEncode({'elements': []}), 200);
    });
    addTearDown(client.close);

    final places = await loadNearbyPlaces(
      latitude: 21.0,
      longitude: 105.0,
      radiusKm: 1,
      category: 'food',
      client: client,
    );

    expect(places, isEmpty);
    expect(requests.map((request) => request.url.toString()), [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ]);
    expect(
      requests.map((request) => request.bodyFields['data']).toSet(),
      hasLength(1),
    );
  });

  test('reports final endpoint HTTP error when both endpoints fail', () async {
    var requests = 0;
    final client = MockClient((_) async {
      requests++;
      return http.Response('busy', requests == 1 ? 503 : 429);
    });
    addTearDown(client.close);

    await expectLater(
      loadNearbyPlaces(
        latitude: 21.0,
        longitude: 105.0,
        radiusKm: 1,
        category: 'food',
        client: client,
      ),
      throwsA(
        isA<ApiError>().having(
          (error) => error.message,
          'message',
          'OpenStreetMap trả HTTP 429.',
        ),
      ),
    );
    expect(requests, 2);
  });
}
