# CHATNET / SOCO — BA HANDOFF A–Z: Distributed Media Storage & Paid Re-access

**Ngày lập:** 16/11/2026  
**Phiên bản:** 1.0 — DRAFT FOR TEAM REVIEW  
**Trạng thái:** ĐẶC TẢ / CHƯA TRIỂN KHAI / CHƯA BẬT THU PHÍ / KHÔNG ĐƯỢC XÓA FILE PRODUCTION THEO TÀI LIỆU NÀY  
**Đầu vào:** trao đổi chủ sản phẩm về chat 1-1, nhóm, relay S3/R2, E2EE, Storage Node tự nguyện, trả thưởng và “Truy cập lại”; nghiên cứu local-first; tài liệu hiện hữu trong docs/.  
**Tài liệu liên quan:** [RFC kiến trúc](./CHATNET_DISTRIBUTED_MEDIA_RECOVERY_SPEC.md), [E2EE Master Plan](../E2EE_IMPLEMENTATION_MASTER_PLAN.md), [Point/Coin Product Spec](../CHATNET_POINT_COIN_PRODUCT_SPEC.md), [Media Access Revocation](../MEDIA_ACCESS_REVOCATION.md), [QA/UAT Matrix](./CHATNET_DISTRIBUTED_MEDIA_RECOVERY_QA_MATRIX.md).

> Nhãn quyết định: **[CHỐT]** là ý đồ nghiệp vụ đã được chủ sản phẩm xác nhận; **[ĐỀ XUẤT]** là thiết kế để team triển khai thử; **[CẦN DUYỆT]** là chỗ không được tự quyết và tuyệt đối không thu phí thật/xóa bản cloud trước khi có quyết định. Những giá trị 40 ngày, 4-of-6, mức độ an toàn, hiệu năng và độ bền đều là mục tiêu kiểm chứng, không phải cam kết đã đạt.

## A. Tóm tắt điều hành — chỉ đọc mục này là hiểu sản phẩm

ChatNet cung cấp nhắn tin và gửi media thuận tiện như ứng dụng chat phổ biến; người gửi và người nhận có thể tự giữ bản media trên thiết bị. Backend giữ ciphertext trên S3/R2 để gửi và đồng bộ ban đầu. Song song, một mạng Storage Node tự nguyện (đầu tiên là desktop) giữ các **mảnh của ciphertext** ở các ổ dữ liệu do người dùng chọn. Khi hết thời gian relay, S3/R2 chỉ được xóa **sau khi** các điều kiện an toàn được kiểm chứng; tin nhắn và metadata vẫn cho phép hiển thị lịch sử.

Khi người đã được cấp quyền mở file cũ mà thiết bị không còn bản local, họ chọn **“Truy cập lại”**. ChatNet kiểm tra quyền, tra manifest, định vị node khỏe mạnh, báo giá/giữ tiền, tải đủ mảnh và xác minh, tái tạo ciphertext; **chỉ client có khóa E2EE mới giải mã**. Thu một khoản tiền/Credit nhỏ **nếu truy xuất thành công**; phần thưởng trả cho những node thực sự đóng góp. Không cần blockchain ở bản đầu, không bắt buộc Drive, không bắt buộc tham gia Storage Node.

**Không thể đảm bảo 100% không mất file.** Nếu toàn bộ mảnh hữu ích mất hoặc không còn khóa giải mã, không thuật toán nào tái tạo file. Chỉ được nói “có bản lưu đã kiểm chứng”, không nói “lưu vĩnh viễn” khi chưa có SLA/dự phòng phù hợp.

## B. Phạm vi, giả định, ngoài phạm vi

| Mục | Phiên bản đầu | Giai đoạn sau |
| --- | --- | --- |
| Chat cá nhân | Ảnh, video, voice, tài liệu E2EE khi transport/crypto đạt gate | Tối ưu streaming và tìm kiếm local |
| Chat nhóm | Một ciphertext/object trên relay; khóa phân phối an toàn tới thành viên/thiết bị hợp lệ | Quy mô nhóm lớn, thay đổi nhóm phức tạp |
| Client chat | Web/PWA được hỗ trợ, nhưng cache browser có thể bị xóa | Native/desktop lưu bền hơn |
| Storage Node | Desktop agent tự nguyện, tự chọn volume/thư mục/quota | macOS/Linux/NAS, relay/peer optimization |
| Thanh toán | Ledger mô phỏng; quote, reserve, settle, release/refund | Coin/VNĐ thật sau phê duyệt |
| Nhà cung cấp | Adapter tận dụng S3/R2 hiện có, không tái cấu trúc production ngay | Rút bớt retention đã đo kiểm |
| Mạng lưu trữ | Registry điều phối tập trung, các data shard phân tán; KHÔNG blockchain | Có thể xem xét on-chain nếu thật sự cần |

**Ngoài phạm vi MVP:** tiền mã hóa tự phát hành, lời hứa đảm bảo vĩnh viễn, chuyển quyền sở hữu file bằng hash, dedup toàn cục theo plaintext, browser trở thành storage node liên tục, auto mở port router, lưu plaintext trên backend, chia tiền mặt chưa có quy trình pháp lý.

## C. Vai trò, quyền và thuật ngữ

- **Sender:** tạo file, client tối ưu/mã hóa, gửi tin và khóa theo E2EE.
- **Recipient/member:** thiết bị hợp lệ nhận/tải/xem file, có thể đề nghị truy cập lại.
- **Storage Provider:** người cho phép desktop agent giữ mảnh ciphertext và nhận thưởng.
- **Storage Node:** một thiết bị/cài đặt provider; **không được nhận khóa**.
- **Control Plane:** ChatNet API; quản lý auth, manifest, placement, node health, quyền, quote, ledger, event, repair.
- **Relay:** S3/R2 chỉ là nguồn dữ liệu tạm/dự phòng ban đầu.
- **Client local copy:** file đã ghi thành công trên máy; không phải bản sao storage network.
- **Hash:** định danh hoặc kiểm tra mảnh; KHÔNG thể dùng hash để tái tạo nội dung đã xóa.
- **STORED:** thiết bị đã ghi và tự kiểm tra byte hợp lệ; không đồng nghĩa người dùng đã đọc.
- **DURABLE_VERIFIED:** mạng có đủ mảnh, đủ failure domain và đã thử tái tạo; không đồng nghĩa bất tử.
- **“Truy cập lại”:** một nghiệp vụ lấy lại file từ Storage Network khi bản relay đã hết hạn và máy không có bản local.

Quyền truy xuất phải đồng thời vượt qua auth phiên đăng nhập, quyền hội thoại/nhóm, trạng thái file, chính sách recall/xóa, device key E2EE và trạng thái quote. Storage Provider không được suy ra tên nhóm, nội dung hay danh sách thành viên từ yêu cầu shard.

## D. Những quy tắc bắt buộc (BR)

| Mã | Quy tắc | Mức |
| --- | --- | --- |
| BR-01 | Gửi file không bắt người dùng bật backup hay Storage Node | CHỐT |
| BR-02 | Nén/tối ưu **trước E2EE**; file gốc giữ chất lượng khi người gửi chọn gửi như tài liệu | CHỐT |
| BR-03 | Node và backend chỉ thấy ciphertext/shard; không truy cập khóa file | BẮT BUỘC |
| BR-04 | Không đặt tên object/dedup theo plaintext hash toàn hệ thống | BẮT BUỘC |
| BR-05 | Chat nhóm chỉ upload một ciphertext lên relay cho một attachment (ngoại trừ phiên bản chất lượng riêng có chủ ý) | ĐỀ XUẤT |
| BR-06 | Cache trên Web/PWA là best-effort; không được tính là bản sao lâu dài đảm bảo | BẮT BUỘC |
| BR-07 | Storage Node chỉ được chạy khi người dùng opt-in và chọn ổ/thư mục/quota, có quyền tạm dừng/rút node | CHỐT |
| BR-08 | Không mặc định dùng ổ chứa hệ điều hành, nhận diện volume theo OS thay vì đoán ký tự C/D/E | CHỐT + ĐỀ XUẤT |
| BR-09 | Không xóa relay vì đã có số lượng ACK; cần audit, recovery thử, đa dạng vị trí, khả năng tự repair và ngưỡng được duyệt | BẮT BUỘC |
| BR-10 | Xem bản local hoặc tải lại từ relay còn hạn không phải paid re-access | CHỐT về ý nghĩa |
| BR-11 | Mỗi truy xuất mới từ Storage Network đều được báo giá trước; chỉ tính phí sau thành công; các retry không tính lại | CHỐT + ĐỀ XUẤT |
| BR-12 | Không chốt Coin/VNĐ, giá, quyền rút tiền của node khi chưa được chủ sản phẩm phê duyệt | CẦN DUYỆT |
| BR-13 | Thành viên bị loại nhóm không được nhận quyền truy xuất mới; file họ đã lưu trước đó không thể thu hồi bằng phần mềm | BẮT BUỘC |
| BR-14 | Khi xóa dữ liệu theo yêu cầu/chính sách pháp lý, cần quy trình purge shard và tombstone, không quảng cáo xóa hết bản ở thiết bị người khác | BẮT BUỘC |
| BR-15 | Hệ thống có quyền chặn xóa S3 khi mức khỏe của mạng suy giảm; phải theo dõi chi phí relay fallback | BẮT BUỘC |

## E. Luồng A–Z — chat và lưu trữ

### UC-01. Đăng ký Node

**Tiền điều kiện:** đăng nhập; máy desktop có agent hợp lệ; đủ quyền truy cập volume.  
**Chính:** người dùng mở “Cung cấp dung lượng” → xem lợi ích/rủi ro/tham gia tự nguyện → agent liệt kê ổ không phải ổ hệ thống, dung lượng trống, loại ổ, mount path → người dùng chọn một ổ/thư mục và quota → app kiểm tra quyền ghi, free-space reserve, trạng thái ổ, network → đăng ký node identity → node ACTIVE sau khi chấp nhận điều khoản.  
**Thay thế:** không có ổ dữ liệu phù hợp thì hiển thị không thể bật, không tự chuyển sang ổ C; ổ di động bị rút/đổi ký tự thì node PAUSED; không cấp quyền ghi thì lưu lỗi và hướng dẫn chọn khác.  
**Hậu điều kiện:** chỉ file trong sandbox do agent tạo được phép quản lý; người dùng có màn hình quota đã cấp/dùng/còn, bandwidth, uptime, thưởng và nút Tạm dừng/Rút khỏi mạng.

### UC-02. Gửi media 1-1

**Tiền điều kiện:** chat có cơ chế E2EE hoạt động/đã kiểm chứng; thiết bị hợp lệ.  
**Chính:** client đọc file → lựa chọn chất lượng và tạo thumbnail trước E2EE → tạo file key ngẫu nhiên → mã hóa file/thumbnail và manifest nhạy cảm → upload ciphertext trực tiếp lên relay bằng signed URL → server xác thực đối tượng/size, lưu media_id ngẫu nhiên và trạng thái RELAY_ACTIVE → client gửi envelope mang file key trong E2EE → người nhận được tin và tải ciphertext khi chính sách mạng/dung lượng cho phép → giải mã client và ghi bản local (ưu tiên ciphertext) → xác nhận STORED.  
**Ngoại lệ:** quá quota, ngắt mạng, upload dở, client hết pin/dung lượng, sai key, lỗi tag AEAD, MIME độc hại, người nhận offline, retries/idempotency. Không trả “đã lưu an toàn” khi chỉ có ACK chuyển tiếp.

### UC-03. Gửi file vào nhóm và chuyển tiếp

**Chính:** gửi một ciphertext lên relay, phát một tin nhắn cho nhóm với file key được phân phối qua group E2EE tới thiết bị đủ quyền; downloader tự quản băng thông và tự lưu theo chính sách. Thành viên offline nhận metadata rồi tải sau.  
**Chuyển tiếp sang nhóm khác:** phải xác thực quyền chuyển tiếp và tái bọc/tạo khóa phù hợp với nhóm đích; không tái sử dụng quyền truy cập của nhóm nguồn làm quyền của nhóm đích.  
**Thay đổi thành viên:** membership và khóa cho tin mới phải cập nhật theo E2EE; quyền xem lịch sử cũ là chính sách riêng [CẦN DUYỆT]. Thành viên bị xóa không được tạo truy xuất mới sau khi quyền bị thu hồi.

### UC-04. Đưa file vào Storage Network

**Tiền điều kiện:** relay object hợp lệ, ciphertext/manifest đã xác minh, số node đủ.  
**Chính:** coordinator chọn cấu hình codec có version (POC 4-of-6) → erasure-code trên ciphertext → tính hash từng shard, ký manifest → scheduler chọn 6 node khác failure domain/chủ máy/ổ/khu vực → gửi shard qua kết nối an toàn với token scope ngắn → node ghi fsync, kiểm tra hash và trả storage receipt ký → registry ghi placement và lease → auditor challenge ngẫu nhiên, chạy thử reconstruct → đạt điều kiện DURABLE_VERIFIED.  
**Thay thế:** thiếu node/quota, shard corrupt, ACK giả, 6 node cùng một người, 1 node đứt mạng, phí repair quá cao → giữ relay và phát hiện AT_RISK. Không đánh đồng heartbeat với proof of possession.

### UC-05. Xóa relay sau retention

**Chính:** job định kỳ chọn object đến hạn (mục tiêu thử nghiệm 40 ngày) → đọc policy hiện hành, legal hold, trạng thái user deletion và healthy-shard count → bắt buộc có recovery drill đủ ngưỡng, node độc lập và health không stale → nếu đạt thì tạo deletion candidate → ghi quyết định/audit → xóa relay object theo lifecycle an toàn → xác minh xóa → trạng thái ARCHIVED.  
**Nếu không đạt:** chuyển AT_RISK, alert và tiếp tục giữ relay hoặc backup; không đánh dấu ARCHIVED, không tự xóa vì 40 ngày. **Chỉ được kích hoạt production khi có go/no-go ký duyệt.**

### UC-06. Người dùng “Truy cập lại” có thu phí

**Tiền điều kiện:** người gọi có quyền, file còn trạng thái truy xuất được, local không có bản, relay hết hạn.  
**Chính:** mở file cũ → thấy “Đã lưu trữ — Truy cập lại” và trạng thái khả dụng → bấm → server kiểm tra auth/group/recall và ước lượng node có thể phục vụ → trả giá, đơn vị, TTL, tổng phí tối đa, khả năng thất bại → user xác nhận → tạo recovery_request và giữ tiền idempotent → coordinator chọn mảnh, tải song song có timeout/retry/switch-node, kiểm tra shard hash → reconstruct ciphertext, xác minh manifest/size → chuyển ciphertext cho client → client kiểm tra AEAD, giải mã và phát receipt thành công → ledger settle đúng một lần → node reward được ghi nhận và bản local có thể được giữ để xem lại không trả phí.  
**Khi lỗi:** mất kết nối, thiếu mảnh, thiếu key, client không xác nhận được, sai tag, user hủy, timeout → không settle, release/refund giữ tiền, hiển thị lý do và đường xử lý. Server tuyệt đối không khẳng định “đã giải mã thành công” chỉ nhờ tải đủ byte; cần receipt có ràng buộc session/device và cơ chế chống giả mạo từ client được review.

### UC-07. Xem file cũ khi đã có bản local

Khách hàng mở từ cache/bản lưu bền vững được cấp quyền → giải mã local → **0 phí**. Không gọi network recovery hoặc charge. Nếu cache bị hệ điều hành xóa, app kiểm tra cloud/peer khả dụng rồi mới hiện quote.

### UC-08. Rút Node / thay ổ / uninstall

Người dùng chọn “Dừng cung cấp” → agent gửi drain intent → coordinator đánh dấu không nhận shard mới, bố trí tái phân phối để giữ redundancy → khi đủ bản thay thế đã được kiểm chứng, xóa shard trong app sandbox và hủy node. Nếu tắt ngang, mất ổ hoặc uninstall bất ngờ: node OFFLINE; repair chạy để bù. Không phạt hay xóa dữ liệu cá nhân ngoài sandbox; thanh toán thưởng đã earned phải có đối soát.

### UC-09. Quản lý xóa, thu hồi, khóa và khiếu nại

Khi người gửi xóa/thu hồi hoặc luật áp dụng yêu cầu xóa, registry đặt tombstone, chặn yêu cầu truy xuất mới, purge mảnh theo lease và theo dõi ACK; không thể xóa những bản copy user khác đã lưu ngoài kiểm soát. Mất khóa E2EE: nếu không có recovery secret/thiết bị khác hỗ trợ thì **không giải mã được**, dù shards vẫn tồn tại. Không thu phí trường hợp đã biết không có key usable.

## F. State machine và invariants

**Media lifecycle:** `LOCAL_PENDING → RELAY_ACTIVE → DISTRIBUTING → DURABLE_VERIFIED → ARCHIVED`. Có nhánh `REPAIRING / AT_RISK / UNAVAILABLE / PURGING → PURGED`. Mọi transition phải lưu reason, timestamp, actor và schema version. `UNAVAILABLE` có thể quay về DURABLE_VERIFIED nếu repair/reindex tìm đủ shard; `PURGED` là trạng thái cuối của storage network.

**Node:** `PENDING → ACTIVE → PAUSED/OFFLINE → DRAINING → REMOVED`; `BANNED` là trạng thái bảo vệ riêng. Không assign shard khi node PAUSED/OFFLINE/DRAINING.

**Recovery:** `REQUESTED → QUOTED → RESERVED → LOCATING → FETCHING → RECONSTRUCTED → CLIENT_VERIFIED → SETTLED`. Nhánh `DECLINED / CANCELLED / FAILED / EXPIRED → RELEASED_OR_REFUNDED`. Ledger settle phải atomic, idempotent theo request_id và quote_id.

**Bất biến:** (1) Chỉ ciphertext đi qua node/relay. (2) Không xóa bản cloud cuối khi không đạt release gate. (3) Không thu phí local. (4) Không thu khi không giao được file hợp lệ. (5) Không double charge vì retry/multi-tab. (6) Không tự bịa quyền E2EE từ membership DB đơn lẻ. (7) Không dùng một hash để tái tạo file. (8) Chỉ sao lưu blob dữ liệu, không trao khóa cho storage node.

## G. Mô hình dữ liệu logic (đề xuất, chưa migration)

| Entity | Trường quan trọng | Ràng buộc |
| --- | --- | --- |
| media_objects | media_id, owner_ref, conversation_ref, size_ciphertext, cipher_version, manifest_ref, retention_until, state, relay_key | Không plaintext filename, không key |
| media_shards | shard_id, media_id, codec_version, k, n, index, size, hash, manifest_signature | Unique (media_id, codec_version, index) |
| storage_nodes | node_id, provider_id, device_pubkey, status, quota, free_reserve, capabilities, last_seen | Không tin client tự báo “có file” |
| shard_placements | shard_id, node_id, lease_until, signed_receipt, last_audit, health, failure_domain | Unique/lock placement; no duplicate domain |
| audit_challenges | challenge_id, shard_id, node_id, nonce, deadline, verifier_result, proof_hash | Không chỉ heartbeat |
| repair_jobs | job_id, media_id, target_policy, state, retry, cost, lock_version | Re-entrant, idempotent |
| client_copies | media_id, user_id, device_id, stored_at, verified_at, storage_class | Chỉ status, không đọc local path riêng |
| reaccess_quotes | quote_id, user_id, media_id, unit, amount, expires_at, policy_version | Hết hạn không thu |
| recovery_requests | request_id, quote_id, device_id, state, source, requested_at, verified_at | Unique client request id |
| wallet_ledger | entry_id, request_id, type, unit, amount, state, idempotency_key | Append-only, double-entry khi thanh toán |
| node_rewards | reward_id, node_id, shard_id, service_receipt, amount, unit, state | Chống self-reward, audit |

Cần schema cụ thể có foreign keys, phân vùng/index, migration additive, chính sách dữ liệu cá nhân, GC, TTL và tranh chấp concurrency. **Không áp dụng SQL trực tiếp lên production** từ bảng logic này.

## H. Hợp đồng API logic (đề xuất, không khẳng định đang tồn tại)

| Method | Endpoint logic | Mục đích |
| --- | --- | --- |
| POST | /api/storage/nodes/enroll | Đăng ký node, khai báo quota/capabilities |
| PATCH | /api/storage/nodes/{id} | Pause/resume/drain; xác thực device |
| GET | /api/storage/nodes/{id}/summary | Tình trạng, usage, uptime, thưởng |
| POST | /api/storage/shards/receipts | Node báo đã ghi, kèm proof ký |
| POST | /api/storage/audits/{id}/prove | Trả challenge-proof |
| POST | /api/media/{id}/archive-evaluate | Admin/worker đánh giá điều kiện archive |
| GET | /api/media/{id}/reaccess-quote | Kiểm quyền + availability + quote phí |
| POST | /api/media/{id}/reaccess | Tạo request idempotent sau user confirmation |
| GET | /api/media/reaccess/{requestId} | Trạng thái và tiến độ an toàn |
| POST | /api/media/reaccess/{requestId}/client-receipt | Xác nhận đã nhận + verify hợp lệ |
| POST | /api/media/reaccess/{requestId}/cancel | Hủy, release khoản giữ |
| GET | /api/wallet/transactions | Sao kê giao dịch/hoàn tiền |
| GET | /api/storage/provider/rewards | Sao kê thưởng từ network |

Tất cả endpoint: JWT/session, device proof, explicit authorization, rate limits, idempotency header, request/response schema version, pagination, tracing không có secret, lỗi machine-readable, audit log. GET quote không giữ tiền. Các endpoint phía node cần mTLS hoặc challenge-signed device identity và token scope ngắn, không dùng public unauthenticated shard URL.

**Ví dụ request (để team chốt schema, KHÔNG phải API đang live):**

`POST /api/media/{id}/reaccess`: `{ "quoteId": "UUID", "requestId": "UUID", "deviceId": "UUID", "acceptedAmount": 3, "unit": "COIN" }`. Giá chỉ là dữ liệu minh họa; **3 COIN không phải giá được chốt**.

**Lỗi chuẩn đề xuất:** `MEDIA_NOT_AUTHORIZED` (403), `MEDIA_UNAVAILABLE` (409), `INSUFFICIENT_SHARDS` (503 + retry-after), `KEY_RECOVERY_REQUIRED` (422), `QUOTE_EXPIRED` (409), `INSUFFICIENT_BALANCE` (402/409 tùy payment contract), `HASH_MISMATCH` (502), `DEVICE_NOT_VERIFIED` (403), `IDEMPOTENCY_CONFLICT` (409).

## I. Chính sách giá, trả thưởng và UX

- **[CHỐT]** Mỗi lần thực sự cần yêu cầu truy xuất mới từ network (không còn bản local) có thể mất một khoản nhỏ. KHÔNG thu mỗi lần mở file đã tồn tại trên thiết bị.
- **[CHỐT]** Đơn vị tiền thật hay Credit/Coin vẫn chưa chốt; Point/Coin hệ thống hiện có phải tuân theo tài liệu kinh tế riêng. Không tự tạo tài sản rút tiền.
- **[ĐỀ XUẤT]** Báo giá = retrieval node + egress/relay + cost audit/repair phân bổ + platform fee + thuế/điều khoản nếu có; có trần phí và hiển thị trước. Chi phí giữ lâu dù ít người mở vẫn phải có nguồn bù.
- **[ĐỀ XUẤT]** Node được ghi điểm/tài khoản thưởng từ phí phục vụ thực và storage đã kiểm chứng; phần thưởng không được phát khi proof gian lận hoặc self-service abuse.
- **[BẮT BUỘC]** Reserve, settle, release/refund dùng atomic double-entry + idempotency. Mất mạng sau khi nhận file nhưng trước ACK cần cơ chế xác minh/claim có hạn và đối soát; không tự thu vô thời hạn.
- **[CẦN DUYỆT]** Mức phí/minimum, đơn vị thu, chia doanh thu, reward theo GB-tháng, tier, chính sách miễn phí ảnh nhỏ, hoàn tiền, rút thưởng, thuế/pháp lý.

**UI copy:** “File đã được lưu trữ. Truy cập lại từ mạng lưu trữ ChatNet — phí dự kiến X Credit. Chỉ thanh toán nếu khôi phục thành công.” Trạng thái: “Đang tìm nguồn lưu”, “Đang tải các mảnh”, “Đang khôi phục”, “Đã truy cập thành công”, “Không đủ bản lưu để khôi phục — không thu phí”. Với local: “Mở file” không kèm giá.

## J. NFR và mục tiêu đo kiểm [ĐỀ XUẤT, chưa là SLA]

| Nhóm | Tiêu chí cần đo |
| --- | --- |
| Reliability | Số file có >= k shard hợp lệ, phân bố failure domain; số giờ ở AT_RISK; full recovery drill |
| Security | Không secret trong logs/DB/storage; cryptographic review; keys group/rotate; XSS |
| Latency | P50/P95 quote, time-to-first-byte, full recover theo 1 MB/100 MB/1 GB |
| Throughput | Node bandwidth, concurrency, backpressure, rate limit, group fanout |
| Economy | Cloud GB-month; node GB-month; audit/repair/egress; chi phí per successful reaccess |
| Billing | Zero double charge, zero charge local, refund failed, reconciliation |
| Observability | Trace upload/placement/audit/repair/recovery/settlement không lộ tên file |
| UX | Progress/pause/resume, mobile data policy, error clarity, accessibility |
| Compliance | Consent dùng ổ, quy trình xóa dữ liệu, payment/reward reviews, dispute handling |

**Go/no-go sản phẩm:** phải đo trên node thực đủ thời gian và số failure domain; xác minh cross-platform E2EE, encryption at-rest; cho chaos testing; đồng thời chứng minh economics rẻ hơn hoặc có lợi thế đủ lớn so với chỉ dùng S3/R2.

## K. Phân rã backlog giao nhân sự (đề xuất)

| ID | P | Luồng / owner gợi ý | Đầu ra có thể nghiệm thu |
| --- | --- | --- | --- |
| DMS-00 | P0 | BA + Lead | Chốt glossary, yêu cầu, quyết định chưa chốt, ERD/API/OpenAPI và threat model |
| DMS-01 | P0 | Backend | Storage adapter/relay metadata, lifecycle state machine, migration additive |
| DMS-02 | P0 | Crypto FE + Security | Media client compression/chunk-E2EE, encrypted manifest, group key lifecycle |
| DMS-03 | P0 | Storage engineer | Erasure coding versioned, shard hash, signed manifest, decode/integrity tests |
| DMS-04 | P0 | Backend | Node registry/placement/failure domains/lease/audit/repair |
| DMS-05 | P0 | Desktop engineer | Opt-in agent, volume detection, directory sandbox, quota, fsync, pause/drain |
| DMS-06 | P0 | Backend + FE | Paid reaccess API, availability lookup, request progress, client verify |
| DMS-07 | P0 | Payments/Backend | Simulated quote/reserve/settle/refund, idempotent ledger and reconciliation |
| DMS-08 | P0 | QA/Security | Fault matrix, node loss, tampering, group access, charge disputes |
| DMS-09 | P1 | UX/FE | Storage Node settings; archived media badge, reaccess price confirmation |
| DMS-10 | P1 | SRE | Monitoring, alerts, backups for registry, runbooks/repair cost controls |
| DMS-11 | P1 | PM/Legal | Pricing, rewards, consent/privacy, user-facing terms, payout decisions |
| DMS-12 | P2 | Platform | NAT/P2P optimization, streaming recovery and network cost tuning |

**Phụ thuộc tối thiểu:** DMS-00 + E2EE gate → DMS-01/02/03 → DMS-04/05 → DMS-06/07 → DMS-08/09/10 → private beta. Không tắt fallback S3/R2 trước bước cuối.

## L. RACI và deliverable khi nhân sự nhận việc

- **BA/PM (Accountable):** câu chuyện người dùng, quy tắc BR, UX copy, quyết định [CẦN DUYỆT], acceptance, thay đổi scope.
- **Tech Lead/Security:** ký duyệt sơ đồ dữ liệu, threat model, E2EE key lifecycle, crypto lib, audit, rollback gate.
- **Backend:** schema, API, scheduler, queue, network coordinator, billing, metrics.
- **Frontend/Web:** ảnh thumbnail/cache, UI trạng thái và báo giá, receipt, quyền nhóm.
- **Desktop/Storage:** agent ổ đĩa, quota, filesystem integrity, drain/repair.
- **QA:** test matrix và báo cáo evidence theo build, không “pass” chỉ từ unit test.
- **SRE/Infra:** staging cluster, registry backup, alerts, runbooks, S3 cost, production safety.
- **Finance/Legal:** phương thức thanh toán, reward, thuế, consent, chính sách xóa.

**Definition of Ready cho một task:** đã có BR/UC liên quan, API/schema rõ, known dependencies, data migration/rollback, case fail, logging, acceptance test và owner.  
**Definition of Done:** code + unit/integration/E2E + security/QA evidence + docs/runbook + release flag off by default + không regression legacy + reviewer phê duyệt. Không được đánh dấu production-ready nếu chỉ chạy POC.

## M. Quyết định cần chủ sản phẩm ký trước khi thanh toán thật

1. **40 ngày** là thời hạn mềm hay cam kết cứng? Đề xuất: mục tiêu mềm, bảo toàn file quan trọng hơn việc xóa đúng ngày.
2. Coin, Credit hay VNĐ? Tỷ giá/giá tối thiểu? Có ưu đãi miễn phí nhỏ không?
3. Node nhận Point, quyền lợi hay tiền mặt? Hệ thống Point/Coin hiện có có hỗ trợ không?
4. Quyền mở media cũ khi thành viên rời/được thêm nhóm (historical access) ra sao?
5. Độ bền dữ liệu và bao nhiêu node/failure domain cần giữ để được phép xóa relay?
6. Chính sách “Giữ vĩnh viễn”, backup cá nhân, xóa theo yêu cầu và giải quyết tranh chấp thế nào?
7. Sản phẩm có sẵn sàng trả phí cloud fallback cho dữ liệu AT_RISK không?

## N. Điều kiện không được vượt qua

- **Chưa đủ kiểm chứng E2EE thực tế:** không triển khai private media thông qua node và không công bố E2EE đã hoàn tất.
- **Chưa đủ node/audit/repair:** không tự động xóa bản S3/R2 cuối.
- **Chưa duyệt thanh toán/điều khoản:** không trừ tiền thật hay cho user rút thưởng.
- **Chưa đạt QA và privacy/legal:** không rollout rộng.

**Trạng thái bàn giao:** đây là BA handoff phục vụ phân tích, ước lượng, thiết kế và chia việc; các hợp đồng API/schema là dự thảo. Repo hiện chưa được thay đổi để chạy Distributed Media Storage chỉ bằng việc tạo tài liệu này. Xem ma trận kiểm thử đi kèm và RFC để triển khai có kiểm soát.
