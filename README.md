# ChatNet

ChatNet là MVP mạng giao tiếp đa ngôn ngữ cho hackathon: **chat riêng + chat nhóm + AI Translation + News Feed**.

Mục tiêu của bản thi là chứng minh một flow end-to-end đủ giống sản phẩm thật nhưng vẫn có kiến trúc để tiếp tục scale sau cuộc thi.

## Tính năng

### Tài khoản
- Đăng ký bằng email + username + tên hiển thị + password.
- Gửi OTP 6 số qua email bằng Resend.
- Pending signup lưu Redis 10 phút; chưa tạo user trong PostgreSQL trước khi OTP đúng.
- Chỉ lưu hash OTP phía server, không lưu mã gốc.
- Tối đa 5 lần nhập OTP sai; có rate limit theo email, token và IP.
- Hỗ trợ gửi lại mã OTP.
- Đăng nhập bằng email/password.
- Password hash bằng bcrypt.
- JWT HS256 bảo vệ API.
- Username vẫn là handle để người khác tìm và bắt đầu chat.
- Session web được giữ trong local storage cho MVP.

### Chat riêng
- Tạo chat 1-1 bằng username.
- Một cặp user chỉ có một direct conversation.
- Lưu lịch sử vào PostgreSQL.
- Realtime message qua Redis Pub/Sub + SSE.
- Presence online tối thiểu.
- Unread count theo từng conversation.
- Mark-as-read khi mở conversation.
- Dịch từng message bằng AI.
- Auto Translate message nhận được.

### Chat nhóm
- Tạo group bằng tên nhóm.
- Thêm nhiều thành viên bằng username.
- Mỗi group có conversation và message history riêng.
- Realtime cho mọi thành viên.
- Unread count theo từng user.
- AI Translation hoạt động giống chat riêng.

### News Feed / Tâm sự
- Đăng bài.
- Like/unlike theo từng user.
- Comment.
- Dịch bài viết bằng AI.
- Feed tự refresh định kỳ khi đang mở.

### PWA
- React + Vite + TypeScript.
- Responsive desktop/mobile.
- Web App Manifest.
- Service Worker cache static assets.
- API không bị Service Worker cache.

---

## Kiến trúc

Railway production chỉ dùng **4 node**:

~~~text
                    ┌────────────────────┐
                    │ Frontend           │
                    │ React + Vite + PWA │
                    │ Nginx :8080        │
                    └─────────┬──────────┘
                              │ /api
                              ▼
                    ┌────────────────────┐
                    │ Backend :8080      │
                    │ Auth + OTP         │
                    │ Private/Group Chat │
                    │ Feed               │
                    │ AI Translation     │
                    │ Realtime/SSE       │
                    └──────┬──────┬──────┘
                           │      │
                           ▼      ▼
                    ┌──────────┐ ┌──────────┐
                    │PostgreSQL│ │ Redis    │
                    │persistent│ │realtime  │
                    │data      │ │OTP/cache │
                    └──────────┘ └──────────┘
~~~

Backend vẫn giữ code chia module/entrypoint rõ ràng, nhưng trên Railway chúng được đóng gói và chạy chung trong **một Backend node** để giảm chi phí và độ phức tạp vận hành. Sau cuộc thi có thể tách lại nếu traffic thực sự cần.

## Node Railway

| Node | Nhiệm vụ |
| --- | --- |
| Frontend | React PWA, Nginx static hosting và proxy /api sang Backend qua private network |
| Backend | Auth, email OTP, JWT, chat riêng/nhóm, Feed, AI Translation, realtime |
| PostgreSQL | Persistent application data |
| Redis | Pub/Sub, presence, pending OTP, rate limit và translation cache |

---

## Cấu trúc thư mục

~~~text
ChatNet/
├── frontend/
│   ├── src/
│   └── public/
├── backend/
│   ├── cmd/
│   │   ├── gateway/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── feed/
│   │   └── translate/
│   ├── internal/
│   │   ├── authx/
│   │   ├── config/
│   │   ├── database/
│   │   └── httpx/
│   ├── migrations/
│   │   └── 001_init.sql
│   ├── Dockerfile
│   └── go.mod
├── Dockerfile.backend
├── backend-run.sh
├── Dockerfile.frontend
├── frontend-nginx.conf.template
├── docker-compose.yml
├── .env.example
├── Makefile
└── README.md
~~~

---

## Chạy toàn bộ hệ thống

Yêu cầu:
- Docker Desktop hoặc Docker Engine + Docker Compose.
- Port 8080 còn trống.
- Resend API key + sender domain đã verify để gửi OTP email.
- API key + Base URL + model của AI provider bên thứ ba để dùng AI Translation thật.

Tạo env:

~~~bash
cp .env.example .env
~~~

Điền:

~~~env
JWT_SECRET=your-long-random-secret
OTP_PEPPER=another-long-random-secret

RESEND_API_KEY=your-resend-api-key
RESEND_API_BASE_URL=https://api.resend.com
CHATNET_EMAIL_FROM=ChatNet <noreply@your-domain.com>

AI_PROVIDER=partner
AI_API_KEY=your-provider-api-key
AI_BASE_URL=https://your-provider.example/v1
AI_MODEL=your-model
AI_API_STYLE=auto
~~~

Sau đó:

~~~bash
docker compose up --build
~~~

Mở:

~~~text
http://localhost:8080
~~~

---

## Railway deploy hiện tại

~~~text
Project: ChatNet
Region: Southeast Asia
Frontend: https://chat.codelocal.cloud
API: https://api-chat.codelocal.cloud
~~~

Railway hiện chỉ chạy đúng **4 node**:

~~~text
frontend   public  :8080  -> chat.codelocal.cloud
backend    public/private :8080 -> api-chat.codelocal.cloud / Railway private network
Postgres   private
Redis      private
~~~

Frontend dùng Nginx proxy `/api` tới `http://backend.railway.internal:8080` qua Railway private network. Client ngoài/mobile có thể gọi trực tiếp `https://api-chat.codelocal.cloud`. Backend kết nối PostgreSQL và Redis bằng Railway private networking.

Các secret/config cần đặt trên **Backend** để test đầy đủ:
- RESEND_API_KEY và sender email đã verify.
- AI_API_KEY
- AI_BASE_URL
- AI_MODEL
- Khuyến nghị đặt riêng JWT_SECRET và OTP_PEPPER khi chuyển khỏi bản hackathon.

Không commit các giá trị bí mật vào source code.

Redeploy:

~~~bash
railway up --service backend --detach -y
railway up --service frontend --detach -y
~~~

Kiểm tra trạng thái:

~~~bash
railway service list --json
railway logs --service backend --latest --lines 100
railway logs --service frontend --latest --lines 100
~~~

---

## Test demo nhanh

### 1. Tạo ba tài khoản

Mỗi tài khoản cần một email nhận OTP thật. Ví dụ:

~~~text
mong@example.com  -> username mong
linh@example.com  -> username linh
ken@example.com   -> username ken
~~~

Flow: điền thông tin -> nhận OTP 6 số qua email -> xác minh -> được đăng nhập tự động.

Mỗi tài khoản mở bằng browser/profile khác nhau.

### 2. Test chat riêng

Đăng nhập Mong:
- Tin nhắn
- + Riêng
- Nhập username: linh
- Gửi message.

Browser của Linh sẽ nhận conversation/message realtime.

### 3. Test chat nhóm

Mong:
- + Nhóm
- Tên nhóm: Hackathon Team
- Username: linh, ken
- Tạo nhóm.

Cả Linh và Ken sẽ nhận group qua realtime và có thể chat chung.

### 4. Test AI Translation

Điền cấu hình AI provider (AI_BASE_URL, AI_API_KEY, AI_MODEL) trong file .env.

Trong conversation:
- Chọn ngôn ngữ đích.
- Bấm **Dịch bằng AI** dưới message.
- Hoặc bật **Tự dịch AI**.

News Feed cũng dùng cùng AI Translation service.

### 5. Test unread

- Linh đang mở conversation A.
- Mong gửi vào conversation B.
- Linh sẽ thấy badge unread ở B.
- Khi Linh mở B, app mark conversation đã đọc.

### 6. Test Feed

- Đăng tâm sự.
- Like.
- Comment.
- Bấm Dịch AI.

---

## API

### Auth

~~~http
POST /api/auth/register/start
POST /api/auth/register/verify
POST /api/auth/register/resend
POST /api/auth/login
GET  /api/auth/me
~~~

Start signup:

~~~json
{
  "email": "mong@example.com",
  "username": "mong",
  "password": "demo12345",
  "displayName": "Mong"
}
~~~

Sau đó server trả verification token. User nhập OTP email:

~~~json
{
  "token": "<verification-token>",
  "code": "123456"
}
~~~

User chỉ được tạo trong PostgreSQL sau khi OTP hợp lệ.

Authenticated API:

~~~http
Authorization: Bearer <jwt>
~~~

### Conversations

~~~http
GET /api/conversations
~~~

Create direct:

~~~http
POST /api/conversations/direct
~~~

~~~json
{
  "username": "linh"
}
~~~

Create group:

~~~http
POST /api/conversations/groups
~~~

~~~json
{
  "name": "Hackathon Team",
  "usernames": ["linh", "ken"]
}
~~~

Messages:

~~~http
GET  /api/conversations/:id/messages
POST /api/conversations/:id/messages
POST /api/conversations/:id/read
~~~

Send:

~~~json
{
  "text": "Xin chào cả nhóm"
}
~~~

### User search

~~~http
GET /api/users/search?q=linh
~~~

### Realtime

~~~http
GET /api/events?token=<jwt>
~~~

MVP dùng SSE. Chat Service giữ presence trong Redis với TTL và subscribe channel riêng cho từng user:

~~~text
chatnet:user:<userId>
~~~

Khi có message, Chat Service publish event tới tất cả member của conversation. Nhờ vậy nhiều instance Chat Service vẫn đồng bộ realtime.

> JWT trong query string chỉ được dùng cho SSE MVP vì browser EventSource không cho set Authorization header. Production nên chuyển WebSocket auth handshake hoặc HttpOnly cookie.

### Feed

~~~http
GET  /api/posts
POST /api/posts
POST /api/posts/:id/like
POST /api/posts/:id/comments
~~~

### AI Translation

Translate Service không khóa vào OpenAI. Nó hỗ trợ các provider tương thích OpenAI thông qua cấu hình ENV và chế độ auto-detect API.

~~~http
POST /api/translate
~~~

~~~json
{
  "text": "Xin chào, hôm nay bạn thế nào?",
  "target": "en"
}
~~~

Translate Service yêu cầu model chỉ trả về nội dung đã dịch, giữ tone, slang, emoji, URL, markdown, tên riêng và line-break.

Provider/model nằm hoàn toàn trong ENV:

~~~text
AI_PROVIDER
AI_API_KEY
AI_BASE_URL
AI_MODEL
AI_API_STYLE
AI_AUTH_HEADER
AI_AUTH_SCHEME
~~~

AI_API_STYLE=auto sẽ thử /responses trước; nếu provider trả 400/404/405/422 thì ChatNet tự fallback sang /chat/completions.

Nếu provider dùng Authorization: Bearer thì giữ cấu hình mặc định. Nếu provider dùng x-api-key thì đặt AI_AUTH_HEADER=x-api-key và để AI_AUTH_SCHEME rỗng.

Frontend và các module Chat/Feed không phụ thuộc trực tiếp vào provider AI.

---

## Database

Migration:

~~~text
backend/migrations/001_init.sql
~~~

Các bảng:

~~~text
users
conversations
conversation_members
messages
message_attachments
posts
post_attachments
post_likes
comments
~~~

Quan hệ chat:

~~~text
users
  │
  ▼
conversation_members
  │
  ▼
conversations ───── messages
~~~

Direct conversation dùng direct_key unique được tạo từ hai user ID đã sort, tránh tạo nhiều chat riêng trùng nhau.

conversation_members.last_read_message_id dùng để tính unread.

---

## Upload media/file qua S3-compatible storage

ChatNet dùng cùng mô hình với KpiBsc: **trình duyệt PUT file thẳng lên S3/R2 bằng presigned URL**. Backend không nhận multipart/file bytes và PostgreSQL không lưu binary.

Luồng:

~~~text
Browser
  │ POST /api/media/presign (metadata)
  ▼
Chat Service
  │ trả presigned PUT URL + s3://bucket/key
  ▼
Browser ── PUT file trực tiếp ──> S3-compatible storage
  │
  │ POST message/post chỉ với metadata + storageRef
  ▼
Chat/Feed Service ── HEAD xác minh object ──> S3
  │
  ▼
PostgreSQL chỉ lưu s3://bucket/key + tên/MIME/kích thước
~~~

ENV cần bổ sung ở backend/Railway:

~~~env
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_ENDPOINT=
S3_REGION=
S3_FORCE_PATH_STYLE=true
~~~

Các credential S3 chỉ nằm ở backend. Frontend chỉ nhận URL ký ngắn hạn.

Bucket phải cho phép CORS từ origin của ChatNet (production: https://chat.codelocal.cloud) cho PUT, GET, HEAD và header Content-Type. Khi test local, thêm origin local tương ứng.

Giới hạn hiện tại:
- Chat: tối đa 10 file/tin nhắn; ảnh 20 MB, video 150 MB, audio 40 MB, tài liệu 50 MB.
- Feed: tối đa 12 ảnh/video/bài; ảnh 20 MB, video 150 MB.
- Feed không nhận tài liệu/audio.
- Server HEAD lại object sau upload để xác minh file tồn tại, MIME và kích thước thật trước khi gắn vào message/post.

---

## Redis

Redis hiện làm bốn việc: realtime event bus, presence, pending signup/OTP có TTL và rate-limit/AI translation cache.

### Realtime bus

~~~text
POST message
    │
    ▼
PostgreSQL
    │
    ▼
Chat Service
    │
    ├─ publish user A
    ├─ publish user B
    └─ publish user C
         │
         ▼
       Redis
         │
         ▼
SSE connection của từng user
~~~

### Presence

Khi user mở SSE:

~~~text
chatnet:presence:<userId>
TTL = 45s
~~~

Server refresh TTL mỗi 20 giây.

---

## JWT

JWT:
- HS256.
- Expire sau 24 giờ.
- Chứa user id, username và display name.
- Secret lấy từ JWT_SECRET.

Production cần thêm:
- Refresh token rotation.
- Device sessions.
- Token revoke.
- HttpOnly cookie cho web.
- Rate limit.

---

## AI Translation

Bản này **không dùng dictionary giả lập** nữa.

Translate module gọi model AI thật của provider được cấu hình và cache kết quả 24 giờ trong Redis theo provider + model + ngôn ngữ đích + nội dung.

Model được cấu hình hoàn toàn bằng ENV, không hard-code provider:

~~~env
AI_MODEL=...
~~~

Nếu chưa cấu hình AI_API_KEY / AI_BASE_URL / AI_MODEL, app vẫn chạy chat/feed nhưng endpoint dịch trả trạng thái chưa cấu hình thay vì giả vờ dịch.

---

## Reset database

Migration Docker chỉ chạy khi PostgreSQL volume được tạo mới.

Nếu schema thay đổi trong giai đoạn hackathon:

~~~bash
docker compose down -v
docker compose up --build
~~~

---

## Commands

~~~bash
make up
make down
make reset
make logs
make build
make test
~~~

---

## Những gì cố tình chưa làm trong MVP

Để giữ scope đủ hoàn thiện trong thời gian hackathon, bản hiện tại chưa ưu tiên:
- Voice/video call.
- Story media 24 giờ.
- Recall/edit message.
- Message reaction.
- Push notification.
- Friend request graph.
- Group admin/member management nâng cao.
- End-to-end encryption.

Các boundary hiện tại cho phép bổ sung các phần này mà không cần viết lại frontend gateway/auth core.

---

## Roadmap sau cuộc thi

1. SSE → WebSocket.
2. Thumbnail/transcode + cleanup media orphan.
3. Notification Center + badge hoàn chỉnh.
4. Delivered/read receipt chi tiết.
5. Reply/reaction/recall.
6. Friend/follow graph.
7. Group role/admin/invite.
8. AI context-aware translation theo conversation.
9. OpenTelemetry + metrics.
10. Rate limit + abuse/moderation.
11. Tách database theo service khi traffic cần.

---

**ChatNet — Chat. Translate. Share.**
