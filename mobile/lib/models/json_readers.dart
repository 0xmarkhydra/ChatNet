/// Shared JSON parsing for transport models. Reject malformed server payloads
/// rather than converting arbitrary values into trusted application state.
typedef JsonMap = Map<String, dynamic>;

const Object absent = Object();

JsonMap jsonMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map && value.keys.every((key) => key is String)) {
    return Map<String, dynamic>.from(value);
  }
  throw const FormatException('Expected a JSON object');
}

T requiredField<T>(JsonMap json, String key) {
  final value = json[key];
  if (value is T) return value;
  throw FormatException('Invalid or missing "$key"');
}

T? optionalField<T>(JsonMap json, String key) {
  final value = json[key];
  if (value == null) return null;
  if (value is T) return value;
  throw FormatException('Invalid "$key"');
}

T enumField<T>(
  JsonMap json,
  String key,
  List<T> values,
  String Function(T) wire,
) {
  final value = requiredField<String>(json, key);
  for (final item in values) {
    if (wire(item) == value) return item;
  }
  throw FormatException('Unknown "$key": $value');
}

T? optionalEnumField<T>(
  JsonMap json,
  String key,
  List<T> values,
  String Function(T) wire,
) {
  if (json[key] == null) return null;
  return enumField<T>(json, key, values, wire);
}

List<T> requiredObjects<T>(
  JsonMap json,
  String key,
  T Function(JsonMap) convert,
) {
  final raw = requiredField<List<dynamic>>(json, key);
  return List<T>.unmodifiable(raw.map((value) => convert(jsonMap(value))));
}

List<T>? optionalObjects<T>(
  JsonMap json,
  String key,
  T Function(JsonMap) convert,
) {
  if (json[key] == null) return null;
  return requiredObjects(json, key, convert);
}

List<int>? optionalInts(JsonMap json, String key) {
  if (json[key] == null) return null;
  final raw = requiredField<List<dynamic>>(json, key);
  return List<int>.unmodifiable(
    raw.map((value) {
      if (value is int) return value;
      throw FormatException('Invalid item in "$key"');
    }),
  );
}
