# ChatNet / SOCO — Distributed Media Storage & Paid Re-access (RFC)

**Ngày:** 16/11/2026  
**Trạng thái:** PRODUCT DISCOVERY / ĐẶC TẢ ĐỊNH HƯỚNG — **chưa triển khai, chưa bật thu phí, chưa chứng minh độ bền**  
**Phạm vi:** chat riêng tư 1-1 và nhóm; Web/PWA giai đoạn đầu; Storage Node tùy chọn trên desktop ở giai đoạn thử nghiệm sau.  
**Liên quan:** [E2EE Master Plan](../E2EE_IMPLEMENTATION_MASTER_PLAN.md), [Point/Coin Product Spec](../CHATNET_POINT_COIN_PRODUCT_SPEC.md), [Media Access Revocation](../MEDIA_ACCESS_REVOCATION.md).

> Ký hiệu: **[CHỐT]** = chủ sản phẩm đã xác nhận trong buổi trao đổi; **[ĐỀ XUẤT]** = hướng kỹ thuật/UX chưa được duyệt; **[CHƯA CHỐT]** = quyết định không được tự suy đoán khi code.

## 1. Mục tiêu và nguyên tắc sản phẩm

- **[CHỐT]** Người dùng gửi/nhận media thuận tiện ở chat 1-1 và chat nhóm; media được tối ưu trước khi mã hóa. Đích dài hạn: giảm chi phí lưu trữ tập trung, đồng thời hỗ trợ khôi phục file cũ an toàn và tốt hơn mô hình chỉ xóa file.
- **[CHỐT]** Hệ thống cho phép người dùng **tự nguyện đăng ký máy làm nơi lưu trữ hộ** (Storage Node), chọn ổ đĩa/thư mục, dung lượng, giới hạn băng thông và thời gian hoạt động; ưu tiên ổ dữ liệu không chứa hệ điều hành trên Windows (ví dụ D:, E:, F:). Không âm thầm chiếm dụng ổ C: hoặc tài nguyên của máy.
- **[CHỐT]** Mạng lưu trữ là chức năng tích hợp của ChatNet; **không bắt buộc blockchain**, không phát hành token blockchain để làm MVP. Máy lưu trữ nhận thưởng theo đóng góp thực tế đã được chứng minh.
- **[CHỐT]** Sau khi bản tạm trên S3/R2 được xóa, người có quyền có thể chọn **“Truy cập lại”** để hệ thống tìm mảnh dữ liệu, tải/ghép file, giải mã trên thiết bị. **Mỗi lần truy xuất từ mạng lưu trữ sau thời hạn lưu tạm có thu một khoản phí nhỏ** (tiền hoặc Credit nội bộ, chính sách cụ thể chưa chốt).
- **[CHỐT]** Không bắt buộc người dùng kết nối Drive/iCloud. Sao lưu cá nhân là lựa chọn thêm.
- **[RÀNG BUỘC]** Không thể cam kết khôi phục 100% nếu mọi bản dữ liệu hữu ích đã mất, không đủ mảnh, hoặc người dùng mất khóa E2EE. Hash không phải bản sao lưu.

## 2. Thuật ngữ người dùng và cách hiển thị

| Thuật ngữ UI | Ý nghĩa |
| --- | --- |
| **Xem file** | Mở file còn trên máy (không phải truy xuất mạng lưu trữ). |
| **Tải xuống** | Tải file còn trong thời gian chuyển tiếp thông thường. |
| **Truy cập lại** | Lấy file đã hết thời gian lưu tạm từ mạng Storage Node. **Thông báo mức phí trước khi xác nhận**. |
| **Đã sao lưu an toàn** | Có khả năng khôi phục đã được kiểm chứng theo chính sách; không tương đương “được bảo đảm vĩnh viễn”. |
| **Cung cấp dung lượng** | Người dùng chọn máy/ổ/thư mục làm Storage Node và nhận thưởng theo điều kiện công bố. |

Không gọi đây là “blockchain” trong UI khi chưa dùng blockchain thực; mô tả là **mạng lưu trữ phân tán của ChatNet**. Không giấu khoản phí dưới nút “Xem”; hiển thị rõ “Truy cập lại — dự kiến X Coin/Credit” trước thao tác có tính phí.

## 3. Kiến trúc tham chiếu [ĐỀ XUẤT]

```text
Thiết bị gửi: nén/tối ưu → E2EE → ciphertext → S3/R2 relay tạm
                                      │
                                      ├─ metadata/quyền + manifest không chứa khóa rõ
                                      │
                                      └─ erasure coding ciphertext → nhiều Storage Node độc lập
                                                            │
             hệ thống giám sát proof/audit, node health, repair, lease & rewards
                                                            │
Người nhận → “Truy cập lại” → auth + quote phí → reserve giao dịch
          → chọn đủ node/mảnh → tải & xác minh hash → ghép ciphertext
          → thiết bị giải mã/kiểm tra → xác nhận thành công → settle phí
          → nếu thất bại: hủy giữ tiền/hoàn phí
```

### Ranh giới bảo mật

- ChatNet API, storage nodes, PostgreSQL, Redis, S3/R2 **không có plaintext media hoặc khóa E2EE**. Khóa file và manifest nhạy cảm được trao đổi trong E2EE envelope được xác thực (tham chiếu master plan).
- Mã hóa **trước khi phân mảnh**, tính hash theo **ciphertext/mảnh ciphertext**; ID ngẫu nhiên. Tránh global plaintext hash/dedup để giảm rủi ro lộ thông tin liên hội thoại.
- Quyền truy cập phải được kiểm tra lại khi truy xuất (group membership, block, recall, quyền sở hữu, chính sách chia sẻ), nhưng không thể “thu hồi” bản đã được bên khác tải và giữ trước đó.
- Node chỉ phục vụ mảnh mã hóa qua giao thức xác thực, giới hạn quyền và tốc độ. Không công khai đường dẫn file, IP node hoặc membership hội thoại cho người yêu cầu nếu không cần thiết.
- Thiết kế khôi phục khóa khi đổi máy là dự án bảo mật riêng; không escrow khóa plaintext tại server. Không gắn nhãn “E2EE mặc định” khi sản phẩm chưa qua kiểm thử và rollout.

### Erasure Coding / tính bền vững

- POC thử chính sách **4-of-6**: 4 mảnh dữ liệu có thể tái tạo bản mã hóa; dung lượng lưu lý thuyết khoảng 1,5× ciphertext. Đây là **tham số thử nghiệm**, không phải độ an toàn được bảo đảm.
- Phân bố mảnh trên những node thuộc chủ máy / ổ / mạng / khu vực khác nhau, tránh sáu node cùng một người hoặc cùng ổ đĩa.
- Registry theo dõi `media_id`, `ciphertext_version`, `shard_id`, `shard_hash`, `node_id`, `placement`, `lease_until`, `last_verified_at`, `health`, `repair_state` và trạng thái lưu tạm; **không** lưu khóa giải mã.
- Thực hiện kiểm tra sở hữu dữ liệu dựa trên challenge/proof thích hợp, audit ngẫu nhiên; heartbeat đơn thuần **không chứng minh** có dữ liệu. Khi số mảnh khỏe mạnh xuống dưới ngưỡng sửa chữa, chủ động phục hồi mảnh trước khi mất khả năng tái tạo.
- **Không xóa S3 chỉ vì đủ số lượng node nhận file.** Phải qua kiểm thử phục hồi thực tế, xác minh đủ đa dạng failure domain, audit mới nhất và có rollback. Nếu mạng chưa đáng tin: kéo dài lưu tạm/giữ backup có kiểm soát, ghi nhận chi phí và thông báo trạng thái; không âm thầm hứa “đã an toàn”.
- Hạn lưu S3/R2 **40 ngày là mục tiêu sản phẩm để thử nghiệm**, không phải quy tắc xóa bất chấp nguy cơ mất file.

## 4. Luồng truy cập lại có thu phí [CHỐT về ý tưởng; ĐỀ XUẤT về cơ chế]

1. Người dùng mở tin nhắn cũ; nếu file đã có **bản local** có quyền mở → xem ngay, **không tính phí**.
2. Nếu ciphertext còn trên relay trong thời hạn thông thường → tải theo quy tắc dịch vụ hiện tại; **không gọi là truy cập lại trả phí**.
3. Nếu relay đã xóa, client gửi `request_reaccess(media_id)`; server kiểm tra phiên, quyền, chính sách xóa/thu hồi và khả năng truy xuất trên Storage Network.
4. API trả về **báo giá trước**, đơn vị, mức phí tối đa, hạn báo giá, nội dung sẽ nhận và điều khoản thất bại; người dùng xác nhận. **Không trừ tiền ngầm**.
5. Ledger tạo giao dịch idempotent và **giữ tạm** số dư; chọn node còn khả dụng, lấy đủ mảnh và kiểm tra hash.
6. Ghép lại ciphertext; client giải mã/kiểm tra AEAD và gửi xác nhận. Chỉ **settle** một lần khi trả file hợp lệ thành công theo chính sách. Mất mạng, thiếu mảnh, sai hash, không có quyền, thiếu khóa → hủy/hoàn phần giữ; tuyệt đối không thu tiền cho file không thể cung cấp.
7. Client có thể giữ lại bản mã hóa bền vững; **mở lại chính bản đã tải trên máy không tính phí**. Mỗi lần thực sự cần truy xuất mới từ Storage Network sau khi mất bản local sẽ phát sinh một báo giá/lượt phí mới, theo yêu cầu thương mại của chủ sản phẩm.

**Chống lạm thu:** không thu nhiều lần do retry, nhiều tab, download Range, hoặc cùng một recovery request. Xác nhận riêng nếu có truy xuất mới. Cần chính sách hoàn khi thiết bị có file nhưng thiếu khóa để giải mã.

### Quan hệ với Point / Coin hiện có

- **[CHƯA CHỐT]** Buổi trao đổi dùng từ “Credit” hoặc tiền, **không chốt đơn vị thanh toán hay giá**.
- Đặc tả `CHATNET_POINT_COIN_PRODUCT_SPEC.md` đã phân biệt **Point = điểm thưởng** và **Coin = đơn vị trả trước**, không tạo ví/tài sản thứ ba tùy tiện. **[ĐỀ XUẤT]** Nếu chọn thu phí nội bộ: mở rộng **Coin hiện có** bằng giao dịch `media_reaccess`, thay vì tạo token/credit thứ ba. Cần chủ sản phẩm phê duyệt.
- **[CHƯA CHỐT]** Node được thưởng bằng Point ghi nhận đóng góp, quyền lợi nội bộ, hay **thu nhập VNĐ có đối soát**. Không tự coi Point là tiền rút được, cũng không tự cho phép nhận Coin nạp của người khác rồi rút. Thu nhập tiền thật cần pháp lý, chống gian lận, thuế và đối tác thanh toán.
- Chốt công thức giá dựa trên tổng **phí node lưu GB-tháng + egress + repair + audit + chi phí nền tảng + dự phòng**, không dựa duy nhất vào số lần tải. File ít được mở vẫn phát sinh chi phí lưu giữ; có thể cần trợ giá hoặc hạn mức retention.
- Hệ thống ghi `quote_id`, `request_id`, `ledger_tx_id`, `amount`, `unit`, `node_reward_entries`, `settlement_state`, `refund_reason`; ledger append-only, unique idempotency keys, audit & reconciliation.

## 5. Người cung cấp ổ lưu trữ (Storage Node) [CHỐT về quyền chọn; ĐỀ XUẤT về triển khai]

- Chức năng **opt-in**, quản lý riêng trong Desktop Agent. Không bắt buộc người dùng chat phải cung cấp dung lượng; không chạy nền không xin phép.
- Agent phát hiện ổ hệ thống và các volume khả dụng theo **OS volume identity/mount point** thay vì đoán C:/D:/E:. Mặc định **không chọn ổ hệ thống**; người dùng có quyền chọn ổ dữ liệu, thư mục và dung lượng tối đa. Nếu không có ổ phù hợp thì không bật node.
- Duy trì free-space reserve, hạn mức IO/CPU/bandwidth, tạm dừng trên pin/metered connection, xử lý rút ổ USB, sleep, shutdown và uninstall. Không tự xóa file cá nhân ngoài sandbox storage đã chọn.
- Lưu mảnh trong thư mục ứng dụng cô lập, có index/reconcile, bảo vệ quyền truy cập OS, kiểm tra integrity định kỳ. Thưởng chỉ khi đã chứng minh có dữ liệu và đáp ứng cam kết phục vụ.
- Người dùng có thể tắt/rút node: phải có **graceful drain** và chuyển mảnh an toàn; nếu ngắt đột ngột, repair tự động. Không được trừng phạt bằng tiền khi chưa có điều khoản rõ và phê duyệt.
- Giai đoạn Web/PWA **không coi trình duyệt là Storage Node bền vững**. Chỉ thử trên Desktop Agent có quyền lưu ổ đĩa hợp lệ.

## 6. Nhóm, E2EE và quyền truy xuất

- Với chat nhóm, người gửi upload **một ciphertext** rồi phân phối khóa theo cơ chế E2EE nhóm, không tạo N bản trên S3 chỉ vì N thành viên.
- Mỗi thành viên/thiết bị có quyền được kiểm tra khi truy cập lại; node không biết tên nhóm/nội dung hoặc khóa.
- Thành viên rời/bị xóa nhóm: không cho truy vấn mới sau khi thu hồi quyền; việc lưu dữ liệu trước đó không thể bị thu hồi hoàn toàn. Thay đổi thành viên phải thay khóa dữ liệu **mới** theo giao thức nhóm; lịch sử/khả năng truy cập file cũ cần chính sách riêng.
- Không tự động tải toàn bộ video nhóm vào mọi máy; tự tải thumbnail/file nhỏ theo hạn mức, video lớn theo Wi-Fi/yêu cầu và cài đặt.

## 7. Rủi ro và điều kiện nghiệm thu

| Rủi ro | Cách kiểm soát / bài test bắt buộc |
| --- | --- |
| Node mất điện, mất ổ, biến mất đồng loạt | Test chaos; 1–2 node rớt; hệ thống phải còn đủ mảnh hoặc bảo vệ cloud fallback |
| Node gian lận nhận thưởng nhưng không lưu | Challenge/audit; thưởng theo kỳ/đợt có xác minh; anti-Sybil và rate limits |
| Lộ ảnh/chat qua node | Ciphertext-only, không lộ E2EE keys, test truy cập trái phép, bảo vệ metadata |
| Khôi phục thất bại sau khi đã thu | Ledger reserve/settle/refund idempotent; test crash/retry/race/multi-tab |
| Tranh chấp xóa dữ liệu, abuse và dữ liệu bất hợp pháp | Quy trình takedown & revocation, retention, disclosure, khiếu nại; cẩn trọng với dữ liệu E2EE |
| Đứt kết nối P2P/NAT/CGNAT | Relay fallback đo được chi phí; không bắt node phải mở cổng router công khai |
| Mất key người dùng | UX bảo vệ/backup key tự quản; không hứa có thể giải mã khi khóa đã mất |

**Acceptance POC**: Một video nhóm được upload một lần và phân mảnh; sau khi xóa bản relay trong môi trường thử nghiệm vẫn khôi phục khi một số node offline; sai hash bị từ chối; node chỉ thấy ciphertext; tính phí **đúng một lần** sau truy xuất thành công; không tính phí local; thiếu mảnh trả tiền lại; không xóa bản cloud production khi chưa có báo cáo độ bền và đo tải.

## 8. Lộ trình [ĐỀ XUẤT — chỉ plan, chưa code]

1. **Discovery + benchmark:** đo GB upload, số lần truy xuất file cũ, chi phí R2/S3, tình trạng key E2EE thực tế; chốt cost model so với chỉ giữ cloud.
2. **POC kỹ thuật:** Desktop Storage Agent opt-in, chọn ổ dữ liệu, encryption/sharding, placement, registry, health/audit/repair và khôi phục qua node; thử nghiệm với data giả lập.
3. **POC kinh tế:** sổ giao dịch thử nghiệm, báo giá trước, reserve–settle–refund, reward theo proof; chống trừ trùng và cày thưởng.
4. **Private beta:** chat 1-1/nhóm thử nghiệm thực, giới hạn node, S3/R2 backup song song, đo xác suất khôi phục và chi phí thực.
5. **Rollout có kiểm soát:** chỉ sau security review, legal review, ngưỡng độ bền, quy trình hỗ trợ và rollback mới bắt đầu rút bớt retention S3; không tự động bật trong main chỉ vì có RFC.

## 9. Câu hỏi phải được chốt trước khi triển khai thương mại

- **[CHƯA CHỐT]** Thu phí bằng Coin hiện tại hay VNĐ qua đối tác? Giá mỗi lượt có phụ thuộc dung lượng? Lượt tải thất bại và sự cố khóa có hoàn phí thế nào?
- **[CHƯA CHỐT]** Node được trả Point, ưu đãi, hay khoản phải trả VNĐ? Điều kiện rút, thuế, chống gian lận?
- **[CHƯA CHỐT]** Cam kết tối thiểu về độ bền, số failure domain, mức dự phòng cloud, thời hạn lưu lịch sử và phạm vi truy xuất của thành viên cũ?
- **[CHƯA CHỐT]** Chính sách xóa theo yêu cầu, lưu trữ nội dung vi phạm, hỗ trợ khôi phục khóa, quản lý dữ liệu của người chưa thành niên?

**Kết luận:** Đây là **định hướng sản phẩm đã được ghi nhận, không phải tính năng đang hoạt động**. Không quảng bá “không bao giờ mất file”, “đã E2EE mặc định”, “rẻ hơn R2” hoặc “đã có blockchain” khi chưa có bằng chứng kiểm thử độc lập.
