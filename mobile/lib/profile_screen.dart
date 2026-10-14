import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:mime/mime.dart';

import 'api.dart';
import 'language_picker.dart';
import 'localization.dart';
import 'profile_qr.dart';
import 'theme.dart';
import 'widgets.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.api,
    required this.onLogout,
    required this.onConnect,
    required this.onLocaleChanged,
  });

  final Api api;
  final Future<void> Function() onLogout;
  final ValueChanged<String> onConnect;
  final ValueChanged<String> onLocaleChanged;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final displayNameController = TextEditingController();
  final usernameController = TextEditingController();
  Json? profile;
  Json preferences = {
    'targetLanguage': 'vi',
    'autoTranslate': true,
    'appLocale': 'vi',
  };
  bool loading = true;
  bool saving = false;
  bool notificationsEnabled = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final values = await Future.wait([
        widget.api.request('GET', '/api/profile'),
        widget.api.request('GET', '/api/preferences'),
      ]);
      if (!mounted) return;
      profile = object(values[0]);
      preferences = object(values[1]);
      displayNameController.text = profile!['displayName']?.toString() ?? '';
      usernameController.text = profile!['username']?.toString() ?? '';
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

  Future<void> _saveProfile() async {
    final username = usernameController.text.trim().toLowerCase();
    final displayName = displayNameController.text.trim();
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
        }),
      );
      await widget.api.updateUser(updated);
      if (mounted) {
        setState(() => profile = updated);
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
      if (mounted) setState(() => profile = updated);
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
      if (mounted) setState(() => preferences = updated);
      if (appLocale != null) {
        widget.onLocaleChanged(updated['appLocale']?.toString() ?? appLocale);
      }
    } catch (value) {
      _show(value.toString());
    }
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
        usernameController.text.trim().toLowerCase() != username;
    return ColoredBox(
      color: socoCanvas,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 34),
        children: [
          SectionHeading(
            eyebrow: tr(context, 'profile.eyebrow').toUpperCase(),
            title: tr(context, 'nav.profile'),
            description: tr(context, 'profile.description'),
          ),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 760),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    margin: const EdgeInsets.fromLTRB(14, 0, 14, 18),
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
                              height: 150,
                              width: double.infinity,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Color(0xFF1769F8),
                                    Color(0xFF8B5CF6),
                                    Color(0xFFFF9F0E),
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
                                        22,
                                        24,
                                        22,
                                        0,
                                      ),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'SOCO',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 27,
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
                              right: 12,
                              bottom: 12,
                              child: FilledButton.tonalIcon(
                                onPressed: saving
                                    ? null
                                    : () => _updateImage('cover'),
                                icon: const Icon(Icons.photo_camera_outlined),
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
                            offset: const Offset(0, -40),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Stack(
                                  children: [
                                    UserAvatar(
                                      name: displayName,
                                      username: username,
                                      size: 92,
                                      online: true,
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
                                        icon: const Icon(
                                          Icons.photo_camera_rounded,
                                          size: 18,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(width: 16),
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
                  _label(tr(context, 'profile.personalInfo').toUpperCase()),
                  _card(
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          tr(context, 'profile.personalInfo'),
                          style: const TextStyle(
                            color: socoNavy,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Đổi tên hiển thị và username của bạn',
                          style: TextStyle(color: socoMuted, fontSize: 12),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: displayNameController,
                          enabled: !saving,
                          maxLength: 100,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            labelText: tr(context, 'profile.displayName'),
                            counterText: '',
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: usernameController,
                          enabled: !saving,
                          maxLength: 32,
                          autocorrect: false,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            labelText: tr(context, 'profile.username'),
                            prefixText: '@',
                            counterText: '',
                          ),
                        ),
                        const SizedBox(height: 5),
                        const Text(
                          '3–32 ký tự: chữ thường, số, dấu chấm, _, hoặc -',
                          style: TextStyle(color: socoMuted, fontSize: 11),
                        ),
                        const SizedBox(height: 14),
                        FilledButton(
                          onPressed: saving || !profileChanged
                              ? null
                              : _saveProfile,
                          child: Text(
                            saving
                                ? tr(context, 'common.saving')
                                : tr(context, 'common.save'),
                          ),
                        ),
                      ],
                    ),
                  ),
                  _label(tr(context, 'profile.settings').toUpperCase()),
                  _card(
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
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          secondary: const Icon(
                            Icons.notifications_none_rounded,
                          ),
                          title: Text(tr(context, 'profile.notifications')),
                          subtitle: Text(
                            tr(context, 'profile.notificationsHint'),
                          ),
                          value: notificationsEnabled,
                          onChanged: (value) =>
                              setState(() => notificationsEnabled = value),
                        ),
                      ],
                    ),
                  ),
                  Padding(
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
      child: child,
    );
  }
}
