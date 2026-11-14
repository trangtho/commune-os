<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# apps/citizen — CommuneOS Citizen Portal

Tầng 2: kênh công dân dựng bằng Nuxt 3 + Vue 3 + TypeScript + Tailwind CSS,
sử dụng Nuxt server API để làm việc với PostgreSQL 17. Đường dẫn và hướng
 dẫn chạy tại [`../../docs/CITIZEN_SETUP.md`](../../docs/CITIZEN_SETUP.md).

Chỉ dùng dữ liệu **giả lập**. Không có quyền quản trị lõi ở ứng dụng này.

# apps/citizen

Tầng 2: kênh nộp hồ sơ trực tuyến cho người dân (Nuxt).

## Citizen portal – incremental local upgrade (2026-11-14)

Only files under `apps/citizen/` were changed in this upgrade; no database migration,
admin, identity, gateway, or root Compose changes are needed.

- **Procedure-specific demo forms:** field definitions for all six procedures in the
  current seed plus a fallback form for future unknown procedure IDs.
  Draft create/edit and submit validate on the server; these are not legally approved forms.
- **Document selection:** select and inspect a local image or PDF, then confirm upload.
  Uploaded files are versioned (new uploads do not delete the old file). The backend
  still enforces MIME signatures, 5 MB size, and a 30-file maximum.
- **Cases:** server-side pagination (`GET /api/applications?paged=1&page=1&q=...&status=...`)
  returns `{items,total,page,pageSize,counts}`. The original `GET /api/applications`
  continues returning an array for the homepage and other existing views.
- **Receipt:** `/nop-thanh-cong/:id` displays server-stored receipt information after
  submission, and offers browser Print / Save PDF. It is clearly marked **demo only**.
- **Support history:** `GET /api/feedback` lists the signed-in citizen's 50 most recent
  feedback items; `GET /api/support?applicationId=...` lists saved questions for an
  application. Existing row-level-security policies protect both. The current schema
  contains *no staff response or support status fields*, so the UI does not invent them.
- **Live updates:** case-list pagination participates in the existing SSE invalidation.

### Quick local checks

```bash
npm --prefix apps/citizen install
npm --prefix apps/citizen test
npm --prefix apps/citizen run build
# With Docker Desktop running:
docker compose -f docker-compose.yml up -d --build citizen
```

For acceptance testing, sign in with a demo account, create a draft for each of the
six procedure types, check required fields, preview/upload sample files, submit,
print the demo receipt, filter and paginate cases, then send/reopen a support question.
Do **not** use genuine personal documents for this demonstration.

## Citizen channel hardening – local implementation (2026-11-14)

**Scope:** `apps/citizen/` only; changes do not modify other members' modules,
PostgreSQL schema, Keycloak realm or root Docker Compose. **Not a production legal
service** until official forms, identity, authorization, signed results and E2E
acceptance have been certified by the responsible teams.

### Implemented now

| Item | State / limitation |
|---|---|
| Six data-driven procedure forms | Field rules in `shared/procedure-forms.ts` are enforced on create, draft edit, final submit. Example business information, **not legally approved form templates**. |
| Documents | Upload/preview images/PDF, replace by new version, remove a draft/supplement file by API and RLS; requires one PostgreSQL permission (below). Other versions remain until individually removed. |
| Search | `/tra-cuu` uses `GET /api/applications?paged=1&q=...&status=...&page=...` with DB search/pagination. |
| Profile | Email and Vietnamese mobile-phone format checks in Vue and server. **Format check is not OTP/email ownership verification.** |
| Support | Categorized feedback recorded in `citizen_feedback.subject` with a prefix; staff replies only shown when trusted staff integration is configured, never fabricated. |
| Notifications | Server-side search, category, unread filtering, paging, automatic SSE reconciliation. |
| A11y | Skip link, keyboard focus rings, screen-reader announcements, labels and responsive controls. |
| Localities | List real configured tenants; only current account's tenant is selectable for submission due to RLS. Cross-locality routing requires the case-routing team. |
| OIDC / VNeID | A real OIDC Code + PKCE start/callback and RSA ID token verification are implemented. **This is not VNeID integration without the approved Identity broker/IdP and linked citizens.** |
| RAG / knowledge QA | Direct retrieval of published `procedures`, `procedure_documents` and portal `citizen_faq` on each request. Optional evidence-selection model via `CITIZEN_RAG_ENDPOINT`; no invented facts or outside web citations. Without AI configuration, it is marked **DATA**, not AI. |
| Signed results | Secured result-metadata/PDF adapter. Valid signature state is reported **by external results service**, not independently verified by this portal; without it the UI says no signed file is available. |
| E2E | Playwright journey spec added, **not run in delivery environment**. Requires running stack, Chromium, demo data, optionally staff-side fixtures. |

### Local database permission for document deletion

Currently `communeos_app` is granted `SELECT,INSERT`, **not DELETE**, on
`application_documents`. The new DELETE API will return a clear `503` until an
administrator runs (against the existing PostgreSQL database, as a role with
GRANT privilege):

```sql
GRANT DELETE ON TABLE public.application_documents TO communeos_app;
```

This changes **no schema or RLS policies**: `FORCE ROW LEVEL SECURITY` and the
existing owner policy still limit deletion to rows belonging to the logged-in
citizen. Application code always checks the case status before deletion. Do not
run this on a production environment without approval from the DB owner.

### Optional server-side integrations (no secrets in Git)

Set these variables in the **citizen service environment** (not just a host
`.env` file that Docker Compose does not pass through). The backend must be
reachable by that container. All sensitive values must remain server-only.

```text
SESSION_SECRET=<at least 32 random characters>
CITIZEN_OIDC_ISSUER=https://identity.example/realms/communeos
CITIZEN_OIDC_AUTHORIZE_URL=https://identity.example/realms/communeos/protocol/openid-connect/auth
CITIZEN_OIDC_TOKEN_URL=https://identity.example/realms/communeos/protocol/openid-connect/token
CITIZEN_OIDC_JWKS_URL=https://identity.example/realms/communeos/protocol/openid-connect/certs
CITIZEN_OIDC_CLIENT_ID=communeos-citizen
CITIZEN_OIDC_CLIENT_SECRET=<only if confidential client>
CITIZEN_OIDC_REDIRECT_URI=https://citizen.example/api/auth/oidc/callback
CITIZEN_RAG_ENDPOINT=https://trusted-ai-service.example/api/classify-evidence
CITIZEN_RAG_TOKEN=<secret>
CITIZEN_SUPPORT_ENDPOINT=https://staff.example/api
CITIZEN_SUPPORT_TOKEN=<secret>
CITIZEN_RESULTS_ENDPOINT=https://results.example/api
CITIZEN_RESULTS_TOKEN=<secret>
```

The `.example` values above are **placeholders, not deployed endpoints**.
Development HTTP is permitted only for `localhost`/`127.0.0.1` endpoints.

**OIDC account linkage:** Identity team provisions a citizen whose
`citizens.login_name` is exactly `oidc-` + first 48 hex characters of
`SHA256(issuer + '|' + OIDC sub)`. The `sub` is read only from a **signature-
verified** ID token with issuer, audience, expiration, issued-at and nonce
checks. No linking by unverified email/name. If account is not provisioned,
callback returns HTTP 403, not a demo login. The Keycloak/broker client must
register the exact redirect URI and enable authorization-code + PKCE. Linking
VNeID requires official approved broker flow and relevant permissions.

**RAG contract (citizen-channel evidence selection):** `POST CITIZEN_RAG_ENDPOINT`
receives `{ "query": "...", "language": "vi", "task": "select_grounded_evidence",
"allowed_fields": [...], "candidates": [...] }`. The remote service **must return**
`{ "selectedProcedureId": "khai-sinh", "fields": ["documents", "duration"] }`.
Only IDs from the server-retrieved candidate list and values from `allowed_fields`
are honored. **Remote-generated prose and remote URLs are ignored**. The citizen
API always assembles the displayed answer and citation locally from published
PostgreSQL rows. A failed or missing classifier leaves the assistant in **DATA**
mode (deterministic grounded retrieval), not a simulated AI connection. Endpoint
must be HTTPS, except localhost HTTP in development. Do not forward genuine PII;
questions with phone numbers, national ID-shaped numbers or email addresses are
never sent to the remote service. Configure outbound allowlists at deployment.

For the example adapter, the AI worker should classify question intent **only**;
it cannot be trusted to invent administrative instructions. This bounded mode is a
retrieval-augmented assistant, but it intentionally does not offer free-form
model-generated administrative claims. If your team wants prose generation, it
requires an additional evidence-based verification design and security review.

**Staff contract:** `GET {CITIZEN_SUPPORT_ENDPOINT}/citizen/tickets?citizenId=<uuid>`
returns `{ "tickets": [{"id":"...","citizenId":"<uuid>","tenantId":"<uuid>","subject":"...","status":"received|processing|answered|closed","reply":"...","updatedAt":"..."}] }`.
Only tickets whose owner AND tenant match the server-verified session are
returned. Unrecognized status is shown as unknown. Submitted local feedback
is not automatically a staff ticket until backend integration provides mapping.

**Results contract:** authenticated `GET {CITIZEN_RESULTS_ENDPOINT}/results/{id}`
returns `{ "title":"...", "verification":"verified|unverified|unknown", "signer":"...", "signedAt":"...", "reference":"..." }`; `GET /results/{id}/file` returns an actual PDF, max 15 MB. Both endpoints are
proxied only after `citizenTx` checks row ownership and `completed` status.
`verification=verified` means the **external service reports verification**;
for legal use the results team must independently validate certificate chain,
trust anchors, signing time, revocation and document integrity.

### Acceptance testing

```bash
cd /Users/T07/Hakathon/Source/commune-os-integrated
npm --prefix apps/citizen install
npm --prefix apps/citizen test
npm --prefix apps/citizen run build
# Start/refresh the citizen service using the EXISTING root compose setup:
docker compose -f docker-compose.yml up -d --build citizen
# Browser-driven E2E (install browser once):
cd apps/citizen
npx playwright install chromium
npm run test:e2e
```

`E2E_BASE_URL` defaults to `http://localhost:3000`.
`E2E_USERNAME` / `E2E_PASSWORD` allow alternate seeded demo credentials.
Optional `E2E_SUPPLEMENT_CASE_ID` and `E2E_COMPLETED_CASE_ID` must refer to
cases belonging to the same test citizen, prepared through the **actual staff
workflow**. The E2E suite skips staff-dependent scenarios until provided;
**skipped tests are not successful end-to-end verification**. E2E submission
creates new records and uploads synthetic documents, so run it against a
**disposable seeded database**, never real citizen records. Use keyboard-only
navigation and a mobile browser viewport as additional manual a11y checks.

### Known work requiring other teams

- Approved national/sectoral official form specifications and document taxonomy.
- Approved VNeID federation, person-identity linkage and tenant authorization.
- Cross-locality submission / workflow routing and tenant selection beyond account tenant.
- Two-way staff ticket synchronization; staff workflow events and replies.
- Trust service and cryptographic verification of signed documents.
- Real deployment tests, CSRF/rate limits, AV scanning, security audit and data retention.


## AI procedure assistant (added 2026-11-14)

**Scope:** Only `apps/citizen/` changes; no core/admin, database schema, gateway,
Keycloak or Docker Compose edits. The assistant is available at `/tro-ly`, from
homepage shortcuts, nav and each procedure detail page. It supports a selected
procedure, suggested questions, linked citations, copy, keyboard navigation and
an explicit no-evidence state. Conversations are kept in page memory only, not
saved to a citizen profile. Questions must not contain actual citizen identifiers.

**Authoritative project data for this prototype:**

- `procedures` (`published=true` only): title, category, description, instructions,
  `fee_note`, `sla_days`; `procedure_documents`: attachment names and required flags.
- `citizen_faq`: how to operate the portal (filing, tracking and supplementing),
  never used to fill missing legal fees/conditions of an individual procedure.
- **No applications, citizen profiles, document uploads or private data** are read
  by this assistant. Unpublished procedure records are excluded by SQL.
- Source citations are first-party relative paths like `/thu-tuc/khai-sinh` or
  `/huong-dan`; user content or model output cannot insert unapproved URLs.

**Update propagation:** the API executes a fresh, read-only PostgreSQL query on
**every** question (no embedding index/cache to synchronize). The existing DB
`NOTIFY` triggers on `procedures` and `procedure_documents` cause the browser
SSE client to refresh the procedure catalog and warn that prior answers may be
outdated. Re-asking reads the current committed rows. FAQ changes are also read
on the next request but do not currently emit SSE (requires DB-team approval).

**Missing-data policy:** If none of the published records match with sufficient
confidence, the answer is `INSUFFICIENT` with no citations; uncertain procedure
matches ask for clarification. No receiving-authority field or verified conditions
are present in the schema: the assistant explicitly says so and never makes up an
agency, eligibility, fee amount or legal rule. Seed contents are **demonstration
records**, not certified administrative advice. For correct real-world advice,
other teams must publish verified source data with effective dates, jurisdiction,
receiving unit, official source URL and version metadata.

### Endpoints and local acceptance

`POST /api/chat` (public; 20 requests/minute per detected visitor per process):

```json
{"message":"Đăng ký khai sinh cần giấy tờ gì?","procedureId":"khai-sinh"}
```

Response:

```json
{
  "answer":"Theo dữ liệu thủ tục ...",
  "mode":"DATA",
  "sources":[{"id":"procedure:khai-sinh","title":"Đăng ký khai sinh","url":"/thu-tuc/khai-sinh","excerpt":"Giấy tờ: ..."}],
  "suggestions":[{"id":"khai-sinh","title":"Đăng ký khai sinh","url":"/thu-tuc/khai-sinh","category":"Hộ tịch"}],
  "revision":"<SHA-256 prefix of current public catalog and FAQ>",
  "knowledgeSource":"published_procedures",
  "updatedOn":"per_request",
  "notice":"..."
}
```

When the trusted AI classifier succeeds, `mode` becomes `RAG` and the final
answer still comes from the same verified server-side records. Without AI
configuration, the useful, cited `DATA` mode works with the existing database.
The service rejects invalid selected procedure IDs and unrecognized fields.

```bash
cd /Users/T07/Hakathon/Source/commune-os-integrated
npm --prefix apps/citizen test
npm --prefix apps/citizen run build
# After starting the existing citizen service:
curl -s http://localhost:3000/api/procedures
curl -s -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Đăng ký khai sinh cần giấy tờ gì?"}'
```

Manual browser check: `/tro-ly` on mobile and desktop; answer about registration
and click first-party citation; ask an irrelevant question and observe a refusal;
select a procedure and ask follow-up questions; update one published procedure
and re-ask (the API must reflect the new data); disconnect the database and
verify `503` without hallucination. No changes to GitHub are required.

## Indexed RAG with transactional knowledge synchronization

The AI assistant at `/tro-ly` now uses a **PostgreSQL full-text knowledge index**
when available, while still independently loading published source rows on every
question. The index covers only `procedures`, `procedure_documents` and
`citizen_faq`; it never ingests private citizens, applications, or uploads.

`core/db/init/02-ai-knowledge.sql` is executed automatically by root
`db-setup` after the normal seed. Its PostgreSQL triggers update indexed
fragments within the same transaction when catalog/document/FAQ data changes,
including deletion and unpublishing. `core/db/init/01-schema.sql` now includes
FAQ in existing SSE invalidation notifications.

Check health at `GET /api/chat/knowledge` (index ready, fragment count,
last index update, AI configured flag). If not ready, run `make repair-db` on
the Mac and refresh; the page will explain that direct-source lookup still
works before the migration. Optional **server-only** model configuration:

```dotenv
CITIZEN_AI_ENDPOINT=https://approved-provider.example/v1/chat/completions
CITIZEN_AI_MODEL=approved-model-name
CITIZEN_AI_TOKEN=private-token
```

Values are mapped to `NUXT_AI_*` by the root Compose service. With no
configured model, answers remain in `DATA` mode, **not an AI simulation**. With
one, the model can select up to six exact evidence substrings; the server
rejects any unverifiable quote, URL, or unsupported fact. Citizen identifiers
are not forwarded to the model. For full architecture and test commands see
`core/ai/README.md` and `core/db/tests/citizen-rag.sql`.

Run `npm --prefix apps/citizen test`, `npm --prefix apps/citizen run build`
and `make rag-test` (on a running PostgreSQL container); the new
Playwright `e2e/rag-assistant.spec.ts` checks actual page-to-API behavior. The SQL test runs
within a transaction and rolls back. This is still **demo administrative data**:
verified legal sources, jurisdiction, receiving agencies and effective dates
must be supplied by the data team before actual citizen reliance.

## Lịch sử hỏi đáp Trợ lý AI theo tài khoản

Khi **đã đăng nhập**, mỗi lần công dân hỏi `/api/chat` hệ thống lưu câu hỏi và câu trả lời đã kiểm chứng nguồn vào PostgreSQL trong **cùng một transaction**, gắn `citizen_id` và `tenant_id`. Khi bắt đầu hội thoại mới, hệ thống tạo một cuộc trò chuyện riêng. Công dân xem lại các hội thoại từ giao diện `/tro-ly`, mở lại, tải tin nhắn cũ, hoặc xóa cả hội thoại. Khi **chưa đăng nhập**, phần tra cứu AI vẫn công khai như trước nhưng **không lưu lịch sử lên server**.

Lịch sử được lưu trong `citizen_ai_conversations` và `citizen_ai_messages`, **không được đưa vào** `citizen_knowledge_chunks` và không phải nguồn tri thức RAG. Hai bảng dùng `FORCE ROW LEVEL SECURITY` theo `app.citizen_id` **và** `app.tenant_id`; API dùng `citizenTx` để thiết lập hai biến này trong giao dịch. Chủ tài khoản xóa cuộc trò chuyện sẽ xóa luôn các tin nhắn qua khóa ngoại `ON DELETE CASCADE`. Nội dung lưu có thể chứa thông tin do người dùng tự nhập; không hỏi CCCD, mật khẩu hoặc dữ liệu nhạy cảm trong cuộc trò chuyện. Việc triển khai phục vụ người dân thật cần chính sách thời hạn lưu và quyền riêng tư được phê duyệt.

API liên quan:

- `POST /api/chat`: dữ liệu `{message, procedureId?, conversationId?}`; phản hồi thêm `conversationId` và `saved`. `conversationId` được kiểm tra quyền sở hữu trước khi trả lời và khi lưu; khách không được gửi `conversationId`.
- `GET /api/chat/conversations?page=1`: danh sách các hội thoại riêng của tài khoản (20 mục/trang).
- `GET /api/chat/conversations/:id?before=<message_id>`: 60 tin nhắn mới nhất, tải thêm các tin cũ bằng cursor.
- `DELETE /api/chat/conversations/:id`: xóa vĩnh viễn hội thoại và tin nhắn thuộc tài khoản.

Sau khi áp dụng mã nguồn, chạy migration mới trên database hiện có:

```bash
make COMPOSE="docker compose -f docker-compose.yml" repair-db
make COMPOSE="docker compose -f docker-compose.yml" chat-history-test
npm --prefix apps/citizen test
```

`repair-db` chạy thêm `core/db/init/03-citizen-chat-history.sql`, không xóa dữ liệu cũ. `chat-history-test` kiểm tra phân quyền giữa hai tài khoản và cascade khi xóa; mọi thay đổi thử nghiệm đều được `ROLLBACK`. Có thể chạy kiểm thử trình duyệt `npm --prefix apps/citizen run test:e2e -- chat-history.spec.ts` khi đã có Playwright và Docker.


## Cá nhân hóa thủ tục và gợi ý địa phương tiếp nhận

Đã bổ sung lựa chọn bật/tắt cá nhân hóa theo tài khoản, phân quyền PostgreSQL RLS, gợi ý có lý do từ lịch sử/lĩnh vực quan tâm, tuyến tiếp nhận có phê duyệt, và bộ kết nối OIDC sẵn có phục vụ VNeID khi có thỏa thuận chính thức. Xem [docs/PERSONALIZATION_VNEID.md](docs/PERSONALIZATION_VNEID.md) để biết migration, API, cấu hình Identity và giới hạn nghiệp vụ.

### Đại diện người thân và hỗ trợ tại quầy (bản bổ sung)

Xem [docs/REPRESENTATION_COUNTER.md](docs/REPRESENTATION_COUNTER.md) để biết chi tiết migration `05-citizen-representation-counter.sql`, phạm vi quyền đại diện, phiên quầy 15 phút, cách kiểm thử và các bước cần phối hợp với backend cán bộ để xác minh.

Chạy `make COMPOSE="docker compose -f docker-compose.yml" repair-db` để nạp migration không phá dữ liệu; chạy `make COMPOSE="docker compose -f docker-compose.yml" representation-test` để kiểm tra RLS, quyền xác minh và thu hồi (rollback).


## Chuyển tiếp hồ sơ và trung tâm hỗ trợ

Giao diện `/chuyen-tiep` và `/yeu-cau-ho-tro` dùng migration `07-citizen-handoff-support.sql`.
Xem [docs/HANDOFF_SUPPORT.md](docs/HANDOFF_SUPPORT.md) để biết hợp đồng API cán bộ,
phân quyền và kiểm thử; không dùng mã chuyển tiếp thay cho xác minh danh tính.
