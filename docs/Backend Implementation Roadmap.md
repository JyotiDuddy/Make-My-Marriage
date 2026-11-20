# Make My Marriage — Backend Implementation Roadmap

**Status:** Active roadmap — M1–M14 COMPLETED; M15 NOT STARTED
**Source of truth:** Approved PRD v1.1, System Architecture v1.1, Database Design v1.2, API Design v1.1, plus confirmed planning decisions recorded in the Project Status Report.
**Architecture:** CommonJS Node.js/Express modular monolith, MongoDB/Mongoose, REST API under `/api/v1`.

This roadmap assigns the documented backend scope to 15 milestones. Milestones 1–14 are complete. Milestone 15 remains planned and must be implemented and verified separately. Tests are written with each milestone; Milestone 15 includes cross-module integration and CI/CD completion from the API design.

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
- **Approved M14 guest photo contract:** `POST /public/weddings/:slug/photos` accepts one multipart `image` file and optional `eventId`, with no other text fields; maximum size is 10 MB; accepted formats are JPEG/PNG/WebP with MIME and detected-content agreement; rate limit is 5 requests per 15 minutes per IP; success is HTTP 201 with only `data: { "status": "PENDING" }` in the standard envelope. The Wedding must be published; an optional Event must be valid and belong to that Wedding. Cloudinary failure returns 502 without a Photo record; persistence failure triggers best-effort deletion of the newly uploaded asset, and failed cleanup is logged for manual retry. Do not expose storage metadata or add another endpoint.
- **Approved M9 operational decisions:** CSV import uses multipart field `file`, max 2 MiB and 500 data rows, the six documented columns, valid-row partial import, row-level reasons, non-blocking duplicate warnings, and summary fields `totalRows`, `importedCount`, `skippedCount`, `errors`, and `warnings`. RSVP tokens use 32 cryptographically random bytes, store only SHA-256 hashes, expire after 90 days, are replaced on regeneration, and are revoked when the Guest is deleted. Raw URLs are returned only by the successful generation/regeneration response. M11 public RSVP endpoints remain out of scope for M9.
- **M9 mobile normalization convention:** Database Design §5.6 requires normalized mobile values without defining a canonical format. The user confirmed formatting-only normalization: trim and remove visual separators while preserving digits and an optional leading `+`, without adding a country code. Duplicate normalized mobile values produce warnings and do not reject creation.
- Public invitation data is already specified across existing APIs: `GET /public/weddings/:slug` returns `commonInvitation`, and `GET /public/weddings/:slug/events` returns an event's `invitation` where present. Implement those existing contracts; do not add an endpoint.

## Milestone summary

| # | Milestone | Status | Main deliverable |
|---|---|---|---|
| 1 | Backend Foundation | COMPLETED | Express foundation, `/api/v1/health`, common response/error handling and HTTP tests |
| 2 | Core Persistence Models | COMPLETED | User and Wedding Mongoose models and documented indexes |
| 3 | Authentication, Sessions and Security | COMPLETED | Seven Admin authentication/session/CSRF/password endpoints |
| 4 | Wedding Setup and Manager Onboarding | COMPLETED | Wedding setup/settings, Manager invitation and activation, publication control |
| 5 | Wedding Images and Our Story | COMPLETED | Hero/cover and Our Story image/content APIs with Cloudinary coordination |
| 6 | Events and YouTube Metadata | COMPLETED | Event CRUD, status, menus, venue and video metadata |
| 7 | Shared Tasks | COMPLETED | Shared task CRUD, filters and optional Event relationship |
| 8 | Actual Expenses | COMPLETED | Wedding-scoped Expense CRUD in integer paise |
| 9 | Family Guests, CSV and Sharing | COMPLETED | Guest CRUD, sharing, CSV import and RSVP-link generation |
| 10 | Invitation Cards | COMPLETED | Common and event card upload/list/removal with Cloudinary coordination |
| 11 | Family RSVP | COMPLETED | Token-protected read and event response APIs |
| 12 | Dashboard Summary | COMPLETED | Wedding-scoped dashboard aggregates |
| 13 | Announcements | COMPLETED | Wedding-scoped Announcement CRUD and publication state |
| 14 | Wedding Memories and Photo Review | COMPLETED | Photo model, organizer workflows, Admin review and public guest submission |
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

**Status:** COMPLETED
**Start date:** 2026-11-17
**Completion date:** 2026-11-17 (MongoDB integration suite, regression tests, lint, build, and diff check passed)
**Objective:** Implement the Wedding module's separate hero/cover asset and embedded Our Story content/supporting-image APIs.

**Scope completed:** Cover image upload/replacement and deletion; Our Story description update; upload and deletion of up to two supporting photographs. The approved cover deletion contract is recorded in API Design §4.8. Cover image remains separate from `ourStory.images` and both remain separate from Wedding Memories Photo records.

**Files/responsibilities:** `server/src/modules/wedding/wedding.routes.js` exposes the endpoints; `wedding.controller.js` handles HTTP envelopes; `wedding.service.js` scopes Wedding updates and coordinates MongoDB/Cloudinary; `image.validation.js` checks signatures and request fields; `server/src/middleware/image-upload.js` provides bounded multipart parsing; `server/src/shared/storage/cloudinary.adapter.js` is the injectable Cloudinary adapter. Integration and validation tests cover the implementation. Cloudinary credentials remain server-only.

**Implemented endpoints:** `PUT /weddings/me/cover-image`; `DELETE /weddings/me/cover-image`; `PATCH /weddings/me/our-story`; `POST /weddings/me/our-story/images`; `DELETE /weddings/me/our-story/images/:imageId`.

**Dependencies:** M2 Wedding schema; M3 auth/CSRF; M4 wedding resolution and publication state. Added Cloudinary, Multer, and `file-type`. Tests inject a fake Cloudinary adapter; no live credentials are needed for the automated suite.

**Security and data integrity:** Admin-only edits with existing session, ownership, and CSRF checks; accept JPEG/PNG/WebP up to 10 MB and verify file signatures; enforce the two-image maximum with an atomic database condition; upload a replacement before database update and delete the old asset only after update succeeds; attempt compensating deletion if database persistence fails; remove database references before deleting Cloudinary assets; log cleanup failures with structured data for manual retry. Responses omit Cloudinary public IDs.

**Verification:** M5 MongoDB integration suite: 15 passed. Backend non-integration suite: 25 passed. Image-validation unit suite: 6 passed. Server lint, root lint, frontend production build, and `git diff --check` passed. Integration tests use an isolated generated local database and a fake Cloudinary adapter.

**Learning concepts:** Multipart processing, content-based file validation, embedded documents, race conditions, external asset lifecycle and compensating cleanup.

**Completion checklist:**

- [x] Hero/cover and Our Story images use the unchanged documented Wedding structures and routes.
- [x] The approved cover-removal contract is recorded in API Design §4.8 and implemented on the existing path.
- [x] Cover removal and cleanup behavior, including idempotence and Cloudinary failure, is tested.
- [x] Cover replacement and Our Story compensation/cleanup tests pass.
- [x] Two-image rule is concurrency-safe, including concurrent upload attempts.
- [x] Cloudinary identifiers/credentials are excluded from response payloads.
- [x] Lint, build, unit tests, MongoDB integration tests, and diff check pass; live Cloudinary remains unverified and cleanup failures require manual retry.

---

## Milestone 6 — Events and YouTube Metadata

**Status:** COMPLETED
**Start date:** 2026-11-17
**Completion date:** 2026-11-17 (isolated MongoDB integration tests, backend regression tests, lint, build, and diff check passed)
**Objective:** Implement wedding-scoped event scheduling, embedded menus, venue directions, publication/status and YouTube metadata.

**Scope completed:** Event schema and documented indexes; create/list/read/update/status/delete; pagination, filtering, menu and Google Maps URL validation; YouTube URL validation and server-side video ID extraction. Events are soft-deleted when no dependent records exist; deletion is rejected with a cancellation recommendation when an injected dependency check reports linked history.

**Files/responsibilities:** `server/src/modules/events/{event.model.js,event.routes.js,event.controller.js,event.service.js,event.validation.js}`; the service scopes every query to the Wedding resolved from session identity and exposes injectable dependency checks for later reference-owning modules.

**Implemented endpoints:** `POST /api/v1/events`; `GET /api/v1/events`; `GET /api/v1/events/:eventId`; `PATCH /api/v1/events/:eventId`; `PATCH /api/v1/events/:eventId/status`; `DELETE /api/v1/events/:eventId`.

**Dependencies:** M3 auth and M4 wedding context. Task/expense/guest/invitation/RSVP/photo relationships arrive in M7–M11 and M14. Each milestone that introduces one of these references must extend the event deletion guard and add its focused test; M15 performs the final cross-module lifecycle verification.

**Approved M6 clarifications:** Creation requires an explicit valid status; no default is introduced. `UPCOMING`, `COMPLETED`, and `CANCELLED` may transition in either direction, including restoring a cancelled event; other values are rejected. Event times are strict 24-hour `HH:mm`. These are recorded in API Design §2.8 and §7.

**Security and data integrity:** Admin/Manager only; force `weddingId`/`createdBy`/`updatedBy` from authenticated context; reject client ownership fields; scope event reads and writes by Wedding; cancelled status does not mutate or remove linked history; soft-delete through `deletedAt`; check dependency callbacks before deletion; accept LIVE/RECORDED with YOUTUBE only and extract video ID server-side. No dependent product models existed in M1–M5; future modules must register their checks.

**Verification:** M6 MongoDB integration suite passed (11 tests) against a generated loopback-only disposable database, dropped after testing. Backend non-integration regression suite passed (25 tests). Server lint, root lint, frontend production build, and `git diff --check` passed.

**Learning concepts:** REST resource lifecycle, embedded menu data, query validation, lifecycle-aware deletion, URL parsing and derived fields.

**Completion checklist:**

- [x] Event schema and documented indexes match Database Design §5.3.
- [x] All six endpoints and documented filters are implemented.
- [x] Same-wedding ownership checks apply to every event operation; Event has no client-selected ownership fields.
- [x] Cancellation preserves linked history; deletion uses `deletedAt` when safe and rejects when an injected dependency check reports linked records. Later reference-owning milestones must extend the deletion guard, and M15 verifies all dependency types together.
- [x] Video ID is extracted from a supported YouTube URL on the server; client-supplied video IDs are rejected.
- [x] Integration/regression tests, lint/build and diff check pass; completion record is updated.

---

## Milestone 7 — Shared Tasks

**Status:** COMPLETED
**Start date:** 2026-11-17
**Completion date:** 2026-11-17 (isolated local MongoDB integration, M1–M6 regressions, lint, build, and diff checks passed)
**Objective:** Implement the shared Admin/Manager task list with an optional Event association.

**Implemented scope:** Task model with only Database Design §5.4 fields and indexes; create/list/read/update/delete; required ISO 8601 deadline with explicit timezone; documented status and priority enums; filtering, pagination, stable deadline ordering; optional same-Wedding Event references; server-derived ownership metadata; and Event deletion dependency enforcement. No assignment, reminder, notification, recurrence, or M8 functionality was added.

**Important files:** `server/src/modules/tasks/{task.model.js,task.validation.js,task.service.js,task.controller.js,task.routes.js}` and `server/test/tasks.integration.test.mjs`. The Event checker is wired in `server/src/routes/v1.js`; M2–M4 test harnesses were updated to accept explicit loopback-only URI overrides so regressions need not read `.env`.

**Implemented endpoints:** `POST /api/v1/tasks`; `GET /api/v1/tasks`; `GET /api/v1/tasks/:taskId`; `PATCH /api/v1/tasks/:taskId`; `DELETE /api/v1/tasks/:taskId`.

**Schema and indexes:** Required `weddingId`, `title`, `deadline`, `priority`, `status`, `createdBy`; optional `description`, `eventId`, `updatedBy`; Mongoose timestamps. Enums are `TODO`/`IN_PROGRESS`/`COMPLETED` and `LOW`/`MEDIUM`/`HIGH`. Indexes are exactly `{ weddingId: 1, status: 1, deadline: 1 }` and `{ weddingId: 1, eventId: 1 }`. No defaults, `assignedTo`, `deletedAt`, or additional indexes were introduced.

**Dependencies:** M3 session authentication/role middleware; M4 Wedding identity resolution; M6 Event model and deletion guard. No package dependencies were added.

**Security and data integrity:** Admin and Manager share the Wedding task list. All operations are Wedding-scoped; `weddingId`, `createdBy`, and `updatedBy` are server-derived; mutations require CSRF. Event association rejects malformed, absent, deleted, and cross-Wedding Events; cancelled Events remain eligible because no contract restriction exists. Task deletion is hard deletion as specified by the schema/API. The M6 Event guard checks Task references and blocks deletion while a linked Task exists.

**Concurrency coordination:** Task creation or association changes that add an Event reference run in a MongoDB transaction and update the referenced Event's existing `updatedAt` value monotonically. This is a write to the common Event document coordinated with M6's `updatedAt` compare-and-set soft deletion; a transaction without that shared write would not close the race. No field, index, collection, lock service, or dependency was added. As a result, `Event.updatedAt` advances when its Task association is added or changed. The integration suite requires a MongoDB replica set; the temporary test replica set was loopback-only and separate from the existing MongoDB instance.

**Required tests:** Schema fields/enums/timestamps and exact indexes; required input and deadline validation; optional, valid, invalid, missing, deleted and cross-Wedding Event references; Admin/Manager shared access; anonymous/CSRF rejection; ownership field rejection; filters/pagination/order; read/update allowlist and clearing optional values; hard deletion; same-Wedding isolation; Event cancellation/history preservation; Event deletion blocked by Task and allowed after Task removal; concurrent Task association/Event deletion invariant; M1–M6 regressions.

**Verification:** M7 isolated MongoDB integration suite **8 passed**; M2 indexes **7 passed**; M3 auth **13 passed**; M4 Wedding **15 passed**; M5 image/Our Story **15 passed**; M6 Events **11 passed**; backend non-integration suite **25 passed**. Backend lint, root lint, frontend production build, and `git diff --check` passed. Test databases were generated and dropped on an isolated local replica set; the existing port 27017 MongoDB instance, `.env`, remote databases, and external services were not used.

**Learning concepts:** Mongoose references/indexes, shared-role authorization, scoped queries, ISO timestamp validation, allowlisted PATCH handling, transactions and shared-document concurrency coordination.

**Completion checklist:**

- [x] Task schema and both indexes match Database Design §5.4 exactly.
- [x] All five documented endpoints follow the approved request, response, filtering, and sorting contracts.
- [x] Task ownership and creator/updater IDs come from the authenticated Wedding/session context.
- [x] Event references are optional, validated, Wedding-scoped, and exclude soft-deleted Events.
- [x] The default M6 Event service checks linked Tasks and preserves them on cancellation.
- [x] Concurrent Task association and Event deletion cannot leave a successfully created Task pointing to a deleted Event.
- [x] No task assignment or unapproved schema/index/dependency was introduced.
- [x] M7/M1–M6 tests, lint, frontend build, and diff check pass; status report records results.

---

## Milestone 8 — Actual Expenses

**Status:** COMPLETED
**Start date:** 2026-11-17
**Completion date:** 2026-11-17 (isolated local MongoDB integration and M2–M7 regression suites, lint, build, and diff checks passed)
**Objective:** Track actual wedding expenses, stored as integer paise.

**Implemented scope:** Added the Expense model with exactly the Database Design §5.5 fields and three indexes. Implemented create/list/read/partial-update/hard-delete, category/Event/date filters, pagination, stable payment-date ordering, optional Event association, integer paise validation, and Wedding-scoped access. No budgets, forecasts, or budget-versus-actual calculations were introduced.

**Important files:** `server/src/modules/expenses/{expense.model.js,expense.routes.js,expense.controller.js,expense.service.js,expense.validation.js}`; `server/test/expenses.integration.test.mjs`.

**Endpoints:** `POST /api/v1/expenses`; `GET /api/v1/expenses`; `GET /api/v1/expenses/:expenseId`; `PATCH /api/v1/expenses/:expenseId`; `DELETE /api/v1/expenses/:expenseId`.

**Dependencies:** Existing M3 session authentication, CSRF and role checks; M4 Wedding context; M6 Event model/deletion guard; M7 transaction-based Event association coordination. No package dependencies were added.

**Security and data integrity:** Admin and Manager share access to their Wedding's Expenses. `weddingId`, `createdBy`, and `updatedBy` are server-derived; mutations require CSRF; reads and writes are Wedding-scoped. Amounts must be safe positive integers in paise. Optional Event IDs must identify an active Event in the same Wedding; cancelled Events remain eligible. Client ownership metadata is rejected. Expense associations transactionally touch the existing Event `updatedAt` with the same M7 strategy used by Event deletion's compare-and-set; no competing lock or schema/index change was added. A linked Expense blocks Event deletion, and Event cancellation preserves Expense history.

**API details left underspecified by API Design §9:** The section gives filter examples but no explicit sort order, does not enumerate PATCH fields, and does not show endpoint response objects. Implementation follows the established API envelope and adjacent modules: PATCH accepts editable Expense business fields only (not ownership or timestamp metadata), and list results are ordered by `paymentDate` descending with `_id` as a stable tie-breaker. Date filters use inclusive `YYYY-MM-DD` calendar days. No product requirement or endpoint was added; these conventions should be consolidated into the API contract before client integration if exact response/sort behavior is required.

**Required tests:** All five endpoints; exact Expense schema/indexes; required fields, category enum and positive integer paise; filtering/pagination/order; optional/same-Wedding Event associations and invalid/missing/deleted/cross-Wedding Event rejection; Admin/Manager shared access; anonymous, role, CSRF and cross-Wedding isolation; server-derived creator/updater; Event deletion guard, cancellation/history preservation, and concurrent Event association/deletion for both create and PATCH.

**Verification:** M8 MongoDB integration **9/9** passed against a generated disposable database on a temporary loopback-only replica set; database was dropped afterward. M7 Tasks **8/8**, M6 Events **11/11**, M5 Wedding images/Our Story **15/15**, M4 Wedding/Manager **15/15**, M3 authentication **13/13**, M2 index enforcement **7/7**, and backend non-integration tests **25/25** passed. Backend lint, root lint, frontend production build, and `git diff --check` passed. Integration tests used explicit loopback-only test URI overrides; no remote MongoDB, real `.env` credentials, or external service was accessed.

**Completion checklist:**

- [x] Expense schema and all three indexes match Database Design §5.5 exactly.
- [x] All five documented Expense endpoints and category/Event/date filters are implemented.
- [x] Integer paise validation and storage preserve exact values; no budget features are included.
- [x] Admin/Manager authorization, CSRF, session authentication and Wedding isolation are covered by integration tests.
- [x] Event references are optional, active, same-Wedding only; Event `updatedAt` transaction coordination reuses M7's race strategy.
- [x] Linked Expenses prevent Event deletion; cancellation preserves Expense records.
- [x] M8/M2–M7 tests, backend/root lint, frontend build, and diff check pass; status report records results.

---

## Milestone 9 — Family Guests, CSV and Sharing

**Status:** COMPLETED
**Start date:** 2026-11-17
**Completion date:** 2026-11-18
**Objective:** Manage family invitation records, event invitations and organizer-maintained sharing state, including approved CSV import and family RSVP-link generation.

**Implemented scope:** Guest model with exact §5.6 fields/indexes; create/list/read/update/delete; search, Event and common invitation-status filters; pagination; formatting-only mobile normalization and non-blocking duplicate warnings; invited-Event validation and duplicate prevention; common and event invitation-sharing status; history-aware soft/hard deletion and token revocation; Event dependency guard integration and M7-style transactional coordination when adding Event references. Public RSVP read/write is excluded.

**Completed scope:** `POST /guests/import` supports the approved 2 MiB/500-row limits, six CSV columns, partial valid-row import, non-sensitive row errors, duplicate warnings and import summary. `POST /guests/:guestId/rsvp-link` generates 32-byte cryptographically secure tokens, stores only SHA-256 hashes, expires tokens after 90 days, replaces previous token data, and returns the URL only in the successful response. Guest deletion revokes access. No public RSVP endpoints or actual RSVP submission were added.

**Additional API §10.3 ambiguity:** The API gives a `search` example but does not specify searched fields; implementation searches family name, primary contact and normalized mobile. It gives `invitationStatus` without saying whether it filters the common invitation or any event invitation; implementation maps it to the common `weddingInvitationStatus`. Guest response object fields and duplicate-warning placement are not shown; implementation uses the shared envelope with Guest fields and a `warnings` array in `data`. Confirm these conventions before relying on them in frontend integration.

**Files/responsibilities:** `server/src/modules/guests/{guest.model.js,guest.routes.js,guest.controller.js,guest.service.js,guest.validation.js,csv-import.service.js,csv-upload.middleware.js}` and `server/test/guests.integration.test.mjs`; `server/package.json` and root `package-lock.json` add the documented `csv-parse` dependency. `server/src/routes/v1.js` mounts the Guest routes.

**Endpoints:** All nine documented endpoints are implemented: `POST /guests`; `GET /guests`; `GET /guests/:guestId`; `PATCH /guests/:guestId`; `DELETE /guests/:guestId`; `POST /guests/import`; `POST /guests/:guestId/rsvp-link`; `PATCH /guests/:guestId/invitation-sharing/common`; `PATCH /guests/:guestId/invited-events/:eventId/invitation-sharing`.

**Dependencies:** M3 auth; M4 Wedding context; M6 Event model/deletion guard; M7 transaction coordination; `csv-parse` for CSV parsing. M11 may consume generated RSVP tokens through its future public endpoints; those endpoints are not part of M9.

**Security and data integrity:** Admin/Manager only; Wedding-scoped reads and writes; server-controlled ownership/audit fields; CSRF on mutations; serialized responses omit RSVP hashes/access data. Event references must be active and same-Wedding; duplicates are rejected. New Guest/Event relationships touch the existing Event `updatedAt` in the same MongoDB transaction as the Guest write, reusing M7/M8 deletion coordination. Guests with RSVP history are soft-deleted, preserve RSVP documents and have RSVP access revoked; Guests without history are hard-deleted. Duplicate normalized mobile values warn without rejecting creation. No WhatsApp sending is implemented.

**Required tests:** Guest schema/indexes; CRUD/search/filter/pagination; normalization and duplicate warning; Event membership and duplicate references; privacy; deletion with/without RSVP history; token revocation on soft deletion; sharing status metadata; Admin/Manager, authentication, CSRF and Wedding isolation; Event deletion guard, cancellation and concurrent create/PATCH association versus deletion; CSV empty/malformed/unsupported/missing-header/oversize/row-limit/partial-import/duplicate-warning/privacy checks; RSVP URL generation, secure hash storage, 90-day expiry, replacement invalidation and deletion/expiry revocation.

**Learning concepts:** Family aggregate modeling, soft deletion, privacy projection, partial indexes, transaction-based Event association safety and invitation-sharing state.

**Verification:** M9 integration **16/16** passed against a generated disposable database on a temporary loopback-only replica set. Regression integration suites passed: M8 **9/9**, M7 **8/8**, M6 **11/11**, M5 **15/15**, M4 **15/15**, M3 **13/13**, M2 **7/7**. Backend non-integration tests **25/25**, backend lint, root lint, frontend production build, and `git diff --check` passed. An initial sandbox run was unable to connect to loopback (`EPERM`); rerunning with permission for local-only access to the disposable replica set passed. No remote database or real Cloudinary operation was used.

**Completion checklist:**

- [x] Guest schema and indexes match Database Design §5.6.
- [x] All nine documented endpoints work.
- [x] CSV columns, limits, duplicate handling, partial-import behavior and summary follow the approved M9 decisions.
- [x] RSVP access is hash-stored, returned only on generation/regeneration, expires after 90 days, is revoked on replacement/deletion, and remains hidden from ordinary reads.
- [x] RSVP-history deletion preserves history and revokes access; hard deletion occurs only when no history exists.
- [x] All required tests/lint/build pass; operational limits and approved decisions are recorded.

---

## Milestone 10 — Invitation Cards

**Status:** COMPLETED
**Start date:** 2026-11-18
**Completion date:** 2026-11-18
**Objective:** Upload, list, replace and remove one common card per wedding or one current card per event.

**Implemented scope:** Invitation model with exactly the two partial unique indexes in Database Design §5.8; Admin/Manager multipart upload/list/delete; COMMON cards omit or null `eventId`; EVENT cards require a non-deleted Event in the same Wedding. Accepts JPEG/PNG/WebP and enforces the user-approved 10 MB per-image maximum with file-signature validation. Invitation metadata is stored in MongoDB and image bytes in Cloudinary only. Replacement updates the existing document, then deletes the previous Cloudinary asset; database failure triggers best-effort cleanup of the new asset. Deletion removes the document before asset cleanup. Cleanup failures use M5 structured logging/manual-retry conventions. No public Cloudinary ID is returned.

**Files/responsibilities:** `server/src/modules/invitations/{invitation.model.js,invitation.routes.js,invitation.controller.js,invitation.service.js,invitation.validation.js}`; shared `server/src/middleware/image-upload.js`, `server/src/modules/wedding/image.validation.js`, and `server/src/shared/storage/cloudinary.adapter.js` are reused. `server/src/routes/v1.js` mounts the module and registers its Event dependency guard. `server/test/invitations.integration.test.mjs` covers the module.

**Endpoints:** `GET /invitations`; `POST /invitations`; `DELETE /invitations/:invitationId`.

**Dependencies:** M3 authentication/CSRF; M4 Wedding resolution; M5 shared image validation and Cloudinary adapter; M6 Event lifecycle; M9 Guest sharing remains a separate workflow. No dependency was added.

**Security and data integrity:** Admin/Manager only; authentication and CSRF precede upload parsing; scope records by Wedding from authenticated identity; do not accept client ownership fields; validate content signatures and MIME match; omit storage public IDs from response payloads; enforce exact partial unique indexes. EVENT association writes transactionally touch the existing Event `updatedAt`, reusing M7–M9 coordination with M6's compare-and-set deletion. Concurrent replacement checks references before asset cleanup so an asset still referenced by a current Invitation is not deleted. Event cancellation leaves invitation metadata/assets intact.

**Required tests:** COMMON and EVENT upload; missing/invalid type and Event IDs; cross-Wedding/deleted Event; invalid MIME/signature; 10 MB oversize; missing image; exact model/index definitions and actual index creation; replacement in place and old-asset cleanup after database update; cleanup of new asset on DB failure; safe deletion and cleanup failure logging; invalid/missing/cross-Wedding Invitation ID; list pagination and Wedding isolation; Admin/Manager permission, anonymous denial and CSRF; Event deletion guard/cancellation; race where upload shares Event with deletion; deletion during in-flight upload; concurrent replacement.

**Learning concepts:** Multipart uploads, partial unique indexes, external storage compensation, metadata vs binary storage.

**Verification:** M10 MongoDB integration **19/19** passed on a generated disposable database using the existing loopback-only replica set and fake Cloudinary adapter. M9 **16/16**, M8 **9/9**, M7 **8/8**, M6 **11/11**, M5 **15/15**, M4 **15/15**, M3 **13/13**, M2 **7/7** integration tests passed. Backend non-integration tests **25/25**, backend lint, root lint, frontend production build, and `git diff --check` passed. No real Cloudinary credentials/assets or remote MongoDB were used.

**Completion checklist:**

- [x] Invitation schema and partial unique indexes match Database Design §5.8.
- [x] All three documented endpoints work.
- [x] Common/event association rules and media checks are enforced.
- [x] Replacement/deletion preserve metadata and clean assets only in documented order.
- [x] Tests/lint/build pass; no invitation designer or family-personalized card feature is added.

---

## Milestone 11 — Family RSVP

**Status:** COMPLETED
**Start/completion dates:** 2026-11-18 / 2026-11-18
**Objective:** Let a family with a valid token view only its invited events and create/update its current event responses.

**Implemented scope:** Added the Database Design §5.7 RSVP model and both documented indexes; implemented token-protected family lookup and event-wise YES/NO creation/update; validated expiry, revocation, active Guest status, invitation membership and same-Wedding active Event; excluded cancelled/deleted Events from the family view; RSVP works when the Wedding site is unpublished.

**Files/responsibilities:** `server/src/modules/rsvp/{rsvp.model.js,rsvp.routes.js,rsvp.controller.js,rsvp.service.js,rsvp.validation.js}`; `server/src/config/env.js` and shared rate-limit middleware configure the approved per-IP protection; `server/src/routes/v1.js` mounts the public routes and adds RSVP to the Event dependency guard; `server/test/rsvp.integration.test.mjs` exercises the module. M9 Guest deletion now uses a MongoDB transaction so a concurrent RSVP cannot leave a hard-deleted Guest with RSVP history.

**Implemented endpoints:** `GET /api/v1/public/rsvp/:token`; `PUT /api/v1/public/rsvp/:token/events/:eventId`.

**Dependencies:** M3 token/security primitives; M6 Event; M9 Guest and generated token; published-site state is intentionally not a prerequisite for valid family RSVP.

**Security and data integrity:** Reuse M9 SHA-256 token hashing and 32-byte base64url token format; require an active, non-deleted Guest and unexpired, unrevoked token. Malformed, unknown, expired, revoked, regenerated and deleted-family tokens use the same 404 `TOKEN_INVALID` response. The user approved 20 requests per 15 minutes per IP separately for each endpoint; server variables `PUBLIC_RSVP_GET_RATE_LIMIT_MAX`, `PUBLIC_RSVP_PUT_RATE_LIMIT_MAX` and `PUBLIC_RSVP_RATE_LIMIT_WINDOW_MS` configure the limits. Responses set `Referrer-Policy: no-referrer`, omit contacts/token metadata/other-family records, and do not require organizer sessions or CSRF because the routes use the family bearer token. The public view includes only that Guest's invited, active, non-cancelled Events. A response write revalidates the Guest and Event in a transaction, coordinates on existing `Event.updatedAt` with M6 deletion/other Event-reference writes, and uses the unique `{weddingId, guestId, eventId}` index; cancellation retains existing RSVP records.

**Tests and verification:** M11 integration **8/8** passed against a generated disposable database on the local loopback replica set; the test database was dropped. Covers exact schema/indexes, valid/malformed/unknown/expired/revoked/regenerated/deleted-family tokens, both endpoint rate limits and the configured 20/15-minute values, response privacy, unpublished-site access, invitation/same-Wedding/Event status checks, anonymous bearer access without CSRF, create/update/idempotent responses, concurrency, Event deletion protection and cancellation preservation. Regression integrations passed: M10 **19/19**, M9 **16/16**, M8 **9/9**, M7 **8/8**, M6 **11/11**, M5 **15/15**, M4 **15/15**, M3 **13/13**, M2 **7/7**. Backend non-integration tests **25/25**, backend lint, root lint, frontend production build, and `git diff --check` passed. Cloudinary and other external services were not used.

**Learning concepts:** Bearer-token security, upsert/idempotency, compound unique constraints, authorization without accounts, public endpoint privacy.

**Completion checklist:**

- [x] RSVP schema/index match Database Design §5.7.
- [x] Both documented routes and response shapes are implemented.
- [x] Token and event authorization rules are enforced server-side.
- [x] One current response per invited family-event pair is maintained.
- [x] Security tests cover token guessing, response privacy, and publication independence.
- [x] Tests/lint/build pass and status is recorded.

---

## Milestone 12 — Dashboard Summary

**Status:** COMPLETED
**Start/completion dates:** 2026-11-18 / 2026-11-18
**Objective:** Provide the dashboard summary as calculated data without a Dashboard collection.

**Implemented scope:** Added `GET /api/v1/dashboard/summary` with exactly the seven fields in API Design §6. Counts and sums are calculated from existing Event, Expense, Guest, RSVP and Task collections. No Dashboard model or collection was added. PRD FR-02's recent-record-updates item is deferred to a later approved API contract, as confirmed during M12 implementation.

**Files/responsibilities:** `server/src/modules/dashboard/{dashboard.routes.js,dashboard.controller.js,dashboard.service.js}`; `server/src/routes/v1.js` registers the endpoint; `server/test/dashboard.integration.test.mjs` covers aggregation and security.

**Implemented endpoint:** `GET /api/v1/dashboard/summary`.

**Response fields:** `totalEvents`, `upcomingEvents`, `totalExpensesPaise`, `totalFamilies`, `acceptedRsvps`, `pendingRsvps`, and `upcomingTasks`, within the standard success envelope.

**Calculation definitions confirmed for M12:** `totalEvents` includes all non-deleted Events, including COMPLETED and CANCELLED historical records. `upcomingEvents` counts non-deleted Events whose status is UPCOMING and whose local event date/time in the Wedding timezone is at or after the current instant. `totalExpensesPaise` sums all Wedding Expenses as integer paise. `totalFamilies` counts non-deleted Guest family records. Accepted and pending RSVP metrics count active invited Guest–Event pairs only, excluding deleted Guests and deleted/CANCELLED Events; YES is accepted, no response is pending, and NO is neither. Duplicate invitation references do not multiply a family–Event pair. `upcomingTasks` is a count of TODO/IN_PROGRESS tasks with deadline at or after the current instant; Date deadlines are compared as absolute instants, and Tasks associated with deleted, CANCELLED, or cross-Wedding Events are excluded. No task list, deadline window, or task ordering is returned.

**Dependencies:** M3 authentication and M6 Events, M7 Tasks, M8 Expenses, M9 Guests, and M11 RSVP data. This places aggregation after its source modules; M12 does not depend on Announcements (M13) or Photos (M14), so those milestones do not need to precede the dashboard.

**Security and data integrity:** Admin/Manager only; derive Wedding ownership from authenticated identity; every query is scoped to that Wedding; client-supplied Wedding IDs are ignored; return only aggregate values; count families and family-event responses, not individual attendees; exclude soft-deleted Guest and deleted Event records.

**Tests and verification:** M12 MongoDB integration **8/8** passed against a generated disposable database on the local loopback replica set; database dropped after testing. Tests cover empty collections, exact response keys, event status/deletion and local-time boundaries in Asia/Kolkata and America/Los_Angeles, integer paise totals, active/soft-deleted family records, accepted/pending YES/NO family–Event pairs including duplicate invitations, upcoming Task statuses/deadlines/Event eligibility, Admin/Manager and invalid-role authorization, anonymous denial, client Wedding-ID isolation, and private-data exclusion. M11 **8/8**, M10 **19/19**, M9 **16/16**, M8 **9/9**, M7 **8/8**, M6 **11/11**, M5 **15/15**, M4 **15/15**, M3 **13/13**, and M2 **7/7** integration suites passed against local disposable databases. M9 and M10 initially encountered replica-set contention when suites ran concurrently, then passed on sequential reruns. Backend non-integration **25/25**, backend lint, root lint, frontend production build, and `git diff --check` passed.

**Learning concepts:** MongoDB aggregation, count semantics, timezone-aware queries, preventing cross-wedding leakage.

**Completion checklist:**

- [x] Documented summary fields and family-based count definitions are returned.
- [x] No Dashboard collection is created.
- [x] All queries are wedding-scoped and role-protected.
- [x] Aggregation tests cover empty, boundary and isolation cases.
- [x] Lint/build/tests pass; dependencies and completion are recorded.

---

## Milestone 13 — Announcements

**Status:** COMPLETED
**Start/completion dates:** 2026-11-18
**Objective:** Manage wedding announcements and publish only approved public content.

**Implemented scope:** Added the Database Design §5.10 Announcement model and its documented compound index; implemented all five Admin/Manager management endpoints with DRAFT/PUBLISHED state, Wedding-scoped authorization, server-derived audit fields, status filtering and pagination. Public read remains assigned to M15.

**Files created:** `server/src/modules/announcements/{announcement.model.js,announcement.routes.js,announcement.controller.js,announcement.service.js,announcement.validation.js}`; `server/test/announcements.integration.test.mjs`.

**Files modified:** `server/src/routes/v1.js`, `server/package.json`, `docs/Make My Marriage api.md`, and `docs/Make My Marriage Project Status Report.md`.

**Endpoints:** `POST /announcements`; `GET /announcements`; `GET /announcements/:announcementId`; `PATCH /announcements/:announcementId`; `DELETE /announcements/:announcementId` (mounted under `/api/v1`). No public endpoint was added.

**Dependencies:** M3 auth; M4 wedding context; M15 public website API consumes the published projection.

**Security and data integrity:** Admin/Manager only for management; creator and Wedding come from authenticated ownership context; reject client-controlled ownership/audit fields; restrict status to the documented enum; all reads and writes are Wedding-scoped. No response includes `weddingId`. Public read remains unimplemented until M15 and must return only PUBLISHED content.

**Approved M13 contract clarifications:** A DRAFT→PUBLISHED transition sets `publishedAt` to the new publish time; unpublishing removes it; edits while still PUBLISHED preserve it; republishing after unpublishing uses a fresh timestamp. Management listing sorts by `updatedAt` descending, then `_id` descending. Title and description are required nonempty strings; no undocumented maximum lengths are imposed.

**Dependencies introduced:** None.

**Tests and verification:** M13 local MongoDB integration **6/6** passed against a generated disposable database on the loopback replica set; database dropped after the run. Tests verify schema fields/index, create validation and server-controlled fields, status filtering/pagination/order and Wedding isolation, read behavior, publication timestamp transitions including republishing, protected update fields, deletion/not-found behavior, Admin/Manager access, anonymous denial, CSRF, and that no M13 public route was added. M2–M12 regression integrations all passed sequentially: M12 **8/8**, M11 **8/8**, M10 **19/19**, M9 **16/16**, M8 **9/9**, M7 **8/8**, M6 **11/11**, M5 **15/15**, M4 **15/15**, M3 **13/13**, M2 **7/7**. Backend non-integration tests **25/25**, backend lint, root lint, frontend production build, and `git diff --check` passed. No remote database or external service was used.

**Learning concepts:** Publication state machines, audit metadata, scoped queries, separating private management views from public projections.

**Completion checklist:**

- [x] Announcement schema/index match Database Design §5.10.
- [x] All five documented management endpoints work.
- [x] DRAFT/PUBLISHED and approved publishedAt behavior is correct.
- [x] Public endpoint remains assigned to M15; M13 adds no public route.
- [x] Integration/regression tests, lint, build and diff check pass; status is recorded.

---

## Milestone 14 — Wedding Memories and Photo Review

**Status:** COMPLETED
**Start date:** 2026-11-19
**Completion date:** 2026-11-20
**Objective:** Manage organizer photographs, Admin review, approved gallery data and the existing guest photo submission endpoint.

**Implemented scope:** Photo model and documented indexes; Admin/Manager Wedding-scoped list/read/upload/delete; Admin-only one-time review of pending guest submissions; public guest submissions forced to PENDING; approved-only public projection helper for M15; Event dependency guard and transaction coordination for Event-associated uploads. All six M14 endpoints are implemented. The public approved-gallery GET remains assigned to M15.

**Files created:** `server/src/modules/photos/{photo.model.js,photo.routes.js,photo.controller.js,photo.service.js,photo.validation.js}` and `server/test/photos.integration.test.mjs`.

**Files modified for M14:** `server/src/config/env.js`, `server/.env.example`, `server/src/routes/v1.js`, `server/package.json`, API Design §13 (approved M14 clarifications), this roadmap, and the Project Status Report. Existing unrelated worktree changes were preserved.

**Implemented endpoints:** `GET /api/v1/photos`; `GET /api/v1/photos/:photoId`; `POST /api/v1/photos`; `PATCH /api/v1/photos/:photoId/review`; `DELETE /api/v1/photos/:photoId`; `POST /api/v1/public/weddings/:slug/photos`.

**Schema and indexes:** Photo matches Database Design §5.9 fields, enum values and timestamps. The exact indexes are `{ weddingId: 1, status: 1, createdAt: -1 }` and `{ weddingId: 1, eventId: 1, status: 1 }`; no other Photo indexes were added.

**Dependencies:** No new dependency was introduced. M3 auth/CSRF and rate limiting, M4 wedding/publication, M6 Event validation and transaction coordination, existing image validation and Cloudinary adapters are reused. M15 consumes the approved-photo service for public reads.

**Security and data integrity:** Organizer routes require authenticated Admin/Manager and CSRF for mutations. Wedding, uploader type/user, and organizer APPROVED status are server-derived. Upload validates image contents and MIME agreement for JPEG/PNG/WebP and enforces the approved 10 MB per-photo limit. Guest uploads accept one multipart `image` file plus optional `eventId`, require a published Wedding, use 5 requests per 15 minutes per IP, and return only the approved minimal status response. Optional Event IDs must identify a non-deleted Event in the same Wedding. Associated uploads use the existing Event `updatedAt` transactional coordination; linked Photo records block unsafe Event deletion, and cancellation preserves them. Only Admin can make a one-time decision on a GUEST photo while it is PENDING; decisions are APPROVED or REJECTED and set `reviewedBy`/`reviewedAt`. Responses omit Cloudinary `storagePublicId`. M15 must use the approved-only projection and require a published Wedding.

**Cloudinary behavior:** Upload precedes MongoDB persistence; upload failure returns 502 and creates no Photo record. If persistence fails after upload, the service attempts to delete the newly uploaded asset. Photo deletion removes the database document, then deletes the Cloudinary asset only if unreferenced. Cleanup failure is logged for manual retry without undoing the completed database operation. Automated tests use a fake adapter; live Cloudinary credentials were not used.

**Integration tests and verification:** M14 integration suite **16/16** passed against a generated disposable database using a loopback-only MongoDB replica set. It covers schema and actual indexes; organizer and guest upload; MIME/content and size validation; auth/roles/CSRF/rate limiting; Wedding and Event isolation; minimal public response and PENDING state; Admin-only one-time review; Cloudinary failure and cleanup compensation; Event deletion/cancellation and concurrent association/deletion; and absence of the M15 public gallery route. Regression suites M2–M13 all passed sequentially: M13 **6/6**, M12 **8/8**, M11 **8/8**, M10 **19/19**, M9 **16/16**, M8 **9/9**, M7 **8/8**, M6 **11/11**, M5 **15/15**, M4 **15/15**, M3 **13/13**, M2 **7/7** (129 total). Backend non-integration tests **25/25** passed. Backend lint, root lint, frontend production build and `git diff --check` passed. Tests used disposable local databases and a fake Cloudinary adapter; no remote MongoDB or real Cloudinary operations were used.

**Learning concepts:** Review workflows, untrusted multipart input, state transitions, public/private projections, rate limiting, and compensating external-service operations.

**Completion checklist:**

- [x] Photo schema/indexes match Database Design §5.9.
- [x] All six documented M14 endpoints are implemented with the approved authorization and Wedding-scoping rules.
- [x] Organizer and guest uploads enforce the approved formats, MIME/content checks and 10 MB limits.
- [x] Guest upload implements the approved multipart shape, published-Wedding/Event checks, per-IP limit, minimal response and PENDING state.
- [x] Admin review is one-time and limited to pending GUEST photos; Manager review is denied.
- [x] Cloudinary failure, persistence compensation, deletion cleanup and cleanup logging are covered with fake-adapter tests.
- [x] Event deletion guard includes Photos; cancellation preserves historical Photo records; concurrent association/deletion behavior is tested.
- [x] M14 integration, M2–M13 regressions, backend non-integration tests, backend/root lint, frontend build and diff check pass.
- [x] Approved M14 contract clarifications are recorded in API Design §13; M15 public gallery GET remains unimplemented.

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

Every endpoint listed in API Design v1.1 is assigned below. M1–M14 are complete; M15 remains not started.

| API group | Documented endpoints | Milestone |
|---|---|---|
| Foundation | `GET /health` under `/api/v1` | M1 (complete; existing foundation endpoint preserved) |
| Auth | `GET /auth/csrf`; `POST /auth/register`; `POST /auth/login`; `POST /auth/logout`; `GET /auth/me`; `POST /auth/forgot-password`; `POST /auth/reset-password` | M3 (7 endpoints; complete) |
| Auth — Manager activation | `POST /auth/manager-activation` | M4 (Auth module endpoint; complete) |
| Wedding | `POST /weddings`; `GET /weddings/me`; `PATCH /weddings/me`; `PATCH /weddings/me/publication`; `POST /weddings/me/manager-invitation`; `POST /weddings/me/manager-invitation/resend` | M4 (complete) |
| Wedding images and Our Story | `PUT /weddings/me/cover-image`; `DELETE /weddings/me/cover-image`; `PATCH /weddings/me/our-story`; `POST /weddings/me/our-story/images`; `DELETE /weddings/me/our-story/images/:imageId` | M5 |
| Events | `POST /events`; `GET /events`; `GET /events/:eventId`; `PATCH /events/:eventId`; `PATCH /events/:eventId/status`; `DELETE /events/:eventId` | M6 (complete) |
| Tasks | `POST /tasks`; `GET /tasks`; `GET /tasks/:taskId`; `PATCH /tasks/:taskId`; `DELETE /tasks/:taskId` | M7 (complete) |
| Expenses | `POST /expenses`; `GET /expenses`; `GET /expenses/:expenseId`; `PATCH /expenses/:expenseId`; `DELETE /expenses/:expenseId` | M8 |
| Guests | `POST /guests`; `GET /guests`; `GET /guests/:guestId`; `PATCH /guests/:guestId`; `DELETE /guests/:guestId`; `POST /guests/import`; `POST /guests/:guestId/rsvp-link`; `PATCH /guests/:guestId/invitation-sharing/common`; `PATCH /guests/:guestId/invited-events/:eventId/invitation-sharing` | M9 (complete) |
| Invitations | `GET /invitations`; `POST /invitations`; `DELETE /invitations/:invitationId` | M10 (complete) |
| Family RSVP | `GET /public/rsvp/:token`; `PUT /public/rsvp/:token/events/:eventId` | M11 |
| Dashboard | `GET /dashboard/summary` | M12 |
| Announcements | `POST /announcements`; `GET /announcements`; `GET /announcements/:announcementId`; `PATCH /announcements/:announcementId`; `DELETE /announcements/:announcementId` | M13 |
| Photos | `GET /photos`; `GET /photos/:photoId`; `POST /photos`; `PATCH /photos/:photoId/review`; `DELETE /photos/:photoId`; `POST /public/weddings/:slug/photos` | M14 |
| Public website | `GET /public/weddings/:slug`; `GET /public/weddings/:slug/events`; `GET /public/weddings/:slug/announcements`; `GET /public/weddings/:slug/photos` | M15 |

The API document's request/response examples and module testing strategy remain controlling for endpoint implementation. Known unexpanded contracts for cover removal and guest upload are explicitly held for clarification above; their route assignments are retained.
