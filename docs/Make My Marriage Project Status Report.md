# Make My Marriage — Project Status Report

**Report purpose:** Central project progress record. Maintain this document after each major milestone, feature, module, significant bug fix, or technical change. Update this file in place; do not create milestone-specific status reports.

**Last updated:** 2026-11-20

## 1. Project Overview

Make My Marriage is a wedding planning and guest communication application. The approved product scope includes a private wedding dashboard for Admins and Managers, a public wedding website, and secure family-specific RSVP experiences. The approved architecture is a MERN modular monolith: one React application, one Node.js/Express application, MongoDB, and selected external services.

The current repository has completed the initial project scaffold, a frontend-only public wedding website demo, and Backend Milestones 1–14. M14 implements the Photo model, five organizer endpoints, Admin review and the public guest photo submission endpoint; all M14 verification passed. User, Wedding, Event, Task, Expense, Guest, Invitation, RSVP, Announcement and Photo models; Admin authentication; MongoDB-backed sessions; CSRF protection; password-reset flow; Wedding setup and Manager onboarding; Wedding image/Our Story, Event, Task, Expense, Guest, Invitation, Family RSVP, Dashboard Summary, Announcement and organizer Photo APIs have passed their recorded tests. Cloudinary operations in automated tests use a fake adapter; live Cloudinary credentials are not configured or tested. Nodemailer is integrated through the existing email adapter, but SMTP credentials are not configured and real email delivery has not been tested.

## 2. Technology Stack

### Implemented

- **Client:** React 19, React DOM 19, Vite 8, React Router 8, Tailwind CSS 4, ESM.
- **Server:** Node.js 24.14.1, Express 5, Mongoose 9, Helmet, dotenv, `express-session`, `connect-mongo`, bcrypt, `csrf-sync`, `express-rate-limit`, CORS, Nodemailer, CommonJS.
- **M6–M8 server additions:** Event, Task and Expense Mongoose models and wedding-scoped routes/services; no new third-party dependencies.
- **M10 server addition:** Invitation model and Admin/Manager upload, list and removal APIs; reuses the existing Cloudinary, Multer and file-type integrations.
- **M11 server addition:** RSVP model and two public family-token routes; reuses the M9 token hash, M3 rate-limiting infrastructure, and M6 Event deletion coordination.
- **M12 server addition:** Wedding-scoped Dashboard Summary endpoint calculated from existing Event, Expense, Guest, RSVP and Task collections; no Dashboard model or collection.
- **M13 server addition:** Wedding-scoped Announcement model and five Admin/Manager management endpoints, with publication state and timestamp handling; public read remains assigned to M15.
- **M14 server addition:** Photo model, five organizer endpoints, Admin-only guest-photo review, public guest submission, an approved-only public projection helper for M15, and Event deletion dependency coordination. No new dependencies were added.
- **Repository:** npm 11.18.0 workspaces (`client` and `server`) with a root `package-lock.json`.
- **Development tooling:** ESLint, React Hooks and React Refresh ESLint plugins, concurrently.
- **Client/server boundary:** Vite proxies `/api` to `http://localhost:4000`; client requests are intended to use relative `/api/v1` paths. Client environment examples contain no variables; server `.env.example` contains development settings and a local MongoDB URI without credentials.

### Planned, not yet installed or implemented

Planned feature-specific dependencies not yet installed include Zod. `csv-parse` was introduced for M9 CSV import. Later product modules remain unimplemented. Vitest and Supertest are installed as development dependencies. The presence of a dependency does not mean every later product feature is implemented.

## 3. Current Overall Status

**Overall project: In progress.**

- **Completed:** Initial scaffold; public wedding website UI using local demo data; code change for hash-based section navigation; Backend Milestones 1–14, including Photo management, review and public guest photo submission.
- **Current stage:** Backend Milestones 1–14 are complete. Milestone 15 — Public Website APIs, Integration and CI/CD — is next and NOT STARTED.
- **Pending:** M15 public website APIs and integration; private Admin/Manager dashboard UI; frontend-backend integration.
- **Blocked:** No current product work is marked blocked.

## 4. Completed Milestones

### Milestone 1 — Project Scaffolding

**Status:** Complete.

**Features implemented:**

- React/Vite client and CommonJS Express server.
- npm workspaces for `client` and `server`, with one root lockfile.
- Tailwind CSS 4, Vite `/api` development proxy, client/server environment examples, Helmet, and ESLint.
- Root scripts for development, build, lint, and future workspace tests. Backend development uses Node's built-in watch mode.

**Important files/folders:** `package.json`, `package-lock.json`, `client/`, `server/`, `eslint.config.js`, `.gitignore`.

**Dependencies introduced:** React, React DOM, Vite, `@vitejs/plugin-react`, `react-router`, Tailwind CSS and `@tailwindcss/vite`; Express, dotenv and Helmet; root ESLint tooling and concurrently.

**Verification:** At scaffold completion, development startup, production build, and lint were recorded as successful. A later combined `npm run dev` rerun during website work failed in the current environment with Node watch error `EMFILE: too many open files, watch`; see Known Issues. Later public UI and navigation lint/build runs passed.

**Remaining limitations:** No API routes, database connection, models, authentication, sessions, or product features are part of this scaffold.

### Milestone 2 — Public Wedding Website UI

**Status:** Complete as a frontend demo; API integration remains pending.

**Features implemented:**

- Reusable React components for the public wedding homepage and a dedicated family RSVP route.
- Header and responsive mobile navigation; hero and future-date countdown; optional Our Story; event selection and expandable celebration details; family RSVP information; approved-photo gallery and lightbox; guest photo-selection preview; published announcements; footer.
- Common and event-specific invitation preview modals.
- Local demo records are stored separately from components and use the documented public content shapes, including `commonInvitation` and event `invitation` fields. UI filters show published events, published announcements, and approved photographs.
- RSVP choices and selected-photo preview are local only and explicitly described as demos.

**Important files/folders:** `client/src/features/public-wedding/`, especially `PublicWeddingPage.jsx`, `components/`, `data/demoWedding.js`, and `public-wedding.css`; route definitions in `client/src/app/App.jsx`.

**Dependencies introduced:** None beyond the scaffold dependencies. Display fonts are loaded from Google Fonts; demo YouTube content uses the embedded player.

**Verification:** `npm run lint` and `npm run build` passed after implementation. The design was implemented responsively from the approved HTML, screenshot, and design tokens. Browser screenshot inspection could not be completed in the last session because the browser access host was unavailable.

**Remaining limitations:** The site uses illustrative static data. No real RSVP persistence, token validation, authentication, photo upload, approval workflow, backend request, Cloudinary, or email functionality is implemented. The family RSVP route is a visual demo, not a secure RSVP service.

### Navigation Correction — Public Website Sections

**Status:** Implemented; manually confirmed by the user.

**Issue and fix:** React Router `Link` updated the URL hash but did not perform native anchor scrolling. `PublicWeddingPage.jsx` now observes the current hash and scrolls to its matching section, including on direct hash URLs and history location changes. Responsive `scroll-margin-top` in the public website stylesheet keeps sections clear of the sticky header. Smooth scrolling respects reduced-motion preferences. Existing homepage and dedicated family RSVP routes remain in place.

**Important files:** `client/src/features/public-wedding/PublicWeddingPage.jsx` and `client/src/features/public-wedding/public-wedding.css`. No dependencies were added.

**Verification:** The user manually confirmed that website navigation works. The specific desktop/mobile split, direct-hash behavior, browser back/forward behavior, and dedicated RSVP route were not individually reported as tested. `npm run lint` and `npm run build` passed after the correction; source inspection confirmed the navigation targets match existing section IDs and the dedicated RSVP route remains defined in `App.jsx`.

### Backend Milestone 1 — Foundation

**Status:** Complete.

**Features implemented:**

- Express setup now applies Helmet and JSON parsing, mounts routes under `/api/v1`, then handles unknown routes and errors centrally.
- Preserved `GET /api/v1/health` with the documented success envelope.
- Added reusable success/error response helpers and an operational `ApiError` type. Unknown routes return the documented `NOT_FOUND` envelope; malformed JSON maps to `VALIDATION_ERROR`; unexpected errors use a generic production message and do not return stack traces.
- Express 5 async route errors flow to the centralized handler.
- Preserved the MongoDB-before-listen startup sequence. The connection helper now throws instead of exiting internally, allowing startup failure handling to remain in the server entry point.
- Added database-independent Vitest/Supertest HTTP tests. Sanitized `server/.env.example` to use a local MongoDB URI; the actual `server/.env` was not opened or modified.

**Important files/folders:** `server/src/app.js`, `server/src/server.js`, `server/src/config/`, `server/src/routes/v1.js`, `server/src/modules/health/`, `server/src/middleware/`, `server/src/shared/`, and `server/test/app.test.mjs`.

**Dependencies introduced:** Vitest 5.1.0 and Supertest 7.3.2 as server development dependencies. Mongoose was already present in the repository before this milestone.

**Verification:** `npm test` passed (6 tests); backend lint and root lint passed; `npm run build` passed. Started the server, observed successful configured MongoDB startup, and requested `/api/v1/health`, which returned HTTP 200 with the expected success envelope.

**Remaining limitations:** No business models, product APIs, authentication, sessions, or authorization were added. The development watch command previously encountered `EMFILE`; this milestone’s live check used the normal start script.

## 5. Current Development Stage

The public wedding website presentation layer is in place as a demo. Backend Milestones 1–14 are complete. M15, the private dashboard UI and frontend-backend integration remain pending. The public website remains demo-only.

## 6. Pending Milestones and Features

All pending work remains unimplemented. Backend work is tracked in [Backend Implementation Roadmap](Backend%20Implementation%20Roadmap.md).

**Backend sequence:** Milestones 1–14 — through Wedding Memories and Photo Review, including the public guest photo submission endpoint — are complete. Milestone 15 remains NOT STARTED and is next in the existing dependency-aware order defined in the roadmap.

The private Admin/Manager dashboard UI and frontend-backend integration remain pending. M4 implements the six Wedding setup/invitation/publication endpoints and Auth-module Manager activation. M5 cover-image and Our Story endpoints, M6 Event endpoints, M7–M8 Task and Expense endpoints, all nine M9 Guest endpoints, and all three M10 Invitation endpoints are implemented; later product-module APIs remain pending.

The public invitation response is documented across the existing API contracts: `GET /public/weddings/:slug` returns `commonInvitation`, and the published events response includes each event's `invitation`. Implementing and consuming these contracts is pending; no endpoint is being added by this report.

## 7. Technical Decisions and Architecture

### Confirmed decisions

- Modular monolith: one React client, one Express server, MongoDB, and external services as needed; no MVP microservices.
- Frontend uses ESM and React Router; backend uses CommonJS.
- npm workspaces remain `client` and `server`; Vite frontend requests use relative `/api/v1` paths through the development proxy.
- Express uses Helmet. Backend secrets belong only in server configuration and must not be exposed to Vite.
- Authentication uses server-side sessions and HTTP-only cookies with MongoDB-backed session storage and CSRF protection.
- Product rules include one designated Manager per wedding at a time, invited by Admin; Managers cannot self-register; Admin can replace the Manager. Family RSVP links remain independent of public-site unpublishing.
- Public content is limited to published wedding content, published events and announcements, approved gallery images, and the invited family's RSVP data on its token-protected route.

### Implementation status

The scaffold, User/Wedding/RSVP/Announcement/Photo models, M3 authentication/security, M4 Wedding ownership/role authorization, M5 Wedding image/Our Story, M6 Event, M7 Task, M8 Expense, M9 Guest, M10 Invitation, M11 Family RSVP, M12 Dashboard Summary, M13 Announcement, and all M14 organizer and guest Photo services are implemented. M15 public website APIs remain pending.

## 8. Dependencies and Integrations

### Present in the repository

Package versions and purposes are declared in the root, client, and server `package.json` files. M5 added Cloudinary `^2.11.0`, Multer `^2.5.0`, and `file-type` `^22.3.0` to support server-side image storage and validation. External resources currently used by the demo include Google Fonts, illustrative image URLs, YouTube embed content, and Google Maps links.

### Pending integrations

- Live Cloudinary verification for wedding imagery, plus future Cloudinary uploads and cleanup for invitations and guest photos. M5 automated tests use a fake adapter; actual Cloudinary credentials are not configured.
- M14 public guest photo submission is implemented per the approved API contract: multipart `image` plus optional `eventId`, 10 MB maximum, JPEG/PNG/WebP with content/MIME validation, 5 requests per 15 minutes per IP, and minimal HTTP 201 response (`data.status: PENDING`). Cloudinary compensation follows the approved existing adapter convention. Real Cloudinary operations have not been tested. Organizer photos have the same 10 MB limit.
- SMTP credentials and live delivery checks for Manager invitations and password resets; Nodemailer is wired into the shared adapter, and automated tests use an injected fake.
- Remaining public website API and frontend-backend integration.

No production credentials or live service configuration are present in the client. `server/.env.example` contains a local MongoDB URI. A random local-only `SESSION_SECRET` was added to ignored `server/.env`; its value is not recorded.

## 9. Testing and Verification Results

| Check | Result | Notes |
| --- | --- | --- |
| Scaffold development startup | Recorded successful at scaffold completion | A later combined dev rerun hit Node watch `EMFILE`; current repeatability needs rechecking. |
| Public UI `npm run lint` | Passed | After the UI implementation and subsequent navigation change. |
| Public UI `npm run build` | Passed | Vite production build completed successfully. |
| Backend `npm test --workspace server` | Passed | 25 tests across 3 files, including 6 foundation HTTP, 13 model/schema, and 6 image-validation tests. Supertest required localhost permission in the restricted environment. |
| MongoDB index integration tests | Passed | 7 tests against a newly named, isolated test database using the local connection with explicit database override. MongoDB created and returned all six approved indexes; duplicate-key/partial-index behavior and shared Manager references passed. The isolated database was dropped after the run; the configured application database was not modified. |
| M3 authentication integration tests | Passed | 13 tests against a unique disposable database: registration/login/session lifecycle, CSRF, reset-token storage and expiry, session invalidation, configured rate limits, and CORS. The database was dropped after the run. Password-reset email used an injected test adapter; no real delivery was configured. |
| Backend lint | Passed | `npm run lint --workspace=@make-my-marriage/server`. |
| Root lint | Passed | `npm run lint`. |
| Root production build | Passed | `npm run build` (client Vite production build). |
| MongoDB startup and health | Passed | Server connected before listening; `GET /api/v1/health` returned HTTP 200 with the expected JSON envelope. |
| Website navigation | Manually confirmed by user | User confirmed navigation works; exact viewport and navigation path coverage were not specified. |
| Direct section-hash navigation | Not individually confirmed | Hash handler and section IDs checked in source. |
| Browser back/forward section navigation | Not individually confirmed | Hash changes are handled through React Router location state. |
| Dedicated family RSVP route | Route/source inspected; manual confirmation not reported | Route remains `/wedding/:slug/rsvp/:token`; interface is demo-only. |
| M3 MongoDB session store | Passed | `connect-mongo` uses the existing Mongoose MongoClient and configured database; no second application connection was introduced. |
| M4 Wedding/Manager integration tests | Passed | 15 tests against a unique disposable MongoDB database; it was dropped afterward. Tests use an injected fake mailer and do not contact SMTP. |
| M5 Wedding images/Our Story MongoDB integration | Passed | 15 tests using a generated isolated local database and injected fake Cloudinary adapter; test database was dropped. No remote MongoDB or Cloudinary was contacted. |
| M6 Events MongoDB integration | Passed | 11 tests against a generated loopback-only disposable database; database dropped after testing. Verifies six endpoints, indexes, auth/CSRF, role and Wedding isolation, validation, transitions, pagination, video parsing, and soft-delete/dependency guard behavior. |
| M7 Shared Tasks MongoDB integration | Passed | 8 tests against a generated disposable database on a temporary loopback-only replica set, dropped after testing. Covers Task schema/indexes, all five endpoints, filters/order/pagination, authorization/CSRF/isolation, Event association and deletion guard, and concurrent Task association/Event deletion. |
| Image-validation unit tests | Passed | 6 tests covering signatures/content validation and Our Story fields; included in the 25-test backend run. |
| M8 Expenses MongoDB integration | Passed | 9 tests against a generated disposable database on a temporary loopback-only replica set; database dropped after testing. Covers exact schema/indexes, all five routes, paise validation, filters/order/pagination, ownership, auth/CSRF, Event reference validation, deletion guard, cancellation preservation and concurrent create/PATCH association versus Event deletion. |
| M9 Guests MongoDB integration | Passed | 16 tests passed against a generated disposable database on the local loopback replica set. Covers all nine Guest endpoints, CSV constraints/partial imports/errors/warnings/privacy, RSVP token hash/90-day expiry/regeneration/revocation, and existing Guest access controls. |
| M10 Invitations MongoDB integration | Passed | 19 tests passed against a generated disposable database on the existing local loopback replica set with fake Cloudinary. Covers all three endpoints, exact partial indexes, media validation, replacement/deletion cleanup, authorization/CSRF/isolation, Event deletion guard, and upload/deletion concurrency. |
| M11 Family RSVP MongoDB integration | Passed | 8 tests passed against a generated disposable database on the local loopback replica set; it was dropped after the run. Covers RSVP schema/indexes; valid, malformed, unknown, expired, revoked, regenerated and deleted-family tokens; separate endpoint rate limits; privacy; unpublished-site access; invited, same-Wedding and active Event rules; response create/update/idempotency/concurrency; Event deletion protection and cancellation preservation. |
| M12 Dashboard Summary MongoDB integration | Passed | 8 tests passed against a generated disposable local replica-set database, dropped after the run. Covers response fields; event and deadline boundaries in multiple Wedding timezones; integer paise totals; active family records; accepted/pending invited family-event pairs; task eligibility; authorization and Wedding isolation. |
| M13 Announcements MongoDB integration | Passed | 6 tests passed against a generated disposable local replica-set database, dropped after the run. Covers schema/index, all five management endpoints, required fields/status and protected fields, status filter/pagination/order, Wedding isolation, publication timestamps and republishing, deletion, Admin/Manager access, anonymous denial and CSRF. No public endpoint was added. |
| M14 Photo MongoDB integration | Passed | 16 tests passed against a generated disposable local replica-set database using fake Cloudinary. Covers schema and actual indexes, all six M14 endpoints, organizer and guest upload validation, Admin/Manager authorization, CSRF, Wedding isolation, per-IP rate limiting, minimal guest response/PENDING state, review rules, Event association/deletion coordination, Cloudinary failure compensation, and the approved-only projection helper. |
| Backend product API tests | Passed through M14 | M2–M14 integration suites and backend non-integration suite passed. M15 APIs remain pending. |
| M2 MongoDB index tests | Passed | Actual MongoDB index creation, options, and uniqueness enforcement were verified against an isolated test database and cleaned up afterward. |

The root `test` script runs workspace tests when present. MongoDB integration suites are opt-in, separate workspace scripts so ordinary tests do not connect to an external database. The server has six foundation tests, 13 schema tests, seven M2 database-index tests, 13 M3 auth integration tests, 15 M4 Wedding/Manager integration tests, 15 M5 Wedding images/Our Story integration tests, 11 M6 Event integration tests, 8 M7 Task integration tests, 9 M8 Expense integration tests, 16 M9 Guest integration tests, 19 M10 Invitation integration tests, 8 M11 RSVP integration tests, 8 M12 Dashboard Summary integration tests, 6 M13 Announcement integration tests, and 16 M14 Photo integration tests. M2–M14 suites use generated disposable databases and explicit loopback-only test URIs where required.

## 10. Known Issues and Limitations

- The latest combined `npm run dev` attempt hit `EMFILE` from Node's `--watch-path=src`; Vite local binding also required an elevated run in the restricted environment. This is a development-environment/startup reliability issue to recheck before relying on the combined dev command.
- The user manually confirmed that website navigation works. The detailed desktop/mobile, direct-hash, browser history, and RSVP-route test coverage has not been reported, so do not claim those individual cases were verified.
- The public site is static demo UI. RSVP changes stay in React state; photo selection creates a local preview only. Neither operation reaches a server or persists data.
- SMTP credentials are not configured, so real password-reset or Manager-invitation delivery is unverified. M4 returns an external-service error for an invitation delivery failure while retaining the committed invitation for resend. Configure server-only SMTP settings and verify delivery before relying on email in a deployed environment.
- Rate limits currently use the package's in-memory store, so counters are per Node.js process. A shared store would be needed if the backend later runs as multiple instances.
- The approved documents do not define a minimum password length or complexity rule. Validation rejects empty passwords and values over bcrypt's 72-byte input limit; no additional password policy was introduced.
- `GET /auth/csrf` has no explicit response field documented. The implementation returns the token as `data.csrfToken`, matching the documented frontend header flow; confirm this field before frontend integration if the API contract needs an exact response shape.
- Session duration, password-reset token lifetime, rate-limit windows and thresholds, bcrypt cost, CORS origin, and trusted-proxy settings are configurable. Their current defaults are implementation choices, not product policy.
- M15 public website APIs, private dashboard UI, frontend-backend integration, future upload integrations, and deployment remain pending. PRD FR-02's recent-record-updates item is deferred to a later API contract and is not returned by the current Dashboard Summary endpoint. Photo Event references are now included in the M6 Event deletion guard; Event cancellation preserves linked Photos. M5/M10/M14 Cloudinary cleanup failures are logged for manual retry; there is no queue or automated retry worker. M7–M14 transaction/concurrency and aggregation integration suites require a MongoDB replica set; the generated test databases are dropped after each suite.
- API Design §9 does not enumerate Expense response fields or the PATCH allowlist and does not specify list sort direction. M8 follows established API envelopes and module conventions, allows only editable Expense business fields, and sorts newest payment dates first with a stable `_id` tie-breaker. Confirm exact response/sort semantics in the API contract before frontend integration if consumers depend on them.
- The previously reported four moderate `minimatch` development-dependency audit findings have not been re-audited during this milestone. Installation used `--no-audit`; no audit remediation was requested.

- **npm audit advisory:** Four moderate development-dependency findings involving `minimatch` in the ESLint dependency tree were reported. `npm audit --omit=dev` returned zero vulnerabilities. Remediation was deliberately deferred; ESLint was not downgraded and dependencies were not modified.

## 11. Change History

| Date | Change |
| --- | --- |
| 2026-11-13 | Created this central Project Status Report from the approved PRD, System Architecture, Database Design, API Design, and current repository inspection. Recorded scaffold, public-site demo, navigation correction, verification status, and pending work. |
| 2026-11-13 | Updated the agreed frontend-first development sequence, recorded the user's manual navigation confirmation with test-coverage limits, and documented the npm audit findings and deferred remediation. |
| 2026-11-13 | Completed backend foundation: versioned health route, shared response/error handling, isolated HTTP tests, safe environment example, and verified MongoDB startup and health response. Added Vitest and Supertest. |
| 2026-11-13 | Added the 15-milestone Backend Implementation Roadmap, recorded Backend Milestone 1 verification and tracking fields, and marked Milestone 2 Core Persistence Models as next/not started. |
| 2026-11-14 | Corrected Manager activation assignment to Milestone 4 while retaining its Auth module ownership; confirmed Milestone 2 remains next and M12 dashboard precedes Announcements and Photos. |
| 2026-11-14 | Began Backend Milestone 2 with User and Wedding schemas and 13 schema-level tests; backend suite (19 tests), lint checks, and frontend build passed. Isolated MongoDB index-enforcement verification remains outstanding. |
| 2026-11-14 | Completed Backend Milestone 2 after 7 isolated MongoDB index tests passed; verified all six approved index definitions and duplicate-key behavior, dropped the disposable test database, and confirmed lint/build checks. |
| 2026-11-14 | Completed Backend Milestone 3 with seven auth endpoints, MongoDB-backed sessions, CSRF, password-reset token handling, rate limits, and 13 isolated integration tests; documented that real email delivery still needs a provider. |
| 2026-11-16 | Completed Backend Milestone 4 with Wedding setup, publication and Manager onboarding/activation endpoints; added Nodemailer SMTP support and 15 isolated integration tests. SMTP credentials remain unconfigured; no commit or push was made. |
| 2026-11-16 | Corrected Wedding creation to persist `managerId: null` per API Design §4.2; the integration test asserts the stored value. M4 (15), backend unit/HTTP (19), M2 index (7), M3 auth (13), lint, build and diff checks passed. |
| 2026-11-17 | Completed Backend Milestone 5 after 15 local MongoDB integration tests, 25 backend tests, lint, build and diff checks passed. Recorded the approved cover deletion contract and M5 verification; Cloudinary live credentials remain unconfigured. |
| 2026-11-17 | Completed Backend Milestone 6 with all six Event endpoints, 11 isolated local MongoDB tests, 25 backend regression tests, M5 integration regression, lint, build and diff checks. Recorded the approved required-status, reversible-transition and `HH:mm` clarifications. |
| 2026-11-17 | Completed Backend Milestone 7 with five Shared Task endpoints, 8 isolated replica-set MongoDB tests, M1–M6 regressions, lint, build and diff checks. Recorded the approved Task contracts and Event deletion concurrency coordination; no commit or push was made. |
| 2026-11-17 | Completed Backend Milestone 8 with five Expense endpoints, 9 isolated replica-set MongoDB integration tests, M2–M7 regressions, lint, build and diff checks. Added Expense Event-dependency protection and recorded API §9 response/PATCH/sort details that remain underspecified; no commit or push was made. |
| 2026-11-17 | Began M9 and verified seven Guest CRUD/sharing endpoints with 12 isolated MongoDB integration tests and M2–M8 regressions. Recorded CSV import and RSVP-link generation as pending decisions; M9 remains IN PROGRESS. |
| 2026-11-18 | Completed M9: added approved CSV import and 90-day hashed RSVP-link generation; all 16 M9 tests, M2–M8 integration regressions, 25 backend tests, lint, build and diff checks passed using disposable loopback MongoDB. |
| 2026-11-18 | Completed M10 with all three Invitation endpoints, the approved 10 MB image limit, M6 Event deletion coordination, and 19 isolated MongoDB tests; M2–M9 regressions, 25 backend tests, lint, build and diff checks passed. Cloudinary remained mocked; no commit or push was made. |
| 2026-11-18 | Completed M11 with both public Family RSVP endpoints, the §5.7 RSVP model/indexes, approved 20-per-15-minute per-IP limits, privacy and Event-deletion protections, and 8 isolated MongoDB tests. M2–M10 regressions, 25 backend tests, lint, build and diff checks passed; no commit or push was made. |
| 2026-11-18 | Completed M12 with the documented Dashboard Summary endpoint, timezone-aware event counts, family-event RSVP metrics, integer-paise expense totals and task-deadline count. M12 tests passed 8/8; M2–M11 regressions and full verification passed. Recent record updates were deferred to a later API contract; no commit or push was made. |
| 2026-11-18 | Completed M13 Announcements with five Wedding-scoped management endpoints and 6/6 local MongoDB integration tests; M2–M12 regression suites, 25 backend tests, lint, production build and diff check passed. Recorded approved publication timestamp, list-order and required-string clarifications; M14 is next. No commit or push was made. |
| 2026-11-19 | Began M14 and verified organizer Photo functionality, 11 integration tests, M2–M13 regressions, backend tests, lint, build and diff check. |
| 2026-11-20 | Completed M14: implemented all six Photo endpoints, including approved public guest submission; 16 M14 integration tests and all M2–M13 regressions passed, along with 25 backend tests, lint, production build and diff check. Recorded the approved guest upload contract. Cloudinary was tested only through a fake adapter; no remote database, real Cloudinary operation, commit or push was used. M15 is next. |

## 12. Backend Progress and Milestone Tracking

The [Backend Implementation Roadmap](Backend%20Implementation%20Roadmap.md) is the detailed plan and endpoint-to-milestone index. The status report records only actual progress; the roadmap remains planned until implementation and verification are complete.

### Backend Milestone 1 — Foundation

- **Status:** COMPLETED.
- **Start date:** Not recorded.
- **Completion date:** 2026-11-13, based on the implementation and verification record.
- **Objective:** Establish Express configuration, versioned routes, health check, shared API response conventions, centralized errors, database startup sequence, and automated HTTP tests.
- **Implementation summary:** Helmet and JSON parsing; `/api/v1` router; preserved `GET /api/v1/health`; success/error helpers; `ApiError`; not-found and centralized error middleware; Express 5 async error forwarding; startup awaits MongoDB before listening.
- **Important files:** `server/src/app.js`, `server/src/server.js`, `server/src/config/env.js`, `server/src/config/database.js`, `server/src/routes/v1.js`, `server/src/modules/health/health.routes.js`, `server/src/middleware/`, `server/src/shared/`, `server/test/app.test.mjs`, `server/package.json`, `package-lock.json`.
- **Dependencies introduced:** Vitest 5.1.0 and Supertest 7.3.2 as server development dependencies. Mongoose was already present.
- **Tests and verification:** Six backend tests passed; backend lint and root lint passed; frontend production build passed; MongoDB startup completed before the server listened; `/api/v1/health` returned HTTP 200 with the expected success envelope. Verification used elevated execution because the restricted environment denied localhost binding.
- **Outstanding issue:** Backend development watch mode previously failed with Node `EMFILE: too many open files`; it remains unresolved. Milestone 1 does not include business models, authentication, sessions, or product APIs.
- **Commit reference:** None — no commit or push was made for this milestone.

### Backend Milestone 2 — Core Persistence Models

- **Status:** COMPLETED.
- **Start date:** 2026-11-14.
- **Completion date:** 2026-11-14.
- **Objective:** Implement only the documented User and Wedding Mongoose models and indexes as defined in Database Design §§5.1–5.2.
- **Implementation summary:** Added User and Wedding schemas, documented indexes including the ordinary non-unique `managerId` index, conditional User password-hash validation, email normalization, wedding defaults, and embedded cover/Our Story validation. No routes, authentication, services, or additional models were added.
- **Files created:** `server/src/modules/auth/user.model.js`, `server/src/modules/wedding/wedding.model.js`, `server/test/models.test.mjs`.
- **Dependencies introduced:** None.
- **Tests and verification:** 13 model/schema tests, 6 existing foundation HTTP tests, and 7 MongoDB integration tests passed. MongoDB returned unique email/adminId/slug indexes; unique partial activation/reset-token indexes with `{ $type: 'string' }` filters; and ordinary non-unique managerId index. Direct MongoDB inserts confirmed duplicate-key errors, missing/null token values were allowed, duplicate non-null token values were rejected, and two weddings could reference the same Manager. Backend lint, root lint, frontend production build, and `git diff --check` passed.
- **Database safety and cleanup:** Used the URI from local `server/.env` in memory with an explicit fresh test database name distinct from the configured application database. Confirmed the selected database and checked for name collision before writes. Dropped the isolated test database after verification; the application database was not modified. No URI or credentials were logged or recorded.
- **Outstanding issues:** None for M2. No authentication, routes, services, or later milestone functionality was added.
- **Commit reference:** None — no commit or push was made.

### Backend Milestone 3 — Authentication, Sessions and Security

- **Status:** COMPLETED.
- **Start date:** 2026-11-14.
- **Completion date:** 2026-11-14.
- **Objective:** Implement the seven documented M3 authentication endpoints using Admin accounts, MongoDB-backed server sessions, CSRF protection, secure password hashing, and password-reset tokens.
- **Implementation summary:** Added Admin registration (client-supplied roles are ignored), generic login failures, authenticated `/me` and logout, session regeneration/destruction, `HttpOnly` cookies with production `Secure`, exact-origin credentialed CORS, session-bound synchronizer CSRF tokens, configurable route rate limits, SHA-256 reset-token hashes, atomic reset-token consumption, and transactional invalidation of only that user's sessions. No Manager activation or wedding APIs were added.
- **Endpoints:** `GET /api/v1/auth/csrf`; `POST /api/v1/auth/register`; `POST /api/v1/auth/login`; `POST /api/v1/auth/logout`; `GET /api/v1/auth/me`; `POST /api/v1/auth/forgot-password`; `POST /api/v1/auth/reset-password`.
- **Important files:** `server/src/config/env.js`, `server/src/config/session.js`, `server/src/middleware/cors.js`, `server/src/app.js`, `server/src/routes/v1.js`, `server/src/modules/auth/`, `server/test/auth.integration.test.mjs`, `server/package.json`, and `package-lock.json`.
- **Dependencies introduced:** Production dependencies `express-session`, `connect-mongo`, `bcrypt`, `csrf-sync`, `express-rate-limit`, and `cors`. No new test dependency was added.
- **Tests and verification:** 13 M3 integration tests passed, including CSRF lifecycle/rejection, session regeneration/logout, generic auth errors, reset-token hashing/expiry/single-use, password replacement, targeted session invalidation, route rate limits, and CORS. The existing 19 M1/M2 tests and 7 M2 MongoDB index tests passed. Backend lint, root lint, frontend build, and `git diff --check` passed.
- **Database safety and cleanup:** M3 tests used a unique test database distinct from the configured development database, confirmed the selected database and checked for name collisions before writes, then dropped only the test database. The application database was not modified. A local-only random session secret was generated in ignored `server/.env`; its value is not recorded.
- **Email limitation:** No email provider or credentials are configured. The tested adapter boundary passes the raw token only to an injected adapter. The default adapter is unconfigured, sends nothing, and the service avoids persisting an unusable token. Real reset email requires a provider adapter and server-only configuration.
- **Implementation defaults (configurable, not product policy):** bcrypt cost 12; session lifetime 7 days; reset-token lifetime 1 hour; rate-limit window 15 minutes with limits registration 5, login 10, forgot password 5, reset password 10; `SameSite=Lax`; development CORS origin `http://localhost:5173`. Production requires `FRONTEND_ORIGIN`; set `TRUST_PROXY` when behind a trusted TLS-terminating proxy.
- **Outstanding issues:** Confirm the undocumented `GET /auth/csrf` response field before frontend integration; no password minimum/complexity requirement is defined; configure real email delivery before relying on password resets; a shared rate-limit store will be needed if horizontally scaling.
- **Commit reference:** None — no commit or push was made.

### Backend Milestone 4 — Wedding Setup and Manager Onboarding

- **Status:** COMPLETED.
- **Start date:** 2026-11-16.
- **Completion date:** 2026-11-16.
- **Objective:** Implement Admin-owned Wedding creation and management, publication control, first Manager invitation/resend, and Auth-module Manager activation.
- **Implementation summary:** Added Admin/Manager role authorization and Wedding resolution from authenticated session identity. Admin can create one Wedding with `managerId: null` explicitly persisted as required by API Design §4.2, retrieve their or their assigned Manager's Wedding, update only documented fields, and publish/unpublish without optional content prerequisites. First invitation creates an `INVITED` Manager and assigns the account inside a MongoDB transaction before email delivery. Resend reuses that account and replaces the token. Activation validates a single-use expiring token, sets a password/status/activation timestamp, clears activation fields, and establishes a regenerated session. Email failure after invitation commit returns `EXTERNAL_SERVICE_ERROR` while preserving the invitation for resend. Unpublishing sets `publishedAt` to `null`; RSVP token data is not touched. Manager replacement remains out of M4.
- **Endpoints:** `POST /api/v1/weddings`; `GET /api/v1/weddings/me`; `PATCH /api/v1/weddings/me`; `PATCH /api/v1/weddings/me/publication`; `POST /api/v1/weddings/me/manager-invitation`; `POST /api/v1/weddings/me/manager-invitation/resend`; `POST /api/v1/auth/manager-activation`.
- **Important files created:** `server/src/middleware/csrf-protection.js`, `server/src/middleware/rate-limiter.js`, `server/src/modules/wedding/wedding.routes.js`, `server/src/modules/wedding/wedding.controller.js`, `server/src/modules/wedding/wedding.service.js`, `server/src/modules/wedding/wedding.validation.js`, `server/test/wedding.integration.test.mjs`.
- **Important files modified:** `server/src/config/env.js`, `server/src/modules/auth/auth.controller.js`, `server/src/modules/auth/auth.middleware.js`, `server/src/modules/auth/auth.routes.js`, `server/src/modules/auth/auth.service.js`, `server/src/modules/auth/auth.validation.js`, `server/src/modules/auth/email.adapter.js`, `server/src/routes/v1.js`, `server/package.json`, `server/.env.example`, `package-lock.json`, this report, and the Backend Implementation Roadmap.
- **Dependencies introduced:** Nodemailer `^10.6.0` as a server production dependency for SMTP delivery through the shared email adapter. No test dependency was added.
- **Configuration:** `MANAGER_ACTIVATION_TOKEN_TTL_MS` defaults to 86,400,000 ms (24 hours). Manager invitation, resend, and activation limits are configurable and use the existing 15-minute in-memory rate-limit approach. SMTP requires server-only `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`; `FRONTEND_ORIGIN` supplies the existing `activate-manager/:token` link origin. The example file contains blank SMTP values only.
- **Tests and verification:** M4 integration suite passed (15 tests) against a unique disposable database, which was dropped. The creation test reads the stored Wedding document and asserts `managerId` is exactly `null`; the API response continues to expose `manager: null` without ownership IDs. Tests also covered authorization, ownership scoping, uniqueness, protected fields, publication/unpublication and RSVP-token preservation, invitation transaction ordering, existing-account rejection, email failure persistence, resend/token replacement, activation and session regeneration, invalid/expired/reused tokens, CSRF, response safety and rate limits. Reverification after the explicit-null correction: M4 integration 15 passed; M1–M3 backend unit/HTTP 19 passed, M2 MongoDB index integration 7 passed, and M3 authentication integration 13 passed. Backend lint, root lint, frontend production build and `git diff --check` passed.
- **Email limitation:** Automated tests use an injected fake adapter; they never contacted SMTP. No SMTP credentials were configured, so real email delivery has not been tested. The invitation link is created from `FRONTEND_ORIGIN`; SMTP must be configured server-side before delivery can work.
- **Outstanding issues:** Frontend Manager activation and Wedding setup integration remain pending. Later product APIs remain unimplemented. M3 rate limits use an in-memory store and are per process.
- **Git state:** The working tree was clean at M4 start. M4 source, package, environment-example and documentation changes are now uncommitted; no commit or push was made.
- **Commit reference:** None — not committed.

### Backend Milestone 5 — Wedding Images and Our Story

- **Status:** COMPLETED.
- **Start date:** 2026-11-17.
- **Completion date:** 2026-11-17, after local MongoDB integration verification.
- **Objective:** Implement the existing cover-image and Our Story APIs using the approved Wedding schema, with secure upload validation and Cloudinary coordination.
- **Implementation summary:** Implemented cover upload/replacement/deletion, Our Story description update, upload of up to two supporting images, and embedded image deletion. Uploads are limited to JPEG, PNG and WebP with a 10 MB cap and signature validation. Admin authentication, Wedding ownership, and CSRF checks run before multipart parsing. The two-image limit uses an atomic MongoDB condition. Cover removal is idempotent, returns `coverImage: null`, and removes the database reference before Cloudinary deletion. Cleanup failures are recorded in structured logs for manual retry. Public responses omit Cloudinary public IDs. No schema, index, endpoint, collection, queue, or worker was added.
- **Endpoints:** `PUT /api/v1/weddings/me/cover-image`; `DELETE /api/v1/weddings/me/cover-image`; `PATCH /api/v1/weddings/me/our-story`; `POST /api/v1/weddings/me/our-story/images`; `DELETE /api/v1/weddings/me/our-story/images/:imageId`.
- **Important files created:** `server/src/middleware/image-upload.js`, `server/src/modules/wedding/image.validation.js`, `server/src/shared/storage/cloudinary.adapter.js`, `server/test/image-validation.test.mjs`, `server/test/wedding-images.integration.test.mjs`.
- **Important files modified:** `server/src/config/env.js`, `server/src/modules/wedding/wedding.controller.js`, `server/src/modules/wedding/wedding.routes.js`, `server/src/modules/wedding/wedding.service.js`, `server/.env.example`, `server/package.json`, `package-lock.json`, `docs/Make My Marriage api.md`, `docs/Backend Implementation Roadmap.md`, and this report.
- **Dependencies introduced:** Cloudinary `^2.11.0`, Multer `^2.5.0`, and `file-type` `^22.3.0`. No new test dependency was added.
- **Configuration:** Server `.env.example` names `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` without values. Real credentials are required only to exercise actual Cloudinary operations; automated tests use an injected fake adapter. The real `.env` was not read or changed.
- **Tests and verification:** M5 MongoDB integration suite passed (15/15) against a generated disposable database on local MongoDB at `127.0.0.1:27017`; it was dropped after testing. Fake Cloudinary adapter prevented external uploads/deletions. Backend non-integration suite passed (25/25 across 3 files, including six image-validation unit tests). Server lint, root lint, frontend production build, and `git diff --check` passed. Initial test-only failures were corrected and the full M5 integration suite passed on rerun.
- **Limitations:** Live Cloudinary integration is untested because real credentials were not configured. Failed asset cleanup requires manual retry from structured logs; there is no persistent retry queue or worker. Guest photo uploads remain outside M5.
- **Git state:** Changes remain uncommitted; no commit or push was made.
- **Commit reference:** None — not committed.

### Backend Milestone 6 — Events and YouTube Metadata

- **Status:** COMPLETED.
- **Start date:** 2026-11-17.
- **Completion date:** 2026-11-17, after the local MongoDB integration suite and required regressions/checks passed.
- **Objective:** Implement wedding-scoped Event CRUD, listing, status, menu, Maps, YouTube, and lifecycle behavior using the approved Event schema.
- **Implementation summary:** Added the Event model with the documented fields and three indexes. Implemented all six endpoints under `/api/v1/events`; Admin and Manager access is session-authenticated, CSRF-protected for mutations, and scoped to the Wedding resolved from the authenticated user. `weddingId`, `createdBy`, and `updatedBy` are server-controlled. List filters support status, name search and event date with page/limit pagination (maximum 100). Input validation covers real `YYYY-MM-DD` dates, approved 24-hour `HH:mm` times, embedded menu shape, Google Maps URL, and YouTube URL/type; video IDs are derived on the server and client-supplied IDs are rejected. Any transition among the approved statuses is allowed. Events are soft-deleted via `deletedAt`; an injectable dependency-check list blocks deletion and recommends cancellation when linked records are reported.
- **Approved contract clarifications recorded:** Event creation requires explicit `status` with no default; statuses are `UPCOMING`, `COMPLETED`, and `CANCELLED`, with transitions allowed in either direction; event times use `HH:mm`. These clarifications are recorded in API Design §§2.8 and 7 and in the M6 roadmap notes.
- **Endpoints:** `POST /api/v1/events`; `GET /api/v1/events`; `GET /api/v1/events/:eventId`; `PATCH /api/v1/events/:eventId`; `PATCH /api/v1/events/:eventId/status`; `DELETE /api/v1/events/:eventId`.
- **Important files created:** `server/src/modules/events/event.model.js`, `event.routes.js`, `event.controller.js`, `event.service.js`, `event.validation.js`, `server/test/events.integration.test.mjs`.
- **Important files modified:** `server/src/routes/v1.js`, `server/src/shared/http/responses.js`, `server/package.json`, `docs/Make My Marriage api.md`, `docs/Backend Implementation Roadmap.md`, and this report.
- **Dependencies introduced:** None.
- **Tests and verification:** M6 integration suite passed (11/11) using `M6_TEST_MONGO_URI=mongodb://127.0.0.1:27017` and a generated disposable database, dropped after tests. Tests verify all six routes, required fields/status, time/date values, menus/Maps/YouTube, server-generated ownership, list filters/pagination, updates/video removal, reversible status transitions, Admin/Manager/anonymous and CSRF behavior, cross-Wedding isolation, invalid IDs, soft deletion, injected dependency-blocked deletion, and actual presence of the three documented Event indexes. Backend regression suite passed (25/25); M5 image integration regression passed (15/15). Server lint, root lint, frontend production build, and `git diff --check` passed.
- **Lifecycle limitation:** No Task, Expense, Guest, RSVP, Invitation or Photo model existed before M6, so there were no real dependent product records to query. The dependency-check interface was extended by M7 for Tasks; M8–M14 must register their Event dependencies, and M15 must verify all linked record types together. At M6 verification time, M2–M4 opt-in suites were not rerun because their harnesses read `.env`; they were rerun in M7 after adding explicit loopback-only URI overrides.
- **Git state:** M6 and existing M5 changes remain uncommitted; no commit or push was made.
- **Commit reference:** None — not committed.

### Backend Milestone 7 — Shared Tasks

- **Status:** COMPLETED.
- **Start date:** 2026-11-17.
- **Completion date:** 2026-11-17, after isolated local MongoDB integration, M1–M6 regressions, lint, frontend build, and diff checks passed.
- **Objective:** Implement the shared Admin/Manager Task list and optional same-Wedding Event relationship.
- **Implementation summary:** Added the documented Task model and exactly two indexes. Implemented create, list, read, partial update, and hard delete. Validated required title/deadline/status/priority; deadlines require complete ISO 8601 date-times with an explicit timezone, while past deadlines remain allowed. List filters are status, priority, eventId, page and limit; results sort by deadline ascending and `_id` ascending. PATCH allows only title, description, eventId, deadline, priority and status; empty description clears text and `eventId: null` removes the relationship. No task assignment, `deletedAt`, defaults, extra schema fields, indexes, or dependencies were added.
- **Endpoints:** `POST /api/v1/tasks`; `GET /api/v1/tasks`; `GET /api/v1/tasks/:taskId`; `PATCH /api/v1/tasks/:taskId`; `DELETE /api/v1/tasks/:taskId`.
- **Authorization and integrity:** Admin and Manager share their Wedding's Task data. All operations resolve Wedding from authenticated identity; `weddingId`, `createdBy`, and `updatedBy` are server-controlled. Mutations require existing CSRF protection. Event references must be valid, active, and in the same Wedding. Cancelled Events remain valid associations; soft-deleted Events are rejected. Hard-deleted Tasks no longer block Event deletion.
- **Event deletion guard and concurrency:** The default M6 Event service now checks for Tasks by both `weddingId` and `eventId`; linked Tasks cause the existing conflict response, and cancellation preserves the Task. When a Task create/update adds an Event reference, a MongoDB transaction touches the existing Event `updatedAt` monotonically and writes the Task, coordinating with M6's Event `updatedAt` compare-and-set deletion. The common-document write is required because a transaction alone would not prevent the race. No extra field/index or lock service was introduced. Event `updatedAt` therefore advances when a Task association is added or changed. This transactional test setup requires a replica set.
- **Important files created:** `server/src/modules/tasks/task.model.js`, `task.validation.js`, `task.service.js`, `task.controller.js`, `task.routes.js`, `server/test/tasks.integration.test.mjs`.
- **Important files modified:** `server/src/routes/v1.js`, `server/package.json`, M2–M4 integration-test harnesses to allow safe explicit loopback URI overrides, `docs/Make My Marriage api.md`, `docs/Backend Implementation Roadmap.md`, and this report.
- **Dependencies introduced:** None.
- **Testing and verification:** M7 integration suite **8/8** against a generated disposable database on temporary local replica set `127.0.0.1:27018`; database dropped afterward. M2 indexes **7/7**; M3 authentication **13/13**; M4 Wedding/Manager **15/15**; M5 images/Our Story **15/15**; M6 Events **11/11**; backend non-integration regression **25/25**. Server lint, root lint, frontend production build, and `git diff --check` passed. Older M2–M4 suites were run with explicit test-only loopback URI overrides that bypass reading `.env`; no remote MongoDB, `.env` credentials, SMTP, or Cloudinary was used.
- **Limitations:** The normal MongoDB instance on port 27017 is standalone and cannot run transaction tests. M7 integration tests require a local replica set; a separate temporary loopback-only replica set was started for verification and has been stopped. No real external integrations were exercised.
- **Git state:** M7 changes are uncommitted; no commit or push was made.
- **Commit reference:** None — not committed.

### Backend Milestone 8 — Actual Expenses

- **Status:** COMPLETED.
- **Start date:** 2026-11-17.
- **Completion date:** 2026-11-17, after isolated local MongoDB integration, M2–M7 regressions, lint, frontend build, and diff checks passed.
- **Objective:** Implement the documented actual-expense tracker, scoped to a Wedding and storing money as integer paise.
- **Implementation summary:** Added the Expense model with the exact §5.5 schema and three documented indexes. Implemented create/list/read/partial update/hard delete, supported category filters, optional Event filter, inclusive date-range filters, pagination, and stable newest-payment-date ordering. Amount validation requires a safe positive integer; the API receives/returns integer paise without rupee conversion. PATCH accepts editable business fields; ownership, creator/updater, IDs and timestamps are not client-editable. No budget, limit, forecast or budget-versus-actual behavior was added.
- **Endpoints:** `POST /api/v1/expenses`; `GET /api/v1/expenses`; `GET /api/v1/expenses/:expenseId`; `PATCH /api/v1/expenses/:expenseId`; `DELETE /api/v1/expenses/:expenseId`.
- **Important files created:** `server/src/modules/expenses/expense.model.js`, `expense.validation.js`, `expense.service.js`, `expense.controller.js`, `expense.routes.js`, and `server/test/expenses.integration.test.mjs`.
- **Important files modified:** `server/src/routes/v1.js`, `server/package.json`, `docs/Backend Implementation Roadmap.md`, and this report. Existing M2–M7 code and documentation history were preserved.
- **Dependencies introduced:** None.
- **Authorization and data integrity:** Existing session authentication, Admin/Manager role authorization and CSRF middleware are reused. Each query is scoped through the authenticated user's Wedding; `weddingId`, `createdBy`, and `updatedBy` are server-derived. Event references must identify a non-deleted Event in the same Wedding; cancelled Events remain associated and retain financial history. M6 Event deletion now also checks for linked Expenses. Adding an Event association during Expense creation or PATCH uses a MongoDB transaction and monotonically touches the existing Event `updatedAt`, the same M7 shared-document coordination used against M6's compare-and-set Event deletion. Tests confirm deletion and association do not both succeed in a state that leaves a successful Expense linked to a deleted Event.
- **Tests and verification:** M8 integration **9/9**; M7 Tasks **8/8**; M6 Events **11/11**; M5 images/Our Story **15/15**; M4 Wedding/Manager **15/15**; M3 auth **13/13**; M2 indexes **7/7**; backend non-integration tests **25/25**. Integration tests used separate generated disposable databases on a temporary replica set bound only to `127.0.0.1:27018`; each database was dropped after testing. Backend lint, root lint, frontend production build, and `git diff --check` passed. No remote MongoDB, real `.env` values, Cloudinary or SMTP was used.
- **Outstanding API-contract detail:** API Design §9 does not list endpoint response object fields or enumerate PATCH's permitted fields, and it gives no list sort direction. M8 follows standard envelopes and neighboring module conventions: business fields only for PATCH, and `paymentDate` descending with `_id` descending as stable tie-breaker. The API Design was not edited because no clarification was approved in this task; record this gap before frontend consumers rely on exact sort/response details.
- **Git state:** M8 changes remain uncommitted; no commit or push was made.
- **Commit reference:** None — not committed.

### Backend Milestone 9 — Family Guests, CSV and Sharing

- **Status:** COMPLETED.
- **Start date:** 2026-11-17.
- **Completion date:** 2026-11-18.
- **Objective:** Implement family-based Guest management, invitation-sharing state, CSV import and family RSVP-link generation.
- **Implemented scope:** Exact Guest schema/indexes; create/list/read/update/delete; search, Event and common invitation-status filters; pagination; formatting-only mobile normalization and duplicate-mobile warnings; same-Wedding invited-Event validation; invitation-sharing state; history-aware hard/soft deletion and RSVP revocation; CSV import with 2 MiB and 500-row limits, partial valid-row import, row-level non-sensitive errors and duplicate warnings; RSVP URL generation using 32 random bytes with SHA-256 hash storage and a 90-day expiry. No public RSVP APIs or messaging delivery were added.
- **Implemented endpoints:** All nine documented Guest operations: `POST /api/v1/guests`; `GET /api/v1/guests`; `GET /api/v1/guests/:guestId`; `PATCH /api/v1/guests/:guestId`; `DELETE /api/v1/guests/:guestId`; `POST /api/v1/guests/import`; `POST /api/v1/guests/:guestId/rsvp-link`; `PATCH /api/v1/guests/:guestId/invitation-sharing/common`; `PATCH /api/v1/guests/:guestId/invited-events/:eventId/invitation-sharing`.
- **Important files created:** `server/src/modules/guests/csv-import.service.js`, `csv-upload.middleware.js`, and `server/test/guests.integration.test.mjs` (extended for M9 operational endpoints and cases).
- **Important files modified:** `server/src/modules/guests/guest.service.js`, `guest.controller.js`, `guest.routes.js`, `server/package.json`, root `package-lock.json`, `docs/Make My Marriage api.md`, `docs/Backend Implementation Roadmap.md`, and this report.
- **Dependencies introduced:** `csv-parse` for CSV parsing.
- **Authorization and data integrity:** Existing session authentication, Admin/Manager authorization, CSRF, response envelopes and centralized error handling are reused. Guest reads and writes are Wedding-scoped; ownership and audit fields are server-derived. Ordinary Guest responses omit RSVP token hashes and access metadata. New Guest/Event associations are written in MongoDB transactions and coordinate through the Event's existing `updatedAt` document with M6 deletion, using the M7/M8 strategy. Event deletion is blocked while any Guest retains an invited-event reference.
- **Git state:** M9 changes remain uncommitted; no commit or push was made. Pre-existing uncommitted M2–M8 changes remain in the working tree.
- **Commit reference:** None — not committed.
- **Tests and verification:** M9 integration **16/16** passed against a generated disposable database on a temporary loopback-only replica set; database dropped after testing. Covers all nine endpoints, CSV validation/limits/partial imports/duplicate warnings/privacy, RSVP token hashing/90-day expiry/regeneration/revocation, and existing schema, authorization, CSRF, Wedding isolation and Event-dependency behavior. Regression suites passed: M8 **9/9**, M7 **8/8**, M6 **11/11**, M5 **15/15**, M4 **15/15**, M3 **13/13**, M2 **7/7**, backend non-integration **25/25**. Backend lint, root lint, frontend production build and `git diff --check` passed. A sandbox-only `EPERM` on loopback was resolved by running the tests with permission for local-only access to the disposable test replica set; no remote MongoDB or real Cloudinary operations were used.
- **Remaining limitations:** At M9 completion, API Design §10.3 still left search fields, `invitationStatus` interpretation, response field details and duplicate-warning placement unclear; current behavior follows the already-recorded implementation conventions. M11 public RSVP endpoints were pending at that milestone and were completed in the subsequent M11 record. Cloudinary and SMTP remain untested with real credentials.
- **Git state:** Changes remain uncommitted; no commit or push was made. Existing M2–M8 worktree changes were preserved.
- **Commit reference:** None — not committed.
- **Git state:** M9 changes remain uncommitted; no commit or push was made. Pre-existing uncommitted M2–M8 changes remain in the working tree.
- **Commit reference:** None — not committed.

### Backend Milestone 10 — Invitation Cards

- **Status:** COMPLETED.
- **Start date:** 2026-11-18.
- **Completion date:** 2026-11-18.
- **Objective:** Upload, list, replace and remove one COMMON card per Wedding or one EVENT card per Event.
- **Implemented scope:** Added the exact Invitation schema fields and two Database Design §5.8 partial unique indexes; Admin/Manager upload, list and delete; COMMON cards omit/null the Event association, while EVENT cards require a valid active same-Wedding Event. JPEG, PNG and WebP are checked by signature and MIME; the user approved a 10 MB per-image maximum, now recorded in API Design §17. Image bytes are sent to Cloudinary; only documented metadata is stored in MongoDB. Replacement updates the same Invitation record and deletes the previous asset only after persistence. Failed persistence triggers best-effort cleanup of the new asset. Deletion removes the database reference first; cleanup failures are logged for manual retry. No invitation designer, family-personalized cards, WhatsApp sending, or new collection/index was added.
- **Endpoints:** `GET /api/v1/invitations`; `POST /api/v1/invitations`; `DELETE /api/v1/invitations/:invitationId`.
- **Important files created:** `server/src/modules/invitations/invitation.model.js`, `invitation.routes.js`, `invitation.controller.js`, `invitation.service.js`, `invitation.validation.js`, and `server/test/invitations.integration.test.mjs`.
- **Important files modified:** `server/src/routes/v1.js`, `server/package.json`, `docs/Make My Marriage api.md`, `docs/Backend Implementation Roadmap.md`, and this report. Shared M5 upload, file-validation and Cloudinary adapter code was reused; no dependency or lockfile change was required.
- **Security and data integrity:** Existing session authentication, Admin/Manager role checks, CSRF and Wedding scoping are used. Client ownership is never trusted. Cloudinary public IDs are omitted from response objects. EVENT association writes reuse the M7–M9 transactional Event `updatedAt` coordination with M6 deletion; linked invitations prevent Event deletion, while cancellation preserves the Invitation.
- **Tests and verification:** M10 integration **19/19**; M9 **16/16**; M8 **9/9**; M7 **8/8**; M6 **11/11**; M5 **15/15**; M4 **15/15**; M3 **13/13**; M2 **7/7**. Backend non-integration tests **25/25**; backend lint, root lint, frontend production build and `git diff --check` passed. Generated disposable local MongoDB databases were used; Cloudinary was mocked. No remote MongoDB or real Cloudinary credentials/assets were used.
- **Remaining limitations:** Live Cloudinary upload/deletion is unverified; configure server-side credentials before testing real provider operations. Failed Cloudinary cleanup requires manual retry from structured logs; no retry worker exists. Response field details for Invitation management are not explicitly enumerated in API Design §11; implementation uses the standard envelope and omits Cloudinary management IDs.
- **Git state:** Work remains uncommitted; no commit or push was made. Existing M2–M9 worktree changes were preserved.
- **Commit reference:** None — not committed.

### Backend Milestone 11 — Family RSVP

- **Status:** COMPLETED.
- **Start date:** 2026-11-18.
- **Completion date:** 2026-11-18.
- **Objective:** Let families view only their invited Events and submit or update one YES/NO response per invited Event through the secure M9 token.
- **Implemented scope:** Added the documented RSVP fields and indexes; implemented `GET /api/v1/public/rsvp/:token` and `PUT /api/v1/public/rsvp/:token/events/:eventId`; reads only active invited Events and that family's existing responses, excluding cancelled/deleted Events; creates and updates one response with a stable `respondedAt` for repeated identical responses. The endpoints work while the website is unpublished and do not require an organizer session or CSRF token.
- **Important files created:** `server/src/modules/rsvp/rsvp.model.js`, `rsvp.routes.js`, `rsvp.controller.js`, `rsvp.service.js`, `rsvp.validation.js`, and `server/test/rsvp.integration.test.mjs`.
- **Important files modified:** `server/src/config/env.js`, `server/src/middleware/rate-limiter.js`, `server/src/routes/v1.js`, `server/src/modules/guests/guest.service.js`, `server/package.json`, `docs/Make My Marriage api.md`, `docs/Backend Implementation Roadmap.md`, and this report.
- **Dependencies introduced:** None.
- **Security and data integrity:** M9's SHA-256 hash and 32-byte base64url token design is reused. Invalid, malformed, expired, revoked, regenerated, and deleted-family tokens return a consistent `404 TOKEN_INVALID`; raw tokens and hashes are not returned or logged. Each endpoint has a separate per-IP limit approved by the user at 20 requests per 15 minutes. Public responses set `Referrer-Policy: no-referrer` and use explicit field projections. Event references are same-Wedding, active, and invitation-scoped. RSVP writes coordinate through the existing Event `updatedAt` transaction strategy and the unique compound index. RSVP dependencies now prevent Event deletion, and cancellation preserves RSVP history. M9 Guest deletion was moved into a transaction so a concurrent RSVP write cannot race with Guest hard deletion.
- **Tests and verification:** M11 MongoDB integration **8/8** passed on the local loopback replica set with a generated disposable database, dropped after the run. Coverage includes indexes, token validity/expiry/revocation/regeneration/deletion, rate limits on both routes, privacy, unpublished-site access, event membership and same-Wedding/status checks, anonymous bearer access, YES/NO create/update/idempotency, concurrent submission, Event deletion guard, and cancellation preservation. Regression results: M10 **19/19**, M9 **16/16**, M8 **9/9**, M7 **8/8**, M6 **11/11**, M5 **15/15**, M4 **15/15**, M3 **13/13**, M2 **7/7**; backend non-integration **25/25**. Backend lint, root lint, frontend production build, and `git diff --check` passed. Local database connections required permission for loopback access; no remote database or external service was used.
- **Outstanding issues:** The rate limiter uses the existing in-memory store, so limits are per server process. The separate rate-limit window and per-endpoint maximums are configurable server-side. The public website UI remains demo-only and is not integrated with these endpoints.
- **Git state:** Changes remain uncommitted; no commit or push was made. Existing uncommitted M2–M10 changes were preserved.
- **Commit reference:** None — not committed.

### Backend Milestone 12 — Dashboard Summary

- **Status:** COMPLETED.
- **Start date:** 2026-11-18.
- **Completion date:** 2026-11-18.
- **Objective:** Calculate and return Wedding-scoped dashboard totals from existing collections without a Dashboard model or collection.
- **Endpoint:** `GET /api/v1/dashboard/summary`.
- **Implemented response fields:** `totalEvents`, `upcomingEvents`, `totalExpensesPaise`, `totalFamilies`, `acceptedRsvps`, `pendingRsvps`, and `upcomingTasks` within the established success envelope. PRD FR-02 recent record updates are deferred to a later API contract and are not returned.
- **Calculation behavior:** Total Events includes all non-deleted statuses; upcoming Events must have status `UPCOMING` and event date/time at or after the current instant in the Wedding timezone. Expense totals sum actual `amountPaise` values. Family totals count active Guest records. Accepted and pending RSVP counts use currently invited, active family–Event pairs; YES is accepted, no response is pending, NO is neither, and deleted Guests or deleted/CANCELLED Events are excluded. Duplicate invited-event references count once. Upcoming task count includes `TODO` and `IN_PROGRESS` deadlines at or after the current instant; Tasks linked to deleted, CANCELLED, or cross-Wedding Events are excluded. No task list, limit or ordering is returned.
- **Important files created:** `server/src/modules/dashboard/dashboard.routes.js`, `dashboard.controller.js`, `dashboard.service.js`, and `server/test/dashboard.integration.test.mjs`.
- **Important files modified:** `server/src/routes/v1.js`, `server/package.json`, `docs/Make My Marriage api.md` (approved calculation clarifications), `docs/Backend Implementation Roadmap.md`, and this report.
- **Dependencies introduced:** None. No Dashboard model/collection or cache was added.
- **Security and data integrity:** Existing session authentication and Admin/Manager role middleware are reused. Wedding ownership is resolved from the authenticated user; all data operations are Wedding-scoped, and query-string Wedding IDs do not alter context. Only aggregate values are returned; family contacts and token data are not projected.
- **Tests and verification:** M12 integration **8/8** passed against a generated disposable database on the local loopback replica set, dropped after testing. Coverage includes empty collections, exact response keys, all aggregate definitions, timezone and boundary checks in Asia/Kolkata and America/Los_Angeles, integer paise, family/Event/RSVP eligibility, duplicate invitation references, Task deadlines/status/Event eligibility, Admin/Manager access, invalid-role and anonymous denial, Wedding isolation, and private-data exclusion. Regression integrations passed: M11 **8/8**, M10 **19/19**, M9 **16/16**, M8 **9/9**, M7 **8/8**, M6 **11/11**, M5 **15/15**, M4 **15/15**, M3 **13/13**, M2 **7/7**. Backend non-integration **25/25**, backend lint, root lint, frontend production build, and `git diff --check` passed. M9/M10 suites initially failed when several database suites ran concurrently; local replica-set health was confirmed and both suites passed when rerun sequentially. No remote MongoDB or external service was used.
- **Outstanding issues:** Recent record updates are deferred to a later API contract. The existing rate-limit/session infrastructure remains process-local where applicable; M12 adds no caching or background processing.
- **Git state:** Changes remain uncommitted; no commit or push was made. Existing M1–M11 worktree changes were preserved.
- **Commit reference:** None — not committed.

### Backend Milestone 13 — Announcements

- **Status:** COMPLETED.
- **Start date:** 2026-11-18.
- **Completion date:** 2026-11-18.
- **Objective:** Provide Wedding-scoped announcement management with controlled draft and publication state.
- **Endpoints:** `POST /api/v1/announcements`, `GET /api/v1/announcements`, `GET /api/v1/announcements/:announcementId`, `PATCH /api/v1/announcements/:announcementId`, and `DELETE /api/v1/announcements/:announcementId`.
- **Implemented scope:** Added the documented Announcement schema and compound index; implemented CRUD, status filtering, pagination, server-derived `weddingId`/`createdBy`/`updatedBy`, Admin/Manager access, and DRAFT/PUBLISHED timestamp handling. The public announcements endpoint remains assigned to M15 and was not implemented here.
- **Important files created:** `server/src/modules/announcements/announcement.model.js`, `announcement.routes.js`, `announcement.controller.js`, `announcement.service.js`, `announcement.validation.js`, and `server/test/announcements.integration.test.mjs`.
- **Important files modified:** `server/src/routes/v1.js`, `server/package.json`, `docs/Make My Marriage api.md`, `docs/Backend Implementation Roadmap.md`, and this report.
- **Dependencies introduced:** None.
- **Security and data integrity:** All queries are Wedding-scoped using authenticated ownership; only Admin/Manager roles may use these routes; write routes require CSRF; client-supplied ownership and audit fields are rejected; list results omit Wedding IDs; no DRAFT content is exposed publicly by M13.
- **Approved behavior recorded:** Publishing sets `publishedAt`; unpublishing removes it; edits while remaining PUBLISHED preserve the timestamp; republishing sets a new timestamp. Management lists sort by `updatedAt` descending then `_id` descending. Required title/description strings have no undocumented maximum lengths.
- **Tests and verification:** M13 local MongoDB integration **6/6** passed on the loopback replica set with a generated disposable database, dropped after the run. Regression integrations passed sequentially: M12 **8/8**, M11 **8/8**, M10 **19/19**, M9 **16/16**, M8 **9/9**, M7 **8/8**, M6 **11/11**, M5 **15/15**, M4 **15/15**, M3 **13/13**, M2 **7/7**. Backend non-integration **25/25**, backend lint, root lint, frontend production build, and `git diff --check` passed. No remote MongoDB or external service was used.
- **Outstanding issues:** No M13-specific blockers. Public announcement projection is still pending M15.
- **Git state:** Changes remain uncommitted; no commit or push was made. Earlier uncommitted work was preserved.
- **Commit reference:** None — not committed.

### Backend Milestone 14 — Wedding Memories and Photo Review

- **Status:** COMPLETED.
- **Start date:** 2026-11-19.
- **Completion date:** 2026-11-20.
- **Objective:** Implement Photo storage, organizer management, Admin review, Cloudinary coordination and guest submission without exposing unapproved photos.
- **Implemented endpoints:** `GET /api/v1/photos`, `GET /api/v1/photos/:photoId`, `POST /api/v1/photos`, `PATCH /api/v1/photos/:photoId/review`, `DELETE /api/v1/photos/:photoId`, and `POST /api/v1/public/weddings/:slug/photos`. The public approved gallery GET remains assigned to M15.
- **Implemented scope:** Added Photo matching Database Design §5.9, including its documented fields, enums, timestamps and two indexes. Admin/Manager organizer actions are Wedding-scoped. Organizer uploads are validated, max 10 MB and forced to APPROVED. Admin may make a one-time APPROVED/REJECTED decision only on a PENDING GUEST photo; Manager review is denied. Guest upload accepts multipart `image` and optional `eventId`, requires a published Wedding, enforces the approved 10 MB and JPEG/PNG/WebP content/MIME rules, and is limited to 5 requests per 15 minutes per IP. It returns HTTP 201 with only `data: { status: "PENDING" }` in the standard envelope. Event association is validated and coordinated with the existing Event deletion guard; cancellation preserves Photos.
- **Important files created:** `server/src/modules/photos/photo.model.js`, `photo.routes.js`, `photo.controller.js`, `photo.service.js`, `photo.validation.js`, and `server/test/photos.integration.test.mjs`.
- **Important files modified for M14:** `server/src/config/env.js`, `server/.env.example`, `server/src/routes/v1.js`, `server/package.json`, API Design §13, Backend Implementation Roadmap, and this report.
- **Dependencies introduced:** None. Existing Multer, `file-type`, Cloudinary adapter, M3 auth/CSRF/rate limiting, and MongoDB transaction support are reused.
- **Security and data integrity:** Wedding/uploader/review fields are server-derived; public guest submissions are forced PENDING and cannot access organizer-only photo records. Organizer and guest Event references must be active and same-Wedding. Responses omit Cloudinary storage metadata. Event deletion is blocked when linked Photos exist; cancellation preserves history. The public projection returns APPROVED photos only for M15.
- **Cloudinary handling:** Upload failure returns 502 and persists no Photo. If persistence fails after upload, cleanup is attempted; failure is logged for manual retry. Photo deletion removes the record and deletes an asset only if unreferenced. Automated tests use a fake adapter; real Cloudinary credentials and operations were not used.
- **Tests and verification:** M14 integration **16/16** passed on a generated disposable database using loopback-only local MongoDB replica-set infrastructure. M2–M13 regression suites passed sequentially: M13 **6/6**, M12 **8/8**, M11 **8/8**, M10 **19/19**, M9 **16/16**, M8 **9/9**, M7 **8/8**, M6 **11/11**, M5 **15/15**, M4 **15/15**, M3 **13/13**, M2 **7/7** (129 total). Backend non-integration tests **25/25** passed. Backend lint, root lint, frontend production build and `git diff --check` passed. No remote MongoDB or real Cloudinary calls were made.
- **Outstanding issues:** No M14 implementation or verification blockers. M15 public website APIs remain pending.
- **Git state:** Changes remain uncommitted; no commit or push was made. Existing M1–M13 worktree changes were preserved.
- **Commit reference:** None — not committed.

### Future milestone record fields

For each backend milestone, record status; start/completion dates when known; objective and implementation summary; files changed; dependencies introduced; tests and verification results; outstanding issues; and commit reference once one exists. Use **NOT STARTED**, **IN PROGRESS**, **COMPLETED**, or **BLOCKED**. A milestone is **COMPLETED** only after its required implementation and verification checklist passes. If a check fails, record the failure and keep the milestone in progress or blocked as appropriate.

---

## Future Update Policy

For each future major implementation task, update this same report only after implementing the approved scope and recording the actual verification results. Update the roadmap checklist only when scope or implementation details need clarification. Update the status report's milestone status, files, dependencies, limitations, and pending priorities as appropriate, then add one concise Change History entry. If implementation or verification fails, report that accurately and do not mark the work complete.
