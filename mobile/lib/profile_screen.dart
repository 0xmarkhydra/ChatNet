import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'state/app_providers.dart';
import 'presentation/profile_timeline.dart';
import 'feed_visitor_profile.dart';
import 'package:mime/mime.dart';

import 'api.dart';
import 'language_picker.dart';
import 'localization.dart';
import 'profile_qr.dart';
import 'theme.dart';
import 'widgets.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({
    super.key,
    required this.api,
    this.refreshRequest = 0,
    required this.onLogout,
    required this.onConnect,
    required this.onLocaleChanged,
    this.onCreatePost,
    this.onNotifications,
    this.onOpenPost,
    this.onOpenContacts,
    this.onOpenConversation,
  });

  final Api api;
  final int refreshRequest;
  final Future<void> Function() onLogout;
  final ValueChanged<String> onConnect;
  final ValueChanged<String> onLocaleChanged;
  final VoidCallback? onCreatePost;
  final VoidCallback? onNotifications;
  final ValueChanged<int>? onOpenPost;
  final VoidCallback? onOpenContacts;
  final ValueChanged<Json>? onOpenConversation;

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final displayNameController = TextEditingController();
  final usernameController = TextEditingController();
  final bioController = TextEditingController();
  final cityController = TextEditingController();
  Json? profile;
  Json? privacy;
  bool privacyLoading = true;
  bool privacyBusy = false;
  String privacyError = '';
  Json preferences = {
    'targetLanguage': 'vi',
    'autoTranslate': true,
    'appLocale': 'vi',
  };
  bool loading = true;
  bool saving = false;
  String error = '';
  // Match the PWA: profile, identity editor and settings are distinct views.
  String section = 'overview';

  @override
  void initState() {
    super.initState();
    _load();
    unawaited(_loadPrivacy());
  }

  @override
  void didUpdateWidget(covariant ProfileScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.refreshRequest != oldWidget.refreshRequest && section == 'overview') {
      ref.invalidate(profileProvider);
      unawaited(_load());
    }
  }

  Future<void> _loadPrivacy() async {
    setState(() {
      privacyLoading = true;
      privacyError = '';
    });
    try {
      ref.invalidate(privacyProvider);
      final values = (await ref.read(privacyProvider.future)).toJson();
      if (!mounted) return;
      setState(() {
        privacy = values;
        privacyLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        privacyLoading = false;
        privacyError = 'Không thể tải cài đặt riêng tư: $error';
      });
    }
  }

  Future<void> _changePrivacy(String key) async {
    if (privacy == null || privacyBusy || privacy![key] is! bool) return;
    final next = {...privacy!, key: privacy![key] != true};
    setState(() => privacyBusy = true);
    try {
      final updated = object(
        await widget.api.request('PUT', '/api/privacy', next),
      );
      if (!mounted) return;
      ref.invalidate(privacyProvider);
      setState(() => privacy = updated);
    } catch (error) {
      _show('Không lưu được quyền riêng tư: $error');
    } finally {
      if (mounted) setState(() => privacyBusy = false);
    }
  }

  Future<void> _load() async {
    try {
      final profileRequest = ref.read(profileProvider.future);
      final preferencesRequest = ref.read(preferencesProvider.future);
      final loadedProfile = await profileRequest;
      final loadedPreferences = await preferencesRequest;
      if (!mounted) return;
      profile = loadedProfile.toJson();
      preferences = loadedPreferences.toJson();
      displayNameController.text = profile!['displayName']?.toString() ?? '';
      usernameController.text = profile!['username']?.toString() ?? '';
      bioController.text = profile!['bio']?.toString() ?? '';
      cityController.text = profile!['city']?.toString() ?? '';
      setState(() {
        loading = false;
        error = '';
      });
    } catch (value) {
      if (mounted) {
        setState(() {
          loading = false;
          error = value.toString();
        });
      }
    }
  }

  void _resetProfileDraft() {
    final current = profile;
    if (current == null) return;
    displayNameController.text = current['displayName']?.toString() ?? '';
    usernameController.text = current['username']?.toString() ?? '';
    bioController.text = current['bio']?.toString() ?? '';
    cityController.text = current['city']?.toString() ?? '';
  }

  Future<void> _saveProfile() async {
    final username = usernameController.text.trim().toLowerCase();
    final displayName = displayNameController.text.trim();
    if (displayName.isEmpty) {
      _show('Vui lòng nhập tên hiển thị.');
      return;
    }
    if (!RegExp(
      r'^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,30}[a-zA-Z0-9]$',
    ).hasMatch(username)) {
      _show(
        'Username cần 3-32 ký tự chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.',
      );
      return;
    }
    setState(() => saving = true);
    try {
      final updated = object(
        await widget.api.request('PUT', '/api/profile', {
          'username': username,
          'displayName': displayName,
          'bio': bioController.text.trim(),
          'city': cityController.text.trim(),
        }),
      );
      await widget.api.updateUser(updated);
      if (mounted) {
        ref.invalidate(profileProvider);
        setState(() {
          profile = updated;
          section = 'overview';
        });
        _show('Đã cập nhật hồ sơ.');
      }
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _updateImage(String kind) async {
    final file = await FilePicker.pickFile(type: FileType.image);
    if (file == null) return;
    setState(() => saving = true);
    try {
      final bytes = await file.readAsBytes();
      final attachment = await widget.api.upload(
        'profile',
        file.name,
        lookupMimeType(file.name, headerBytes: bytes) ?? 'image/jpeg',
        bytes,
      );
      final updated = object(
        await widget.api.request('PUT', '/api/profile/media', {
          'kind': kind,
          'attachment': attachment,
        }),
      );
      if (mounted) {
        ref.invalidate(profileProvider);
        setState(() => profile = updated);
      }
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _savePreferences({
    bool? autoTranslate,
    String? target,
    String? appLocale,
  }) async {
    final next = {...preferences};
    if (autoTranslate != null) next['autoTranslate'] = autoTranslate;
    if (target != null) next['targetLanguage'] = target;
    if (appLocale != null) next['appLocale'] = appLocale;
    try {
      final updated = object(
        await widget.api.request('PUT', '/api/preferences', next),
      );
      ref.invalidate(preferencesProvider);
      if (mounted) setState(() => preferences = updated);
      if (appLocale != null) {
        widget.onLocaleChanged(updated['appLocale']?.toString() ?? appLocale);
      }
    } catch (value) {
      _show(value.toString());
    }
  }

  Future<void> _openVisitor(String username) async {
    if (username.trim().isEmpty || !mounted) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => FeedVisitorProfile(
          api: widget.api,
          username: username,
          onOpenConversation: (room) {
            Navigator.of(context).pop();
            widget.onOpenConversation?.call(room);
          },
          onOpenPost: (post) {
            final id = (post['id'] as num?)?.toInt();
            Navigator.of(context).pop();
            if (id != null) widget.onOpenPost?.call(id);
          },
        ),
      ),
    );
  }

  void _showQr() {
    final username =
        profile?['username']?.toString() ??
        widget.api.user['username']?.toString() ??
        '';
    showProfileQr(
      context,
      username: username,
      displayName:
          profile?['displayName']?.toString() ??
          widget.api.user['displayName']?.toString() ??
          username,
      onConnect: widget.onConnect,
    );
  }

  void _show(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  void dispose() {
    displayNameController.dispose();
    usernameController.dispose();
    bioController.dispose();
    cityController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error.isNotEmpty && profile == null) {
      return EmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Chưa tải được hồ sơ',
        description: error,
        action: FilledButton(onPressed: _load, child: const Text('Thử lại')),
      );
    }
    final username = profile?['username']?.toString() ?? '';
    final displayName = profile?['displayName']?.toString() ?? username;
    final version = profile?['updatedAt'];
    final coverUrl =
        profile?['coverUrl']?.toString() ??
        (profile?['coverSet'] == true
            ? profileAssetUrl(username, 'cover', version: version)
            : null);
    final avatarUrl =
        profile?['avatarUrl']?.toString() ??
        (profile?['avatarSet'] == true
            ? profileAssetUrl(username, 'avatar', version: version)
            : null);
    final profileChanged =
        displayNameController.text.trim() != displayName ||
        usernameController.text.trim().toLowerCase() != username ||
        bioController.text.trim() != (profile?['bio']?.toString() ?? '') ||
        cityController.text.trim() != (profile?['city']?.toString() ?? '');
    return ColoredBox(
      color: socoCanvas,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 34),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 760),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (section != 'overview')
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
                      child: Row(
                        children: [
                          IconButton(
                            key: const ValueKey('profile-back'),
                            tooltip: 'Quay lại trang cá nhân',
                            onPressed: saving ? null : () => setState(() {
                              if (section == 'editor') _resetProfileDraft();
                              section = 'overview';
                            }),
                            icon: const Icon(Icons.arrow_back_rounded),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              section == 'editor' ? 'Chỉnh sửa hồ sơ' : 'Cài đặt',
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: socoNavy),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (section == 'overview') Container(
                    margin: const EdgeInsets.fromLTRB(0, 0, 0, 9),
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: socoLine),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      children: [
                        Stack(
                          children: [
                            Container(
                              height: 112,
                              width: double.infinity,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Color(0xFF2563EB),
                                    Color(0xFF7754EE),
                                  ],
                                ),
                                image: coverUrl == null
                                    ? null
                                    : DecorationImage(
                                        image: NetworkImage(coverUrl),
                                        fit: BoxFit.cover,
                                      ),
                              ),
                              alignment: Alignment.topLeft,
                              child: coverUrl == null
                                  ? Padding(
                                      padding: const EdgeInsets.fromLTRB(
                                        11,
                                        13,
                                        11,
                                        0,
                                      ),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'SocCO',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 23,
                                              fontWeight: FontWeight.w900,
                                            ),
                                          ),
                                          Text(
                                            tr(context, 'profile.tagline'),
                                            style: const TextStyle(
                                              color: Colors.white,
                                            ),
                                          ),
                                        ],
                                      ),
                                    )
                                  : null,
                            ),
                            Positioned(
                              left: 11,
                              bottom: 11,
                              child: OutlinedButton.icon(
                                onPressed: widget.onCreatePost,
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFF78859A),
                                  backgroundColor: Colors.white,
                                  minimumSize: const Size(0, 40),
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                                icon: const Icon(Icons.add_rounded, size: 20),
                                label: const Text(
                                  'Chia sẻ suy nghĩ...',
                                  style: TextStyle(fontSize: 12),
                                ),
                              ),
                            ),
                            Positioned(
                              right: 10,
                              bottom: 11,
                              child: FilledButton.tonalIcon(
                                style: FilledButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: const Color(0xFF293449),
                                  minimumSize: const Size(0, 39),
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 9,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(11),
                                  ),
                                ),
                                onPressed: saving
                                    ? null
                                    : () => _updateImage('cover'),
                                icon: const Icon(
                                  Icons.image_outlined,
                                  size: 18,
                                ),
                                label: Text(
                                  profile?['coverSet'] == true
                                      ? tr(context, 'profile.changeCover')
                                      : tr(context, 'profile.addCover'),
                                ),
                              ),
                            ),
                          ],
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 2),
                          child: Transform.translate(
                            offset: const Offset(0, -23),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Stack(
                                  children: [
                                    UserAvatar(
                                      name: displayName,
                                      username: username,
                                      size: 67,
                                      online: false,
                                      circular: true,
                                      imageUrl: avatarUrl,
                                      fetchProfileImage: !widget.api.isDemo,
                                    ),
                                    Positioned(
                                      right: 0,
                                      bottom: 0,
                                      child: IconButton(
                                        tooltip: tr(
                                          context,
                                          'profile.changeAvatar',
                                        ),
                                        onPressed: saving
                                            ? null
                                            : () => _updateImage('avatar'),
                                        style: IconButton.styleFrom(
                                          backgroundColor: const Color(
                                            0xFFF0F3E8,
                                          ),
                                          minimumSize: const Size.square(32),
                                          maximumSize: const Size.square(32),
                                        ),
                                        icon: const Icon(
                                          Icons.image_outlined,
                                          size: 17,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(width: 9),
                                Expanded(
                                  child: Padding(
                                    padding: const EdgeInsets.only(bottom: 7),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          displayName,
                                          style: Theme.of(
                                            context,
                                          ).textTheme.titleLarge,
                                        ),
                                        Text(
                                          '@$username',
                                          style: Theme.of(
                                            context,
                                          ).textTheme.bodySmall,
                                        ),
                                        Text(
                                          widget.api.user['email']
                                                  ?.toString() ??
                                              '',
                                          style: Theme.of(
                                            context,
                                          ).textTheme.bodySmall,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                IconButton(
                                  tooltip: 'QR của tôi',
                                  onPressed: _showQr,
                                  icon: const Icon(Icons.qr_code_2_rounded),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (section == 'overview')
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: FilledButton.icon(
                              key: const ValueKey('profile-edit-open'),
                              onPressed: () => setState(() => section = 'editor'),
                              icon: const Icon(Icons.edit_outlined, size: 18),
                              label: const Text('Chỉnh sửa hồ sơ'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          OutlinedButton.icon(
                            key: const ValueKey('profile-settings-open'),
                            onPressed: () => setState(() => section = 'settings'),
                            icon: const Icon(Icons.settings_outlined, size: 18),
                            label: const Text('Cài đặt'),
                          ),
                        ],
                      ),
                    ),
                  if (section == 'overview') ProfileTimeline(
                    api: widget.api,
                    refreshRequest: widget.refreshRequest,
                    username: username,
                    displayName: displayName,
                    bio: profile?['bio']?.toString() ?? '',
                    city: profile?['city']?.toString() ?? '',
                    email: widget.api.user['email']?.toString() ?? '',
                    onCreatePost: widget.onCreatePost,
                    onOpenPost: widget.onOpenPost,
                    onOpenContacts: widget.onOpenContacts,
                    onViewFriend: _openVisitor,
                  ),
                  if (section == 'editor') _card(
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Thông tin cơ bản',
                          style: const TextStyle(
                            color: socoNavy,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Chỉ thay đổi những thông tin bạn muốn người khác nhìn thấy.',
                          style: TextStyle(color: socoMuted, fontSize: 12),
                        ),
                        const SizedBox(height: 14),
                        Container(
                          height: 112,
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(
                            color: socoSoftBlue,
                            borderRadius: BorderRadius.circular(14),
                            image: coverUrl == null ? null : DecorationImage(
                              image: NetworkImage(coverUrl), fit: BoxFit.cover,
                            ),
                          ),
                          alignment: Alignment.bottomRight,
                          child: Padding(
                            padding: const EdgeInsets.all(8),
                            child: FilledButton.tonalIcon(
                              onPressed: saving ? null : () => _updateImage('cover'),
                              icon: const Icon(Icons.camera_alt_outlined, size: 18),
                              label: const Text('Đổi ảnh bìa'),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            UserAvatar(
                              name: displayName,
                              username: username,
                              size: 64,
                              imageUrl: avatarUrl,
                              fetchProfileImage: !widget.api.isDemo,
                            ),
                            const SizedBox(width: 10),
                            OutlinedButton.icon(
                              onPressed: saving ? null : () => _updateImage('avatar'),
                              icon: const Icon(Icons.camera_alt_outlined, size: 17),
                              label: const Text('Đổi ảnh đại diện'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        const Text(
                          'Tên hiển thị',
                          style: TextStyle(
                            color: Color(0xFF465676),
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 5),
                        TextField(
                          controller: displayNameController,
                          enabled: !saving,
                          maxLength: 100,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            hintText: 'Nhập tên hiển thị',
                            counterText: '',
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Tên người dùng',
                          style: TextStyle(
                            color: Color(0xFF465676),
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 5),
                        TextField(
                          controller: usernameController,
                          enabled: !saving,
                          maxLength: 32,
                          autocorrect: false,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            hintText: 'Tên người dùng duy nhất',
                            prefixText: '@',
                            counterText: '',
                          ),
                        ),
                        const SizedBox(height: 5),
                        const Text(
                          '3–32 ký tự: chữ thường, số, dấu chấm, _, hoặc -',
                          style: TextStyle(color: socoMuted, fontSize: 11),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Tiểu sử',
                          style: TextStyle(
                            color: Color(0xFF465676),
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 5),
                        TextField(
                          key: const ValueKey('profile-bio'),
                          controller: bioController,
                          enabled: !saving,
                          maxLength: 160,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                            hintText: 'Một chút giới thiệu về bạn',
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Thành phố',
                          style: TextStyle(
                            color: Color(0xFF465676),
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 5),
                        TextField(
                          key: const ValueKey('profile-city'),
                          controller: cityController,
                          enabled: !saving,
                          maxLength: 100,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                            hintText: 'Thành phố bạn muốn chia sẻ',
                          ),
                        ),
                        const SizedBox(height: 14),
                        OutlinedButton.icon(
                          onPressed: saving ? null : () => setState(() {
                            _resetProfileDraft();
                            section = 'overview';
                          }),
                          icon: const Icon(Icons.undo_rounded),
                          label: const Text('Hủy thay đổi'),
                        ),
                        const SizedBox(height: 8),
                        FilledButton(
                          onPressed: saving || !profileChanged || displayNameController.text.trim().isEmpty
                              ? null
                              : _saveProfile,
                          child: Text(
                            saving
                                ? tr(context, 'common.saving')
                                : 'Lưu hồ sơ',
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (section == 'settings') _label('TÙY CHỌN & CÀI ĐẶT'),
                  if (section == 'editor' || section == 'settings') _card(
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Quyền riêng tư tài khoản',
                          style: TextStyle(
                            color: socoNavy,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 3),
                        const Text(
                          'Kiểm soát ai có thể tìm, gửi lời mời và thấy bạn trực tuyến. '
                          'Thiết lập lưu trên máy chủ.',
                          style: TextStyle(
                            color: Color(0xFF758274),
                            fontSize: 12,
                          ),
                        ),
                        if (privacyLoading)
                          const Padding(
                            padding: EdgeInsets.all(16),
                            child: Center(child: CircularProgressIndicator()),
                          ),
                        if (privacyError.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            privacyError,
                            style: const TextStyle(
                              color: Color(0xFFBE123C),
                              fontSize: 12,
                            ),
                          ),
                          TextButton.icon(
                            onPressed: _loadPrivacy,
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('Thử lại'),
                          ),
                        ],
                        if (privacy != null)
                          for (final setting in const [
                            (
                              'searchableByUsername',
                              'Cho phép tìm bằng username',
                              'Người khác có thể tìm @username của bạn.',
                            ),
                            (
                              'searchableByName',
                              'Cho phép tìm bằng tên',
                              'Tên hiển thị có thể xuất hiện trong kết quả.',
                            ),
                            (
                              'searchableByEmail',
                              'Cho phép tìm bằng email',
                              'Chỉ tìm bằng email khớp chính xác.',
                            ),
                            (
                              'allowFriendRequests',
                              'Cho phép lời mời mới',
                              'Tắt để ngăn yêu cầu kết bạn mới.',
                            ),
                            (
                              'showOnlineStatus',
                              'Hiển thị trạng thái online',
                              'Ẩn sự hiện diện của bạn trong danh sách.',
                            ),
                          ])
                            if (privacy![setting.$1] is bool)
                              SwitchListTile.adaptive(
                                key: ValueKey('privacy-${setting.$1}'),
                                contentPadding: EdgeInsets.zero,
                                title: Text(
                                  setting.$2,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                subtitle: Text(
                                  setting.$3,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: socoMuted,
                                  ),
                                ),
                                value: privacy![setting.$1] == true,
                                onChanged: privacyBusy
                                    ? null
                                    : (_) => _changePrivacy(setting.$1),
                              ),
                      ],
                    ),
                  ),
                  if (section == 'settings') _card(
                    Column(
                      children: [
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(tr(context, 'profile.autoTranslate')),
                          subtitle: Text(
                            tr(context, 'profile.autoTranslateHint'),
                          ),
                          value: preferences['autoTranslate'] == true,
                          onChanged: (value) =>
                              _savePreferences(autoTranslate: value),
                        ),
                        const Divider(),
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.translate_rounded),
                          title: Text(
                            tr(context, 'profile.translationLanguage'),
                          ),
                          subtitle: Text(
                            languageName(
                              preferences['targetLanguage']?.toString(),
                            ),
                          ),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () async {
                            final target = await showLanguagePicker(
                              context,
                              selected:
                                  preferences['targetLanguage']?.toString() ??
                                  'vi',
                              title: tr(context, 'profile.translationLanguage'),
                            );
                            if (target != null) {
                              _savePreferences(target: target);
                            }
                          },
                        ),
                        const Divider(),
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.language_rounded),
                          title: Text(tr(context, 'profile.appLanguage')),
                          subtitle: Text(
                            languageName(preferences['appLocale']?.toString()),
                          ),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () async {
                            final locale = await showLanguagePicker(
                              context,
                              selected:
                                  preferences['appLocale']?.toString() ??
                                  'auto',
                              title: tr(context, 'locale.title'),
                              allowAuto: true,
                            );
                            if (locale != null) {
                              _savePreferences(appLocale: locale);
                            }
                          },
                        ),
                        const Divider(),
                        ListTile(
                          key: const ValueKey('profile-notifications'),
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.notifications_none_rounded),
                          title: Text(tr(context, 'profile.notifications')),
                          subtitle: const Text(
                            'Xem lời mời, tin nhắn và bài viết nhắc đến bạn',
                          ),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: widget.onNotifications,
                        ),
                      ],
                    ),
                  ),
                  if (section == 'settings') Padding(
                    padding: const EdgeInsets.fromLTRB(14, 6, 14, 0),
                    child: OutlinedButton.icon(
                      onPressed: saving ? null : widget.onLogout,
                      icon: const Icon(Icons.logout_rounded),
                      label: Text(tr(context, 'profile.logout')),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFBE123C),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
      child: Text(
        text,
        style: const TextStyle(
          color: socoMuted,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _card(Widget child) {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 18),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: socoLine),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Material(type: MaterialType.transparency, child: child),
    );
  }
}
