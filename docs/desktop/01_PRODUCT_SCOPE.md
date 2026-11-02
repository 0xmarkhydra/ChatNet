# SOCO Desktop — Product Scope / PRD v1

**Ngày:** 30/10/2026 · **Trạng thái:** KẾ HOẠCH, chưa code · **Target:** Windows + macOS.
**Đích:** Desktop app dùng chung tài khoản/hội thoại với `chat.codelocal.cloud`, không dựng mạng xã hội hay hệ thống dữ liệu thứ hai.

## 1. User Journey (MVP/P0)

1. Người dùng tải bộ cài có ký, mở SOCO từ icon desktop, thấy giao diện SOCO; chọn cửa sổ nhỏ/lớn không tràn.
2. Đăng nhập email/OTP qua Auth hiện tại; desktop có thiết bị/phiên riêng, logout hoặc thu hồi từ thiết bị khác phải chấm dứt phiên.
3. Mở danh sách chat, tìm hội thoại, gửi/nhận text + file/voice, react/edit/recall, trạng thái đọc, chat nhóm và quyền nhóm; ảnh/media đúng scope.
4. Ngắt mạng rồi gửi: giữ bản nháp/hàng đợi, hiển thị trạng thái, khôi phục sau restart; khi nối lại không gửi trùng.
5. Gọi voice/video đơn và nhóm qua LiveKit; micro/camera được xin quyền khi cần; có chuông đến, thao tác nhận/từ chối, tắt mic/cam, kết thúc.
6. Bấm “Dịch” trong cuộc gọi, xem transcript/phụ đề và nghe bản dịch theo nghiệp vụ web; tuân thủ sự đồng ý người nói trước khi gửi âm thanh đến nhà cung cấp AI.
7. Khi thu nhỏ vào khay hệ thống, chat và chuông/notification vẫn chạy nếu tiến trình đang mở; nhấn thông báo mở đúng hội thoại.
8. Đóng hẳn ứng dụng -> không bảo đảm nhận push realtime; mở lại tự đồng bộ từ backend.
9. Có trạng thái update và có thể khởi động lại an toàn sau khi update; không mất phiên/hàng đợi.

## 2. Phạm vi chức năng

| ID nhóm | Hạng mục | P0 — Beta tối thiểu | P1 — sau Alpha | P2 / ngoài phạm vi |
|---|---|---|---|---|
| D-UI | Shell, UI desktop | Native frame/tray, resize, 2–3 vùng, shortcut cơ bản, dark/light kế thừa nếu có | split pane, đa cửa sổ | hiệu ứng trang trí nặng |
| D-AUTH | Danh tính | OTP/login/logout/refresh/revoke, kho phiên an toàn | device session UX tối ưu | ví Web3 mới |
| D-MSG | Tin nhắn | chat, nhóm, media, read, reaction, edit/recall, tìm kiếm, offline retry | drag/drop đa file, copy định dạng, quick reply | hệ nhắn tin khác backend |
| D-CALL | LiveKit | thoại/video 1:1 + nhóm, thiết bị, ringtone, permission, reconnect | chia sẻ màn hình/cửa sổ | tự ghi âm cuộc gọi |
| D-TRANS | AI | dịch text + dịch call/trang bên cạnh, nút dịch đơn giản | điều khiển phím tắt | gọi Gemini trực tiếp từ desktop |
| D-NOTI | Notification | native OS, badge, click mở hội thoại, chống thông báo trùng khi active | thông báo có action nhanh | push khi tiến trình đã thoát |
| D-SOCIAL | Feed/Profile | giữ thao tác thiết yếu cần cho parity Web: feed/story, profile, friends/QR, privacy | tối ưu UI desktop, quản lý nhiều ảnh | mở nghiệp vụ mới |
| D-MKT | Marketplace | giữ truy cập tính năng đã có, không phá tính năng Web | AI đăng bán/đơn hàng khi backend sẵn sàng | tự quyết Coin/VNĐ |
| D-OPS | Distribution | build + ký + update/rollback + crash report an toàn | staged rollout | Linux ở beta đầu |

P0 là **điều kiện để công bố beta**, không có nghĩa mọi tính năng Web đã production-ready. Khi backend thiếu nghiệp vụ, Desktop phải phản ánh đúng trạng thái và không mô phỏng thanh toán/đăng bán như đã thật.

## 3. UX & trạng thái bắt buộc

- Tối ưu màn hình desktop 1280×720 trở lên, đồng thời không tràn khi cửa sổ nhỏ; xác định kích thước tối thiểu sau spike. **Không ép cả ứng dụng cuộn dọc**, panel có scroll độc lập.
- Chat: sidebar conversations → nội dung chat → panel chi tiết tùy chọn; số chữ gọn, focus input sau gửi, điều hướng bằng keyboard.
- File: drag/drop an toàn, giới hạn MIME/kích thước theo API hiện tại; mở file phải bảo vệ chống path traversal.
- Notification không lộ nội dung nhạy cảm khi người dùng tắt preview; click thông báo chỉ chuyển hội thoại nếu session vẫn hợp lệ và quyền chưa bị thu hồi.
- Trạng thái network: offline, reconnect, send queued, unconfirmed (mất ACK), failed (lỗi vĩnh viễn), sent/read. Không báo “đã gửi” khi backend chưa xác nhận.
- Nếu desktop không có quyền mic/camera/screen: giải thích lý do và hướng dẫn cấp quyền trong OS; không xin quyền liên tục không có hành động.
- Nếu update thất bại: app cũ vẫn mở, có nút retry; dữ liệu offline được giữ nguyên, không buộc user mất session.

## 4. Bất biến nghiệp vụ và quyền riêng tư

- Backend vẫn là nguồn chân lý về auth, block/privacy, membership, moderation, Feed, Marketplace; desktop không tự sửa logic server.
- Không phát push cho tin nhắn của chính user; không “ding” khi tải lịch sử; không lặp lại thông báo do hai kênh cùng gửi.
- Voice/video E2EE và cơ chế đồng ý dịch như `docs/CALL_LIVE_TRANSLATION_WEB.md`; stream âm thanh đến provider cần sự đồng ý của speaker.
- Dữ liệu Point/Coin không được mặc định thay thế VNĐ; checkout chỉ làm theo quyết định nghiệp vụ đã duyệt.
- Người dùng có thể logout từ mọi cửa sổ; những dữ liệu nhạy cảm offline phải bị xóa theo account sau logout/revoke, không trộn tài khoản.
- Không lưu mật khẩu/OTP, media signed URL, Gemini key hoặc token plaintext trong logs/localStorage của Desktop.

## 5. Ra khỏi phạm vi bản đầu

- Không làm lại thiết kế mobile native; không thêm native iOS/Android.
- Không tự phát triển protocol chat, video engine, AI service, backend/DB mới.
- Không cho Electron tải và chạy JS remote “nóng” như một cách cập nhật; chỉ cập nhật gói đã ký qua release pipeline.
- Không coi screenshot/mock API là chứng cứ tính năng hoàn thành; bắt buộc test API thật ở UAT.
- Linux, cửa sổ đa tài khoản đồng thời, auto-start mặc định, native screen audio capture đa OS: cần quyết định/đợt sau, không khóa Alpha.

## 6. Kết quả kỳ vọng

- Một tài khoản chat web và desktop với hai session độc lập, dữ liệu đồng nhất, logout/revoke đúng.
- Windows và macOS không cần cài Node hay trình duyệt ngoài để chạy ứng dụng.
- Tối thiểu 2 máy thật (Windows, macOS) được QA có ghi bằng chứng trước khi beta.
- File cài và cập nhật có nguồn gốc xác minh được; không phát bản không ký như bản sản xuất chính thức.

**Thông tin pháp lý/phát hành cần chốt** được theo dõi tại [04_QA_RELEASE_GATES.md](04_QA_RELEASE_GATES.md).
