# Demo POC: lưu media phân tán 4-of-6 và "Truy cập lại"

Bản demo nhỏ bằng TypeScript (backend và giao diện web) minh họa luồng trong bộ tài liệu [Distributed Media Recovery](../README.md). Toàn bộ chạy giả lập trên một máy; **không phải sản phẩm** và không thay đổi code của ChatNet.

**Trạng thái:** POC để kiểm chứng luồng nghiệp vụ. Giá, tỷ lệ thưởng và quỹ thưởng trong demo là số đặt tạm để minh họa, chưa phải quyết định sản phẩm (xem [RFC](../CHATNET_DISTRIBUTED_MEDIA_RECOVERY_SPEC.md)).

## Luồng được minh họa

1. **Gửi file:** trình duyệt tạo khóa AES-256-GCM và mã hóa file; server chỉ nhận ciphertext (không nhận khóa, không nhận tên file).
2. **Bản tạm (giả lập S3/R2):** server giữ ciphertext trong `relay/` để tải nhanh, miễn phí.
3. **Chia mảnh 4-of-6:** ciphertext được mã hóa xóa (Reed-Solomon trên GF(256)) thành 6 mảnh; bất kỳ 4 mảnh nào cũng ghép lại được (khoảng 1,5 lần dung lượng).
4. **Node = chương trình agent riêng:** 6 tiến trình `src/agent.ts` (mô phỏng ứng dụng desktop của người cho mượn ổ cứng), nói chuyện với server qua HTTP, chỉ giữ mảnh đã mã hóa. Sáu node nằm trong 3 failure domain.
5. **Audit và repair:** mỗi mảnh được kiểm tra bằng hash (OK / OFFLINE / MISSING / CORRUPT); mảnh hỏng được dựng lại từ các mảnh còn tốt.
6. **Hết hạn bản tạm có điều kiện:** chỉ khi đủ 6/6 mảnh, đủ failure domain và diễn tập khôi phục đạt; nếu không thì giữ bản tạm và chuyển `AT_RISK`. Trong demo "xóa" chỉ là chuyển sang `relay-expired/`.
7. **Thưởng giữ mảnh:** nút "Tua nhanh 1 ngày" trả thưởng từ quỹ giả định, chỉ cho mảnh qua kiểm tra hash.
8. **Truy cập lại có phí:** báo giá (chưa trừ tiền) → giữ tiền → khôi phục từ ≥4 mảnh → client giải mã thành công mới quyết toán, đúng một lần; lỗi thì hoàn tiền. Idempotent theo `requestId`; server tự kiểm tra giá; người ngoài nhóm nhận 403.

Vòng đời media: `RELAY_ACTIVE → DISTRIBUTING → DURABLE_VERIFIED → ARCHIVED` (và `AT_RISK`). Vòng đời yêu cầu truy cập lại: `REQUESTED → QUOTED → RESERVED → LOCATING → FETCHING → RECONSTRUCTED → SETTLED` (hoặc `RELEASED` khi lỗi).

## Chạy thử

Cần Node.js **22.13 trở lên** (`node --version`). Không cần cài thư viện nào để chạy.

```bash
cd docs/distributed-media-storage/demo
npm start          # server + 6 agent, mở http://localhost:5600
npm run demo       # kịch bản dòng lệnh (8 cảnh), in từng bước
npm test           # 15 test tự động
npm run typecheck  # tùy chọn, cần: npm i
```

Windows: bấm đúp `start-demo.bat` (đóng cửa sổ là dừng cả server lẫn 6 agent). Lần đầu nên bấm **Reset demo** trên giao diện.

Cổng mặc định: server `5600`, agent `6201–6206` (đổi bằng `PORT`, `DMS_AGENT_BASE_PORT`). Chạy agent ở máy khác: `npm run agent -- --name node-3 --port 6203 --host 0.0.0.0`, rồi chạy server với `DMS_NODE_URLS=url1,...,url6`. Demo không có đăng nhập thật, chỉ dùng trong mạng tin cậy.

## Kịch bản trên giao diện

Người dùng demo: `alice` (người gửi), `bob` (thành viên nhận), `dave` (người ngoài nhóm).

1. alice: chọn ảnh nhỏ, "Mã hóa và gửi" → `DURABLE_VERIFIED`, 6 node mỗi node giữ 1 mảnh.
2. alice: "Hết hạn relay" → `ARCHIVED`.
3. "Tua nhanh 1 ngày": các node nhận thưởng giữ mảnh dù chưa ai xem lại file.
4. Tạm dừng node-2 và node-5 → bob: "Truy cập lại (có phí)" → xác nhận. Ảnh hiện lại, hash trùng, ví bob bị trừ một lần.
5. bob: "Gửi lại cùng request đã trả" → số dư không đổi. (Sau khi trả, nút Truy cập lại bị khóa; dùng "Mở bản trên máy". Đừng tải lại trang, bản giải mã chỉ nằm trong bộ nhớ trang.)
6. Tạm dừng thêm node-1 (3 node) → báo không đủ mảnh, không thu phí. Bật lại node.
7. alice: "Làm hỏng mảnh" ở một node → `CORRUPT`; "Tua nhanh 1 ngày": node đó không được thưởng; "Sửa chữa" → `HEALTHY`.
8. bob: tick "giả lập mất khóa" → truy cập lại → hoàn tiền.
9. dave: không thấy file nào.

Có thể kết thúc hẳn một tiến trình agent: node báo "mất kết nối", file vẫn khôi phục được nếu còn ≥4 node.

## Kết quả kiểm tra

15 test tự động đạt, kịch bản `npm run demo` chạy đúng, và luồng chính được thử qua giao diện web.

| Tình huống | Kết quả |
| --- | --- |
| Tắt 2 node | Vẫn khôi phục, giải mã đúng, hash trùng file gốc |
| Tắt 3 node | Báo không đủ mảnh (cần 4), không thu phí |
| Mảnh bị sửa 1 byte | Hash phát hiện, bỏ qua, khôi phục từ mảnh khác, repair dựng lại được |
| Hết hạn bản tạm khi thiếu điều kiện | Bị từ chối, giữ bản tạm, `AT_RISK` |
| Truy cập lại thành công | Trừ phí đúng một lần, sổ tiền khớp |
| Gửi lại cùng `requestId` | Trả kết quả cũ, không tính tiền lần hai |
| Sửa số tiền phía client | Bị chặn (`PRICE_MISMATCH`) |
| Mất khóa giải mã | Client báo lỗi, hoàn tiền |
| Số dư không đủ | 402, không giữ tiền |
| Người ngoài nhóm | 403, giống nhau cho file có thật và không tồn tại |
| Node hỏng hoặc đang tắt | Không được thưởng giữ mảnh; tiền vẫn bảo toàn |
| Agent bị đóng hẳn | Vẫn khôi phục nếu còn đủ 4 node |

Giới hạn kiểm tra: mới chạy trên một máy, chưa thử node ở mạng thật, luồng giao diện được thử bằng thao tác tự động và chưa thử với nhiều loại file thật.

## Giới hạn và việc chưa làm

- Node ở mạng thật (NAT, nhiều máy); ứng dụng desktop có giao diện (hiện là chương trình dòng lệnh).
- Chống node nói dối bằng thử thách ngẫu nhiên (audit hiện do server đọc mảnh rồi so hash).
- S3/R2 thật, hết hạn bản tạm theo thời gian thật, tiền thật, đăng nhập thật.
- Bản giải mã trên trình duyệt chỉ nằm trong bộ nhớ trang; tải lại trang mất bản này và phải trả phí lại.
- Công thức demo (không phải quyết định sản phẩm): phí `100 + 50 × MB` xu (100 xu = 1,00 COIN demo), 80% phí cho node phục vụ, thưởng giữ mảnh 1 xu mỗi 64 KB mỗi ngày, quỹ 5000 xu.

## Câu hỏi cần chốt

1. Ai nạp tiền vào quỹ thưởng lưu trữ cho node: người dùng trả phí lưu, hay chỉ trả khi xem lại file cũ, hay ChatNet bù?
2. File ở S3/R2 giữ bao lâu trước khi chuyển sang các node?

## Cấu trúc

| Đường dẫn | Việc |
| --- | --- |
| `src/erasure.ts` | Reed-Solomon 4-of-6 trên GF(256), tự viết |
| `src/e2ee.ts` | AES-256-GCM (WebCrypto), dùng chung cho trình duyệt và Node |
| `src/agent.ts` | Chương trình node (HTTP), chỉ giữ mảnh mã hóa |
| `src/network.ts`, `src/cluster.ts` | Cách server nói chuyện với node (agent HTTP hoặc thư mục cho test) |
| `src/ledger.ts` | Ví giả lập, reserve/settle/release, thưởng node, kiểm tra bảo toàn tiền |
| `src/service.ts` | Vòng đời media, audit, repair, báo giá, truy cập lại |
| `src/server.ts` | Web server, API, tự mở 6 agent |
| `src/demo-cli.ts` | Kịch bản dòng lệnh |
| `web/` | Giao diện (TypeScript, server tự bỏ kiểu khi gửi cho trình duyệt) |
| `tests/` | 15 test |

Mã dùng cú pháp TypeScript "chỉ xóa kiểu" (`--experimental-strip-types` của Node), nên không cần bước build.
