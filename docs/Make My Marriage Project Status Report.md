# Make My Marriage — Project Status Report

**Report purpose:** Central project progress record. Maintain this document after each major milestone, feature, module, significant bug fix, or technical change. Update this file in place; do not create milestone-specific status reports.

**Last updated:** 2026-11-16

## 1. Project Overview

Make My Marriage is a wedding planning and guest communication application. The approved product scope includes a private wedding dashboard for Admins and Managers, a public wedding website, and secure family-specific RSVP experiences. The approved architecture is a MERN modular monolith: one React application, one Node.js/Express application, MongoDB, and selected external services.

The current repository has completed the initial project scaffold, a frontend-only public wedding website demo, and Backend Milestones 1–4. The User and Wedding models, Admin authentication, MongoDB-backed sessions, CSRF protection, password-reset flow, Wedding setup and Manager onboarding have passed their recorded tests. Nodemailer is integrated through the existing email adapter, but SMTP credentials are not configured and real email delivery has not been tested.

## 2. Technology Stack

### Implemented

- **Client:** React 19, React DOM 19, Vite 8, React Router 8, Tailwind CSS 4, ESM.
- **Server:** Node.js 24.14.1, Express 5, Mongoose 9, Helmet, dotenv, `express-session`, `connect-mongo`, bcrypt, `csrf-sync`, `express-rate-limit`, CORS, Nodemailer, CommonJS.
- **Repository:** npm 11.18.0 workspaces (`client` and `server`) with a root `package-lock.json`.
- **Development tooling:** ESLint, React Hooks and React Refresh ESLint plugins, concurrently.
- **Client/server boundary:** Vite proxies `/api` to `http://localhost:4000`; client requests are intended to use relative `/api/v1` paths. Client environment examples contain no variables; server `.env.example` contains development settings and a local MongoDB URI without credentials.

### Planned, not yet installed or implemented

Planned feature-specific dependencies not yet installed include Zod and csv-parse, where applicable. Vitest and Supertest are installed as development dependencies. The presence of a dependency does not mean every later product feature is implemented.

## 3. Current Overall Status

**Overall project: In progress.**

- **Completed:** Initial scaffold; public wedding website UI using local demo data; code change for hash-based section navigation; Backend Milestones 1–4, including User/Wedding models, Admin authentication/security, Wedding setup/publication and Manager onboarding/activation.
- **Current stage:** Backend Milestones 1–4 are complete and verified. Backend Milestone 5 — Wedding Images and Our Story — is next.
- **Pending:** Later product models and APIs, private Admin/Manager dashboard UI, and frontend-backend integration.
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

The public wedding website presentation layer is in place as a demo. Backend Milestones 1–4 are complete. Backend Milestone 5 — Wedding Images and Our Story — is next. Later product APIs, the private dashboard and frontend-backend integration remain pending. The public website remains demo-only.

## 6. Pending Milestones and Features

All pending work remains unimplemented. Backend work is tracked in [Backend Implementation Roadmap](Backend%20Implementation%20Roadmap.md).

**Backend sequence:** Milestones 1–4 — Foundation, Core Persistence Models, Authentication/Sessions/Security, and Wedding Setup/Manager Onboarding — are complete. Milestone 5 — Wedding Images and Our Story — is **NEXT / NOT STARTED**. Milestones 6–15 remain in the existing dependency-aware order defined in the roadmap.

The private Admin/Manager dashboard UI and frontend-backend integration remain pending. M4 implements the six Wedding setup/invitation/publication endpoints and Auth-module Manager activation. Cover-image and Our Story image/content endpoints remain assigned to M5; all later product-module APIs remain pending.

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

The scaffold, User/Wedding models, M3 authentication/security, and M4 Wedding ownership/role authorization are implemented. Later module authorization, upload validation, public APIs and product modules still need implementation and verification.

## 8. Dependencies and Integrations

### Present in the repository

Package versions and purposes are declared in the root, client, and server `package.json` files. External resources currently used by the demo include Google Fonts, illustrative image URLs, YouTube embed content, and Google Maps links.

### Pending integrations

- Cloudinary uploads and cleanup for wedding imagery, invitations, and guest photos.
- SMTP credentials and live delivery checks for Manager invitations and password resets; Nodemailer is wired into the shared adapter, and automated tests use an injected fake.
- Public API and RSVP endpoint implementation and client integration.
- CSV guest import and server-side validation/security dependencies listed above.

No production credentials or live service configuration are present in the client. `server/.env.example` contains a local MongoDB URI. A random local-only `SESSION_SECRET` was added to ignored `server/.env`; its value is not recorded.

## 9. Testing and Verification Results

| Check | Result | Notes |
| --- | --- | --- |
| Scaffold development startup | Recorded successful at scaffold completion | A later combined dev rerun hit Node watch `EMFILE`; current repeatability needs rechecking. |
| Public UI `npm run lint` | Passed | After the UI implementation and subsequent navigation change. |
| Public UI `npm run build` | Passed | Vite production build completed successfully. |
| Backend `npm test --workspace=@make-my-marriage/server` | Passed | 19 tests: 6 foundation HTTP tests and 13 User/Wedding schema tests. Supertest required localhost permission in the restricted environment. |
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
| Backend product API tests | Pending | M4 Wedding setup/Manager onboarding is implemented; M5 and later module endpoints are not implemented. |
| M2 MongoDB index tests | Passed | Actual MongoDB index creation, options, and uniqueness enforcement were verified against an isolated test database and cleaned up afterward. |

The root `test` script runs workspace tests when present. MongoDB integration suites are opt-in, separate workspace scripts so ordinary tests do not connect to an external database. The server has six foundation tests, 13 schema tests, seven M2 database-index tests, 13 M3 auth integration tests, and 15 M4 Wedding/Manager integration tests.

## 10. Known Issues and Limitations

- The latest combined `npm run dev` attempt hit `EMFILE` from Node's `--watch-path=src`; Vite local binding also required an elevated run in the restricted environment. This is a development-environment/startup reliability issue to recheck before relying on the combined dev command.
- The user manually confirmed that website navigation works. The detailed desktop/mobile, direct-hash, browser history, and RSVP-route test coverage has not been reported, so do not claim those individual cases were verified.
- The public site is static demo UI. RSVP changes stay in React state; photo selection creates a local preview only. Neither operation reaches a server or persists data.
- SMTP credentials are not configured, so real password-reset or Manager-invitation delivery is unverified. M4 returns an external-service error for an invitation delivery failure while retaining the committed invitation for resend. Configure server-only SMTP settings and verify delivery before relying on email in a deployed environment.
- Rate limits currently use the package's in-memory store, so counters are per Node.js process. A shared store would be needed if the backend later runs as multiple instances.
- The approved documents do not define a minimum password length or complexity rule. Validation rejects empty passwords and values over bcrypt's 72-byte input limit; no additional password policy was introduced.
- `GET /auth/csrf` has no explicit response field documented. The implementation returns the token as `data.csrfToken`, matching the documented frontend header flow; confirm this field before frontend integration if the API contract needs an exact response shape.
- Session duration, password-reset token lifetime, rate-limit windows and thresholds, bcrypt cost, CORS origin, and trusted-proxy settings are configurable. Their current defaults are implementation choices, not product policy.
- M5 cover-image and Our Story APIs, later product APIs, dashboard, remaining upload integrations and deployment remain pending.
- The previously reported four moderate `minimatch` development-dependency audit findings have not been re-audited during this milestone. Installation used `--no-audit`; no audit remediation was requested.
- The guest photo API is documented as `POST /public/weddings/:slug/photos`, but its implementation and complete request/response and operational handling are pending.
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
- **Outstanding issues:** Frontend Manager activation and Wedding setup integration remain pending. M5 image/Our Story APIs and later product APIs remain unimplemented. M3 rate limits use an in-memory store and are per process.
- **Git state:** The working tree was clean at M4 start. M4 source, package, environment-example and documentation changes are now uncommitted; no commit or push was made.
- **Commit reference:** None — not committed.

### Future milestone record fields

For each backend milestone, record status; start/completion dates when known; objective and implementation summary; files changed; dependencies introduced; tests and verification results; outstanding issues; and commit reference once one exists. Use **NOT STARTED**, **IN PROGRESS**, **COMPLETED**, or **BLOCKED**. A milestone is **COMPLETED** only after its required implementation and verification checklist passes. If a check fails, record the failure and keep the milestone in progress or blocked as appropriate.

---

## Future Update Policy

For each future major implementation task, update this same report only after implementing the approved scope and recording the actual verification results. Update the roadmap checklist only when scope or implementation details need clarification. Update the status report's milestone status, files, dependencies, limitations, and pending priorities as appropriate, then add one concise Change History entry. If implementation or verification fails, report that accurately and do not mark the work complete.
