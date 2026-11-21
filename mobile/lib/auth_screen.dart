import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'state/app_providers.dart';

import 'api.dart';
import 'theme.dart';
import 'widgets.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({
    super.key,
    required this.api,
    required this.onAuthenticated,
    required this.onDemo,
  });

  final Api api;
  final VoidCallback onAuthenticated;
  final VoidCallback onDemo;

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final emailController = TextEditingController();
  final otpController = TextEditingController();
  final passwordController = TextEditingController();
  bool registering = false;
  bool passwordLogin = true;
  bool showPassword = false;
  String? verificationToken;
  String maskedEmail = '';
  int secondsLeft = 0;
  bool busy = false;
  String error = '';
  Timer? timer;

  @override
  void dispose() {
    timer?.cancel();
    emailController.dispose();
    otpController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  void _startTimer(int seconds) {
    timer?.cancel();
    setState(() => secondsLeft = seconds);
    timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (secondsLeft <= 1) {
        timer.cancel();
        setState(() => secondsLeft = 0);
      } else {
        setState(() => secondsLeft--);
      }
    });
  }

  Future<void> _loginWithPassword() async {
    final email = emailController.text.trim();
    if (!email.contains('@') || passwordController.text.isEmpty) {
      setState(() => error = 'Nhập email và mật khẩu hợp lệ.');
      return;
    }
    if (busy) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final result = object(
        await widget.api.request('POST', '/api/auth/login', {
          'email': email,
          'password': passwordController.text,
        }),
      );
      await widget.api.authenticate(result);
      if (mounted) widget.onAuthenticated();
    } on ApiError catch (cause) {
      if (mounted) {
        setState(
          () => error = cause.status == 401
              ? 'Email hoặc mật khẩu không đúng. Bạn cũng có thể dùng OTP.'
              : cause.toString(),
        );
      }
    } catch (cause) {
      if (mounted) setState(() => error = 'Không thể đăng nhập: $cause');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _start() async {
    if (!emailController.text.contains('@')) {
      setState(() => error = 'Nhập email hợp lệ.');
      return;
    }
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final challenge = await ref
          .read(emailAuthProvider.notifier)
          .start(emailController.text.trim());
      verificationToken = challenge.verificationToken;
      maskedEmail = challenge.emailMasked;
      _startTimer(challenge.expiresInSeconds);
    } catch (value) {
      error = value.toString();
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _verify() async {
    final code = otpController.text.trim();
    if (code.length != 6 || verificationToken == null) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await ref.read(emailAuthProvider.notifier).verify(code);
      widget.onAuthenticated();
    } catch (value) {
      error = value.toString();
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final challenge = await ref.read(emailAuthProvider.notifier).resend();
      verificationToken = challenge.verificationToken;
      maskedEmail = challenge.emailMasked;
      otpController.clear();
      _startTimer(challenge.expiresInSeconds);
    } catch (value) {
      error = value.toString();
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final otp = verificationToken != null;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF4F8FF), Color(0xFFF7F4FF), Color(0xFFFFF8ED)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: Column(
                  children: [
                    const SocoLogo(size: 68),
                    const SizedBox(height: 16),
                    const GradientText(
                      'SocCO',
                      style: TextStyle(
                        fontSize: 42,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Understand. Connect. Together.',
                      style: TextStyle(color: socoMuted, fontSize: 16),
                    ),
                    const SizedBox(height: 30),
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .96),
                        border: Border.all(color: socoLine),
                        borderRadius: BorderRadius.circular(22),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x15213882),
                            blurRadius: 40,
                            offset: Offset(0, 14),
                          ),
                        ],
                      ),
                      child: AutofillGroup(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              otp
                                  ? 'Kiểm tra email của bạn'
                                  : registering
                                  ? 'Tạo tài khoản SocCO'
                                  : 'Chào mừng trở lại',
                              style: Theme.of(context).textTheme.headlineSmall,
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              otp
                                  ? 'SocCO đã gửi mã xác minh 6 số tới $maskedEmail.'
                                  : registering
                                  ? 'Bắt đầu kết nối qua xác minh email.'
                                  : 'Đăng nhập để khám phá cộng đồng SocCO.',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 16),
                            if (!otp)
                              SegmentedButton<bool>(
                                key: const ValueKey('auth-mode'),
                                segments: const [
                                  ButtonSegment(
                                    value: false,
                                    label: Text('Đăng nhập'),
                                  ),
                                  ButtonSegment(
                                    value: true,
                                    label: Text('Tạo tài khoản'),
                                  ),
                                ],
                                selected: {registering},
                                onSelectionChanged: busy
                                    ? null
                                    : (values) => setState(() {
                                        registering = values.first;
                                        passwordLogin = !registering;
                                        error = '';
                                      }),
                              ),
                            const SizedBox(height: 16),
                            if (!otp)
                              TextField(
                                controller: emailController,
                                enabled: !busy,
                                keyboardType: TextInputType.emailAddress,
                                autofillHints: const [AutofillHints.email],
                                textInputAction: TextInputAction.done,
                                onSubmitted: (_) => passwordLogin
                                    ? _loginWithPassword()
                                    : _start(),
                                decoration: const InputDecoration(
                                  labelText: 'Email',
                                  hintText: 'you@example.com',
                                  prefixIcon: Icon(
                                    Icons.alternate_email_rounded,
                                  ),
                                ),
                              )
                            else
                              TextField(
                                controller: otpController,
                                enabled: !busy,
                                autofocus: true,
                                keyboardType: TextInputType.number,
                                maxLength: 6,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 8,
                                ),
                                onChanged: (_) => setState(() {}),
                                onSubmitted: (_) => _verify(),
                                decoration: const InputDecoration(
                                  labelText: 'Mã xác minh',
                                  hintText: '000000',
                                  counterText: '',
                                ),
                              ),
                            if (!otp && !registering) ...[
                              const SizedBox(height: 12),
                              TextButton.icon(
                                key: const ValueKey('auth-toggle-method'),
                                onPressed: busy
                                    ? null
                                    : () => setState(() {
                                        passwordLogin = !passwordLogin;
                                        error = '';
                                      }),
                                icon: Icon(
                                  passwordLogin
                                      ? Icons.mail_outline_rounded
                                      : Icons.lock_outline_rounded,
                                ),
                                label: Text(
                                  passwordLogin
                                      ? 'Đăng nhập bằng OTP qua email'
                                      : 'Đăng nhập bằng mật khẩu',
                                ),
                              ),
                            ],
                            if (!otp && passwordLogin && !registering) ...[
                              TextField(
                                key: const ValueKey('auth-password-input'),
                                controller: passwordController,
                                enabled: !busy,
                                obscureText: !showPassword,
                                autofillHints: const [AutofillHints.password],
                                onSubmitted: (_) => _loginWithPassword(),
                                decoration: InputDecoration(
                                  labelText: 'Mật khẩu',
                                  prefixIcon: const Icon(
                                    Icons.lock_outline_rounded,
                                  ),
                                  suffixIcon: IconButton(
                                    key: const ValueKey('auth-show-password'),
                                    tooltip: showPassword
                                        ? 'Ẩn mật khẩu'
                                        : 'Hiện mật khẩu',
                                    onPressed: () => setState(
                                      () => showPassword = !showPassword,
                                    ),
                                    icon: Icon(
                                      showPassword
                                          ? Icons.visibility_off_outlined
                                          : Icons.visibility_outlined,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                            if (otp) ...[
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      secondsLeft > 0
                                          ? 'Hết hạn sau ${secondsLeft ~/ 60}:${(secondsLeft % 60).toString().padLeft(2, '0')}'
                                          : 'Mã đã hết hạn',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: busy ? null : _resend,
                                    child: const Text('Gửi lại mã'),
                                  ),
                                ],
                              ),
                            ],
                            if (error.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFF1F2),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  error,
                                  style: const TextStyle(
                                    color: Color(0xFFBE123C),
                                  ),
                                ),
                              ),
                            ],
                            const SizedBox(height: 18),
                            FilledButton(
                              onPressed:
                                  busy ||
                                      (otp &&
                                          (otpController.text.length != 6 ||
                                              secondsLeft == 0))
                                  ? null
                                  : (otp
                                        ? _verify
                                        : passwordLogin && !registering
                                        ? _loginWithPassword
                                        : _start),
                              child: busy
                                  ? const SizedBox.square(
                                      dimension: 20,
                                      child: CircularProgressIndicator(
                                        color: Colors.white,
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : Text(
                                      otp
                                          ? 'Xác minh & vào SocCO'
                                          : registering
                                          ? 'Gửi mã xác minh'
                                          : passwordLogin
                                          ? 'Đăng nhập'
                                          : 'Gửi mã OTP',
                                    ),
                            ),
                            if (otp)
                              TextButton(
                                onPressed: busy
                                    ? null
                                    : () {
                                        timer?.cancel();
                                        otpController.clear();
                                        ref
                                            .read(emailAuthProvider.notifier)
                                            .reset();
                                        setState(() {
                                          verificationToken = null;
                                          error = '';
                                        });
                                      },
                                child: const Text('Dùng email khác'),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextButton.icon(
                      onPressed: widget.onDemo,
                      icon: const Icon(Icons.play_circle_outline_rounded),
                      label: const Text('Xem bản demo'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
