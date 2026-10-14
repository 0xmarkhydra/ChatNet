import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'nearby_places.dart';
import 'theme.dart';
import 'widgets.dart';

enum _NearbyMode { people, places }

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key, required this.api, required this.query});

  final Api api;
  final String query;

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  final mapController = MapController();
  final searchController = TextEditingController();
  List<Json> people = [];
  List<Json> places = [];
  _NearbyMode mode = _NearbyMode.people;
  bool mapView = true;
  bool scanning = false;
  bool active = false;
  double peopleRadius = 5;
  double placeRadius = 1;
  String category = 'all';
  String? selectedPlace;
  double? latitude;
  double? longitude;
  String error = '';

  Future<({double latitude, double longitude})> _position() async {
    if (widget.api.isDemo) {
      return (latitude: 10.7769, longitude: 106.7009);
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
    return (latitude: value.latitude, longitude: value.longitude);
  }

  Future<void> _scanPeople() async {
    setState(() {
      scanning = true;
      error = '';
    });
    try {
      final position = await _position();
      final result = object(
        await widget.api.request('POST', '/api/users/nearby', {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'radiusKm': peopleRadius,
        }),
      );
      if (!mounted) return;
      setState(() {
        latitude = position.latitude;
        longitude = position.longitude;
        people = objects(result['users']);
        active = true;
      });
    } catch (value) {
      if (mounted) setState(() => error = value.toString());
    } finally {
      if (mounted) setState(() => scanning = false);
    }
  }

  Future<void> _loadPlaces({bool locate = false}) async {
    setState(() {
      scanning = true;
      error = '';
    });
    try {
      if (locate || latitude == null || longitude == null) {
        final position = await _position();
        latitude = position.latitude;
        longitude = position.longitude;
      }
      final result = widget.api.isDemo
          ? demoNearbyPlaces(latitude!, longitude!)
          : await loadNearbyPlaces(
              latitude: latitude!,
              longitude: longitude!,
              radiusKm: placeRadius,
              category: category,
            );
      if (!mounted) return;
      setState(() {
        places = result;
        selectedPlace = null;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          mapController.move(LatLng(latitude!, longitude!), 14);
        }
      });
    } catch (value) {
      if (mounted) setState(() => error = value.toString());
    } finally {
      if (mounted) setState(() => scanning = false);
    }
  }

  Future<void> _stop() async {
    try {
      await widget.api.request('DELETE', '/api/users/nearby');
    } catch (_) {
      // Local privacy state still closes if server location already expired.
    }
    if (mounted) {
      setState(() {
        active = false;
        people = [];
      });
    }
  }

  Future<void> _friend(Json person) async {
    try {
      await widget.api.request('POST', '/api/friends/${person['id']}');
      _show('Đã gửi lời mời kết bạn tới @${person['username']}.');
    } catch (value) {
      _show(value.toString());
    }
  }

  Future<void> _directions(Json place) async {
    final route =
        '${latitude ?? ''},${longitude ?? ''};'
        '${place['latitude']},${place['longitude']}';
    final uri = Uri.https('www.openstreetmap.org', '/directions', {
      'engine': 'fossgis_osrm_car',
      'route': route,
    });
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      _show('Không mở được ứng dụng chỉ đường.');
    }
  }

  void _show(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  List<Json> get _visiblePeople {
    final query = searchController.text
        .trim()
        .replaceFirst('@', '')
        .toLowerCase();
    return people.where((person) {
      return query.isEmpty ||
          '${person['displayName']} ${person['username']}'
              .toLowerCase()
              .contains(query);
    }).toList()..sort(
      (left, right) => ((left['distanceKm'] as num?)?.toDouble() ?? 999)
          .compareTo((right['distanceKm'] as num?)?.toDouble() ?? 999),
    );
  }

  List<Json> get _visiblePlaces {
    final query = searchController.text.trim().toLowerCase();
    return places.where((place) {
      final categoryMatch = category == 'all' || place['category'] == category;
      final textMatch =
          query.isEmpty ||
          '${place['name']} ${place['address']}'.toLowerCase().contains(query);
      final withinRadius =
          ((place['distanceKm'] as num?)?.toDouble() ?? 999) <= placeRadius;
      return categoryMatch && textMatch && withinRadius;
    }).toList();
  }

  @override
  void dispose() {
    mapController.dispose();
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final peopleMode = mode == _NearbyMode.people;
    final visiblePeople = _visiblePeople;
    final visiblePlaces = _visiblePlaces;
    return ColoredBox(
      color: socoCanvas,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 30),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 980),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 14, 12, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Quanh đây',
                            style: TextStyle(
                              color: socoNavy,
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        if (peopleMode)
                          Switch(
                            value: active,
                            onChanged: scanning
                                ? null
                                : (value) => value ? _scanPeople() : _stop(),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _ModeButton(
                          selected: peopleMode,
                          icon: Icons.people_outline_rounded,
                          label: 'Người ở gần',
                          onTap: () => setState(() {
                            mode = _NearbyMode.people;
                            searchController.clear();
                            error = '';
                          }),
                        ),
                        const SizedBox(width: 18),
                        _ModeButton(
                          selected: !peopleMode,
                          icon: Icons.location_on_outlined,
                          label: 'Địa điểm',
                          onTap: () => setState(() {
                            mode = _NearbyMode.places;
                            searchController.clear();
                            error = '';
                          }),
                        ),
                      ],
                    ),
                    const Divider(height: 1),
                    const SizedBox(height: 15),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final compact = constraints.maxWidth < 520;
                        final search = TextField(
                          controller: searchController,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            hintText: peopleMode
                                ? 'Tên hoặc @username'
                                : 'Tên địa điểm hoặc địa chỉ',
                            prefixIcon: const Icon(
                              Icons.search_rounded,
                              size: 20,
                            ),
                            contentPadding: EdgeInsets.zero,
                            filled: true,
                            fillColor: Colors.white,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: socoLine),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: socoLine),
                            ),
                          ),
                        );
                        final radius = _RadiusDropdown(
                          value: peopleMode ? peopleRadius : placeRadius,
                          values: peopleMode
                              ? const [1, 5, 10, 25, 50]
                              : const [.5, 1, 3, 5],
                          onChanged: scanning
                              ? null
                              : (value) {
                                  setState(() {
                                    if (peopleMode) {
                                      peopleRadius = value;
                                    } else {
                                      placeRadius = value;
                                    }
                                  });
                                },
                        );
                        final refresh = IconButton(
                          tooltip: 'Tìm lại',
                          onPressed: scanning
                              ? null
                              : () => peopleMode
                                    ? _scanPeople()
                                    : _loadPlaces(
                                        locate:
                                            latitude == null ||
                                            longitude == null,
                                      ),
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.white,
                            side: const BorderSide(color: socoLine),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(13),
                            ),
                          ),
                          icon: scanning
                              ? const _ProgressIcon(color: socoBlue)
                              : const Icon(Icons.refresh_rounded, size: 21),
                        );
                        if (!compact) {
                          return Row(
                            children: [
                              Expanded(
                                child: SizedBox(height: 46, child: search),
                              ),
                              const SizedBox(width: 8),
                              radius,
                              const SizedBox(width: 8),
                              refresh,
                            ],
                          );
                        }
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: SizedBox(height: 46, child: search),
                                ),
                                const SizedBox(width: 8),
                                radius,
                              ],
                            ),
                            const SizedBox(height: 8),
                            refresh,
                          ],
                        );
                      },
                    ),
                    if (peopleMode) ...[
                      const SizedBox(height: 15),
                      const Row(
                        children: [
                          Icon(
                            Icons.shield_outlined,
                            color: Color(0xFF748579),
                            size: 17,
                          ),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Vị trí chính xác của bạn không được chia sẻ.',
                              style: TextStyle(
                                color: Color(0xFF6C7E72),
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                    _error(),
                    const SizedBox(height: 19),
                    Text(
                      scanning
                          ? 'Đang cập nhật...'
                          : peopleMode
                          ? '${visiblePeople.length} người'
                          : '${visiblePlaces.length} địa điểm',
                      style: const TextStyle(
                        color: socoNavy,
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (peopleMode)
                      _people(visiblePeople)
                    else
                      _places(visiblePlaces),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _people(List<Json> visible) {
    return Column(
      children: [
        if (!active)
          EmptyState(
            icon: Icons.people_outline_rounded,
            title: 'Tìm người ở gần bạn',
            description: 'Chỉ người bật Quanh đây mới xuất hiện trong kết quả.',
            action: FilledButton(
              onPressed: scanning ? null : _scanPeople,
              child: Text(scanning ? 'Đang tìm...' : 'Bật và tìm người'),
            ),
          )
        else if (visible.isEmpty)
          EmptyState(
            icon: Icons.people_outline_rounded,
            title: searchController.text.trim().isEmpty
                ? 'Chưa có ai ở gần'
                : 'Không khớp tìm kiếm',
            description: searchController.text.trim().isEmpty
                ? 'Thử tăng bán kính hoặc tìm lại sau.'
                : 'Thử tên khác hoặc xóa tìm kiếm.',
            action: FilledButton(
              onPressed: searchController.text.trim().isEmpty
                  ? _scanPeople
                  : () => setState(searchController.clear),
              child: Text(
                searchController.text.trim().isEmpty
                    ? 'Tìm lại'
                    : 'Xóa tìm kiếm',
              ),
            ),
          )
        else
          _resultPanel(
            children: [
              for (final person in visible)
                ListTile(
                  leading: UserAvatar(
                    name:
                        person['displayName']?.toString() ??
                        person['username']?.toString() ??
                        '',
                    username: person['username']?.toString(),
                    online: person['online'] == true,
                    fetchProfileImage: !widget.api.isDemo,
                  ),
                  title: Text(
                    person['displayName']?.toString() ??
                        person['username']?.toString() ??
                        '',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    '@${person['username']} · '
                    '${_distanceLabel((person['distanceKm'] as num?)?.toDouble())}',
                  ),
                  trailing: TextButton(
                    onPressed: () => _friend(person),
                    child: const Text('Kết bạn'),
                  ),
                ),
            ],
          ),
      ],
    );
  }

  Widget _places(List<Json> visible) {
    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final entry in nearbyCategories.entries)
                Padding(
                  padding: const EdgeInsets.only(right: 7),
                  child: ChoiceChip(
                    label: Text(entry.value),
                    selected: category == entry.key,
                    onSelected: scanning
                        ? null
                        : (_) {
                            setState(() => category = entry.key);
                            if (latitude != null) _loadPlaces();
                          },
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        if (latitude == null && !scanning)
          EmptyState(
            icon: Icons.map_outlined,
            title: 'Tìm địa điểm gần bạn',
            description: 'Cho phép vị trí để xem bản đồ và địa điểm lân cận.',
            action: FilledButton.icon(
              onPressed: () => _loadPlaces(locate: true),
              icon: const Icon(Icons.my_location_rounded),
              label: const Text('Dùng vị trí hiện tại'),
            ),
          )
        else if (latitude != null) ...[
          Row(
            children: [
              Expanded(
                child: Text(
                  scanning ? 'Đang cập nhật...' : '${visible.length} địa điểm',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(
                    value: false,
                    icon: Icon(Icons.list_rounded),
                    tooltip: 'Danh sách',
                  ),
                  ButtonSegment(
                    value: true,
                    icon: Icon(Icons.map_outlined),
                    tooltip: 'Bản đồ',
                  ),
                ],
                selected: {mapView},
                showSelectedIcon: false,
                onSelectionChanged: (value) {
                  setState(() => mapView = value.first);
                },
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (mapView) ...[
            SizedBox(
              height: 300,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: FlutterMap(
                  mapController: mapController,
                  options: MapOptions(
                    initialCenter: LatLng(latitude!, longitude!),
                    initialZoom: 14,
                    minZoom: 3,
                    maxZoom: 19,
                    backgroundColor: const Color(0xFFE8EFF4),
                  ),
                  children: [
                    if (widget.api.isDemo)
                      const Positioned.fill(
                        child: CustomPaint(painter: _StreetMapPainter()),
                      )
                    else
                      TileLayer(
                        urlTemplate:
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'vn.soco.mobile',
                      ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: LatLng(latitude!, longitude!),
                          width: 34,
                          height: 34,
                          child: const _CurrentLocationMarker(),
                        ),
                        for (var index = 0; index < visible.length; index++)
                          Marker(
                            point: LatLng(
                              (visible[index]['latitude'] as num).toDouble(),
                              (visible[index]['longitude'] as num).toDouble(),
                            ),
                            width: 42,
                            height: 42,
                            child: _PlaceMarker(
                              index: index + 1,
                              selected: selectedPlace == visible[index]['id'],
                              onTap: () {
                                setState(
                                  () => selectedPlace = visible[index]['id']
                                      ?.toString(),
                                );
                              },
                            ),
                          ),
                      ],
                    ),
                    const Align(
                      alignment: Alignment.bottomRight,
                      child: ColoredBox(
                        color: Colors.white70,
                        child: Padding(
                          padding: EdgeInsets.all(3),
                          child: Text(
                            '© OpenStreetMap',
                            style: TextStyle(fontSize: 10),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (!scanning && error.isEmpty && visible.isEmpty)
            const EmptyState(
              icon: Icons.search_off_rounded,
              title: 'Chưa tìm thấy địa điểm',
              description: 'Thử từ khóa, danh mục hoặc bán kính khác.',
            )
          else
            _resultPanel(
              children: [
                for (var index = 0; index < visible.length; index++)
                  ListTile(
                    selected: visible[index]['id'] == selectedPlace,
                    onTap: () {
                      final place = visible[index];
                      setState(() {
                        selectedPlace = place['id']?.toString();
                        mapView = true;
                      });
                      mapController.move(
                        LatLng(
                          (place['latitude'] as num).toDouble(),
                          (place['longitude'] as num).toDouble(),
                        ),
                        16,
                      );
                    },
                    leading: CircleAvatar(
                      backgroundColor: socoSoftBlue,
                      foregroundColor: socoBlue,
                      child: Text('${index + 1}'),
                    ),
                    title: Text(
                      visible[index]['name']?.toString() ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      '${nearbyCategories[visible[index]['category']] ?? visible[index]['kind']}'
                      ' · ${_distanceLabel((visible[index]['distanceKm'] as num?)?.toDouble())}'
                      '${_placeDetails(visible[index])}',
                      maxLines: 3,
                    ),
                    trailing: IconButton(
                      tooltip: 'Chỉ đường',
                      onPressed: () => _directions(visible[index]),
                      icon: const Icon(Icons.navigation_outlined),
                    ),
                  ),
              ],
            ),
        ],
      ],
    );
  }

  Widget _resultPanel({required List<Widget> children}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: socoLine),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(children: children),
    );
  }

  Widget _error() {
    if (error.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Color(0xFFBE123C)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              error,
              style: const TextStyle(color: Color(0xFFBE123C)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeButton extends StatelessWidget {
  const _ModeButton({
    required this.selected,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 1),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: selected ? socoBlue : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 19,
              color: selected ? socoBlue : const Color(0xFF7D8BA4),
            ),
            const SizedBox(width: 7),
            Text(
              label,
              style: TextStyle(
                color: selected ? socoBlue : const Color(0xFF7D8BA4),
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RadiusDropdown extends StatelessWidget {
  const _RadiusDropdown({
    required this.value,
    required this.values,
    required this.onChanged,
  });

  final double value;
  final List<num> values;
  final ValueChanged<double>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 80,
      height: 46,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: socoLine),
        borderRadius: BorderRadius.circular(14),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<double>(
          value: value,
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 19),
          style: const TextStyle(color: Color(0xFF37517D), fontSize: 14),
          items: [
            for (final item in values)
              DropdownMenuItem(
                value: item.toDouble(),
                child: Text(item < 1 ? '500 m' : '${item.toInt()} km'),
              ),
          ],
          onChanged: onChanged == null
              ? null
              : (next) {
                  if (next != null) onChanged!(next);
                },
        ),
      ),
    );
  }
}

class _ProgressIcon extends StatelessWidget {
  const _ProgressIcon({this.color = Colors.white});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: 18,
      child: CircularProgressIndicator(color: color, strokeWidth: 2),
    );
  }
}

class _CurrentLocationMarker extends StatelessWidget {
  const _CurrentLocationMarker();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: socoBlue.withValues(alpha: .2),
        shape: BoxShape.circle,
      ),
      child: const Center(
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: socoBlue,
            shape: BoxShape.circle,
            border: Border.fromBorderSide(
              BorderSide(color: Colors.white, width: 3),
            ),
          ),
          child: SizedBox.square(dimension: 18),
        ),
      ),
    );
  }
}

class _PlaceMarker extends StatelessWidget {
  const _PlaceMarker({
    required this.index,
    required this.selected,
    required this.onTap,
  });

  final int index;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: selected ? socoOrange : socoBlue,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8)],
        ),
        child: Center(
          child: Text(
            '$index',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
  }
}

class _StreetMapPainter extends CustomPainter {
  const _StreetMapPainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawColor(const Color(0xFFE9EFF3), BlendMode.src);
    final block = Paint()..color = const Color(0xFFDCE7DE);
    final water = Paint()..color = const Color(0xFFCBE8F3);
    canvas.drawRect(
      Rect.fromLTWH(size.width * .68, 0, size.width * .32, size.height),
      water,
    );
    for (var row = 0; row < 5; row++) {
      for (var column = 0; column < 5; column++) {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(
              column * size.width / 5 + 8,
              row * size.height / 5 + 8,
              size.width / 5 - 17,
              size.height / 5 - 17,
            ),
            const Radius.circular(7),
          ),
          block,
        );
      }
    }
    final road = Paint()
      ..color = Colors.white
      ..strokeWidth = 8
      ..style = PaintingStyle.stroke;
    for (var index = -1; index < 7; index++) {
      canvas.drawLine(
        Offset(index * 74.0, 0),
        Offset(index * 74.0 + 120, size.height),
        road,
      );
      canvas.drawLine(
        Offset(0, index * 62.0),
        Offset(size.width, index * 62.0 + 90),
        road,
      );
    }
    final artery = Paint()
      ..color = const Color(0xFFF9D99A)
      ..strokeWidth = 12
      ..style = PaintingStyle.stroke;
    canvas.drawLine(
      Offset(0, size.height * .78),
      Offset(size.width, size.height * .31),
      artery,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

String _distanceLabel(double? value) {
  if (value == null || !value.isFinite) return 'chưa rõ';
  if (value < 1) return '${(value * 1000).round()} m';
  return '${value.toStringAsFixed(value < 10 ? 1 : 0)} km';
}

String _placeDetails(Json place) {
  final details = [
    place['address']?.toString(),
    place['openingHours']?.toString(),
  ].where((item) => item != null && item.isNotEmpty);
  return details.isEmpty ? '' : '\n${details.join(' · ')}';
}
