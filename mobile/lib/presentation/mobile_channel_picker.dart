import 'package:flutter/material.dart';

import '../models/json_readers.dart';
import '../theme.dart';
import 'channel_list_presenter.dart';

/// PWA-style channel picker connected to the same animated avatar boundary.
/// Search remains owned by the parent so expanding/collapsing the avatar rail
/// never discards the query or selected channel.
class MobileChannelPicker extends StatelessWidget {
  const MobileChannelPicker({
    super.key,
    required this.group,
    required this.channels,
    this.generalChannel,
    required this.searchController,
    required this.loading,
    required this.selectedId,
    required this.onSearchChanged,
    required this.onSelect,
  });

  final JsonMap group;
  final List<JsonMap> channels;
  final JsonMap? generalChannel;
  final TextEditingController searchController;
  final bool loading;
  final int selectedId;
  final VoidCallback onSearchChanged;
  final ValueChanged<int> onSelect;

  static const _tones = [
    Color(0xFFE8F0FF),
    Color(0xFFE9F7F1),
    Color(0xFFFFF0E2),
    Color(0xFFF1EAFE),
    Color(0xFFE7F5F8),
    Color(0xFFFFEAF0),
  ];

  @override
  Widget build(BuildContext context) {
    final entries = channelPreviews(
      channels,
      generalChannel: generalChannel,
      query: searchController.text,
    );
    return Material(
      color: Colors.white,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 9, 10, 13),
            child: SizedBox(
              height: 39,
              child: TextField(
                key: const ValueKey('mobile-channel-search'),
                controller: searchController,
                onChanged: (_) => onSearchChanged(),
                style: const TextStyle(fontSize: 12, color: Color(0xFF293F60)),
                decoration: InputDecoration(
                  hintText: 'Tìm kênh hội thoại...',
                  hintStyle: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF92A0B4),
                  ),
                  prefixIcon: const Icon(
                    Icons.search_rounded,
                    color: Color(0xFF7E90AC),
                    size: 18,
                  ),
                  prefixIconConstraints: const BoxConstraints(minWidth: 34),
                  suffixIcon: searchController.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Xóa tìm kiếm kênh',
                          onPressed: () {
                            searchController.clear();
                            onSearchChanged();
                          },
                          icon: const Icon(Icons.close_rounded, size: 17),
                        ),
                  suffixIconConstraints: const BoxConstraints(minWidth: 34),
                  filled: true,
                  fillColor: const Color(0xFFF6F8FC),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(11),
                    borderSide: const BorderSide(color: Color(0xFFE5EAF4)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(11),
                    borderSide: const BorderSide(color: Color(0xFFA7BDF3)),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : entries.isEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text(
                        'Không tìm thấy kênh phù hợp.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF91A0B4),
                        ),
                      ),
                    ),
                  )
                : ListView.builder(
                    key: const ValueKey('mobile-channel-picker'),
                    padding: const EdgeInsets.fromLTRB(7, 0, 7, 12),
                    itemCount: entries.length,
                    itemBuilder: (context, index) {
                      final channel = entries[index];
                      final selected = channel.id == selectedId;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 3),
                        child: Material(
                          color: selected
                              ? const Color(0xFFEAF1FF)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(11),
                          clipBehavior: Clip.antiAlias,
                          child: InkWell(
                            key: ValueKey('mobile-channel-${channel.id}'),
                            onTap: () => onSelect(channel.id),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 9,
                              ),
                              child: Row(
                                children: [
                                  _avatar(channel, selected),
                                  const SizedBox(width: 9),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Row(
                                                children: [
                                                  Flexible(
                                                    child: Text(
                                                      channel.name,
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: const TextStyle(
                                                        fontSize: 12,
                                                        fontWeight:
                                                            FontWeight.w800,
                                                        color: Color(
                                                          0xFF263D5B,
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                  if (channel.muted) ...[
                                                    const SizedBox(width: 4),
                                                    const Icon(
                                                      Icons
                                                          .notifications_off_outlined,
                                                      size: 13,
                                                      color: Color(0xFF8999B4),
                                                    ),
                                                  ],
                                                ],
                                              ),
                                            ),
                                            if (channel
                                                .lastMessageAt
                                                .isNotEmpty)
                                              Text(
                                                channelPreviewTime(
                                                  channel.lastMessageAt,
                                                ),
                                                style: const TextStyle(
                                                  fontSize: 10,
                                                  color: Color(0xFF9BA9BC),
                                                ),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 5),
                                        Text(
                                          channel.description.isEmpty
                                              ? 'Chưa đặt chủ đề'
                                              : channel.description,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: Color(0xFF788BA8),
                                          ),
                                        ),
                                        const SizedBox(height: 5),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                channel.lastMessage.isEmpty
                                                    ? 'Chưa có tin nhắn'
                                                    : channel.lastMessage,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  color: Color(0xFF8798AD),
                                                ),
                                              ),
                                            ),
                                            if (channel.unreadCount > 0)
                                              Container(
                                                margin: const EdgeInsets.only(
                                                  left: 4,
                                                ),
                                                height: 21,
                                                constraints:
                                                    const BoxConstraints(
                                                      minWidth: 21,
                                                    ),
                                                alignment: Alignment.center,
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 5,
                                                    ),
                                                decoration: BoxDecoration(
                                                  color: const Color(
                                                    0xFF4C81EA,
                                                  ),
                                                  borderRadius:
                                                      BorderRadius.circular(12),
                                                ),
                                                child: Text(
                                                  channel.unreadCount > 99
                                                      ? '99+'
                                                      : '${channel.unreadCount}',
                                                  style: const TextStyle(
                                                    color: Colors.white,
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                                ),
                                              ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _avatar(ChannelPreview channel, bool selected) {
    final imageUrl = channel.id == 0
        ? group['avatarUrl']?.toString()
        : channel.avatarUrl;
    final fallback = DecoratedBox(
      decoration: BoxDecoration(
        color: selected ? const Color(0xFF477BE2) : _tones[channel.tone],
        borderRadius: BorderRadius.circular(13),
      ),
      child: Center(
        child: Text(
          channel.initials,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: selected ? Colors.white : socoBlue,
          ),
        ),
      ),
    );
    return SizedBox.square(
      dimension: 42,
      child: imageUrl == null || imageUrl.isEmpty
          ? fallback
          : ClipRRect(
              borderRadius: BorderRadius.circular(13),
              child: Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => fallback,
              ),
            ),
    );
  }
}
