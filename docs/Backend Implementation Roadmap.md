# Make My Marriage — Backend Implementation Roadmap

**Status:** Active roadmap — M1–M4 COMPLETED; M5 next
**Source of truth:** Approved PRD v1.1, System Architecture v1.1, Database Design v1.2, API Design v1.1, plus confirmed planning decisions recorded in the Project Status Report.
**Architecture:** CommonJS Node.js/Express modular monolith, MongoDB/Mongoose, REST API under `/api/v1`.

This roadmap assigns the documented backend scope to 15 milestones. Milestones 1–4 are complete. Milestones 5–15 remain planned and must be implemented and verified one at a time. Tests are written with each milestone; Milestone 15 includes cross-module integration and CI/CD completion from the API design.

## Status and milestone tracking conventions

Use only these statuses: **NOT STARTED**, **IN PROGRESS**, **COMPLETED**, **BLOCKED**.

Track each milestone in the Project Status Report with:

- Start date and completion date, only when known.
- Implementation summary and files changed.
- Tests and verification actually performed.
- Outstanding issues and dependencies.
- Commit reference once a commit exists; use “None — not committed” before then.

Mark a milestone **COMPLETED** only when its implementation and completion checklist pass and verification results are recorded. Code generation alone is insufficient. Do not describe planned endpoints or behavior as implemented. Do not modify approved product schemas, API contracts, indexes, or business rules through implementation; resolve a genuine contract gap before implementing the affected behavior.

## Confirmed constraints and contract gaps

- Keep the modular monolith, CommonJS server, existing MongoDB-before-listen startup, versioned `/api/v1` route structure, standard API response envelopes, centralized errors, MongoDB-backed server sessions, and existing ten product collections.
- Each wedding has one designated Manager at a time; Admin invites the Manager, Managers cannot self-register, and Admin can replace the designated Manager. Do not infer additional replacement workflow behavior. In particular, do not add a unique index to `Wedding.managerId`.
- Event cancellation preserves RSVP and financial records; prefer cancellation when dependent records exist. Guest records with RSVP history are soft-deleted and their RSVP token revoked. Hard deletion is allowed only when safe and historical records need not be retained.
- As Tasks, Expenses, Guests, Invitations, RSVPs and Photos gain Event references, their milestones must extend the Event deletion guard; M15 verifies cancellation/deletion against all dependent record types.
- Unpublishing the public website must not automatically deactivate family RSVP links.
- **Known contract gap — `DELETE /weddings/me/cover-image`:** the endpoint is listed, but request/response details and Cloudinary deletion behavior are not specified. Confirm its contract and asset cleanup semantics before implementing it; do not infer them from cover replacement or Our Story deletion.
- **Known contract gap — guest photo upload:** `POST /public/weddings/:slug/photos` exists. The API gives general image guidance (JPEG/PNG/WebP and a proposed 10 MB gallery limit) but does not establish the complete guest-upload contract. Confirm its accepted formats and maximum size, request fields and response shape, event-association optionality, rate-limit and validation policy, Pending approval state, and Cloudinary failure/cleanup handling before implementing the guest upload. The API document does state that the wedding must be published, rate limiting applies, an optional event is validated, and new submissions are `PENDING`; retain those requirements. Do not add another endpoint.
- Public invitation data is already specified across existing APIs: `GET /public/weddings/:slug` returns `commonInvitation`, and `GET /public/weddings/:slug/events` returns an event's `invitation` where present. Implement those existing contracts; do not add an endpoint.

## Milestone summary

| # | Milestone | Status | Main deliverable |
|---|---|---|---|
| 1 | Backend Foundation | COMPLETED | Express foundation, `/api/v1/health`, common response/error handling and HTTP tests |
| 2 | Core Persistence Models | COMPLETED | User and Wedding Mongoose models and documented indexes |
| 3 | Authentication, Sessions and Security | COMPLETED | Seven Admin authentication/session/CSRF/password endpoints |
| 4 | Wedding Setup and Manager Onboarding | COMPLETED | Wedding setup/settings, Manager invitation and activation, publication control |
| 5 | Wedding Images and Our Story | NOT STARTED | Hero/cover and Our Story image/content APIs with Cloudinary coordination |
| 6 | Events and YouTube Metadata | NOT STARTED | Event CRUD, status, menus, venue and video metadata |
| 7 | Shared Tasks | NOT STARTED | Task CRUD and optional event relationship |
| 8 | Actual Expenses | NOT STARTED | Expense CRUD in integer paise |
| 9 | Family Guests, CSV and Sharing | NOT STARTED | Family records, import, RSVP-link and invitation-sharing status |
| 10 | Invitation Cards | NOT STARTED | Common and event card upload/list/removal |
| 11 | Family RSVP | NOT STARTED | Token-protected read and event response APIs |
| 12 | Dashboard Summary | NOT STARTED | Wedding-scoped dashboard aggregates |
| 13 | Announcements | NOT STARTED | Announcement CRUD and publication state |
| 14 | Wedding Memories and Photo Review | NOT STARTED | Organizer uploads, review, gallery and public guest submission |
| 15 | Public Website APIs, Integration and CI/CD | NOT STARTED | Public homepage/events data and end-to-end/CI verification |

---

## Milestone 1 — Backend Foundation

**Status:** COMPLETED
**Start date:** Not recorded
**Completion date:** 2026-11-13 (verification recorded)
**Objective:** Establish the maintainable Express, routing, response, error and test foundation used by later modules.

**Implemented scope:** Express app configuration with Helmet and JSON parsing; `/api/v1` router; `GET /api/v1/health`; common success/error helpers; `ApiError`; not-found and centralized error middleware; MongoDB connection before listening; isolated Vitest/Supertest HTTP tests.

**Important files:** `server/src/app.js`, `server/src/server.js`, `server/src/config/{env,database}.js`, `server/src/routes/v1.js`, `server/src/modules/health/health.routes.js`, `server/src/middleware/{not-found,error-handler}.js`, `server/src/shared/{errors/api-error.js,http/responses.js}`, `server/test/app.test.mjs`, `server/package.json`, `package-lock.json`.

**Endpoints:** `GET /api/v1/health` only. No product endpoints were implemented.

**Dependencies:** Existing Express, Helmet, dotenv and Mongoose; Vitest and Supertest added as server development dependencies.

**Security/data integrity:** Do not return production stack/database details; retain MongoDB-before-listen sequence; keep the real `.env` secret and do not expose it to Vite.

**Tests and verification recorded:** 6 backend tests passed; backend lint passed; root lint passed; root production build passed; configured MongoDB startup completed before listen; health endpoint returned HTTP 200 with the expected success envelope. `git diff --check` passed. Verification used elevated execution for localhost access.

**Learning concepts:** Express middleware order, route mounting, CommonJS modules, centralized errors, async error forwarding in Express 5, HTTP testing without a live database.

**Completion checklist:**

- [x] App configuration is separate from server startup.
- [x] Versioned router and existing health path are present.
- [x] Success/error envelope helpers and centralized error/not-found handling are present.
- [x] Six HTTP behavior tests pass without requiring MongoDB.
- [x] Backend/root lint, frontend build, Mongo startup and health check pass.
- [x] Status report records scope and remaining limitations.

**Outstanding:** Development watch-mode `EMFILE` was observed and remains unresolved. No business models, sessions, or product endpoints exist.

---

## Milestone 2 — Core Persistence Models

**Status:** COMPLETED
**Start/completion dates:** 2026-11-14
**Objective:** Add the documented persistence definitions needed by authentication and wedding setup without adding business behavior or changing approved fields/indexes.

**Scope:** Configure model organization and implement only `User` and `Wedding` Mongoose schemas from Database Design §§5.1–5.2, including documented fields, enums/required rules, embedded cover/Our Story shape, timestamps, and indexes. Do not implement routes, session auth, or manager workflow here. Do not add a unique `Wedding.managerId` index.

**Expected files/responsibilities:** `server/src/modules/auth/user.model.js`; `server/src/modules/wedding/wedding.model.js`; model exports and any minimal model-test setup under `server/test/`. Keep schemas in their owning modules and relationships/business validation in services when later introduced.

**Endpoints:** None.

**Dependencies:** Milestone 1 foundation and existing Mongoose connection/configuration.

**Security and data integrity:** Normalize/uniquely index user email as documented; token hashes only, when those fields are used; one wedding per admin, unique slug, ordinary non-unique managerId index only; match schema field names/types exactly; never add undocumented indexes.

**Required tests:** Schema required/enum/type validation; documented indexes (including explicit assertion that `managerId` is not unique); embedded Our Story shape and two-image validation if expressible at schema level; model behavior against isolated MongoDB test configuration or a test database, never production.

**Learning concepts:** Mongoose schemas/models, embedded subdocuments vs references, compound/partial indexes, schema validation vs service-level relationship validation.

**Completion checklist:**

- [x] User schema matches Database Design §5.1 with no extra business fields.
- [x] Wedding schema matches §5.2, including separate introduction and Our Story fields.
- [x] Only documented indexes are declared; `managerId` index is not unique.
- [x] Model tests pass in an isolated database configuration.
- [x] No API routes or auth behavior are included prematurely.
- [x] Lint and relevant build/tests pass and results are recorded.

---

## Milestone 3 — Authentication, Sessions and Security

**Status:** COMPLETED
**Start/completion dates:** 2026-11-14
**Objective:** Implement secure Admin authentication using documented server-side sessions and the existing User model.

**Scope:** Admin registration; login/logout; current-user lookup; password hashing; session regeneration/destruction and MongoDB store; HTTP-only cookie settings; CSRF token issuance/validation; rate limits appropriate to documented auth operations; forgot-password and reset-password flows/email-provider boundary. Manager activation is assigned to M4. Do not implement wedding or manager-invitation APIs in this milestone.

**Expected files/responsibilities:** `server/src/modules/auth/{auth.routes.js,auth.controller.js,auth.service.js,auth.validation.js}` and session/CSRF/rate-limit configuration and middleware under `server/src/config/` and `server/src/middleware/`; focused auth tests under `server/test/`. Reuse User model from M2. Use only previously agreed security packages when appropriate.

**Documented endpoints (7):** `GET /auth/csrf`; `POST /auth/register`; `POST /auth/login`; `POST /auth/logout`; `GET /auth/me`; `POST /auth/forgot-password`; `POST /auth/reset-password`.

**Dependencies:** M2 User model; M1 centralized errors and versioned route tree.

**Security and data integrity:** Hash passwords and reset tokens; generic forgot-password response to avoid account enumeration; expiring, single-use reset tokens; regenerate sessions on login; invalidate sessions as documented after reset; session cookie HttpOnly/Secure-in-production/SameSite; CSRF on cookie-authenticated mutations; never return hashes/session IDs or log raw tokens/passwords. Apply rate limiting without inventing public business policy values; confirm configuration thresholds before release if not set in the approved docs.

**Required tests:** Registration, duplicate email, role cannot be client-selected, login/invalid credentials, session regeneration, logout/session invalidation, `/auth/me` privacy, CSRF token lifecycle and rejection, password reset valid/invalid/expired and existing-session behavior, forgot-password response does not disclose account existence, rate-limit behavior, secure cookie flags.

**Learning concepts:** Password hashing, session lifecycle, CSRF token flow, bearer-token hashing, account enumeration, middleware-based authentication, test isolation for cookies and session stores.

**Completion checklist:**

- [x] All seven M3 auth endpoints are mounted under `/api/v1` with documented request/response behavior; Manager activation remains assigned to M4.
- [x] Mongo-backed session storage and cookie controls work in test configuration.
- [x] CSRF is enforced on authenticated state-changing cookie requests.
- [x] Password reset tokens are single-use, expiring, and stored only as hashes.
- [x] No guest registration or client-selected role is possible.
- [x] API tests cover the documented auth cases and pass without production services.
- [x] Lint/build pass; no secrets or raw tokens are exposed; status report is updated.

---

## Milestone 4 — Wedding Setup and Manager Onboarding

**Status:** COMPLETED
**Start date:** 2026-11-16
**Completion date:** 2026-11-16
**Objective:** Let an authenticated Admin create/configure the wedding, invite the designated Manager, and control website publication; let the invited Manager accept the invitation and activate the account.

**Scope:** Admin creates and manages Wedding details, sends the first Manager invitation, and controls publication. Manager replacement is explicitly out of M4. Existing email addresses are rejected; resend reuses the assigned invited account. Publication requires only valid required Wedding information; cover image, Our Story, events, announcements and photos are optional. Invitation records are committed before email; a delivery failure leaves them available for resend. Activation tokens default to 24 hours and are configurable. Unpublishing sets `publishedAt` to `null` and does not revoke RSVP tokens.

**Manager workflow (API Design §4.7, then Auth activation):**

1. Create the invited Manager `User`.
2. Generate an activation token and store its hash and expiry.
3. Assign the Manager to `Wedding.managerId`.
4. Commit the database changes.
5. Send the activation email.
6. The Manager opens and accepts the invitation, sets a password, and activates the account. The account becomes `ACTIVE`, activation fields are cleared, and the documented Manager session is established.

The Manager assignment therefore occurs during invitation, before the activation email; activation happens afterward.

**Expected files/responsibilities:** Wedding routes/controller/service/validation in `server/src/modules/wedding/`; Manager activation route/controller/service remains part of the Auth module under `server/src/modules/auth/` but is implemented in M4; manager invitation email adapter boundary; wedding service resolves wedding from authenticated user, never client-supplied ownership IDs.

**Documented endpoints (7):** `POST /weddings`; `GET /weddings/me`; `PATCH /weddings/me`; `PATCH /weddings/me/publication`; `POST /weddings/me/manager-invitation`; `POST /weddings/me/manager-invitation/resend`; `POST /auth/manager-activation` (Auth module endpoint assigned to M4).

**Dependencies:** M2 User/Wedding models; M3 authentication, password hashing and sessions. M4 adds reusable role authorization and applies the existing CSRF/session behavior to Wedding mutations and activation.

**Security and data integrity:** Admin-only wedding create/update/publication/invitation; Manager can read their own wedding; activation is public but requires the documented invitation token. Derive authenticated admin/manager identity from session; enforce unique admin ownership and slug; exclude client control of `adminId`/`managerId`. In the invitation transaction, persist the invited User, token hash/expiry and Wedding manager assignment, commit, then send the email. Keep one designated Manager at a time without a unique `Wedding.managerId` index. Do not revoke RSVP links on unpublish.

**Required tests:** One Wedding per Admin and a persisted `managerId: null` on initial creation; duplicate create/update slug; allowlisted patch fields; Manager and anonymous restrictions; Admin/Manager Wedding resolution; invitation rejects existing accounts, commits the invited User and Wedding assignment before email, stores only a token hash, and preserves committed state on delivery failure; resend reuses the same account and invalidates the previous token; activation accepts a valid token once, hashes the password, clears token fields, and establishes a regenerated session; invalid/expired/reused/active-account tokens fail; publication requires no optional content, updates `publishedAt`, and leaves RSVP token data unchanged; rate limits and CSRF behavior; injected email adapter failures. M4 replacement remains out of scope.

**Learning concepts:** Ownership scoping, allowlisted updates, multi-document consistency, invitation and activation flow, external side effects after database commit, publication state.

**Completion checklist:**

- [x] All six Wedding endpoints and the existing `POST /auth/manager-activation` endpoint work with documented access and payload behavior; activation remains in the Auth module.
- [x] Authenticated identity, not client IDs, determines ownership.
- [x] Wedding creation explicitly persists `managerId: null`, as required by API Design §4.2; the integration test asserts the stored database value.
- [x] Manager invitation follows the documented order: invited User and hashed token/expiry are persisted, Manager is assigned to Wedding, the transaction commits, then activation email is attempted.
- [x] Manager subsequently accepts the invitation, sets a password, activates, activation fields are cleared, and a regenerated session is established.
- [x] Resend reuses the invited Manager, replaces the token and preserves it on email failure.
- [x] Publication accepts required valid Wedding information without optional content; unpublishing clears `publishedAt` and leaves RSVP tokens untouched.
- [x] M4 security and configured rate-limit tests, backend/root lint, frontend build, and regression suites pass; status report records that SMTP credentials are not configured and real delivery is unverified.

---

## Milestone 5 — Wedding Images and Our Story

**Status:** NOT STARTED
**Start/completion dates:** Not recorded
**Objective:** Implement the Wedding module's separate hero/cover asset and embedded Our Story content/supporting-image APIs.

**Scope:** Cover image upload/replacement; cover removal only after its request/response and Cloudinary deletion contract is clarified; Our Story description update; add/remove up to two supporting photographs. Keep cover image separate from `ourStory.images` and both separate from Wedding Memories Photo records.

**Expected files/responsibilities:** Wedding image/story routes, validators, controller/service and Cloudinary adapter under `server/src/modules/wedding/`; multipart parser/file validation configuration; tests for image content and asset cleanup. Keep Cloudinary credentials server-only.

**Documented endpoints:** `PUT /weddings/me/cover-image`; `DELETE /weddings/me/cover-image` (listed endpoint; unresolved contract gap); `PATCH /weddings/me/our-story`; `POST /weddings/me/our-story/images`; `DELETE /weddings/me/our-story/images/:imageId`.

**Dependencies:** M2 Wedding schema; M3 auth/CSRF; M4 wedding resolution and publication state. Cloudinary service configuration is required for integration tests or use a controllable adapter mock.

**Security and data integrity:** Admin-only edits; JPEG/PNG/WebP and proposed 10 MB limits where documented; validate actual file content; enforce maximum two images under concurrent requests; upload new asset before DB replacement; delete old asset only after successful DB update; clean newly uploaded asset if DB update fails; for Our Story deletion remove DB reference first and log/retry Cloudinary cleanup failure. Never expose Cloudinary public IDs in public response.

**Required tests:** Cover upload/replacement, invalid type/oversized file, DB failure cleanup, old asset retained if DB update fails; Our Story description updates do not overwrite images; first/second image pass, third rejected including concurrent attempts; invalid/oversized file; remove by embedded ID; missing image 404; Cloudinary cleanup failure leaves no public reference and is recorded for retry; public field projection belongs to M15.

**Learning concepts:** Multipart processing, content-based file validation, embedded documents, race conditions, external asset lifecycle and compensating cleanup.

**Completion checklist:**

- [ ] Hero/cover and Our Story images use the unchanged documented Wedding structures and routes.
- [ ] `DELETE /weddings/me/cover-image` behavior is not implemented until request/response and cleanup contract are approved.
- [ ] The cover-removal contract is finalized, the existing DELETE route is implemented without changing its path, and its Cloudinary behavior is tested.
- [ ] Cover replacement and Our Story compensation/cleanup tests pass.
- [ ] Two-image rule is concurrency-safe.
- [ ] Cloudinary identifiers/credentials are excluded from public payloads.
- [ ] Lint/build/tests pass and report lists any cleanup limitations.

---

## Milestone 6 — Events and YouTube Metadata

**Status:** NOT STARTED
**Start/completion dates:** Not recorded
**Objective:** Implement wedding-scoped event scheduling, embedded menus, venue directions, publication/status and YouTube metadata.

**Scope:** Event schema/indexes; create/list/read/update; status update; safe logical deletion; menu and Maps URL validation; video URL validation and backend video ID extraction. Event removal prefers cancellation where dependencies exist.

**Expected files/responsibilities:** `server/src/modules/events/{event.model.js,event.routes.js,event.controller.js,event.service.js,event.validation.js}` and shared URL/video validation only if reusable.

**Endpoints:** `POST /events`; `GET /events`; `GET /events/:eventId`; `PATCH /events/:eventId`; `PATCH /events/:eventId/status`; `DELETE /events/:eventId`.

**Dependencies:** M3 auth and M4 wedding context. Task/expense/guest/invitation/RSVP/photo relationships arrive in M7–M11 and M14. Each milestone that introduces one of these references must extend the event deletion guard and add its focused test; M15 performs the final cross-module lifecycle verification.

**Security and data integrity:** Admin/Manager only; force `weddingId`/`createdBy`; verify same-wedding references; cancelled events reject new RSVPs; preserve dependent RSVP, expense, task, invitation and photo records; prefer cancellation where dependents exist; use `deletedAt` only when deletion is safe; accept LIVE/RECORDED with YOUTUBE only, extract video ID server-side.

**Required tests:** CRUD, filters/pagination, wedding isolation, menu and Maps validation, status values, cancellation behavior, deletion with/without each dependent record, soft delete, video URL parsing/types/removal and rejecting client-supplied videoId.

**Learning concepts:** REST resource lifecycle, embedded menu data, query validation, lifecycle-aware deletion, URL parsing and derived fields.

**Completion checklist:**

- [ ] Event schema and documented indexes match Database Design §5.3.
- [ ] All six endpoints and documented filters are implemented.
- [ ] Same-wedding ownership checks apply to all event references.
- [ ] Cancellation and `deletedAt` behavior work for the data currently present; later reference-owning milestones extend the deletion guard, and M15 verifies all dependency types together.
- [ ] Video ID is extracted from an allowed YouTube URL on the server.
- [ ] Tests, lint/build pass and completion record is updated.

---

## Milestone 7 — Shared Tasks

**Status:** NOT STARTED
**Start/completion dates:** Not recorded
**Objective:** Implement the shared Admin/Manager task list with optional event association.

**Scope:** Task model/indexes and create/list/read/update/delete; status, priority, deadline, and optional event validation. No assignment feature.

**Expected files/responsibilities:** `server/src/modules/tasks/{task.model.js,task.routes.js,task.controller.js,task.service.js,task.validation.js}`.

**Endpoints:** `POST /tasks`; `GET /tasks`; `GET /tasks/:taskId`; `PATCH /tasks/:taskId`; `DELETE /tasks/:taskId`.

**Dependencies:** M3 auth, M4 wedding context, M6 Event model for optional same-wedding event reference.

**Security and data integrity:** Admin/Manager only; wedding-scoped filters; `createdBy` from session; no `assignedTo`; validate event belongs to same wedding; allow only documented TODO/IN_PROGRESS/COMPLETED and LOW/MEDIUM/HIGH values.

**Required tests:** Create/list/filter/pagination/read/update/delete; role and wedding isolation; same-wedding and invalid event references; required deadline; enum and field allowlists.

**Learning concepts:** CRUD services, query filtering/pagination, reference validation, allowlisted partial updates.

**Completion checklist:**

- [ ] Task schema and indexes match Database Design §5.4.
- [ ] All five documented endpoints work with documented filters.
- [ ] Event is optional and, when set, belongs to the active wedding.
- [ ] No assignment field or endpoint is added.
- [ ] Tests/lint/build pass and status is recorded.

---

## Milestone 8 — Actual Expenses

**Status:** NOT STARTED
**Start/completion dates:** Not recorded
**Objective:** Track actual wedding expenses, stored as integer paise.

**Scope:** Expense model/indexes and create/list/read/update/delete, category/event/date filters, pagination, and optional event association. No budget planning or forecasting.

**Expected files/responsibilities:** `server/src/modules/expenses/{expense.model.js,expense.routes.js,expense.controller.js,expense.service.js,expense.validation.js}`.

**Endpoints:** `POST /expenses`; `GET /expenses`; `GET /expenses/:expenseId`; `PATCH /expenses/:expenseId`; `DELETE /expenses/:expenseId`.

**Dependencies:** M3 auth, M4 wedding context, M6 Event model.

**Security and data integrity:** Admin/Manager only; positive integer `amountPaise`; INR; allowed categories only; same-wedding event validation; never trust body-supplied `weddingId`/`createdBy`.

**Required tests:** CRUD, category/event/date filters, pagination, amount validation, event ownership, role/wedding isolation, paise preserved exactly.

**Learning concepts:** Integer money representation, date filtering, schema/service validation, safe partial updates.

**Completion checklist:**

- [ ] Expense schema/indexes match Database Design §5.5.
- [ ] All five documented endpoints and filters work.
- [ ] Money is stored and returned as paise without floating-point conversion errors.
- [ ] Tests/lint/build pass; no budget fields/features are introduced.

---

## Milestone 9 — Family Guests, CSV and Sharing

**Status:** NOT STARTED
**Start/completion dates:** Not recorded
**Objective:** Manage family invitation records, event invitations, CSV import and organizer-maintained sharing state.

**Scope:** Guest model/indexes; create/list/read/update; safe deletion; CSV import; generate/regenerate family RSVP link; common and event invitation-sharing statuses. Keep guest contact data private. Do not implement RSVP read/write endpoints here.

**Expected files/responsibilities:** `server/src/modules/guests/{guest.model.js,guest.routes.js,guest.controller.js,guest.service.js,guest.validation.js,csv-import.service.js}`; use documented `csv-parse` dependency when installed for this milestone.

**Endpoints:** `POST /guests`; `GET /guests`; `GET /guests/:guestId`; `PATCH /guests/:guestId`; `DELETE /guests/:guestId`; `POST /guests/import`; `POST /guests/:guestId/rsvp-link`; `PATCH /guests/:guestId/invitation-sharing/common`; `PATCH /guests/:guestId/invited-events/:eventId/invitation-sharing`.

**Dependencies:** M3 auth/token primitives; M4 wedding context; M6 Event; M11 consumes the resulting RSVP token records.

**Security and data integrity:** One Guest represents one family; normalize mobile; detect likely duplicate mobile as warning per docs; validate every invited event belongs to wedding and prevent duplicate event refs; store only token hash, return raw URL once, regenerate revokes previous token; never expose RSVP token in ordinary Guest reads; preserve RSVP history and soft-delete family with RSVP history while revoking token; hard-delete only when safe; CSV row validation and safe limits must follow approved operational decisions.

**Required tests:** Guest CRUD/search/filter; event membership checks; duplicate event refs; mobile normalization/duplicate warning; CSV valid/invalid rows and import summary; deleted guest exclusion; safe/historical deletion; token generation/hash/expiry/regeneration/revocation; common/event sharing statuses, `sharedAt`/`sharedBy`; no token/contact leakage.

**Learning concepts:** Family aggregate modeling, soft deletion, token hash lifecycle, CSV validation, partial import reporting, privacy projection.

**Completion checklist:**

- [ ] Guest schema and indexes match Database Design §5.6.
- [ ] All nine documented endpoints work; no WhatsApp sending endpoint is added.
- [ ] CSV columns and import summary follow API contract.
- [ ] RSVP access is hashed, one-time returned, expiring/revocable, and hidden from reads.
- [ ] RSVP-history deletion preserves history and revokes access.
- [ ] Tests/lint/build pass and operational limits are recorded.

---

## Milestone 10 — Invitation Cards

**Status:** NOT STARTED
**Start/completion dates:** Not recorded
**Objective:** Upload, list, replace and remove one common card per wedding or one current card per event.

**Scope:** Invitation model/indexes; multipart upload; COMMON/EVENT type handling; event validation; Cloudinary upload and replacement/deletion cleanup.

**Expected files/responsibilities:** `server/src/modules/invitations/{invitation.model.js,invitation.routes.js,invitation.controller.js,invitation.service.js,invitation.validation.js}` and shared Cloudinary/file validation adapter.

**Endpoints:** `GET /invitations`; `POST /invitations`; `DELETE /invitations/:invitationId`.

**Dependencies:** M3 auth; M4 wedding context; M6 Event; M9 family invitation-sharing state is a separate Guest workflow.

**Security and data integrity:** Admin/Manager only; JPEG/PNG/WebP and documented proposed 10 MB limit; validate content; common invitation omits/nulls eventId; event invitation requires same-wedding event; enforce documented partial unique indexes; replace existing metadata and delete old asset only after successful DB update; coordinate DB and Cloudinary deletion.

**Required tests:** Common and event upload, invalid type/size, event ownership, duplicate prevention, replacement, cleanup after database failure, remove asset/document, invitation ownership, permission and wedding isolation.

**Learning concepts:** Multipart uploads, partial unique indexes, external storage compensation, metadata vs binary storage.

**Completion checklist:**

- [ ] Invitation schema and partial unique indexes match Database Design §5.8.
- [ ] All three documented endpoints work.
- [ ] Common/event association rules and media checks are enforced.
- [ ] Replacement/deletion preserve records and clean assets only in documented order.
- [ ] Tests/lint/build pass; no invitation designer or family-personalized card feature is added.

---

## Milestone 11 — Family RSVP

**Status:** NOT STARTED
**Start/completion dates:** Not recorded
**Objective:** Let a family with a valid token view only its invited events and create/update its current event responses.

**Scope:** RSVP model/indexes; token-protected lookup; event-wise YES/NO upsert; expiry/revocation checks and strict public response projection. Family RSVP remains available independently of website publication.

**Expected files/responsibilities:** `server/src/modules/rsvp/{rsvp.model.js,rsvp.routes.js,rsvp.controller.js,rsvp.service.js,rsvp.validation.js}` plus token rate-limit/security middleware as finalized.

**Endpoints:** `GET /public/rsvp/:token`; `PUT /public/rsvp/:token/events/:eventId`.

**Dependencies:** M3 token/security primitives; M6 Event; M9 Guest and generated token; published-site state is intentionally not a prerequisite for valid family RSVP.

**Security and data integrity:** Hash submitted token and check expiry/revocation; protect against token guessing with finalized rate limits; do not reveal if a guessed token maps to another family; return only the matching family's event and response data, never contacts or other families; require invited event in same wedding; reject cancelled/deleted events; unique `{weddingId, guestId, eventId}` enforces one current response; token page strict referrer policy; avoid raw-token logging.

**Required tests:** Valid/invalid/expired/revoked token; rate limit and guessing protection; invited/uninvited/cross-wedding event; cancelled/deleted event; GET reveals only that family; create/update YES/NO; concurrent duplicate prevention; RSVP works when website unpublished; no contact or other-family data leaks.

**Learning concepts:** Bearer-token security, upsert/idempotency, compound unique constraints, authorization without accounts, public endpoint privacy.

**Completion checklist:**

- [ ] RSVP schema/index match Database Design §5.7.
- [ ] Both documented routes and response shapes are implemented.
- [ ] Token and event authorization rules are enforced server-side.
- [ ] One current response per invited family-event pair is maintained.
- [ ] Security tests cover token guessing, response privacy, and publication independence.
- [ ] Tests/lint/build pass and status is recorded.

---

## Milestone 12 — Dashboard Summary

**Status:** NOT STARTED
**Start/completion dates:** Not recorded
**Objective:** Provide the dashboard summary as calculated data without a Dashboard collection.

**Scope:** Aggregate total/upcoming events, actual expenses, active family records, accepted and pending family-event RSVPs, and upcoming task deadlines. Pending RSVP count means invited family-event pairs with no response.

**Expected files/responsibilities:** `server/src/modules/dashboard/{dashboard.routes.js,dashboard.controller.js,dashboard.service.js}`; aggregate from Event, Expense, Guest, RSVP and Task models. Do not create a Dashboard model.

**Endpoint:** `GET /dashboard/summary`.

**Dependencies:** M3 authentication and M6 Events, M7 Tasks, M8 Expenses, M9 Guests, and M11 RSVP data. This places aggregation after its source modules; M12 does not depend on Announcements (M13) or Photos (M14), so those milestones do not need to precede the dashboard.

**Security and data integrity:** Admin/Manager only; derive wedding from identity; every aggregate filters by that wedding; count families and family-event responses, not individual attendees; exclude deleted guest/event records according to their lifecycle rules.

**Required tests:** Each aggregate, upcoming/date boundaries in wedding timezone, pending family-event pair count, wedding isolation, role checks, empty collections, cancelled/deleted handling.

**Learning concepts:** MongoDB aggregation, count semantics, timezone-aware queries, preventing cross-wedding leakage.

**Completion checklist:**

- [ ] Documented summary fields and family-based count definitions are returned.
- [ ] No Dashboard collection is created.
- [ ] All queries are wedding-scoped and role-protected.
- [ ] Aggregation tests cover empty, boundary and isolation cases.
- [ ] Lint/build/tests pass; dependencies and completion are recorded.

---

## Milestone 13 — Announcements

**Status:** NOT STARTED
**Start/completion dates:** Not recorded
**Objective:** Manage wedding announcements and publish only approved public content.

**Scope:** Announcement model/index; Admin/Manager create/list/read/update/delete; DRAFT/PUBLISHED state and timestamp; wedding-scoped authorization. Public read endpoint is exposed in M15.

**Expected files/responsibilities:** `server/src/modules/announcements/{announcement.model.js,announcement.routes.js,announcement.controller.js,announcement.service.js,announcement.validation.js}`.

**Endpoints:** `POST /announcements`; `GET /announcements`; `GET /announcements/:announcementId`; `PATCH /announcements/:announcementId`; `DELETE /announcements/:announcementId`.

**Dependencies:** M3 auth; M4 wedding context; M15 public website API consumes the published projection.

**Security and data integrity:** Admin/Manager only for management; derive creator from session; restrict status values; set/maintain `publishedAt`; never expose DRAFT content publicly; all records scoped to wedding.

**Required tests:** CRUD, filters/pagination, allowed states, publishedAt transitions, role/wedding isolation, deleted/not found, public projection tests in M15.

**Learning concepts:** Publication state machines, audit metadata, scoped queries, separating private management views from public projections.

**Completion checklist:**

- [ ] Announcement schema/index match Database Design §5.10.
- [ ] All five documented management endpoints work.
- [ ] DRAFT/PUBLISHED and publishedAt behavior is correct.
- [ ] Public endpoint remains assigned to M15 and returns only published entries.
- [ ] Tests/lint/build pass; status is recorded.

---

## Milestone 14 — Wedding Memories and Photo Review

**Status:** NOT STARTED
**Start/completion dates:** Not recorded
**Objective:** Manage organiser photographs, admin review, approved gallery data and the existing guest photo submission endpoint.

**Scope:** Photo model/indexes; Admin/Manager list/read/upload/delete; admin-only review; guest submission at the documented route only. The public approved gallery read API is assigned to M15. The guest upload request/response and operational details listed under contract gaps must be confirmed before guest upload is implemented; organiser upload and review work can proceed independently.

**Expected files/responsibilities:** `server/src/modules/photos/{photo.model.js,photo.routes.js,photo.controller.js,photo.service.js,photo.validation.js}`; multipart validation, rate-limit and Cloudinary adapter integration.

**Endpoints:** `GET /photos`; `GET /photos/:photoId`; `POST /photos`; `PATCH /photos/:photoId/review`; `DELETE /photos/:photoId`; `POST /public/weddings/:slug/photos` (existing documented endpoint; no substitute endpoint).

**Dependencies:** M3 auth; M4 wedding/publication; M6 Event for optional event reference. M15 consumes the approved-photo service for public reads.

**Security and data integrity:** Organizer uploads set uploader type from session and are APPROVED; guest uploads must be PENDING and cannot choose status; only Admin approves/rejects; manager cannot review; public reads never expose Pending/Rejected; published wedding required for guest submission and public gallery; rate-limit and actual file validation; Cloudinary and Mongo cleanup/failure policy for guest upload must await contract clarification.

**Required tests:** Organizer upload and role checks; list/read filters; review allowlist and reviewer metadata; manager approval denied; public approved-only projection; guest submission only for published wedding, optional event validation if confirmed, rate limit, status forced Pending, file validation, Cloudinary failure/cleanup, no guest-supplied status, cross-wedding event rejection, deletion coordination.

**Learning concepts:** Review workflows, untrusted multipart input, state transitions, public/private projections, compensating external-service operations.

**Completion checklist:**

- [ ] Photo schema/indexes match Database Design §5.9.
- [ ] Five organizer/review/delete endpoints work with role and wedding scopes; public gallery GET remains assigned to M15.
- [ ] Public guest POST remains exactly `POST /public/weddings/:slug/photos`.
- [ ] Guest photo contract gaps are resolved before implementing guest upload behavior.
- [ ] Only APPROVED photos are publicly available; guest records start PENDING.
- [ ] Cloudinary failure cleanup and rate-limit tests pass for the approved contract.
- [ ] Tests/lint/build pass and remaining risks are recorded.

---

## Milestone 15 — Public Website APIs, Integration and CI/CD

**Status:** NOT STARTED
**Start/completion dates:** Not recorded
**Objective:** Complete public wedding content APIs, verify cross-module privacy/data contracts, and establish the documented CI/CD checks and deployment workflow.

**Scope:** Public homepage projection; published events with invitations and videos; published announcements; approved photo data; frontend API integration when separately approved; automated CI checks and deployment workflow per architecture. M14 owns public guest upload; M12 owns token RSVP. This milestone does not create a public invitation endpoint: it implements invitation fields in the existing homepage/events responses.

**Expected files/responsibilities:** `server/src/modules/public-website/{public-website.routes.js,public-website.controller.js,public-website.service.js}` or the existing website module arrangement; focused integration tests; `.github/workflows/` CI and deploy workflows only when deployment environment/secrets and release process are approved. Frontend service integration is not assumed unless included in its separately approved scope.

**Documented endpoints:** `GET /public/weddings/:slug`; `GET /public/weddings/:slug/events`; `GET /public/weddings/:slug/announcements`; `GET /public/weddings/:slug/photos`. Existing public RSVP and guest-photo routes remain owned by M12 and M14 respectively.

**Dependencies:** M4 publication; M5 Wedding/Our Story; M6 Events; M10 Invitations; M13 Announcements; M14 Photos. The event response must include its event invitation if one exists; homepage response must include the common invitation if one exists.

**Security and data integrity:** Every response is explicit field projection; require published wedding and only published events/announcements or approved photos; hide Cloudinary management IDs and private guest/account data; public guest upload is disabled when wedding unpublished; unpublishing does not revoke family RSVP links; do not leak draft or deleted content.

**Required tests:** Published/unpublished wedding; homepage fields including common invitation and Our Story allowed fields; published events only including event invitations, menus, venue and video projection; published announcements only; approved photos only; no private fields; unknown slug behavior; API integration across module services; event deletion guard with RSVP, expense, task, invitation and photo dependencies; CI runs lint, frontend/backend tests, API integration tests and build; deployment health checks use approved environment configuration and do not reset production data.

**Learning concepts:** Read-model composition, DTO/projection design, cross-module integration, CI/CD gates, environment separation and deployment health checks.

**Completion checklist:**

- [ ] Four documented public GET routes are implemented; no extra endpoint is invented.
- [ ] Homepage includes `commonInvitation`; event rows include event-specific `invitation` where available.
- [ ] Only published/approved data is returned and private data is absent.
- [ ] Public RSVP remains independent of publication.
- [ ] Cross-module event lifecycle tests confirm cancellation/deletion preserves every dependent record type.
- [ ] Cross-module API integration tests pass.
- [ ] GitHub Actions CI checks documented lint, tests and build; deployment is enabled only after environment/secrets/release settings are approved.
- [ ] Health checks pass; production data cannot be reset by deployment.
- [ ] Status report records actual tests, deployment state and commit reference.

---

## Endpoint coverage index

Every endpoint listed in API Design v1.1 is assigned below. M1–M4 rows are complete; M5–M15 rows remain planned.

| API group | Documented endpoints | Milestone |
|---|---|---|
| Foundation | `GET /health` under `/api/v1` | M1 (complete; existing foundation endpoint preserved) |
| Auth | `GET /auth/csrf`; `POST /auth/register`; `POST /auth/login`; `POST /auth/logout`; `GET /auth/me`; `POST /auth/forgot-password`; `POST /auth/reset-password` | M3 (7 endpoints; complete) |
| Auth — Manager activation | `POST /auth/manager-activation` | M4 (Auth module endpoint; complete) |
| Wedding | `POST /weddings`; `GET /weddings/me`; `PATCH /weddings/me`; `PATCH /weddings/me/publication`; `POST /weddings/me/manager-invitation`; `POST /weddings/me/manager-invitation/resend` | M4 (complete) |
| Wedding images and Our Story | `PUT /weddings/me/cover-image`; `DELETE /weddings/me/cover-image`; `PATCH /weddings/me/our-story`; `POST /weddings/me/our-story/images`; `DELETE /weddings/me/our-story/images/:imageId` | M5 |
| Events | `POST /events`; `GET /events`; `GET /events/:eventId`; `PATCH /events/:eventId`; `PATCH /events/:eventId/status`; `DELETE /events/:eventId` | M6 |
| Tasks | `POST /tasks`; `GET /tasks`; `GET /tasks/:taskId`; `PATCH /tasks/:taskId`; `DELETE /tasks/:taskId` | M7 |
| Expenses | `POST /expenses`; `GET /expenses`; `GET /expenses/:expenseId`; `PATCH /expenses/:expenseId`; `DELETE /expenses/:expenseId` | M8 |
| Guests | `POST /guests`; `GET /guests`; `GET /guests/:guestId`; `PATCH /guests/:guestId`; `DELETE /guests/:guestId`; `POST /guests/import`; `POST /guests/:guestId/rsvp-link`; `PATCH /guests/:guestId/invitation-sharing/common`; `PATCH /guests/:guestId/invited-events/:eventId/invitation-sharing` | M9 |
| Invitations | `GET /invitations`; `POST /invitations`; `DELETE /invitations/:invitationId` | M10 |
| Family RSVP | `GET /public/rsvp/:token`; `PUT /public/rsvp/:token/events/:eventId` | M11 |
| Dashboard | `GET /dashboard/summary` | M12 |
| Announcements | `POST /announcements`; `GET /announcements`; `GET /announcements/:announcementId`; `PATCH /announcements/:announcementId`; `DELETE /announcements/:announcementId` | M13 |
| Photos | `GET /photos`; `GET /photos/:photoId`; `POST /photos`; `PATCH /photos/:photoId/review`; `DELETE /photos/:photoId`; `POST /public/weddings/:slug/photos` | M14 |
| Public website | `GET /public/weddings/:slug`; `GET /public/weddings/:slug/events`; `GET /public/weddings/:slug/announcements`; `GET /public/weddings/:slug/photos` | M15 |

The API document's request/response examples and module testing strategy remain controlling for endpoint implementation. Known unexpanded contracts for cover removal and guest upload are explicitly held for clarification above; their route assignments are retained.
