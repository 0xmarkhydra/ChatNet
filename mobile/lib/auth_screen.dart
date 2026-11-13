import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';
import 'widgets.dart';

class AuthScreen extends StatefulWidget {
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
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final otpController = TextEditingController();

  String mode = 'login';
  String loginMethod = 'password';
  String? verificationToken;
  String maskedEmail = '';
  int secondsLeft = 0;
  bool busy = false;
  bool rememberEmail = false;
  bool showPassword = false;
  String error = '';
  Timer? timer;

  bool get usingPassword => mode == 'login' && loginMethod == 'password';

  @override
  void initState() {
    super.initState();
    _restoreRememberedEmail();
  }

  Future<void> _restoreRememberedEmail() async {
    try {
      final value = await widget.api.storage.read(key: 'soco.rememberedEmail');
      if (!mounted || value == null || emailController.text.isNotEmpty) return;
      setState(() {
        emailController.text = value;
        rememberEmail = true;
      });
    } catch (_) {
      // Keeping an email is optional; auth works without OS secure storage.
    }
  }

  Future<void> _rememberAddress() async {
    try {
      if (rememberEmail) {
        await widget.api.storage.write(
          key: 'soco.rememberedEmail',
          value: emailController.text.trim(),
        );
      } else {
        await widget.api.storage.delete(key: 'soco.rememberedEmail');
      }
    } catch (_) {
      // Saving the email must never block sign-in.
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    emailController.dispose();
    passwordController.dispose();
    otpController.dispose();
    super.dispose();
  }

  void _resetVerification() {
    timer?.cancel();
    otpController.clear();
    setState(() {
      verificationToken = null;
      maskedEmail = '';
      secondsLeft = 0;
      error = '';
    });
  }

  void _switchMode(String next) {
    if (busy) return;
    _resetVerification();
    passwordController.clear();
    setState(() => mode = next);
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

  Future<void> _start() async {
    if (!emailController.text.trim().contains('@')) {
      setState(() => error = 'Nhập email hợp lệ.');
      return;
    }
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await _rememberAddress();
      final result = object(
        await widget.api.request('POST', '/api/auth/email/start', {
          'email': emailController.text.trim(),
        }),
      );
      if (!mounted) return;
      verificationToken = result['verificationToken']?.toString();
      maskedEmail = result['emailMasked']?.toString() ?? emailController.text;
      if (verificationToken?.isEmpty ?? true) {
        throw const FormatException('Máy chủ chưa trả về mã xác minh.');
      }
      otpController.clear();
      _startTimer((result['expiresInSeconds'] as num?)?.toInt() ?? 600);
    } catch (value) {
      if (mounted) setState(() => error = value.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _loginWithPassword() async {
    if (!emailController.text.trim().contains('@') ||
        passwordController.text.isEmpty) {
      setState(() => error = 'Nhập email và mật khẩu để đăng nhập.');
      return;
    }
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await _rememberAddress();
      final result = object(
        await widget.api.request('POST', '/api/auth/login', {
          'email': emailController.text.trim(),
          'password': passwordController.text,
        }),
      );
      await widget.api.authenticate(result);
      passwordController.clear();
      if (mounted) widget.onAuthenticated();
    } catch (value) {
      if (mounted) setState(() => error = value.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _verify() async {
    final code = otpController.text.trim();
    if (code.length != 6 || verificationToken == null || secondsLeft == 0) {
      return;
    }
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final result = object(
        await widget.api.request('POST', '/api/auth/email/verify', {
          'token': verificationToken,
          'code': code,
        }),
      );
      await widget.api.authenticate(result);
      if (mounted) widget.onAuthenticated();
    } catch (value) {
      if (mounted) setState(() => error = value.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _resend() async {
    if (verificationToken == null || busy) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final result = object(
        await widget.api.request('POST', '/api/auth/email/resend', {
          'token': verificationToken,
        }),
      );
      if (!mounted) return;
      verificationToken = result['verificationToken']?.toString();
      maskedEmail = result['emailMasked']?.toString() ?? maskedEmail;
      otpController.clear();
      _startTimer((result['expiresInSeconds'] as num?)?.toInt() ?? 600);
    } catch (value) {
      if (mounted) setState(() => error = value.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget _modeTab(String key, String title) {
    final active = mode == key;
    return Expanded(
      child: TextButton(
        onPressed: busy ? null : () => _switchMode(key),
        style: TextButton.styleFrom(
          foregroundColor: active ? socoBlue : socoMuted,
          backgroundColor: active ? socoSoftBlue : Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: Text(
          title,
          style: TextStyle(
            fontWeight: active ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final otp = verificationToken != null;
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8FD),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 640;
            return Center(
              child: SingleChildScrollView(
                padding: EdgeInsets.symmetric(
                  horizontal: compact ? 14 : 24,
                  vertical: 20,
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 465),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        padding: const EdgeInsets.fromLTRB(20, 19, 20, 20),
                        decoration: BoxDecoration(
                          gradient: socoGradient,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const SocoLogo(size: 38),
                                const SizedBox(width: 10),
                                const Text(
                                  'SocCo',
                                  style: TextStyle(
                                    fontSize: 24,
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 17),
                            Text(
                              otp
                                  ? 'Kết nối an toàn hơn'
                                  : 'Understand. Connect. Together.',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 21,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              otp
                                  ? 'Xác thực email để tiếp tục kết nối.'
                                  : 'Nhắn tin, chia sẻ khoảnh khắc và kết nối mọi người.',
                              style: const TextStyle(
                                color: Color(0xFFF2F5FF),
                                fontSize: 12,
                                height: 1.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      Container(
                        padding: EdgeInsets.all(compact ? 20 : 28),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: socoLine),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: AutofillGroup(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (otp)
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: IconButton(
                                    tooltip: 'Quay về nhập email',
                                    onPressed: busy ? null : _resetVerification,
                                    icon: const Icon(Icons.arrow_back_rounded),
                                  ),
                                ),
                              Text(
                                otp
                                    ? 'Xác thực email'
                                    : mode == 'register'
                                    ? 'Tạo tài khoản SocCo'
                                    : 'Chào mừng trở lại 👋',
                                style: Theme.of(
                                  context,
                                ).textTheme.headlineSmall,
                              ),
                              const SizedBox(height: 7),
                              Text(
                                otp
                                    ? 'Mã OTP đã gửi tới $maskedEmail.'
                                    : mode == 'register'
                                    ? 'Bắt đầu kết nối cùng mọi người qua email.'
                                    : 'Đăng nhập để tiếp tục sử dụng SocCo.',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              const SizedBox(height: 18),
                              if (!otp) ...[
                                Row(
                                  children: [
                                    _modeTab('login', 'Đăng nhập'),
                                    const SizedBox(width: 8),
                                    _modeTab('register', 'Tạo tài khoản'),
                                  ],
                                ),
                                const SizedBox(height: 18),
                                TextField(
                                  controller: emailController,
                                  enabled: !busy,
                                  keyboardType: TextInputType.emailAddress,
                                  autofillHints: const [AutofillHints.email],
                                  textInputAction: TextInputAction.next,
                                  decoration: const InputDecoration(
                                    labelText: 'Email',
                                    hintText: 'you@example.com',
                                    prefixIcon: Icon(
                                      Icons.mail_outline_rounded,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                if (usingPassword) ...[
                                  TextField(
                                    controller: passwordController,
                                    enabled: !busy,
                                    obscureText: !showPassword,
                                    autofillHints: const [
                                      AutofillHints.password,
                                    ],
                                    textInputAction: TextInputAction.done,
                                    onSubmitted: (_) => _loginWithPassword(),
                                    decoration: InputDecoration(
                                      labelText: 'Mật khẩu',
                                      prefixIcon: const Icon(
                                        Icons.lock_outline_rounded,
                                      ),
                                      suffixIcon: IconButton(
                                        tooltip: showPassword
                                            ? 'Ẩn mật khẩu'
                                            : 'Hiện mật khẩu',
                                        icon: Icon(
                                          showPassword
                                              ? Icons.visibility_off_outlined
                                              : Icons.visibility_outlined,
                                        ),
                                        onPressed: () => setState(
                                          () => showPassword = !showPassword,
                                        ),
                                      ),
                                    ),
                                  ),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 0,
                                    crossAxisAlignment:
                                        WrapCrossAlignment.center,
                                    alignment: WrapAlignment.spaceBetween,
                                    children: [
                                      InkWell(
                                        onTap: busy
                                            ? null
                                            : () => setState(
                                                () => rememberEmail =
                                                    !rememberEmail,
                                              ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            SizedBox(
                                              width: 38,
                                              child: Checkbox(
                                                visualDensity:
                                                    VisualDensity.compact,
                                                value: rememberEmail,
                                                onChanged: busy
                                                    ? null
                                                    : (value) => setState(
                                                        () => rememberEmail =
                                                            value ?? false,
                                                      ),
                                              ),
                                            ),
                                            const Text(
                                              'Ghi nhớ email',
                                              style: TextStyle(fontSize: 11),
                                            ),
                                          ],
                                        ),
                                      ),
                                      TextButton(
                                        onPressed: busy
                                            ? null
                                            : () => setState(() {
                                                loginMethod = 'otp';
                                                error = '';
                                              }),
                                        child: const Text('Quên mật khẩu?'),
                                      ),
                                    ],
                                  ),
                                ] else ...[
                                  Container(
                                    padding: const EdgeInsets.all(13),
                                    decoration: BoxDecoration(
                                      color: socoSoftBlue,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      mode == 'register'
                                          ? 'Tài khoản được tạo sau khi xác minh mã OTP qua email.'
                                          : 'Nhập mã OTP được gửi qua email để đăng nhập an toàn.',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                ],
                              ] else ...[
                                const SizedBox(height: 6),
                                TextField(
                                  controller: otpController,
                                  enabled: !busy,
                                  autofocus: true,
                                  keyboardType: TextInputType.number,
                                  maxLength: 6,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 24,
                                    letterSpacing: 7,
                                    fontWeight: FontWeight.w800,
                                  ),
                                  onChanged: (_) => setState(() {}),
                                  onSubmitted: (_) => _verify(),
                                  decoration: const InputDecoration(
                                    labelText: 'Mã xác minh gồm 6 số',
                                    counterText: '',
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  secondsLeft > 0
                                      ? 'Mã có hiệu lực trong ${(secondsLeft ~/ 60).toString().padLeft(2, '0')}:${(secondsLeft % 60).toString().padLeft(2, '0')}'
                                      : 'Mã đã hết hạn. Hãy gửi lại mã.',
                                  style: Theme.of(context).textTheme.bodySmall,
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
                              const SizedBox(height: 16),
                              FilledButton.icon(
                                onPressed:
                                    busy ||
                                        (otp &&
                                            (otpController.text.length != 6 ||
                                                secondsLeft == 0))
                                    ? null
                                    : otp
                                    ? _verify
                                    : usingPassword
                                    ? _loginWithPassword
                                    : _start,
                                icon: busy
                                    ? const SizedBox.square(
                                        dimension: 17,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : const Icon(Icons.arrow_forward_rounded),
                                label: Text(
                                  busy
                                      ? 'Đang xử lý...'
                                      : otp
                                      ? 'Xác minh và tiếp tục'
                                      : mode == 'register'
                                      ? 'Gửi mã xác minh'
                                      : usingPassword
                                      ? 'Đăng nhập'
                                      : 'Gửi mã OTP',
                                ),
                              ),
                              if (otp) ...[
                                TextButton(
                                  onPressed: busy ? null : _resend,
                                  child: const Text(
                                    'Chưa nhận được mã? Gửi lại',
                                  ),
                                ),
                                TextButton(
                                  onPressed: busy ? null : _resetVerification,
                                  child: const Text('Đổi email'),
                                ),
                                const Text(
                                  'Không chia sẻ mã OTP với người khác.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: socoMuted,
                                  ),
                                ),
                              ] else ...[
                                TextButton(
                                  onPressed: busy
                                      ? null
                                      : () => setState(() {
                                          if (mode == 'login') {
                                            loginMethod = usingPassword
                                                ? 'otp'
                                                : 'password';
                                            error = '';
                                          }
                                        }),
                                  child: Text(
                                    mode == 'login'
                                        ? usingPassword
                                              ? 'Đăng nhập bằng mã OTP qua email'
                                              : 'Đăng nhập bằng mật khẩu'
                                        : ' ',
                                  ),
                                ),
                                const Text(
                                  'Bằng việc tiếp tục, bạn đồng ý với chính sách của SocCo.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: socoMuted,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextButton.icon(
                        onPressed: widget.onDemo,
                        icon: const Icon(Icons.play_circle_outline_rounded),
                        label: const Text('Xem bản demo'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
