import 'package:flutter/material.dart';

import 'api.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = Api();
  await api.restore();
  runApp(SocoApp(api: api));
}
