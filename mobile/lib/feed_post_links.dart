/// Canonical public post route used by the React/PWA main branch.
/// A shared link must open the full post detail rather than just the Feed tab.
Uri postShareUri(int id, {String origin = 'https://chat.codelocal.cloud'}) {
  if (id <= 0) throw ArgumentError.value(id, 'id', 'Invalid post id');
  final base = Uri.parse(origin);
  if (base.scheme != 'https' || base.host.isEmpty || base.userInfo.isNotEmpty) {
    throw ArgumentError.value(origin, 'origin', 'HTTPS origin required');
  }
  return base.replace(
    path: '/feed/posts/$id',
    queryParameters: {'ref': 'share'},
  );
}

int? postIdFromSharedUri(Uri uri) {
  if (uri.scheme != 'https' || uri.host != 'chat.codelocal.cloud') {
    return null;
  }
  final match = RegExp(r'^/feed/posts/([1-9][0-9]*)/?$').firstMatch(uri.path);
  if (match == null) return null;
  return int.tryParse(match.group(1)!);
}
