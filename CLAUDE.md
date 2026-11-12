# ChatNet — Project Agent Rules

Read this project policy and the relevant local skills before editing code.

## Product and implementation context
- Phase 1 delivers **Web and PWA**. Do not add native iOS/Android release work without an explicit request; preserve existing mobile source and compatibility.
- Current stack: React + TypeScript + Vite/PWA frontend; Go services, PostgreSQL and Redis backend. Inspect actual modules, APIs and configuration before choosing an approach.
- Use the established blue-violet (indigo) brand system consistently. Optimize for compact, accessible, responsive desktop/mobile Web UX without unexpected layout shifts.
- Preserve private/group chat, feed/social interactions, notifications, calls and translations. Never put AI provider secrets, privileged Gemini calls or server-only translation logic into client bundles.
- Retain server-side authorization, validation, API/data contracts, rate limits, migration integrity and safe error handling.
- Respect unrelated dirty files, parallel agent worktrees and untracked assets. Only stage task files; never force-push or change deployments implicitly. Use a focused branch, verify, then integrate according to repository policy.
- Write commit subjects as a single-line Conventional Commit in English; do not add a commit body unless requested.
- Truthfully report PASS/FAIL/NOT RUN/BLOCKED and independently identify commit, push, merge, CI and deployment status.

See `docs/AI_SKILLS_SETUP.md` for source provenance, dispatch and update instructions.

<!-- CODELOCAL-SKILLS:BEGIN -->
## CodeLocal Skills — coding agent instructions

Before a coding task, inspect the repository, existing instructions, project stack,
Git state, affected workflows and contracts. Read the applicable skill(s), not all
nine indiscriminately:

- Server/API/DB/auth/security/migrations: .claude/skills/backend-engineering/SKILL.md and relevant references.
- React/Vite/Next.js frontend behavior, state/forms/API/routing/feature parity:
  .claude/skills/react-frontend-engineering/SKILL.md and relevant references.
- Design system, iOS-inspired UI, responsive, visual quality:
  .claude/skills/ios-inspired-ui-design/SKILL.md and relevant references.
- Any code creation/fix/refactor: additionally read .claude/skills/ponytail/SKILL.md.
  Apply Ponytail **Ultra** as a simplicity *decision policy*, not a plugin mode.
  Challenge unneeded complexity; reuse existing code/platform/dependencies first.
- On explicit review/audit/debt/benchmark/help requests, use
  .claude/skills/ponytail-review/SKILL.md, .claude/skills/ponytail-audit/SKILL.md,
  .claude/skills/ponytail-debt/SKILL.md, .claude/skills/ponytail-gain/SKILL.md, or
  .claude/skills/ponytail-help/SKILL.md as appropriate.

Precedence: project/user-approved scope, correctness, backend authorization, data
and API compatibility, feature parity, accessibility, tests and release safety
always beat code brevity (P0/P1 quality gates). Ponytail Ultra must NOT silently remove requirements,
validation, security checks, error handling or tests. Follow project branch/CI
policies. Report PASS/FAIL/NOT RUN/BLOCKED from evidence; do not invent success,
commit, push, merge, deployment or live testing.

This block was installed by CodeLocal Skills. Existing project instructions remain
in effect. Ponytail is third-party MIT-licensed; provenance is under
`.codelocal-skills/ponytail/`. No marketplace plugin or hooks are installed.
<!-- CODELOCAL-SKILLS:END -->

## Kiến trúc frontend (bắt buộc)
- `app/` chỉ khởi tạo, providers, layout, điều hướng. `features/<tên>/` sở hữu components, hooks, state, `api/` và nghiệp vụ của chính nó. `shared/` chỉ chứa code không phụ thuộc feature nào. `platform/` chứa tích hợp môi trường và nhận phụ thuộc qua tham số. Quy ước thư mục: `docs/FRONTEND_STRUCTURE.md`.
- Hướng phụ thuộc: `app → features → shared`. `shared` và `platform` không import `features` hoặc `app`. Feature không import ngược `app/`.
- Feature khác chỉ dùng một feature qua `index.ts` của nó, không import sâu vào file nội bộ.
- Lời gọi Backend nằm trong `features/<tên>/api/`; component không gọi `fetch`/`apiFetch` trực tiếp.
- Các thư mục `api/`, `index.ts` và Context cho session/thông báo đang được triển khai dần theo kế hoạch PR. Code cũ chưa tuân thủ không phải lý do để vi phạm trong code mới; khi sửa một khu vực, đưa nó về đúng quy ước nếu phạm vi PR cho phép.

## Quy tắc React (bắt buộc)
- Tuân thủ Rules of Hooks, purity và immutability. Không đọc hoặc ghi `ref.current` khi render.
- Không dùng `useEffect` để đồng bộ hoặc reset state khi có cách đúng hơn: tính trực tiếp từ state/props, hoặc dùng `key`.
- Không lưu trong state thứ có thể tính ra. Không tạo state trùng với state hoặc ref khác.
- Ưu tiên state cục bộ; chỉ nâng state khi nhiều nơi thực sự cần. Context chỉ cho dữ liệu ít đổi, dùng rộng (session, thông báo).
- Component tập trung UI; hook quản lý logic có state; module `api/` giao tiếp Backend.
- Không tắt rule ESLint để qua kiểm tra. Nếu cần ngoại lệ, ghi lý do cụ thể ngay tại chỗ.
- `npm run lint` (trong `frontend/`) chạy ESLint với `eslint-plugin-react-hooks` và so với `lint-baseline.json`: các vi phạm có sẵn được phép giảm nhưng không được tăng. Sau khi sửa bớt vi phạm, chạy `npm run lint:baseline` để ghi nhận. `npm run lint:report` liệt kê chi tiết kèm số dòng.

## Quy trình refactor kiến trúc (bắt buộc)
- Audit chỉ đọc → xin duyệt → mới sửa. Mỗi PR một phạm vi, giữ nguyên hành vi, không đổi API, database, Docker hay cấu hình production.
- Trước khi báo xong: `tsc`, lint, build và kiểm tra liên quan. Build PASS không chứng minh chức năng đúng; ghi rõ phần chưa kiểm tra (NOT RUN).

## Khuyến nghị (không áp ngưỡng máy móc)
- Hook có quá nhiều tham số hoặc component có quá nhiều props là dấu hiệu cần xem lại ranh giới, không phải ngưỡng cứng.
- Chỉ dùng `useMemo`/`useCallback` khi có lý do đo được.
- Chỉ thêm abstraction khi nó giảm độ phức tạp thực tế.
