import 'json_readers.dart';

enum MediaKind { image, video, audio, file }

/// A display-only attachment can be missing storageRef (e.g. demo or public
/// feed images). Uploads must use toUploadRequestJson(), which validates it.
class MediaAttachment {
  const MediaAttachment({
    this.id,
    this.storageRef,
    required this.name,
    this.sizeBytes = 0,
    this.contentType = '',
    required this.kind,
    this.url,
  });

  final int? id;
  final String? storageRef;
  final String name;
  final int sizeBytes;
  final String contentType;
  final MediaKind kind;
  final String? url;

  factory MediaAttachment.fromJson(JsonMap json) => MediaAttachment(
    id: optionalField<int>(json, 'id'),
    storageRef: optionalField<String>(json, 'storageRef'),
    name: requiredField<String>(json, 'name'),
    sizeBytes: optionalField<int>(json, 'sizeBytes') ?? 0,
    contentType: optionalField<String>(json, 'contentType') ?? '',
    kind: enumField(json, 'kind', MediaKind.values, (value) => value.name),
    url: optionalField<String>(json, 'url'),
  );

  MediaAttachment copyWith({
    Object? id = absent,
    Object? storageRef = absent,
    String? name,
    int? sizeBytes,
    String? contentType,
    MediaKind? kind,
    Object? url = absent,
  }) => MediaAttachment(
    id: identical(id, absent) ? this.id : id as int?,
    storageRef: identical(storageRef, absent)
        ? this.storageRef
        : storageRef as String?,
    name: name ?? this.name,
    sizeBytes: sizeBytes ?? this.sizeBytes,
    contentType: contentType ?? this.contentType,
    kind: kind ?? this.kind,
    url: identical(url, absent) ? this.url : url as String?,
  );

  JsonMap toJson() => {
    if (id != null) 'id': id,
    if (storageRef != null) 'storageRef': storageRef,
    'name': name,
    'sizeBytes': sizeBytes,
    'contentType': contentType,
    'kind': kind.name,
    if (url != null) 'url': url,
  };

  /// Only the five input fields accepted by strict Go JSON decoders.
  JsonMap toUploadRequestJson() {
    if (storageRef == null ||
        storageRef!.isEmpty ||
        contentType.isEmpty ||
        name.isEmpty ||
        sizeBytes <= 0) {
      throw const FormatException('Attachment is not ready for upload');
    }
    return {
      'storageRef': storageRef,
      'name': name,
      'sizeBytes': sizeBytes,
      'contentType': contentType,
      'kind': kind.name,
    };
  }
}

class PresignedUpload {
  const PresignedUpload({
    required this.uploadUrl,
    required this.storageRef,
    required this.key,
    required this.expiresAt,
    required this.kind,
    required this.downloadUrl,
  });

  final String uploadUrl;
  final String storageRef;
  final String key;
  final String expiresAt;
  final MediaKind kind;
  final String downloadUrl;

  factory PresignedUpload.fromJson(JsonMap json) => PresignedUpload(
    uploadUrl: requiredField<String>(json, 'uploadUrl'),
    storageRef: requiredField<String>(json, 'storageRef'),
    key: requiredField<String>(json, 'key'),
    expiresAt: requiredField<String>(json, 'expiresAt'),
    kind: enumField(json, 'kind', MediaKind.values, (value) => value.name),
    downloadUrl: requiredField<String>(json, 'downloadUrl'),
  );

  PresignedUpload copyWith({
    String? uploadUrl,
    String? storageRef,
    String? key,
    String? expiresAt,
    MediaKind? kind,
    String? downloadUrl,
  }) => PresignedUpload(
    uploadUrl: uploadUrl ?? this.uploadUrl,
    storageRef: storageRef ?? this.storageRef,
    key: key ?? this.key,
    expiresAt: expiresAt ?? this.expiresAt,
    kind: kind ?? this.kind,
    downloadUrl: downloadUrl ?? this.downloadUrl,
  );

  JsonMap toJson() => {
    'uploadUrl': uploadUrl,
    'storageRef': storageRef,
    'key': key,
    'expiresAt': expiresAt,
    'kind': kind.name,
    'downloadUrl': downloadUrl,
  };
}
