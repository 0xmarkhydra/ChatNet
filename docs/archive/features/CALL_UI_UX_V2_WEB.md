# ChatNet Web/PWA — Call UI/UX V2 (15/10/2026)

## Phạm vi
Chỉ đổi giao diện `SecureCallRoom` và xử lý quyền cho cuộc gọi trên Web/PWA. Không đổi Flutter/iOS native; giữ LiveKit E2EE, Gemini backend proxy, JWT, Redis session, quy tắc audio permission.

## Thiết kế
- Đồng bộ ChatNet/SocCo: gradient xanh tím, nền midnight navy, kính mờ nhẹ, góc bo iOS, shadow tinh tế, Lucide React.
- Topbar: avatar tên cuộc gọi, "Bảo mật", số người, trạng thái dịch; chi tiết kỹ thuật chỉ trong tooltip.
- Khu vực video: tile lớn, viền phát sáng tinh tế ở người đang nói, nhãn tên dạng pill.
- 5 điều khiển: Mic, Camera, Dịch AI, Thêm, Kết thúc. Menu Thêm: chia sẻ màn hình, âm thanh, phụ đề, cấp/thu hồi đồng ý AI.
- Dịch AI chỉ cần một nút bấm; người nghe có thể thu gọn/mở lại panel mà không dừng dịch. Video luôn còn không gian riêng.
- Desktop: panel dịch bên phải; tablet/mobile <=900px: bottom sheet, không kéo dãn hay ép nhỏ video. Thu gọn còn chip và phụ đề ngắn phủ phía dưới khu vực video.
- Bảng dịch: chọn ngôn ngữ, trạng thái kết nối, phụ đề người nói, lỗi và nút thử lại, nhắc quyền xử lý audio.
- Motion tinh tế, tắt animation khi `prefers-reduced-motion`, nút keyboard focus-visible, viewport safe-area iPhone.

## Xin quyền trên từng cuộc gọi
- Quyền trình duyệt **micro/camera**: luôn gọi API enable theo nhu cầu của cuộc gọi; nếu chưa cấp thì browser có thể hỏi lại. Nếu browser đã lưu "Từ chối", website không thể ép browser hiện hộp cấp quyền; phải chỉ đường vào cài đặt site để đổi quyền. Khi từ chối, giữ cuộc gọi kết nối, hiển thị card giải thích và nút **Cấp quyền** để thử lại, không tự hạ mức E2EE hay thoát cuộc gọi.
- Quyền **AI dịch giọng nói**: khởi tạo là `false` ở mỗi call ID; không đọc lưu localStorage và không kế thừa từ cuộc gọi cũ. Chỉ truyền audio của người khác lên Gemini sau khi nhận DataPacket đồng ý của chính người nói. Nếu người nói chưa đồng ý, hiện một thẻ lời mời có hai lựa chọn `Cho phép` / `Để sau`; không có checkbox thường trực.
- Nếu dịch bật trước khi thành viên mới tham gia: gửi lại yêu cầu đồng ý khi họ vào. Khi thành viên rời phòng, xóa trạng thái đồng ý của họ; nếu quay lại thì xin lại.
- Tắt dịch / rời cuộc gọi phải stop các phiên dịch audio, không lưu transcript ở frontend ngoài state của phòng.

## Checklist nghiệm thu
- Desktop >= 1024: video grid đúng tỉ lệ, panel dịch rộng 316-354px, không tràn.
- Tablet/mobile <=900: panel overlay bottom sheet; màn iPhone 320/375/390 không tràn ngang, footer 5 nút dễ bấm.
- Kết nối 2 người: bật/tắt mic/camera, bấm dịch AI một lần, hỏi đồng ý người nói, thu gọn và mở lại phụ đề, âm thanh dịch chạy.
- Nhóm: thành viên vào muộn và rời/đăng nhập lại, quyền AI được kiểm soát theo từng participant và từng call.
- Quyền mic/camera: mới cấp, đã cho phép, từ chối một lần, chặn trong site settings, retry.
- Accessibility: Tab/Enter/Escape cơ bản, đọc screen reader label, reduced motion.
- Giữ bảo mật: key Gemini chỉ ở backend, E2EE vẫn bắt buộc trong phòng LiveKit; AI processing riêng khi có đồng ý.

## Kiểm thử tự động
`cd frontend && npm run build && npm run check:call-ux && npm run check:call-live`
`cd backend && go test ./...`

Lưu ý: browser layout smoke sử dụng fixture có markup đại diện; không thay thế e2e hai tài khoản thật sử dụng media device và phiên dịch Google.
