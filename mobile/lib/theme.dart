import 'package:flutter/material.dart';

const socoBlue = Color(0xFF2563EB);
const socoViolet = Color(0xFF8B5CF6);
const socoOrange = Color(0xFFFF9F0E);
const socoTeal = Color(0xFF14B8A6);
const socoNavy = Color(0xFF0F172A);
const socoText = Color(0xFF17233D);
const socoMuted = Color(0xFF697894);
const socoLine = Color(0xFFE8ECF7);
const socoCanvas = Color(0xFFF5F7FD);
const socoSoftBlue = Color(0xFFEFF4FF);

const socoGradient = LinearGradient(
  begin: Alignment.centerLeft,
  end: Alignment.centerRight,
  colors: [Color(0xFF1769F8), Color(0xFF4267FD), Color(0xFF8955F6)],
  stops: [0, .49, 1],
);

ThemeData buildSocoTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: socoBlue,
    brightness: Brightness.light,
    surface: Colors.white,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme.copyWith(
      primary: socoBlue,
      secondary: socoViolet,
      tertiary: socoOrange,
      surface: Colors.white,
      outline: socoLine,
    ),
    scaffoldBackgroundColor: const Color(0xFFF0F4FB),
    fontFamily: 'SF Pro Text',
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        color: socoNavy,
        fontSize: 30,
        height: 1.15,
        fontWeight: FontWeight.w800,
      ),
      headlineSmall: TextStyle(
        color: socoNavy,
        fontSize: 22,
        height: 1.2,
        fontWeight: FontWeight.w800,
      ),
      titleLarge: TextStyle(
        color: socoNavy,
        fontSize: 18,
        fontWeight: FontWeight.w700,
      ),
      titleMedium: TextStyle(
        color: socoNavy,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
      bodyLarge: TextStyle(color: socoText, fontSize: 16, height: 1.45),
      bodyMedium: TextStyle(color: socoText, fontSize: 14, height: 1.4),
      bodySmall: TextStyle(color: socoMuted, fontSize: 12, height: 1.35),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF7F9FD),
      hintStyle: const TextStyle(color: Color(0xFF8E9AB2)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: socoLine),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: socoLine),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFFA6BEFD), width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: socoBlue,
        foregroundColor: Colors.white,
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: socoBlue,
        minimumSize: const Size(48, 46),
        side: const BorderSide(color: Color(0xFFDCE5FB)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: socoBlue,
        backgroundColor: socoSoftBlue,
        minimumSize: const Size.square(42),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
      ),
    ),
    dividerTheme: const DividerThemeData(color: socoLine, thickness: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: socoNavy,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Colors.white,
      showDragHandle: true,
    ),
  );
}
