import 'package:flutter/material.dart';

/// Contact metadata form shared by the Contacts profile and conversation details.
Future<String?> showContactMetadataEditor(
  BuildContext context, {
  required String field,
  required String initialValue,
}) {
  final nickname = field == 'nickname';
  var draft = initialValue;
  return showDialog<String>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(nickname ? 'Đặt tên gợi nhớ' : 'Ghi chú riêng'),
      content: TextFormField(
        key: ValueKey('contact-edit-$field'),
        initialValue: draft,
        onChanged: (value) => draft = value,
        maxLength: nickname ? 60 : 1500,
        decoration: InputDecoration(
          labelText: nickname ? 'Tên gợi nhớ' : 'Ghi chú',
          hintText: nickname ? 'Để trống để dùng tên gốc' : null,
        ),
        minLines: 1,
        maxLines: nickname ? 1 : 5,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(dialogContext, draft.trim()),
          child: const Text('Lưu'),
        ),
      ],
    ),
  );
}
