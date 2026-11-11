# SOCO Newsfeed — Threads-inspired UI audit and scoped backlog

**Ngày rà soát:** 11/11/2026
**Nguồn:** Git `origin/main` tại `35d5216`, đọc trực tiếp React/Vite và Go feed service.
**Phạm vi:** SOCO Social Newsfeed Web/PWA (mobile trước, desktop responsive); không sửa Marketplace, Coin/Point, Chat, quyền truy cập hay backend khi chưa có hợp đồng API.
**Trạng thái:** Vòng polish UI đầu tiên nằm trên nhánh `feat/feed-threads-audit-20261111`, chưa merge/main và chưa deploy.

## Mục tiêu UX

Giữ nhận diện SOCO xanh–tím, nhưng theo bố cục đọc của Threads: **một cột nội dung chính (khoảng 600–640px), avatar/tên/thời gian gọn, post nối tiếp bằng divider mảnh, bốn icon tương tác gọn với vùng chạm 44px, composer chỉ mở sâu khi cần, cuộn mượt và trạng thái dữ liệu rõ**. Không sao chép logo/assets của Threads, không đánh đổi chức năng đang có.

## Đã có trong code

- `PostComposer.tsx`: nội dung + ảnh/video/album/nền chữ; quyền xem công khai/bạn bè/riêng tư; draft upload, API tạo bài thật.
- `FeedPostCard.tsx`, `FeedLikeButton.tsx`, `FeedPostActions.tsx`: hiển thị bài, thích, bình luận, chia sẻ URL qua Web Share/Clipboard, lưu, sửa/xóa/report.
- `FeedDiscussion.tsx`: bình luận/trả lời, chỉnh sửa/xóa/report theo quyền.
- `useFeedData.ts`, `useFollowingPosts.ts`, `usePostSearch.ts`, `useFeedInfiniteScroll.ts`: feed, following, tìm kiếm, phân trang/đang tải/lỗi.
- `StoryViewer.tsx` và `SocialFeedStories.tsx`: danh sách và trải nghiệm Story; moderation có API.
- `backend/cmd/feed/main.go`: posts, comments, reactions, stories; `manage.go`: save/edit/delete/report; có kiểm tra privacy/block.
- Các thiết kế tham khảo Social V4 ở `docs/SOCCO_SOCIAL_DESKTOP_V4_PENPOT_HANDOFF.md` là prototype, **không chứng minh API đã hoàn chỉnh**.

## Các vấn đề đã xác minh

1. **Bố cục rối và nhiều khối viền:** `frontend/src/styles/social-feed.css` dựng Stories, composer, filter, từng post thành card bo tròn + shadow riêng. Mobile còn hiển thị toàn bộ `PostComposer` trực tiếp giữa dòng feed.
2. **Thanh thao tác kiểu 4 ô lớn:** `FeedPostCard.tsx` + CSS áp `grid-template-columns: repeat(4,...)`; giống bảng thao tác hơn là Threads. Đã đổi bước đầu sang 4 icon compact có tên truy cập hỗ trợ.
3. **Chia sẻ bị nhầm thành số liệu:** trước khi sửa, `FeedPostCard` luôn in `... bình luận · Chia sẻ` dù `Post` không có `shareCount`. Đã bỏ nhãn gây hiểu lầm.
4. **“Dành cho bạn” chưa phải feed gợi ý:** `backend/cmd/feed/main.go` thực thi `ORDER BY p.id DESC` khi scope=all; chưa có ranking hay đề xuất theo sở thích.
5. **“Đang theo dõi” là bài của bạn bè:** API scope=following thực tế lọc `friend_connections.status='accepted'`, không phải quan hệ follow tác giả độc lập; UX cần làm rõ trước khi dùng tên “following”.
6. **Chưa có repost/quote của Threads:** `FeedShareAction` chỉ Web Share / clipboard; Go feed routes không có API repost, quote, thống kê share.
7. **Tốn truy vấn/khó mở rộng khi đông bài:** `backend/cmd/feed/main.go` với mỗi post gọi `attachPostReactions`, `comments`, `postAttachments`; `comments()` hiện lấy toàn bộ bình luận theo bài, chưa phân trang riêng hoặc trả `commentCount` có giới hạn truy vấn.
8. **Trạng thái notification social chưa đầy đủ:** tài liệu V4 mobile xác nhận Activity mới tổng hợp message/friend requests, chưa có event like/comment/mention; cần một API event thực, không mock.
9. **Kiểm thử cũ đã lệch UI hiện hành:** `check-social-ui.mjs` từng đòi picker emoji ở PostCommentsPage trong khi component hiện dùng `FeedLikeButton`; `run-ui-layout.mjs` thất bại ở focus search (không thuộc thay đổi feed). Phải cập nhật test theo giao diện thực, không hạ chuẩn chỉ để xanh CI.

## Backlog theo thứ tự ưu tiên

Các mã dưới đây **chỉ để phân công**; chưa tạo task trên Plane.

| Mã | Mức | Việc cụ thể | Nơi làm | Điều kiện hoàn thành |
|---|---|---|---|---|
| NF-01 | P0 | Một cột Newsfeed kiểu Threads, card nối bằng divider, nhịp spacing và header tác giả gọn | `social-feed.css`, `FeedPostCard.tsx` | Desktop 1440/1024 và phone 390/320 không tràn, layout nhất quán, không mất Story/side modules |
| NF-02 | P0 | Composer mobile rút thành avatar + prompt + ảnh; dialog giữ nháp, thêm media, quyền xem, trạng thái đăng | `App.tsx`, `PostComposer.tsx`, `ProfileOverlay.tsx` | Mặc định không chiếm nhiều màn; mở/đóng bằng chạm/ESC; đăng thất bại giữ bản nháp |
| NF-03 | P0 | Toolbar post icon-first: Thích/Bình luận/Chia sẻ/Lưu, ba chấm độc lập, chỉ số thực | `FeedPostCard.tsx`, `feed-actions.css` | 44px touch, keyboard/aria, không có share count giả, phản hồi liked/saved/pending đúng API |
| NF-04 | P0 | Trang/overlay bình luận mobile như một luồng hội thoại: thread/reply/menu, focus keyboard, long text | `PostCommentsPage.tsx`, `FeedDiscussion.tsx`, `post-comments-page.css` | Mở từ post → viết/trả lời → quay lại đúng vị trí; không che input bởi bàn phím iOS |
| NF-05 | P0 | Responsive & visual regression ở 320/390/768/1024/1440; hover/focus/pressed/loading/disabled/dark + reduced-motion | `check-social-ui.mjs`, `run-ui-layout.mjs`, CSS | Test layout và tương tác tại các breakpoint; chụp before/after; giải quyết test baseline lệch hiện tại |
| NF-06 | P1 | Feed header/tabs: tab Dành cho bạn, Bạn bè, Mới nhất, Đã lưu — đúng ý nghĩa dữ liệu | `App.tsx`, `useFollowingPosts.ts`, `main.go` | Label không đánh tráo “following”; scope đúng, scroll/URL state bền khi chuyển tab |
| NF-07 | P1 | Repost/quote post thật, không chỉ copy link; số lần repost/share | Go API, DB migration, `FeedPostActions` | Repost/quote xuất hiện trong feed, tránh duplicate, permission/private/block và đếm đúng |
| NF-08 | P1 | Phân trang bình luận + `commentCount` + tối ưu N+1 feed | `backend/cmd/feed/main.go`, Go tests, `FeedDiscussion` | GET feed không truy vấn mọi comment của từng post; scroll bình luận từng trang, count thống nhất |
| NF-09 | P1 | Tạo/sửa bài có nhiều media: reorder, remove, upload retry, progress, giữ draft khi offline/lỗi | `PostComposer.tsx`, `FeedPostActions.tsx`, media API | Hủy không upload; không đăng trùng; edit ảnh/video hoạt động thật thay vì chỉ sửa text |
| NF-10 | P1 | Thông báo Newsfeed: like, reply, mention, repost, deeplink về bài | feed event API, notification service, UI activity | Chỉ người có quyền nhận; badge/count đúng; click mở đúng bài/bình luận |
| NF-11 | P1 | Feed loading/skeleton, refresh, empty/error retry, search/pagination state | `useFeedData`, `usePostSearch`, `useFeedInfiniteScroll` | Mất mạng không trắng màn; retry không nhân đôi bài; chuyển account không lộ cache |
| NF-12 | P1 | Ảnh/video feed: grid album, preview, accessibility, hạn chế tải trước và native player controls | `MediaAttachmentsView`, `FeedPostCard`, CSS | 1–N ảnh đúng tỉ lệ, không crop sai, video không tự mở detail khi thao tác playback |
| NF-13 | P2 | Story caption/audience/editor rõ luồng, không trộn vào main feed | `StoryViewer`, Story composer, API | Story có audience và status thật; không mock sticker/crop nếu API chưa hỗ trợ |
| NF-14 | P2 | Moderation, privacy, hide/report/block từ post; quan sát hiệu năng | `FeedPostActions`, `FeedModeration`, Go auth/privacy tests | Không xem được bài cấm/blocked, menu chỉ hiện quyền hợp lệ, scroll ổn dưới tải |

## Vòng UI đầu đã làm trong branch

- Mobile launcher gọn + `ProfileOverlay` tạo bài cho cả desktop và mobile.
- Post stream desktop phẳng, bớt bo góc/đổ bóng, phân cách bằng divider; nút tương tác icon-only với vùng chạm tối thiểu 44px.
- Thống kê chỉ hiển thị like và comment có dữ liệu thật; bỏ nhãn “Chia sẻ” giả.
- Bổ sung kiểm thử độc lập `node frontend/scripts/check-social-ui.mjs --threads-only` từ `frontend`.

## Chất lượng và giới hạn

- **PASS:** `npm --prefix frontend run build`; `node frontend/scripts/check-social-ui.mjs --threads-only` chạy trong `frontend` (desktop 1586 & mobile 390, modal, buttons, overflow).
- **FAIL (đang có trong test suite toàn diện):** `check:social-ui` còn assertion picker emoji cũ ở PostCommentsPage; `check:ui` fail search focus outline. Không coi đây là PASS.
- **NOT RUN:** Safari iPhone, Android thật, media/call backend, load testing DB, kiểm tra production live sau thay đổi.
- **Không tạo task trên Plane và chưa merge/deploy**. Vì từng yêu cầu xóa backlog cũ, chỉ gửi danh sách ở đây để bạn duyệt, không tự tạo 14 work item.

## Thứ tự triển khai khuyến nghị

**Đợt A (UI first):** NF-01 → 05. **Đợt B (hành vi + API):** NF-06/08/09/11/12. **Đợt C (mạng xã hội hoàn chỉnh):** NF-07/10/13/14. Mỗi đợt là PR độc lập, có screenshot và kiểm thử ở mobile & desktop trước khi phát hành.
