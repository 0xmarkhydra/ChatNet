# ChatNet / SOCO — Bộ tài liệu bàn giao mạng lưu trữ media phân tán

**Cập nhật:** 16/11/2026  
**Trạng thái:** Đặc tả phục vụ phân tích và thử nghiệm — **chưa triển khai**, chưa bật tính phí, chưa được phép xóa file S3/R2 production.

## Dành cho nhân sự mới: đọc theo thứ tự

| Thứ tự | Tài liệu | Mục đích |
| --- | --- | --- |
| **01 — BA A–Z (đọc trước)** | [CHATNET_DISTRIBUTED_MEDIA_RECOVERY_BA_HANDOFF.md](CHATNET_DISTRIBUTED_MEDIA_RECOVERY_BA_HANDOFF.md) | Bối cảnh, yêu cầu nghiệp vụ, luồng gửi/nhận, chat nhóm, đăng ký node, lưu mảnh, truy cập lại có phí, trường hợp lỗi, API/DB logic và backlog phân công |
| **02 — RFC kiến trúc** | [CHATNET_DISTRIBUTED_MEDIA_RECOVERY_SPEC.md](CHATNET_DISTRIBUTED_MEDIA_RECOVERY_SPEC.md) | Mô hình E2EE, erasure coding, storage node tự nguyện, audit/repair, nguyên tắc xóa bản relay và mô hình thưởng |
| **03 — QA/UAT** | [CHATNET_DISTRIBUTED_MEDIA_RECOVERY_QA_MATRIX.md](CHATNET_DISTRIBUTED_MEDIA_RECOVERY_QA_MATRIX.md) | Các case bắt buộc, điều kiện chặn release, biểu mẫu ghi nhận kết quả và bằng chứng nghiệm thu |

## Ý tưởng cốt lõi

1. Ảnh/video/voice/file được tối ưu trước khi mã hóa đầu cuối; server chuyển tiếp qua S3/R2 trong thời gian tạm.
2. Bản ciphertext có thể được chia thành nhiều mảnh và phân phối cho các máy **tình nguyện** làm Storage Node; người dùng được chọn ổ đĩa, thư mục, hạn mức.
3. File cũ không còn bản local/cloud có thể **“Truy cập lại”** từ các node, với khoản phí nhỏ được **báo trước và chỉ quyết toán khi khôi phục thành công**; các node đủ điều kiện nhận thưởng.
4. Không yêu cầu blockchain/token on-chain. Giá Coin/VNĐ, reward và mốc 40 ngày vẫn cần duyệt/kiểm chứng.
5. **Không được tự xóa bản S3/R2 cuối cùng** chỉ vì đã hết 40 ngày: phải có bằng chứng đủ mảnh, độc lập failure-domain, kiểm toán và thử khôi phục thành công.

## Các phần phụ thuộc trong dự án

- [E2EE Implementation Master Plan](../../archive/features/E2EE_IMPLEMENTATION_MASTER_PLAN.md) — trạng thái E2EE và điều kiện triển khai.
- [Point/Coin Product Spec](../CHATNET_POINT_COIN_PRODUCT_SPEC.md) — nền tảng kinh tế nội bộ, chưa chốt dùng loại nào cho phí truy cập lại.
- [Media Access Revocation](../../archive/features/MEDIA_ACCESS_REVOCATION.md) — nguyên tắc cấp, thu hồi quyền media.

## Phạm vi bàn giao / hướng triển khai

**BA/PM:** duyệt yêu cầu, giá/đơn vị phí, chính sách xóa, giữ file và quyền của thành viên nhóm.  
**Backend + Storage/desktop:** triển khai thử registry, 4-of-6 POC, agent opt-in, audit, repair, recovery, ledger giả lập.  
**Frontend:** luồng upload E2EE, trạng thái file, báo giá, xác nhận, tiến độ và thông báo lỗi.  
**QA/Security/SRE:** thực thi ma trận P0 và báo cáo bằng chứng; chặn rollout khi chưa đạt độ bền, bảo mật, kinh tế.

**Điều kiện bàn giao code:** mỗi task có owner, mã BR/UC, contract, dữ liệu, rủi ro, test và bằng chứng. Không coi tài liệu là bằng chứng hệ thống đang hoạt động.

> Bộ hồ sơ này chỉ gom **ba tài liệu của chức năng Distributed Media Storage**. Các tài liệu E2EE/Point/Coin dùng chung toàn dự án được liên kết đến bản gốc để tránh có hai phiên bản khác nhau.
