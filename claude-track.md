# Team Usage Tracking — Design & Discussion Doc

> **Trạng thái:** DRAFT — để team review & discuss
> **Dự án:** Founder Chatbot (Skalata)
> **Phạm vi:** Theo dõi usage của Claude Code theo từng dev → Supabase → web dashboard cho team, kèm cơ chế token auth.
> **Ghi chú:** Các quyết định chưa chốt nằm ở mục [10. Câu hỏi mở](#10-câu-hỏi-mở--điểm-cần-chốt).

---

## 1. Mục tiêu

Cho phép team nhìn thấy, tập trung ở một web dashboard:

- Mỗi dev đang chạy model gì, ở project/branch nào.
- Mức tiêu thụ context window (%), token, cost ước tính.
- Trạng thái quota (5h / 7 ngày) khi có.
- Ai đang idle (tận dụng event `TeammateIdle`).

Đồng thời statusline của mỗi dev vẫn hiển thị usage cá nhân như hiện tại, và có một "cổng đăng nhập" bằng token để gắn mỗi phiên CLI với một user trên dashboard.

**Không nằm trong phạm vi (lần này):** billing thật, phân tích lịch sử dài hạn (đã có công cụ như ccusage cho single-machine), OAuth browser flow đầy đủ.

---

## 2. Nguyên tắc thiết kế cốt lõi (RÀNG BUỘC — đọc trước khi code)

Đây là các ràng buộc kỹ thuật đã xác minh từ tài liệu Claude Code. Vi phạm chúng sẽ làm chậm hoặc treo trải nghiệm của dev.

1. **Statusline phải local & nhanh.** Statusline chạy lại tối đa mỗi ~300ms. **TUYỆT ĐỐI KHÔNG gọi mạng (Supabase) từ trong `statusline.cjs`** — mỗi lần gõ phím sẽ khựng. Statusline chỉ đọc/ghi file cache local.
2. **Tách rõ ranh giới mạng.** Việc đẩy dữ liệu lên Supabase xảy ra ở **hooks** (bất đồng bộ), không nằm trên đường tương tác real-time.
3. **Fire-and-forget.** Mọi lệnh gọi Supabase phải không chặn (spawn detached / không await). Supabase sập thì Claude Code của dev **vẫn chạy bình thường**.
4. **SessionStart KHÔNG chặn được phiên.** Nó chỉ chèn được banner/context. Cổng token bắt buộc phải đặt ở **UserPromptSubmit** (event này chặn được prompt bằng exit code 2).
5. **Không sync ở UserPromptSubmit.** Event này chặn xử lý model tới khi hook xong (timeout mặc định 30s). Chỉ dùng nó để *kiểm tra token* (đọc env — tức thì). Sync mạng để ở **Stop**.
6. **Config không hot-reload.** Claude snapshot hook lúc bắt đầu phiên; sửa `settings.json` xong phải mở phiên mới (review trong `/hooks`).

---

## 3. Kiến trúc tổng quan

Bốn lớp, tách theo ranh giới mạng:

```
┌─────────────────────── MÁY DEV (mỗi người) ───────────────────────┐
│                                                                    │
│  Claude Code                                                       │
│    ├── statusline.cjs ──(đọc/ghi)──► local cache (tmp/*.json)      │
│    │        ▲                                                      │
│    │        └── chỉ đọc số liệu local, KHÔNG gọi mạng              │
│    │                                                               │
│    └── hooks/                                                      │
│         ├── UserPromptSubmit  → CỔNG TOKEN (chặn nếu thiếu)        │
│         ├── SessionStart      → banner nhắc token (không chặn)     │
│         └── Stop / TaskDone    → đọc cache → PUSH (fire-forget) ───┼──┐
│                                                                    │  │
└────────────────────────────────────────────────────────────────── ┘  │
                        ╎ ranh giới mạng (async)                        │
┌────────────────────── SUPABASE ─────────────────────────┐            │
│  Edge Function: validate token → upsert theo user_id     │ ◄──────────┘
│  Postgres + RLS: sessions, usage_snapshots, device_tokens│
│  Realtime: phát thay đổi cho dashboard                   │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  WEB DASHBOARD (Next.js + supabase-js, deploy Vercel)     │
│   - Cấp token cho dev (mục 4)                             │
│   - Bảng usage/cost/idle của cả team, cập nhật realtime   │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Luồng token / Auth

Mô phỏng cảm giác "đăng nhập Claude CLI":

1. **Web cấp token.** Dev đăng nhập dashboard → hệ thống sinh một **token opaque, per-user, revocable**. Lưu **bản hash** trong bảng `device_tokens` map tới `user_id`. Hiển thị token (chỉ 1 lần) để dev copy.
   - Token này **KHÔNG** phải `service_role` key của Supabase.
2. **Dev dán token vào CLI.** Vào `.claude/.env`:
   ```
   TEAM_USAGE_TOKEN=cku_xxxxxxxxxxxxxxxx
   ```
   Khớp pattern `.env` sẵn có của project (đã có `.env.example` + `resolve_env.py`). Hook đọc qua `process.env.TEAM_USAGE_TOKEN`.
3. **Cổng token (khi bắt đầu làm việc):**
   - **SessionStart** (`session-init.cjs`): nếu thiếu token → `echo` banner ra stdout (được inject làm context): *"⚠ Chưa có usage token — lấy tại https://<web>/login rồi dán vào .claude/.env"*. Không chặn.
   - **UserPromptSubmit** (hook mới): nếu thiếu token → ghi hướng dẫn + link ra **stderr** rồi `exit(2)`. Chặn cứng mọi prompt tới khi có token. stderr được hiện cho người dùng.
4. **Sync usage:** hook **Stop** đọc cache local → POST fire-and-forget lên Edge Function, gửi `Authorization: Bearer $TEAM_USAGE_TOKEN`. Edge Function xác thực → resolve `user_id` → upsert.

---

## 5. Chi tiết thành phần

### 5.1 Statusline (không đổi nhiều)
Giữ nguyên `statusline.cjs`. Nếu muốn hiển thị số liệu "đã xác nhận từ server", để hook/daemon ghi kết quả sync xuống một file cache local, statusline đọc file đó (vẫn không gọi mạng).

### 5.2 Hooks
| Event | Hook | Vai trò | Chặn? |
|---|---|---|---|
| `UserPromptSubmit` | (mới) `require-usage-token.cjs` | Cổng token: exit 2 nếu thiếu | ✅ có |
| `SessionStart` | `session-init.cjs` (mở rộng) | Banner nhắc token | ❌ không |
| `Stop` | `session-state.cjs` (mở rộng) | Đọc cache → push Supabase (fire-forget) | ❌ không |
| `TaskCompleted` | `task-completed-handler.cjs` (mở rộng) | Push mốc hoàn thành task | ❌ không |
| `TeammateIdle` | `teammate-idle-handler.cjs` (mở rộng) | Push trạng thái idle | ❌ không |

> Không push ở `PostToolUse` (quá dày) trừ khi có throttle.

### 5.3 Supabase
- **Edge Function** `ingest-usage`: nhận POST, validate token (hash-compare với `device_tokens`), lấy `user_id`, upsert vào `usage_snapshots` / `sessions`.
- **RLS**: token chỉ ghi được dữ liệu của chính user đó; dashboard đọc theo team qua policy.
- **Realtime**: bật trên `usage_snapshots` để dashboard live.

### 5.4 Web dashboard
- Next.js + `supabase-js`, deploy Vercel.
- Trang cấp/thu hồi token (mục 4).
- Bảng team: mỗi dev một hàng — model, project/branch, context %, cost, quota, idle, cập nhật realtime.

---

## 6. Data model (đề xuất, để bàn)

```sql
-- Người dùng trong team (có thể map sang Supabase Auth users)
team_members(user_id uuid pk, email text, display_name text, created_at timestamptz)

-- Token cấp cho từng dev/máy
device_tokens(
  id uuid pk,
  user_id uuid references team_members,
  token_hash text not null,      -- lưu HASH, không lưu token thô
  label text,                    -- ví dụ "laptop cá nhân"
  created_at timestamptz,
  revoked_at timestamptz null
)

-- Một phiên Claude Code
sessions(
  session_id text pk,
  user_id uuid references team_members,
  model text, project text, branch text,
  started_at timestamptz, last_seen_at timestamptz
)

-- Snapshot usage theo thời gian (nguồn cho dashboard)
usage_snapshots(
  id bigint pk,
  session_id text references sessions,
  user_id uuid references team_members,
  context_percent int,
  input_tokens int, output_tokens int,
  cost_usd numeric null,          -- có thể null / là ước lượng
  lines_added int, lines_removed int,
  active_plan text null,
  five_hour_pct int null, seven_day_pct int null,  -- có thể vắng mặt
  idle boolean default false,
  created_at timestamptz default now()
)
```

---

## 7. Bảo mật

- Token **opaque + revocable**, chỉ lưu **hash** ở server; validate tại Edge Function. Không bao giờ để `service_role` key trên máy client.
- Bật **RLS**: mỗi token chỉ ghi được dữ liệu của user của nó.
- **Dữ liệu nhạy cảm:** đường dẫn repo (vd `W:\repo\AnhThang\...`), thống kê code, cost. Cân nhắc chỉ đẩy **số liệu tổng hợp** thay vì path/nội dung — xem [câu hỏi mở](#10-câu-hỏi-mở--điểm-cần-chốt).
- Project đã có `privacy-block.cjs` — nên tận dụng/đồng bộ nguyên tắc privacy với nó.

---

## 8. Cảnh báo về độ chính xác dữ liệu

- `total_cost_usd` chỉ có ý nghĩa thật với billing kiểu **API**; trên gói Max/Pro nó là **ước lượng** → hiển thị kèm nhãn "ước tính".
- `rate_limits` (5h / 7 ngày) **không phải account/version nào cũng có** → xử lý khi thiếu, đừng giả định luôn tồn tại.
- `context_window.used_percentage` chỉ tính **input token**; `current_usage` là null trước lần gọi API đầu tiên và ngay sau `/compact`.

---

## 9. Lộ trình triển khai (đề xuất)

- **Phase 0 — Chốt thiết kế:** giải quyết [mục 10].
- **Phase 1 — Supabase nền:** tạo bảng + RLS + Edge Function `ingest-usage`. Test bằng `curl`.
- **Phase 2 — Cổng token:** hook `require-usage-token.cjs` (UserPromptSubmit) + banner ở SessionStart. Chưa cần dashboard, token cấp tay.
- **Phase 3 — Sync:** mở rộng `session-state.cjs` (Stop) để push fire-and-forget.
- **Phase 4 — Dashboard:** Next.js đọc Supabase + Realtime + trang cấp/thu hồi token.
- **Phase 5 — Đánh bóng:** thu hồi token, xử lý offline queue, (tùy chọn) device-code flow thay copy-paste.

---

## 10. Câu hỏi mở / điểm cần chốt

> Đây là phần chính để team discuss.

1. **Cổng token: chặn cứng hay chỉ cảnh báo?**
   UserPromptSubmit exit 2 sẽ chặn *mọi* prompt khi thiếu token — khá gắt. Có nên đặt sau một flag config (vd `requireToken: true` trong `.ck.json`) để mặc định chỉ cảnh báo, chỉ chặn khi bật?

2. **Dữ liệu gì được phép rời máy?**
   Có đẩy đường dẫn repo / tên branch / project không, hay chỉ số liệu tổng hợp (context %, cost, idle)? Ảnh hưởng trực tiếp tới rủi ro privacy (mục 7).

3. **Cột mốc sync.** Chỉ Stop, hay thêm SessionStart/TaskCompleted? Có cần snapshot định kỳ (heartbeat) để biết dev "đang online" không, hay chỉ khi có sự kiện?

4. **Nguồn danh tính.** Dùng Supabase Auth cho dashboard, hay hệ auth riêng? Token map 1-user-nhiều-máy hay 1-token-1-máy?

5. **Offline/lỗi mạng.** Khi push thất bại, có queue local để gửi lại sau không, hay chấp nhận mất snapshot đó?

6. **Cost trên gói Max/Pro.** Có hiển thị cost ước lượng không, hay ẩn để tránh hiểu nhầm?

7. **Phân quyền dashboard.** Ai xem được usage của ai? Mọi thành viên thấy cả team, hay chỉ lead?

8. **Thu hồi token.** Cần nút revoke ngay từ Phase 2, hay để Phase 5?

---

## 11. Tham khảo

- Claude Code — Statusline: https://code.claude.com/docs/en/statusline
- Claude Code — Hooks reference: https://code.claude.com/docs/en/hooks
- Claude Code — Subagents: https://code.claude.com/docs/en/sub-agents
- Supabase — Edge Functions, RLS, Realtime: https://supabase.com/docs