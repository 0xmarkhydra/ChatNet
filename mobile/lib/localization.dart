import 'package:flutter/material.dart';

const uiBundleVersion = '2026-10-14.1';

const uiSourceMessages = <String, String>{
  'nav.chat': 'Tin nhắn',
  'nav.contacts': 'Danh bạ',
  'nav.discover': 'Quanh đây',
  'nav.feed': 'Bảng tin',
  'nav.profile': 'Cá nhân',
  'common.search': 'Tìm kiếm',
  'common.save': 'Lưu thay đổi',
  'common.saving': 'Đang lưu...',
  'common.close': 'Đóng',
  'common.auto': 'Tự động',
  'common.loading': 'Đang tải...',
  'common.test': 'Test',
  'profile.tagline': 'Understand. Connect. Together.',
  'profile.eyebrow': 'Không gian của bạn',
  'profile.description': 'Hồ sơ, ngôn ngữ và quyền riêng tư.',
  'profile.addCover': 'Thêm ảnh bìa',
  'profile.changeCover': 'Đổi ảnh bìa',
  'profile.changeAvatar': 'Đổi ảnh đại diện',
  'profile.avatarHint': 'Bấm biểu tượng máy ảnh để đổi avatar',
  'profile.avatarUpdating': 'Đang cập nhật ảnh đại diện...',
  'profile.personalInfo': 'Thông tin cá nhân',
  'profile.personalInfoHint': 'Đổi tên hiển thị và username của bạn',
  'profile.displayName': 'Tên hiển thị',
  'profile.displayNamePlaceholder': 'Tên của bạn',
  'profile.username': 'Username',
  'profile.usernameHint': '3–32 ký tự: chữ thường, số, dấu chấm, _ hoặc -',
  'profile.notifications': 'Thông báo',
  'profile.notificationsHint': 'Cho phép bật/tắt bất cứ lúc nào',
  'profile.testNotification': 'Test thông báo',
  'profile.testNotificationHint': 'Bắn một push thử tới thiết bị này',
  'profile.autoTranslate': 'Tự động dịch tin nhắn',
  'profile.autoTranslateHint': 'Hiện bản dịch theo ngôn ngữ bạn chọn.',
  'profile.settings': 'Tùy chọn & cài đặt',
  'profile.translationLanguage': 'Ngôn ngữ dịch',
  'profile.translationLanguageHint': 'Giữ nguyên sau khi F5/mở lại app',
  'profile.appLanguage': 'Ngôn ngữ ứng dụng',
  'profile.appLanguageHint': 'Tự động theo thiết bị hoặc chọn ngôn ngữ riêng',
  'profile.install': 'Cài SocCo vào điện thoại',
  'profile.logout': 'Đăng xuất',
  'locale.title': 'Ngôn ngữ ứng dụng',
  'locale.subtitle': 'Giao diện SocCo sẽ dùng ngôn ngữ này',
  'locale.device': 'Theo ngôn ngữ thiết bị',
  'locale.deviceHint': 'Tự nhận diện ngôn ngữ của điện thoại hoặc trình duyệt',
  'locale.searchPlaceholder': 'Tìm ngôn ngữ, quốc gia hoặc mã...',
  'locale.noResults': 'Không tìm thấy ngôn ngữ phù hợp',
  'locale.dynamicHint': 'Bản dịch giao diện được tải và cache tự động',
  'translation.title': 'Dịch AI',
  'translation.subtitle': 'Dịch tự động tin nhắn nhận được',
  'translation.searchPlaceholder': 'Tìm ngôn ngữ, quốc gia hoặc mã...',
  'translation.languageCount': 'ngôn ngữ',
  'translation.languageHint': 'Tên theo ngôn ngữ giao diện + tên bản địa',
  'translation.noResults': 'Không tìm thấy ngôn ngữ phù hợp.',
  'translation.original': 'GỐC',
  'translation.originalText': 'Nguyên văn',
};

const demoEnglishBundle = <String, String>{
  'nav.chat': 'Messages',
  'nav.contacts': 'Contacts',
  'nav.discover': 'Nearby',
  'nav.feed': 'Feed',
  'nav.profile': 'Profile',
  'common.search': 'Search',
  'common.save': 'Save changes',
  'common.saving': 'Saving...',
  'common.close': 'Close',
  'common.auto': 'Automatic',
  'common.loading': 'Loading...',
  'common.test': 'Test',
  'profile.tagline': 'Understand. Connect. Together.',
  'profile.eyebrow': 'Your space',
  'profile.description': 'Profile, languages and privacy.',
  'profile.addCover': 'Add cover photo',
  'profile.changeCover': 'Change cover photo',
  'profile.changeAvatar': 'Change profile photo',
  'profile.avatarHint': 'Tap the camera icon to change your photo',
  'profile.avatarUpdating': 'Updating profile photo...',
  'profile.personalInfo': 'Personal information',
  'profile.personalInfoHint': 'Change your display name and username',
  'profile.displayName': 'Display name',
  'profile.displayNamePlaceholder': 'Your name',
  'profile.username': 'Username',
  'profile.usernameHint':
      '3–32 characters: lowercase letters, numbers, dots, _ or -',
  'profile.notifications': 'Notifications',
  'profile.notificationsHint': 'Turn notifications on or off anytime',
  'profile.testNotification': 'Test notification',
  'profile.testNotificationHint': 'Send a test push to this device',
  'profile.autoTranslate': 'Automatically translate messages',
  'profile.autoTranslateHint': 'Show translations in your selected language.',
  'profile.settings': 'Options & settings',
  'profile.translationLanguage': 'Translation language',
  'profile.translationLanguageHint': 'Saved when you reopen the app',
  'profile.appLanguage': 'App language',
  'profile.appLanguageHint': 'Follow your device or choose a language',
  'profile.install': 'Install SocCo',
  'profile.logout': 'Log out',
  'locale.title': 'App language',
  'locale.subtitle': 'SocCo will use this language',
  'locale.device': 'Use device language',
  'locale.deviceHint': 'Detect your phone or browser language',
  'locale.searchPlaceholder': 'Search language, country or code...',
  'locale.noResults': 'No matching language found',
  'locale.dynamicHint': 'UI translations load and cache automatically',
  'translation.title': 'AI translation',
  'translation.subtitle': 'Automatically translate incoming messages',
  'translation.searchPlaceholder': 'Search language, country or code...',
  'translation.languageCount': 'languages',
  'translation.languageHint': 'Localized and native language names',
  'translation.noResults': 'No matching language found.',
  'translation.original': 'ORIGINAL',
  'translation.originalText': 'Original text',
};

class UiTranslations extends InheritedWidget {
  const UiTranslations({
    super.key,
    required this.messages,
    required super.child,
  });

  final Map<String, String> messages;

  static String text(BuildContext context, String key) {
    return context
            .dependOnInheritedWidgetOfExactType<UiTranslations>()
            ?.messages[key] ??
        uiSourceMessages[key] ??
        key;
  }

  @override
  bool updateShouldNotify(UiTranslations oldWidget) =>
      oldWidget.messages != messages;
}

String tr(BuildContext context, String key) =>
    UiTranslations.text(context, key);
