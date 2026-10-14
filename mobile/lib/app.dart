import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'auth_screen.dart';
import 'demo.dart';
import 'home_shell.dart';
import 'language_picker.dart';
import 'localization.dart';
import 'theme.dart';

class SocoApp extends StatefulWidget {
  const SocoApp({super.key, required this.api});

  final Api api;

  @override
  State<SocoApp> createState() => _SocoAppState();
}

class _SocoAppState extends State<SocoApp> {
  late Api api = widget.api;
  Map<String, String> messages = uiSourceMessages;
  int localeRequest = 0;

  @override
  void initState() {
    super.initState();
    if (api.session != null) unawaited(_loadLocale());
  }

  void _authenticated(Api next) {
    setState(() => api = next);
    unawaited(_loadLocale());
  }

  String _effectiveLocale(String preference) {
    var code = preference.trim().toLowerCase().split('-').first;
    if (code == 'auto') {
      code = WidgetsBinding.instance.platformDispatcher.locale.languageCode
          .toLowerCase();
    }
    return languageCatalog.containsKey(code) ? code : 'vi';
  }

  Future<void> _loadLocale([String? preference]) async {
    final request = ++localeRequest;
    try {
      final prefs = preference == null
          ? object(await api.request('GET', '/api/preferences'))
          : null;
      final locale = _effectiveLocale(
        preference ?? prefs?['appLocale']?.toString() ?? 'auto',
      );
      // ponytail: Demo keeps English offline; signed-in users load every catalog locale from the server.
      final fallback = locale == 'en' && api.isDemo
          ? {...uiSourceMessages, ...demoEnglishBundle}
          : uiSourceMessages;
      if (mounted && request == localeRequest) {
        setState(() => messages = fallback);
      }
      if (locale == 'vi' || api.isDemo) return;
      final response = object(
        await api.request('POST', '/api/i18n/bundle', {
          'locale': locale,
          'version': uiBundleVersion,
          'messages': uiSourceMessages,
        }),
      );
      final translated = object(response['messages']);
      if (!mounted || request != localeRequest) return;
      setState(() {
        messages = {
          ...uiSourceMessages,
          for (final entry in translated.entries)
            if (entry.value is String &&
                entry.value.toString().trim().isNotEmpty)
              entry.key: entry.value.toString(),
        };
      });
    } catch (_) {
      // Vietnamese source remains usable when locale sync is unavailable.
    }
  }

  Future<void> _logout() async {
    final current = api;
    try {
      await current.logout();
    } finally {
      if (mounted) setState(() => api = Api());
      current.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    return UiTranslations(
      messages: messages,
      child: MaterialApp(
        title: 'SOCO',
        debugShowCheckedModeBanner: false,
        theme: buildSocoTheme(),
        home: api.session == null
            ? AuthScreen(
                api: api,
                onAuthenticated: () => _authenticated(api),
                onDemo: () => _authenticated(DemoApi()),
              )
            : HomeShell(
                api: api,
                onLogout: _logout,
                onLocaleChanged: _loadLocale,
              ),
      ),
    );
  }
}
