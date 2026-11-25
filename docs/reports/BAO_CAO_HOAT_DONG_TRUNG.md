# Báo cáo: Trung đã làm gì trên ChatNet

Lập ngày 2026-11-25, từ lịch sử git của `main`. Số liệu là thật; phần mô tả dựa trên tiêu đề commit, chưa đọc từng diff.

## Tóm tắt nhanh

Trong 14 ngày (11/11 → 25/11), bạn có **676 commit** (hơn một nửa repo), khoảng **80 PR**, gần như toàn bộ ở `frontend/`. Công việc gồm bốn mảng:

1. **Tái cấu trúc code**: tách `App.tsx` 8.982 dòng thành kiến trúc theo feature (còn 42 dòng).
2. **Thiết kế và sửa giao diện**: Explore, Profile, Feed, Search, Marketplace, Contacts, header/sidebar, navbar mobile.
3. **Tái cấu trúc CSS và component**: chuyển sang Tailwind và design token, dọn CSS chết, gom component dùng chung.
4. **Chất lượng**: Router, test, script kiểm tra, CI, tài liệu.

(Tôi coi `trung02032001@gmail.com` và `Trung020301` là cùng một người. 181 trong 676 commit có nội dung liên quan trực tiếp tới giao diện/CSS.)

## 1. Thiết kế và sửa giao diện

| Màn hình | Đã làm |
|---|---|
| **Explore (Discover)** | Làm trang khám phá xã hội giai đoạn 1, bố cục hai cột giữa, rồi bản v2 lấy dữ liệu từ API; chỉnh trạng thái rỗng và responsive. |
| **Profile** | Thiết kế lại hồ sơ khách theo kiểu Facebook: hero căn giữa theo cột nội dung, sidebar dính (sticky), card bài viết mới; sửa form chỉnh sửa hồ sơ. |
| **Feed** | Header feed mới (tab, màu, chữ theo token), card bài viết tách avatar và tên tác giả, bỏ nút lưu trùng, card tràn lề trên mobile; làm lại trang bình luận. |
| **Shell v2** | Sidebar và header mới; thiết kế lại header desktop; thanh tìm kiếm dùng chung. |
| **Search** | Trang kết quả mới (S08): bộ lọc, tìm kiếm đã lưu, gợi ý khi gõ, trạng thái không có kết quả; ẩn header trên route search. |
| **Marketplace** | Thiết kế lại và thêm component `SearchField` dùng chung (làm trong nhánh gần đây). |
| **Contacts** | Tổng quan bạn bè theo thiết kế Penpot: lời mời, mã QR, mật độ và chuyển động gọn hơn, hỗ trợ truy cập (a11y), trạng thái tải/thử lại. |
| **Navbar mobile** | Thanh điều hướng dưới dạng kính nổi chỉ có icon, ẩn khi cuộn xuống và hiện khi cuộn lên (làm cùng nhau trong phiên này). |
| **Chat** | Mention thành viên, cải tiến ô soạn tin, căn lại icon sidebar với nhãn điều hướng. |

Sửa lệch với thiết kế Penpot cũng nhiều: "align-header-with-penpot", "penpot-header-parity".

## 2. Tái cấu trúc CSS và component

- **Tailwind**: dựng nền Tailwind cho UI, rồi chuyển dần từ CSS viết tay sang Tailwind: post card, profile, bố cục cột feed, bình luận, search, form chỉnh sửa hồ sơ.
- **Design token**: gom token ngữ nghĩa dùng chung cho shared/feed/profile/contacts; thêm token z-index và vòng focus; thay mã hex lặp lại bằng token màu SocCO; bỏ giá trị dự phòng cho biến đã khai ở root.
- **Dọn CSS**: xóa rule chết và stylesheet không còn import; tách post card khỏi CSS cũ của bài viết; giới hạn phạm vi CSS của nút trang.
- **Component dùng chung**: nút, form, hộp thoại, menu, `SearchField`; thống nhất header sidebar; tài liệu cho post card và shared UI.
- **Chốt chặn**: CI chặn CSS mới trái chính sách Tailwind; có baseline "design debt" để nợ giao diện không tăng.

## 3. Tái cấu trúc code (không đổi giao diện)

- **`App.tsx`: 8.982 → 42 dòng.** Chia thành vỏ đăng nhập (auth shell) và `AuthedApp` (hiện 2.856 dòng, vẫn đang tách tiếp).
- Tách state và hành động thành hook theo feature; thêm lớp API riêng cho chat, feed, contacts, profile, settings.
- Chia logic chat thành các phần nhỏ: soạn tin, tìm kiếm, tin nhắn hẹn giờ, quản trị nhóm, danh bạ thành viên nhóm, đồng bộ kênh live.
- Số file trong `frontend/src`: 195 → 783.

## 4. Router và độ bền

- Cây route và outlet; link chia sẻ được cho hội thoại, cuộc gọi, mục cài đặt, bài viết; chuyển hướng link cũ.
- Cô lập dữ liệu giữa các phiên đăng nhập, nên không còn rò state khi đổi tài khoản.
- Trang lỗi/lazy-load có thể thử lại; chứa lỗi render theo route; bẫy focus trong trình xem ảnh/video.

## 5. Kiểm tra, CI, tài liệu

- **Test**: 216 file, 676 case (Vitest); bạn thêm khoảng 178 file test.
- **Script kiểm tra**: 28 file trong `frontend/scripts` (ranh giới kiến trúc, lint ratchet, design-system, API, bố cục chat responsive…).
- **CI**: các cổng chất lượng frontend và chính sách Tailwind.
- **Tài liệu** (`docs/`): cấu trúc frontend, chuẩn frontend, quyền sở hữu file khi nhiều agent làm song song, design system, post card, shared UI, UI foundation, mẫu PR.
- **Công cụ**: tích hợp skill `ui-ux-pro-max`, ESLint react-hooks có baseline không thụt lùi.

## 6. Dòng thời gian

| Ngày | Trọng tâm |
|---|---|
| 12/11 | Tách `App.tsx`, dựng kiến trúc, hook, lớp API |
| 13/11 | Chuẩn React 19, hợp đồng API, bắt đầu Vitest |
| 14–15/11 | Router, link chia sẻ, cô lập phiên |
| 16/11 | Nhiều sửa lỗi nhỏ (129 commit, ngày nhiều nhất) |
| 17–18/11 | Search S08, Contacts, Explore giai đoạn 1 |
| 19–20/11 | Explore v2, Profile kiểu Facebook, Shell v2, Tailwind |
| 22–23/11 | Tiếp tục Tailwind, Search mới, tách logic chat |
| 24–25/11 | Navbar mobile, dọn CSS và token, dọn hook chết |

## 7. Cần để ý

1. **353/676 commit không theo Conventional Commit** (kiểu `fix-xxx-yyy`), trái quy ước trong CLAUDE.md. Lịch sử đã merge nên chỉ cần chú ý từ nay.
2. **`AuthedApp.tsx` vẫn lớn** (2.856 dòng) và còn đang tách.
3. **Navbar mobile chưa kiểm tra trực quan** trên feed đã đăng nhập; nguy cơ bài cuối bị che hoặc ẩn/hiện bị giật gần đáy.
4. **Số dòng +208k/−30k không đáng tin** vì dữ liệu skill `ui-ux-pro-max` chiếm nhiều; đừng dùng đo khối lượng.
5. PR 285 (xóa hook chết) đang mở, chưa merge.
6. Chưa kiểm tra lint, test hay CI trên `main` khi lập báo cáo.
