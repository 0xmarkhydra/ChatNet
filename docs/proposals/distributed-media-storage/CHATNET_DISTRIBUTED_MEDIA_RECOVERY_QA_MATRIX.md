# ChatNet — Distributed Media Recovery QA Matrix & UAT

**Ngày:** 16/11/2026 · **Phiên bản:** 1.0 · **Trạng thái:** Checklist nghiệm thu đề xuất; chưa có kết quả test thực tế.  
**Đi cùng:** `CHATNET_DISTRIBUTED_MEDIA_RECOVERY_BA_HANDOFF.md`, `CHATNET_DISTRIBUTED_MEDIA_RECOVERY_SPEC.md`.  
**Quy ước:** P0 = chặn release; P1 = cần xử lý trước public beta; P2 = tối ưu. Mọi case “PASS” chỉ khi có run ID, build SHA, môi trường, log/trace đã loại dữ liệu nhạy cảm, ảnh hoặc video bằng chứng, người xác nhận. Không được tự đánh dấu PASS vì có tài liệu.

## 1. Bộ dữ liệu và môi trường tối thiểu

- **Người dùng:** Alice (người gửi), Bob và Carol (người nhận), Dave (ngoài nhóm), Erin (thành viên nhóm đã bị loại), Grace (thành viên mới).
- **Thiết bị:** 2 browser của Alice/Bob, 1 iOS Safari/PWA để kiểm tra quota, 2 desktop user-client, 8 desktop Storage Node trên ít nhất 3 failure domain độc lập. Tạo node adversarial (xóa shard, sửa byte, giả ACK) và node bị lỗi.
- **File mẫu:** ảnh 30 KB/5 MB, ảnh gốc RAW, video 20 MB/1 GB, voice 200 KB, tài liệu PDF, file rỗng, file chứa byte null, tên Unicode/emoji, dữ liệu ngẫu nhiên không thể nén; file 100 MB để test k=4,n=6.
- **Network:** Ethernet, Wi-Fi, mạng tính phí, 3G/4G giả lập, mạng chậm/packet loss, NAT/CGNAT, node sleep, phân vùng mạng; tắt/bật router.
- **Payment:** ví giả lập đủ/thiếu số dư, lỗi timeout, cùng request_id nhiều tab, crash trước/sau ledger settle, node rewards chưa phê duyệt tiền thật.
- **Dịch vụ:** staging PostgreSQL/Redis/S3 hoặc R2 riêng; tất cả node và nội dung dùng dữ liệu giả lập; tuyệt đối không thử xóa production.
- **Điều kiện khởi chạy:** audit E2EE riêng hoàn tất theo gate tương ứng; feature flag `MEDIA_DISTRIBUTED_STORAGE`, `MEDIA_REACCESS_SIMULATED_BILLING` ban đầu OFF; không giả vờ các flags đã tồn tại.

## 2. Ma trận chức năng & lỗi bắt buộc

| TC | P | Tình huống / hành động | Kỳ vọng có thể kiểm chứng |
| --- | --- | --- | --- |
| NODE-01 | P0 | Người dùng không opt-in nhưng dùng ChatNet chat bình thường | Không có thư mục shard, không chạy storage agent background, không có tài nguyên bị cấp |
| NODE-02 | P0 | Opt-in trên Windows có C: hệ thống và D:/E: dữ liệu | UI phân biệt ổ OS, mặc định chỉ đề xuất volume dữ liệu; người dùng tự chọn quota và thư mục |
| NODE-03 | P0 | Chỉ có ổ C: hoặc không có ổ đủ điều kiện | Không âm thầm ghi vào C:, từ chối kích hoạt và nêu lý do |
| NODE-04 | P0 | Chọn thư mục ngoài quyền ghi, read-only, symlink bất thường | Không được cấp quyền nguy hiểm hoặc ghi ra ngoài sandbox |
| NODE-05 | P0 | Đặt 30 GB quota, 10 GB free-space reserve; nạp gần quota | Không vượt quota/reserve, ngừng nhận shard mới, báo trạng thái |
| NODE-06 | P0 | Rút ổ E: USB hoặc mount point bị đổi | Node PAUSED/OFFLINE; không ghi nhầm vào ổ mới cùng ký tự; tự xác minh volume identity |
| NODE-07 | P1 | Laptop sleep, pin yếu hoặc mạng tính phí | Agent dừng/giới hạn theo cài đặt; không tiêu hao tài nguyên vượt cam kết |
| NODE-08 | P0 | Người dùng bấm rút node khi đang giữ shards | Drain: không nhận shard mới, chuyển dữ liệu sang node khác, chỉ xóa local khi bản thay thế đã được chứng thực |
| NODE-09 | P0 | Uninstall/force quit không drain | Registry đánh OFFLINE; repair tự chạy; không can thiệp file ngoài app directory |
| NODE-10 | P1 | Node báo dung lượng hoặc thời gian online giả | Hệ thống chỉ thưởng dựa proof/audit có thể kiểm chứng; thiếu proof không trả thưởng |
| SEND-01 | P0 | Alice gửi ảnh cho Bob với profile tiêu chuẩn | File nén trước khi mã hóa, relay chỉ chứa ciphertext, metadata nhạy cảm không lộ trên server |
| SEND-02 | P0 | Alice chọn “Gửi như file” | Bản nhận/khôi phục trùng nguyên bản byte-for-byte; không nén mất dữ liệu |
| SEND-03 | P0 | Alice gửi video 20 MB vào nhóm 100 thành viên | Một ciphertext relay/object attachment cho nhóm (trừ variant định nghĩa riêng), 100 devices nhận E2EE metadata đúng quyền |
| SEND-04 | P0 | Bob offline lúc Alice gửi | Không yêu cầu Bob online; khi online có thể tải relay trong hạn, không báo “đã lưu local” trước ACK |
| SEND-05 | P0 | Bị mất mạng giữa upload, client retry | Không sinh duplicate message/object bị tính tiền; resumable hoặc retry an toàn; cleanup temp |
| SEND-06 | P0 | Client đầy bộ nhớ hoặc browser tự dọn IndexedDB | Không đánh STORED nếu chưa ghi bền; PWA không được tính là durable source |
| SEND-07 | P0 | Gửi file 0 byte, sai MIME, kích thước quá quota, tên emoji | Lỗi UX xác định, không log plaintext filename; policy kiểm tra đúng |
| SEND-08 | P0 | Phá 1 byte trong ciphertext/manifest | Client từ chối AEAD/manifest, không hiển thị nội dung giả và không ACK |
| GROUP-01 | P0 | Bob chuyển tiếp ảnh sang nhóm khác | Quyền và khóa mới hợp lệ cho nhóm đích; nhóm nguồn không cấp phép implicit |
| GROUP-02 | P0 | Xóa Erin khỏi nhóm rồi Erin xin lại file cũ | Tuân theo policy quyền lịch sử đã duyệt; tối thiểu từ chối yêu cầu truy xuất mới nếu quyền đã thu hồi |
| GROUP-03 | P0 | Thêm Grace vào nhóm sau khi file được gửi | Không mặc định cấp khóa/backup lịch sử; chỉ cấp nếu chính sách nhóm và cơ chế E2EE cho phép |
| GROUP-04 | P0 | Tệp đã được tải trước khi thành viên bị loại | Không tuyên bố có thể xóa bản local trên máy thành viên; giữ ranh giới bảo mật |
| STORE-01 | P0 | Nén+E2EE 100 MB, encode 4-of-6 | 6 shard, giải mã từ 4 shard bất kỳ; hash/integrity đúng; overhead được đo |
| STORE-02 | P0 | 6 shard lên 6 node nhưng cùng chủ máy/ổ | Placement policy từ chối coi là DURABLE_VERIFIED; phát hiện failure-domain trùng |
| STORE-03 | P0 | Receipt ký giả, ghi ACK mà xóa shard ngay | Audit/challenge phát hiện thiếu dữ liệu; không trả thưởng và không xóa relay |
| STORE-04 | P0 | Mất 1–2 shard khi cấu hình 4-of-6 | Khôi phục được với 4 shard, repair bổ sung shard; capture evidence |
| STORE-05 | P0 | Mất 3 shard trước khi repair | Mark AT_RISK/UNAVAILABLE; giữ fallback; không báo vẫn có thể khôi phục |
| STORE-06 | P0 | Shard corrupt có cùng kích thước | Hash mismatch, chọn shard khác; quarantine node; audit trail |
| STORE-07 | P0 | Node khỏe trên heartbeat nhưng không phục vụ shard | Không tính heartbeat là proof; health giảm sau thử fetch/audit |
| STORE-08 | P0 | Coordinator/Redis restart giữa placement/repair | Idempotent recovery, không mồ côi file hoặc phát sinh vô hạn placement |
| STORE-09 | P0 | Quá 40 ngày nhưng mạng chưa đủ shard khỏe mạnh | Relay không được xóa; trạng thái AT_RISK, alert và ghi chi phí fallback |
| STORE-10 | P0 | Đủ shard/đã audit nhưng chưa diễn tập recovery | Không cho xóa relay chỉ dựa shard count |
| STORE-11 | P0 | Đã thử recovery thành công, node độc lập, chính sách duyệt | Chỉ staging được xóa relay; reaccess thành công; lưu audit/decision |
| STORE-12 | P0 | S3/R2 xóa thất bại hoặc lifecycle chạy không đúng thời điểm | Phản ánh state thực; retry idempotent, không đánh ARCHIVED sai |
| RE-01 | P0 | Mở file còn local và còn khóa | Mở ngay, không gọi paid recovery, phí = 0 |
| RE-02 | P0 | Không có local, relay còn file | Dùng flow tải thông thường, không ngầm thu phí reaccess |
| RE-03 | P0 | Relay đã xóa, ≥4 mảnh, khóa hợp lệ | Quote → confirm → reserve → fetch → verify → decrypt client → settle đúng một lần |
| RE-04 | P0 | Người dùng hủy ở màn hình báo giá | Không reserve/settle; không có fee |
| RE-05 | P0 | Người dùng thiếu tiền, quote hết hạn | Thông báo đúng, không chạy recovery tốn phí khi chưa được phép |
| RE-06 | P0 | Chỉ còn 3/6 shard và không có local/backup | Không khôi phục, không thu tiền; hiện trạng thái trung thực |
| RE-07 | P0 | Có đủ ciphertext nhưng không có khóa E2EE | Không trả file đã giải mã, không settle; chỉ hướng dẫn khôi phục khóa hợp pháp nếu có |
| RE-08 | P0 | Session mất mạng, timeout, server trả 5xx | Retry idempotent; hoặc resume, hoặc release/refund; không trừ 2 lần |
| RE-09 | P0 | Gửi cùng request_id từ 2 tab đồng thời | Một request kinh tế và một settlement; trường khác payload → conflict |
| RE-10 | P0 | Server crash sau settle nhưng trước response | Ledger reconciliation xác nhận đã trừ một lần; không tạo charge thứ hai |
| RE-11 | P0 | Node gửi shard sai hoặc giả kết quả | Hash/AEAD fail; không settle, audit node, thử thay nguồn nếu còn |
| RE-12 | P0 | Client giả success receipt hoặc im lặng sau tải | Chính sách settlement chống spoof/race, timeout/hoàn phí có chứng cứ; phải security-review |
| RE-13 | P0 | Dave không thuộc nhóm gọi reaccess bằng media_id đoán được | 403, không lộ existence, hash, node address, filename hoặc giá tùy chính sách |
| RE-14 | P1 | Sau một lần reaccess thành công, mở lại cùng bản local | Không thu thêm; khi local bị mất và có request mới thì hiển thị quote mới |
| PAY-01 | P0 | Quote 1 đơn vị nhưng xác nhận payload số khác | Backend kiểm tra giá server-side, chặn price tampering |
| PAY-02 | P0 | Billing simulated: reserve/settle/refund chạy lại N lần | Tổng debit ≤ 1 charge; refund đúng; ledger append-only và cân đối |
| PAY-03 | P0 | Node tự request file của chính mình để farm reward | Anti-Sybil/self-dealing, fraud flags; không trả thưởng thiếu chứng minh |
| PAY-04 | P1 | Hủy node sau khi đã earned reward | Giữ lịch sử thưởng và đối soát đúng, không xóa nợ hợp lệ |
| DEL-01 | P0 | Chủ sở hữu xóa media / yêu cầu xóa theo luật | Tombstone, chặn request mới, purge controlled, audit outcome |
| DEL-02 | P0 | Bị thu hồi khóa / logout / đổi máy | Không rò khóa; đồng bộ trạng thái từ chối; không hứa mở file khi mất key |
| SEC-01 | P0 | Storage node cố đọc nội dung/membership | Chỉ thấy shard ciphertext và thông tin tối thiểu; không có file key hoặc tên nhóm |
| SEC-02 | P0 | XSS trên Web/PWA, replay token, signed URL cũ | Threat model, CSP/security test; không giả định E2EE chống được XSS trên client |
| SEC-03 | P0 | Flood node proof/reaccess/quote và phân vùng DDoS | Rate limit, quota, circuit breaker, no noisy neighbor outage |
| PERF-01 | P1 | Recovery 1 MB/100 MB/1 GB trong 3 cấu hình mạng | Có P50/P95 và throughput; không công bố SLA nếu chưa đạt |
| COST-01 | P0 | So tổng chi phí storage nodes + audit + repair + transfer + payout với S3/R2 | Có báo cáo thực tế theo GB-tháng và mỗi recovery; chỉ rollout nếu economics hợp lý |
| OPS-01 | P0 | Tắt feature flag, dừng placement, ledger incident | Kill switch hoạt động; không xóa cloud/không thu phí mới; các recovery ongoing xử lý minh bạch |
| OPS-02 | P0 | Mất registry DB hoặc mất bản đồ shard | Backup+restore registry và shard manifest; DR drill, đo RPO/RTO |
| OPS-03 | P0 | 10% node cùng khu vực/ISP offline | Recovery/repair hoạt động theo policy; báo AT_RISK khi chưa đủ nguồn |
| OPS-04 | P1 | Nhiều bản app/agent chạy codec version khác nhau | Version negotiation tương thích, không làm mất file cũ |

## 3. Các điều kiện chặn release

1. **E2EE trước Storage Network:** group key/device/key recovery và encrypted attachments phải có test end-to-end thực sự; không triển khai dựa trên một relay giả MLS.
2. **Durability:** không xóa object production dựa trên 4-of-6 POC. Phải chứng minh theo failure domain, tỷ lệ node churn, frequency audit, repair budget, backup fallback.
3. **Kinh tế:** giá/reward/đơn vị và điều khoản được phê duyệt; trước đó mọi test sử dụng simulated wallet, không có tiền thật.
4. **Bảo mật:** khóa không lộ ở backend/node/log; security review/penetration review không còn P0/P1 chưa xử lý theo policy.
5. **Vận hành:** có runbook khi node mất, hệ thống xuống cấp, registry mất, ledger tranh chấp, CS support và rollback/kill switch.
6. **Tài liệu:** mỗi TC P0 có owner, môi trường, script/traces, chứng cứ pass/fail và issue link; QA lead ký, PM và security ký go/no-go.

## 4. Khung báo cáo UAT

| Trường | Nội dung phải điền |
| --- | --- |
| Build SHA / branch / flags | ... |
| Run ID + timestamp + environment | ... |
| Test case IDs đã chạy | ... |
| PASS / FAIL / BLOCKED / NOT RUN | ... |
| Evidence (trace đã ẩn secrets, screenshot, checksum, ledger snapshot) | ... |
| Incident / repro / owner / ETA | ... |
| Chi phí thực đo (GB-tháng, egress, reward, repair) | ... |
| Quyết định go/no-go | QA, Security, SRE, PM ký |

**Nhắc lại:** Ma trận này là checklist bàn giao, **không phải chứng nhận đã kiểm thử**. Tất cả case vẫn NOT RUN cho đến khi có build và bằng chứng thực thi.
