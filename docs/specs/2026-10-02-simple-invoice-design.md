# SimpleInvoice — Design Spec

- **Date:** 2026-10-02. Revised the same day while the implementation plan was written and verified: a few details now match the verified behaviour (the logout cookie, the test tooling, the frontend's session states, nginx forwarding and the CI steps).
- **Source requirements:** *Full Stack Assessment v2.3.1* (101 Digital), file `Assessment_Fullstack_v3.0.0.pdf` (kept outside the repository). **A§x.y** refers to a section of that document; a plain **§x** refers to a section of this spec.
- **Domain language:** [`CONTEXT.md`](../../CONTEXT.md). Its capitalised terms (Invoice, Customer, User, Status, Stored Status, Overdue, Sub-total, Tax Rate, Tax Amount, Discount, Total Amount, Total Paid, Balance) carry their glossary meaning here.
- **Decisions:**
  - [ADR-0001](../adr/0001-customer-snapshot-on-invoice.md): Customer details are a snapshot on the Invoice.
  - [ADR-0002](../adr/0002-jwt-in-httponly-cookie.md): the SPA carries the JWT in an httpOnly cookie; API tools use Bearer.

## 1. Goal

Build **SimpleInvoice**: a ReactJS + TypeScript SPA and a NestJS + TypeScript REST API on PostgreSQL. It provides four features:

1. Authentication.
2. An invoice list with search, filter, sort and server-side pagination.
3. An invoice detail view.
4. Invoice creation with server-side totals.

The project must satisfy every requirement in the assessment (traceability is in §13). The repository must also score well on the rubric (A§4.1): packaging, a complete working app, API design, database design, business logic, authentication, code quality, testing, documentation, Docker and value-add.

The User's stated priorities, tied first:

1. **Reviewer-friendly conventions.** Use textbook NestJS/React patterns, the fewest moving parts, and a literal reading of the spec.
2. **Security & correctness.**

Polish and extra features are deliberately lean.

## 2. Architecture overview

**Approach (chosen):** conventional NestJS feature modules with a **pure domain core**.
- Controllers are thin: HTTP concerns and Swagger only.
- Services orchestrate persistence through TypeORM.
- The business rules are framework-free functions, unit-tested directly: totals calculation, status derivation, and the status filter criteria.
- Database CHECK constraints are a safety net only. They are not the place where the logic lives.

**Rejected approaches:**
- **Hexagonal/clean architecture** (ports, adapters, separate domain entities). It means 2–3× the files for five endpoints, which reads as over-engineering.
- **DB-centric** (generated columns for totals and a SQL view for Overdue). It undercuts "total amount must be calculated by the backend", it makes the spec's required unit tests depend on a database, and it ties "today" to the database's time zone.

### 2.1 Runtime topology (`docker compose up`)

```
Browser ──► localhost:8080  frontend  (nginx-unprivileged, serves the built SPA)
              ├─ /*      → SPA files (history fallback to index.html)
              └─ /api/*  → strip "/api", proxy ─► backend:3000  (NestJS 12, node:24-alpine, non-root)
                                                   ├─ /auth/login · /auth/me · /auth/logout
                                                   ├─ /invoices · /invoices/:id
                                                   ├─ /health
                                                   └─ /api/docs   (Swagger UI, opened on the backend port)
                                                   ▼
                                                 db:5432  (postgres:17-alpine, named volume `pgdata`)
```

- **Start-up chain.** Each step is gated by the previous health check:
  1. `db` becomes healthy (`pg_isready`).
  2. `backend` starts: its entrypoint runs the seeder (pending migrations, then an idempotent seed) when `SEED_ON_START=true`, which compose sets, then starts the API. It is healthy once `GET /health` returns 200.
  3. `frontend` starts.
- **Host ports.** All are bound to `127.0.0.1` and can be overridden through env:

  | Service | Default port |
  |---|---|
  | Frontend | 8080 |
  | Backend | 3000 |
  | Postgres | 5432 |

- **Same origin.** The SPA always calls `/api/*` on its own origin: nginx proxies it in Docker, and the Vite dev-server proxy does so in development. So no CORS configuration is needed, and the auth cookie is first-party.
- **Swagger** is served by the backend only, at `http://localhost:3000/api/docs`. Because the proxy strips `/api`, `localhost:8080/api/docs` is not Swagger; the README links the backend port.

### 2.2 Repository layout (monorepo)

```
simple-invoice/
├── backend/
│   ├── src/
│   │   ├── main.ts                 # bootstrap: create app, applyAppSetup(app), listen
│   │   ├── app.module.ts
│   │   ├── app.setup.ts            # shared by main.ts and e2e tests: body parser, helmet, cookie-parser,
│   │   │                           # trust proxy, ValidationPipe, AllExceptionsFilter, Swagger
│   │   ├── config/                 # env schema validated at boot + typed accessors
│   │   ├── common/                 # AllExceptionsFilter, @Public(), @CurrentUser(), ClockService,
│   │   │                           # @IsDateOnly() / @IsOnOrAfter() validators, ErrorResponseDto
│   │   ├── auth/                   # AuthController, AuthService, JwtStrategy, JwtAuthGuard,
│   │   │                           # LoginDto, LoginResponseDto, UserDto
│   │   ├── users/                  # User entity, UsersService
│   │   ├── invoices/
│   │   │   ├── domain/             # invoice-totals.ts, invoice-status.ts, currencies.ts (pure)
│   │   │   ├── dto/                # CreateInvoiceDto, ListInvoicesQueryDto, InvoiceDto,
│   │   │   │                       # InvoiceListResponseDto, PagingDto
│   │   │   ├── entities/           # Invoice, InvoiceItem
│   │   │   ├── invoice.mapper.ts   # entity → InvoiceDto (derives Status, item amount)
│   │   │   ├── invoices.controller.ts
│   │   │   └── invoices.service.ts
│   │   ├── health/                 # GET /health (Terminus DB ping)
│   │   └── database/
│   │       ├── data-source.ts      # DataSource for CLI/seed (same options as the app)
│   │       ├── migrations/         # hand-written SQL migrations
│   │       └── seed/               # run-seed.ts (entry), appendix-a.ts, generate-invoices.ts, seeder.ts
│   ├── test/                       # *.e2e-spec.ts + Testcontainers helper
│   ├── Dockerfile · docker-entrypoint.sh · .dockerignore · .env.example
│   └── package.json · tsconfig*.json · nest-cli.json · vitest.config*.ts · .oxlintrc.json · .prettierrc
├── frontend/
│   ├── src/
│   │   ├── main.tsx · App.tsx (providers) · routes.tsx · theme.ts
│   │   ├── api/                    # http.ts (axios instance), auth.ts, invoices.ts, types.ts
│   │   ├── auth/                   # AuthProvider, useAuth, RequireAuth, LoginPage
│   │   ├── features/invoices/      # list/, detail/, create/, hooks/, listParams.ts, schema.ts
│   │   ├── components/             # AppLayout, PageHeader, StatusChip, EmptyState, ErrorState, FullPageSpinner,
│   │   │                           # NotFoundPage, SectionCard
│   │   ├── lib/                    # format.ts (money/date), currencies.ts, dates.ts
│   │   └── test/                   # setup.ts, msw/ (handlers, server, fixtures), render helpers
│   ├── nginx.conf · security-headers.conf · Dockerfile · .dockerignore · .env.example
│   └── package.json · tsconfig*.json · vite.config.ts · .oxlintrc.json · .prettierrc
├── docs/adr/ · docs/specs/
├── .github/workflows/ci.yml · scripts/smoke-test.sh
├── CONTEXT.md · README.md · docker-compose.yml · .env.example · .gitignore
```

## 3. Technology and verified versions

Two throwaway spikes on 2026-10-02 verified these versions together: build, lint, unit tests, Testcontainers e2e tests, a Docker image run, and a headless browser.

| Area | Choice and pinned version |
|---|---|
| Runtime | Node 24 (`node:24-alpine`); local Node 24.15+ or 22.22.2+ (the strictest `engines` ranges: jsdom 30 and React Router 8) |
| Backend framework | NestJS **12.1.2** in its default **ESM** layout (`"type": "module"`), with `@nestjs/cli` 12.0.8 and `@nestjs/schematics` 12.0.6 |
| Backend language | TypeScript **6.0.3**. TS 7 is excluded because it ships no compiler API, which `nest build` needs. |
| ORM / DB | TypeORM **1.1.1**, `@nestjs/typeorm` 12.0.2, `pg` 8.23.1, PostgreSQL **17** |
| Backend libraries | `@nestjs/config` 12.0.1, `@nestjs/jwt` 12.0.2, `@nestjs/passport` 12.0.0 + `passport` 0.7.0 + `passport-jwt` 4.0.1, `@nestjs/swagger` 12.0.2, `@nestjs/terminus` 12.1.0, `@nestjs/throttler` 6.7.1, `class-validator` 0.15.1, `class-transformer` 0.5.1, `bcryptjs` 3.0.3, `decimal.js` 10.6.0, `helmet` 8.3.0, `cookie-parser` 1.4.7 (+ `@types/cookie-parser` 1.4.10), `reflect-metadata` 0.2.2, `rxjs` 7.8.2 |
| Backend tests | Vitest **4.1.11**, as scaffolded by `nest new`. Decorator metadata works with no plugins. Also `@vitest/coverage-v8` 4.1.11, `@nestjs/testing` 12.1.2, `supertest` 7.3.0, `@testcontainers/postgresql` 12.2.0. |
| Frontend | React **19.3.0**, Vite **8.3.2**, `@vitejs/plugin-react` 6.1.1, TypeScript **6.0.3** (pinned exactly, like the backend), React Router **8.4.0**, TanStack Query **5.104.0**, React Hook Form 7.89.0, Zod **4.6.5**, `@hookform/resolvers` 5.9.1, axios 1.20.0, MUI **9.4.0** + `@mui/icons-material` 9.4.0 + `@emotion/react` 11.14.0 + `@emotion/styled` 11.14.1, notistack 3.0.2, `@fontsource/roboto` 5.3.0 |
| Frontend tests | Vitest **5.0.3**, jsdom 30.1.1, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.7, `@testing-library/jest-dom` 7.0.1, MSW **3.0.1** |
| Lint / format | oxlint (both official scaffolds now generate it; type-aware on the backend; the frontend fails on warnings with `--deny-warnings`) + Prettier |

`helmet`, `cookie-parser` and `@fontsource/roboto` were not part of the spikes. Their versions above were the latest on npm on 2026-10-02.

**Implementation gotchas** (each one was verified):

- **Backend ESM:**
  - Relative imports end in `.js`.
  - Circular entity relations use `Relation<T>`.
  - **DTO classes must be value imports, never `import type`.** Otherwise the design-time metadata becomes `Function` and the `ValidationPipe` silently stops validating.
- `import { Decimal } from 'decimal.js'`. The default import fails with TS2351.
- class-transformer's `@Type()` calls `Reflect.getMetadata` as soon as the class is defined. Nest and TypeORM load `reflect-metadata`, but the env schema also runs without them (in its unit test), so it imports `reflect-metadata` itself.
- `@nestjs/jwt`: pass `expiresIn` as a **number of seconds**. jsonwebtoken reads a bare string such as `"3600"` as milliseconds.
- **TypeORM 1.x:**
  - `numeric` hydrates as a string, so a `ValueTransformer` maps it to `Decimal`.
  - `date` hydrates as a `'YYYY-MM-DD'` string on entities, but raw queries return a local-midnight `Date`. Register `pg.types.setTypeParser(1082, v => v)` once, so a DATE is always a string.
  - `findOneBy({ id: undefined })` throws.
  - Find-options `relations` and `select` take objects.
- Terminus 12: `pingCheck('database')` returns an attempt object; use `.withTimeout(ms)`.
- Remove the scaffold's `@nestjs/mau` dev dependency. It is the source of all `npm audit` findings and is unused.
- **React Router 8:** import from `react-router`, except `RouterProvider`, which comes from `react-router/dom`. `react-router-dom` no longer exists.
- **MUI 9:**
  - System props are removed; use `sx`.
  - `Grid` takes `size={{ xs: 12, md: 6 }}`.
  - TextField uses `slotProps.{input, htmlInput, inputLabel, select, formHelperText}`.
  - In tests, open a select with `user.click(getByRole('combobox', { name }))`, then pick `findByRole('option', { name })`. The menu's portal works in jsdom.
- **Zod 4:** use `z.email()`. For `z.coerce.number<string>()`, type the form as `useForm<z.input<S>, unknown, z.output<S>>`.
- React Hook Form with a MUI TextField: pass `inputRef={field.ref}`.
- **MSW 3:** `server.listen({ onUnhandledFrame: 'error' })`. The old `onUnhandledRequest` is silently ignored.
- jsdom has no `matchMedia`; stub it only in viewport-dependent tests.
- The frontend's TS config (from the Vite template) sets `erasableSyntaxOnly` and `verbatimModuleSyntax`. So the frontend has no `enum`s and no constructor parameter properties, and type-only imports use `import type`. The backend config sets neither flag, because Nest relies on parameter properties. It still uses string-literal unions rather than `enum`s, for consistency.

## 4. Data model (PostgreSQL 17)

The first migration creates `pg_trgm`. `gen_random_uuid()` is built in.

### 4.1 `users`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `email` | varchar(255) | NOT NULL; `UNIQUE INDEX users_email_lower_uq ON users (lower(email))` |
| `password_hash` | varchar(100) | NOT NULL (bcrypt, cost 12) |
| `fullname` | varchar(255) | NOT NULL |
| `created_at` | timestamptz | NOT NULL, default `now()` |

### 4.2 `invoices`

| Column | Type | Constraints |
|---|---|---|
| `invoice_id` | uuid | PK, default `gen_random_uuid()` |
| `invoice_number` | varchar(50) | NOT NULL; `UNIQUE INDEX invoices_invoice_number_lower_uq ON invoices (lower(invoice_number))` |
| `invoice_reference` | varchar(100) | NULL |
| `invoice_date` | date | NOT NULL |
| `due_date` | date | NOT NULL; `CHECK (due_date >= invoice_date)` |
| `currency` | char(3) | NOT NULL; `CHECK (currency ~ '^[A-Z]{3}$')` |
| `currency_symbol` | varchar(8) | NOT NULL |
| `description` | varchar(1000) | NULL |
| `status` | enum `invoice_status` (`'Draft'`,`'Pending'`,`'Paid'`) | NOT NULL, default `'Draft'`. **Overdue cannot be stored.** |
| `customer_fullname` | varchar(255) | NOT NULL |
| `customer_email` | varchar(255) | NOT NULL |
| `customer_mobile_number` | varchar(20) | NULL |
| `customer_address` | varchar(500) | NULL |
| `tax_rate` | numeric(5,2) | NOT NULL; `CHECK (tax_rate BETWEEN 0 AND 100)` |
| `invoice_sub_total` | numeric(15,2) | NOT NULL, ≥ 0 |
| `total_tax` | numeric(15,2) | NOT NULL, ≥ 0 |
| `total_discount` | numeric(15,2) | NOT NULL default 0, ≥ 0 |
| `total_amount` | numeric(15,2) | NOT NULL, ≥ 0 |
| `total_paid` | numeric(15,2) | NOT NULL default 0, ≥ 0 |
| `balance_amount` | numeric(15,2) | NOT NULL, ≥ 0 |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `created_by` | uuid | NOT NULL; FK → `users(id)` ON DELETE RESTRICT |

**Invariant CHECKs.** These are a safety net; the service computes the values.

- `total_amount = invoice_sub_total + total_tax - total_discount`
- `balance_amount = total_amount - total_paid`
- `total_paid <= total_amount`
- `status <> 'Paid' OR balance_amount = 0`

### 4.3 `invoice_items`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `invoice_id` | uuid | NOT NULL; FK → `invoices(invoice_id)` ON DELETE CASCADE |
| `name` | varchar(255) | NOT NULL |
| `quantity` | integer | NOT NULL; `CHECK (quantity > 0)` |
| `rate` | numeric(15,2) | NOT NULL; `CHECK (rate > 0)` |

The item's `amount` (quantity × Rate) is computed when read; it is not stored.

### 4.4 Indexes

| Index | Serves |
|---|---|
| `invoices_invoice_number_trgm` GIN (`invoice_number gin_trgm_ops`) | case-insensitive partial search (`ILIKE`) |
| `invoices_customer_fullname_trgm` GIN (`customer_fullname gin_trgm_ops`) | case-insensitive partial search (`ILIKE`) |
| B-tree `invoice_date`, `due_date`, `total_amount`, `created_at` | sorting and the date-range filter |
| B-tree `(status, due_date)` | status filters, including derived Overdue (`status IN ('Draft','Pending') AND due_date < :today`) |
| B-tree `invoices(created_by)`, `invoice_items(invoice_id)` | FK lookups |

## 5. Backend design

### 5.1 Modules

| Module | Contents |
|---|---|
| `ConfigModule` (global) | env schema, validated at boot |
| `TypeOrmModule` | `DATABASE_URL`, entities, migrations, **`migrationsRun: true`**, `synchronize: false` |
| `UsersModule` | `User` entity, `UsersService.findByEmail/findById` |
| `AuthModule` | controller, service, `JwtStrategy`, global `JwtAuthGuard` (`APP_GUARD`), `ThrottlerModule` for login |
| `InvoicesModule` | controller, service, entities, mapper, domain functions |
| `HealthModule` | `GET /health` |
| `common/` | `ClockService` (injectable `today(): string` in `APP_TIMEZONE`), the `AllExceptionsFilter`, decorators, validators |

### 5.2 Domain core (pure, framework-free)

**`invoices/domain/invoice-totals.ts`**

```
calculateInvoiceTotals({ items: [{quantity, rate}], taxRate, discount, totalPaid = 0 }) →
  subTotal      = Σ quantity × rate                                 (exact Decimal)
  taxAmount     = roundHalfUp(subTotal × taxRate / 100, 2)
  totalAmount   = subTotal + taxAmount − discount                   → throws DiscountExceedsTotalError if < 0
  balanceAmount = totalAmount − totalPaid
  (returns Decimals: subTotal, taxAmount, discount, totalAmount, totalPaid, balanceAmount)
```

**`invoices/domain/invoice-status.ts`**

```
type StoredStatus  = 'Draft' | 'Pending' | 'Paid'
type InvoiceStatus = StoredStatus | 'Overdue'

deriveInvoiceStatus(stored, dueDate, today) = stored !== 'Paid' && dueDate < today ? 'Overdue' : stored
     // ISO 'YYYY-MM-DD' strings compare correctly as text

STATUS_CRITERIA: Record<InvoiceStatus, { storedIn: StoredStatus[]; due: 'beforeToday' | 'todayOrLater' | 'any' }> = {
  Draft:   { storedIn: ['Draft'],            due: 'todayOrLater' },
  Pending: { storedIn: ['Pending'],          due: 'todayOrLater' },
  Paid:    { storedIn: ['Paid'],             due: 'any' },
  Overdue: { storedIn: ['Draft', 'Pending'], due: 'beforeToday' },
}
matchesStatusCriteria(row, criteria, today)   // TS evaluator, used by the unit test
```

The SQL predicate is generated from `STATUS_CRITERIA`:

```
status IN (:...storedIn) [AND due_date < :today | AND due_date >= :today]
```

A unit test runs every combination of Stored Status × due-date position (before, on, after today). It asserts that `deriveInvoiceStatus(row) === s` holds exactly when `matchesStatusCriteria(row, STATUS_CRITERIA[s])` does, so the list filter can never disagree with the displayed Status.

**`invoices/domain/currencies.ts`** maps currency codes to symbols, for 2-decimal ISO 4217 currencies only:

| Code | Symbol |
|---|---|
| AUD | `AU$` |
| USD | `US$` |
| GBP | `£` |
| EUR | `€` |
| SGD | `S$` |
| NZD | `NZ$` |
| CAD | `CA$` |
| HKD | `HK$` |

The frontend keeps the same list in `frontend/src/lib/currencies.ts`, with a comment naming the backend file as the source of truth.

### 5.3 API contract

All routes are guarded by default; `@Public()` marks the exceptions.

| Method | Path | Auth | Success | Errors |
|---|---|---|---|---|
| POST | `/auth/login` | public; throttled `LOGIN_THROTTLE_LIMIT` per `LOGIN_THROTTLE_TTL` s per IP | **200** `{ accessToken, tokenType: "Bearer", expiresIn, user: UserDto }` and `Set-Cookie: access_token` | 400, 401 `"Invalid email or password"`, 429 |
| GET | `/auth/me` | ✓ | 200 `UserDto` = `{ id, email, fullname, createdAt }` | 401 |
| POST | `/auth/logout` | ✓ | **204**; clears the cookie | 401 |
| GET | `/invoices` | ✓ | 200 `{ data: InvoiceDto[], paging: { page, pageSize, total } }` | 400, 401 |
| GET | `/invoices/:id` | ✓ | 200 `InvoiceDto` | 400 (not a UUID), 401, 404 `"Invoice not found"` |
| POST | `/invoices` | ✓ | **201** `InvoiceDto` with a `Location: /invoices/{id}` header | 400, 401, 409 |
| GET | `/health` | public | 200 Terminus report `{ status: "ok", info, error, details }`; 503 with `status: "error"` when the database ping fails | none |

**`LoginDto`:** `email` is required, a valid email, at most 255 characters, and trimmed. `password` is required, 1–128 characters, and never trimmed or logged.

**`InvoiceDto`** is the single representation used by the list, the detail view and create. It follows the Appendix A names. The additions are `taxRate`, item `amount`, and `status` as the computed Status.

```json
{ "invoiceId": "uuid", "invoiceNumber": "IV1780488206995", "invoiceReference": "#5721662",
  "invoiceDate": "2026-06-03", "dueDate": "2026-07-03", "currency": "AUD", "currencySymbol": "AU$",
  "description": "Invoice is issued to Kanglee", "status": "Overdue",
  "customer": { "fullname": "Paul", "email": "paul@101digital.io", "mobileNumber": "947717364111", "address": "Singapore" },
  "items": [ { "id": "uuid", "name": "Honda RC150", "quantity": 2, "rate": 1000, "amount": 2000 } ],
  "taxRate": 10, "invoiceSubTotal": 2000, "totalTax": 200, "totalDiscount": 20,
  "totalAmount": 2180, "totalPaid": 1451.34, "balanceAmount": 728.66,
  "createdAt": "2026-06-03T12:03:26.995Z", "createdBy": "ad1e0902-1928-4345-b513-60c86c94fc91" }
```

Money fields are JSON numbers rounded to 2 decimal places. Optional fields that are empty are `null`.

**`GET /invoices` query (`ListInvoicesQueryDto`):**

| Param | Rule | Default |
|---|---|---|
| `page` | integer ≥ 1 | 1 |
| `pageSize` | integer 1–100 | 10 |
| `sortBy` | `invoiceDate` \| `dueDate` \| `totalAmount` | none: sort by creation time (`created_at`) |
| `ordering` | `ASC` \| `DESC` (case-insensitive); applies to whichever sort key is in effect | `DESC` (so the default is newest first) |
| `status` | `Draft` \| `Pending` \| `Paid` \| `Overdue` (case-insensitive) | none |
| `keyword` | trimmed string ≤ 100 | none |
| `fromDate`, `toDate` | real `YYYY-MM-DD` dates; filter `invoice_date` inclusively; `fromDate > toDate` returns 400 `"toDate must be on or after fromDate"` | none |

A blank value of any optional parameter (for example `keyword=`, `status=` or `fromDate=`) counts as absent.

Query behaviour:
- **Keyword:** `(invoice_number ILIKE :kw OR customer_fullname ILIKE :kw)`, where `:kw = %escaped%`; the characters `\`, `%` and `_` in the keyword are escaped.
- **Status:** the `STATUS_CRITERIA` predicate.
- **Sort:** through a whitelisted map from `sortBy` to column (`created_at` when `sortBy` is absent), in `ordering` direction, with `invoice_id` as the tie-breaker.
- **Pagination:** `OFFSET (page−1)·pageSize LIMIT pageSize`, plus a `COUNT` with the same filters for `total`. The page's Invoice Items come from one extra query (no N+1). A page past the end returns `data: []` with the true `total`.
- **One `today`** from `ClockService` serves the whole request.

**`POST /invoices` body (`CreateInvoiceDto`).** It is checked by the global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`). String fields are trimmed, and empty optional strings become absent.

| Field | Rule |
|---|---|
| `customer.fullname` | required, non-empty, ≤ 255 |
| `customer.email` | required, valid email, ≤ 255 |
| `customer.mobileNumber` | optional; 6–20 characters in total, matching `^\+?[0-9\s\-()]+$` (digits, spaces, `-`, `(`, `)`, and an optional leading `+`) |
| `customer.address` | optional, ≤ 500 |
| `invoiceNumber` | required; `^[A-Za-z0-9][A-Za-z0-9\-_/.#]*$`; ≤ 50; unique regardless of case, else **409** `"Invoice number <invoiceNumber> already exists"` |
| `invoiceReference` | optional, ≤ 100 |
| `invoiceDate` | required, a real `YYYY-MM-DD` date (`@IsDateOnly()`) |
| `dueDate` | required, a real `YYYY-MM-DD` date; `@IsOnOrAfter('invoiceDate')` gives **`"dueDate must be on or after invoiceDate"`** |
| `currency` | required; one of the supported codes (input is uppercased) |
| `description` | optional, ≤ 1000 |
| `items` | array of **exactly 1**: `name` required ≤ 255; `quantity` integer 1–1,000,000; `rate` > 0, ≤ 1,000,000, at most 2 decimal places |
| `taxRate` | optional, 0–100, at most 2 decimal places; default **10** |
| `discount` | optional, ≥ 0, at most 2 decimal places; default **0**. A class-level check calls `calculateInvoiceTotals`: **`"discount must not exceed the sub-total plus tax"`** |

**Create flow (service):**

1. Compute the totals with `calculateInvoiceTotals` (`totalPaid` = 0).
2. Save the Invoice and its item in one transaction, with Stored Status **Draft**, `currency_symbol` taken from the currency map, and `created_by` = the current User.
3. On a Postgres error `23505` from `invoices_invoice_number_lower_uq`, raise `ConflictException`. The database index is the only uniqueness check, so there is no check-then-insert race.
4. Reload the row and map it, so the Status is computed.

### 5.4 Authentication (ADR-0002)

- **Login:**
  1. Find the User by `lower(email)`.
  2. Run `bcrypt.compare` against the stored hash, or against a fixed dummy hash when the User is missing, so timing reveals nothing.
  3. On failure, return **401 `"Invalid email or password"`**.
  4. On success, sign `{ sub, email }` with HS256 and `expiresIn = JWT_EXPIRES_IN` (a number of seconds). Verification pins `algorithms: ['HS256']`.
  5. Set the cookie `access_token=<jwt>; HttpOnly; SameSite=Strict; Path=/; Max-Age=<JWT_EXPIRES_IN>`. `Secure` follows `COOKIE_SECURE`: `auto` means `req.secure`, so it is off on plain http://localhost and on behind TLS with `trust proxy`.
- **The global `JwtAuthGuard`** (passport-jwt) skips `@Public()` routes. Its extractor order is:
  1. an `Authorization: Bearer` header;
  2. otherwise, the `access_token` cookie, **only when the request carries `X-Requested-With: XMLHttpRequest`**.

  `validate(payload)` reloads the User and returns 401 if they no longer exist. A missing, invalid or expired token gives 401 `{ statusCode: 401, message: "Unauthorized", error: "Unauthorized" }`.
- **Logout** is guarded like any other route. It clears the cookie (same attributes, with `Expires=Thu, 01 Jan 1970 00:00:00 GMT`, as Express's `res.clearCookie` sends it) and returns 204. Because it is guarded, a cross-site form cannot log a User out: a cookie without the header gets 401. The SPA treats logout as fire-and-forget: it signs out locally whatever the response.
- **Hardening:**
  - `NestFactory.create(AppModule, { bodyParser: false })`, then register only a JSON body parser (100 kB limit). Form-encoded and `text/plain` bodies are never parsed, so they fail validation with 400.
  - `helmet()`, `cookie-parser`, and `app.set('trust proxy', TRUST_PROXY)` so the login throttle sees the real client IP behind nginx.
  - No `enableCors`: same-origin only.

### 5.5 Error handling

The global `AllExceptionsFilter` always returns `{ statusCode, message, error }`.

| Source | Response |
|---|---|
| `HttpException` (including the `ValidationPipe`'s `BadRequestException`) | keeps its message (string, or an array of strings for validation); `error` = the HTTP reason phrase |
| `ThrottlerException` | 429 `"Too many login attempts, please try again later"` |
| Malformed `:id` | `ParseUUIDPipe` with a custom message: 400 `"id must be a valid UUID"` |
| Anything else | 500 `"Internal server error"`. The stack trace and the request method and path are logged server-side and never returned. |

### 5.6 Swagger (`/api/docs`)

- `DocumentBuilder` with the title "SimpleInvoice API", a description, a version and `addBearerAuth()`.
- **Bearer is the only security scheme in the document**, because it is the only one Swagger UI can use. The cookie mode needs a browser-set cookie plus the `X-Requested-With` header (ADR-0002). The API description and the login operation's `Set-Cookie` response header document it in prose.
- `swaggerOptions.persistAuthorization = true`.
- Tags: `auth`, `invoices`, `health`.
- Every operation carries:
  - `@ApiOperation`;
  - its request DTO or query DTO (`@ApiProperty` with descriptions, enums, defaults and examples);
  - a typed success response (`InvoiceDto`, `InvoiceListResponseDto` with `PagingDto`, `LoginResponseDto`, `UserDto`);
  - every error status, typed as `ErrorResponseDto`.
- **Decorators are explicit; there is no Swagger CLI plugin.** Vitest compiles the e2e app without `nest build`, so plugin-generated metadata would be missing there, and the tested OpenAPI document would differ from the shipped one.

### 5.7 Configuration

**API process.** It is validated at boot, and the API refuses to start on any missing or invalid value.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | 3000 | |
| `DATABASE_URL` | none (required) | `postgres://user:pass@host:5432/db` |
| `JWT_SECRET` | none (required) | ≥ 32 characters; no fallback in code |
| `JWT_EXPIRES_IN` | 3600 | seconds; positive integer |
| `COOKIE_SECURE` | `auto` | `auto` \| `true` \| `false` |
| `APP_TIMEZONE` | `UTC` | IANA name; defines "today" |
| `LOGIN_THROTTLE_LIMIT` / `LOGIN_THROTTLE_TTL` | 5 / 60 | attempts per TTL seconds, per IP |
| `TRUST_PROXY` | `loopback, linklocal, uniquelocal` | Express `trust proxy` value; trusts the bundled nginx on the private Docker network |

**Seeder and container entrypoint.** These are validated when the seeder runs.

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL`, `APP_TIMEZONE` | as above | |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `SEED_USER_FULLNAME` | none (required) | the default User |
| `SEED_ON_START` | `false` | read by `docker-entrypoint.sh`; compose sets `true` |

**Example files.** Each one lists every key its consumer reads:
- **Root `.env.example`** (compose): host ports, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and the backend keys.
- **`backend/.env.example`**: the API and seeder keys, for running without Docker.
- **`frontend/.env.example`**: `VITE_API_BASE_URL=/api` and `API_PROXY_TARGET=http://localhost:3000` (the Vite dev proxy).

These files never hold real values for secrets (`JWT_SECRET`, `POSTGRES_PASSWORD`, `SEED_USER_PASSWORD`, and the password inside `DATABASE_URL`). Each secret is empty or an obvious placeholder, with a comment on how to choose or generate one (`openssl rand -base64 48`). The other keys carry harmless local values.

`docker-compose.yml` reads every key as `${VAR:-default}`, with clearly labelled **local-only defaults**. So a fresh clone runs with no `.env` file, and an empty value in `.env` also falls back to the default.

### 5.8 Migrations and seed

- **Migrations:** hand-written TypeORM migration classes with raw SQL `up`/`down`. They run automatically at API boot (`migrationsRun`). `npm run migration:run` and `migration:revert` are also available.
- **The seeder** (`database/seed/run-seed.ts`):
  1. Initialise the DataSource.
  2. Run pending migrations.
  3. Upsert the default User by fixed id `ad1e0902-1928-4345-b513-60c86c94fc91` (Appendix A's `createdBy`), with email, name and a bcrypt hash of `SEED_USER_PASSWORD`.
  4. Insert the Appendix A Invoice verbatim: same `invoiceId`, number, reference, dates, Customer, item id, and amounts (2000 / 200 / 20 / 2180 / 1451.34 / 728.66, Tax Rate 10). Its Stored Status is **Pending**; it is part-paid, and its Overdue is derived.
  5. Insert **40 generated Invoices**, numbered `INV-0001` to `INV-0040`.

  Every insert uses `ON CONFLICT DO NOTHING`, and an Invoice Item is inserted only when its Invoice was. So a second run changes nothing.
- **Generated data** is deterministic (a fixed-seed PRNG, no faker library). It is relative to the seed day: "today" from the same clock logic as the API (`APP_TIMEZONE`). Tests pass a fixed date instead.
  - Invoice dates range from today − 180 days to today + 10 days; due dates are the invoice date + {0, 7, 14, 30, 45, 60} days.
  - Stored Statuses are mixed: about 35 % Paid (Total Paid = Total Amount), about 40 % Pending (some part-paid), about 25 % Draft.
  - Customers come from about 20 names that overlap partially, for the search demo (for example "Nguyen Van An" and "Nguyen Thi Binh", or "Acme Corp" and "Acme Pty Ltd").
  - Item names, quantities (1–50) and Rates (5–5,000) vary. Tax Rates are 10 (mostly), 0, 7.5 and 15; Discounts are mostly 0 with some amounts. Currencies are mostly AUD, with some USD, SGD, GBP and EUR.
  - Fixed edge cases are always included: an Overdue Draft, an Overdue Pending, a Pending due today (not Overdue), a Paid past its Due Date (not Overdue), and a future-dated Draft.
  - `created_at` is the Invoice Date at a working-hours time, but never later than the seed time. So "newest first" roughly follows Invoice Date, and nothing is created in the future.
- **Scripts:**
  - `npm run seed` seeds as above.
  - `npm run seed:reset` truncates `invoices` (items cascade) and reseeds. Users are kept.
  - `npm run migration:run` and `npm run migration:revert` are also available.
  - These scripts run compiled code. Locally, npm `pre` hooks (`preseed`, `preseed:reset`, `premigration:run`, `premigration:revert`) run `nest build` first.
  - The runtime image already contains `dist/` and deletes those hooks (`npm pkg delete`). So the same commands work in the container, for example `docker compose exec backend npm run seed`.
  - The entrypoint seeds automatically when `SEED_ON_START=true`.
- **Reviewer credentials** (documented in the README; compose defaults): **`admin@example.com` / `Password123!`**.

## 6. Frontend design

### 6.1 Routes

The router is a React Router 8 data router; the app's `createBrowserRouter` and the tests' `createMemoryRouter` share one `routes` array.

| Path | Element | Notes |
|---|---|---|
| `/login` | `LoginPage` | public; a signed-in User is redirected to `state.from` or `/invoices` |
| (pathless) | `RequireAuth` → `AppLayout` | `AppLayout` has an AppBar ("SimpleInvoice", Invoices, New invoice, a user menu showing the name and email, and Logout); it collapses on mobile |
| `/` (index) | `<Navigate to="/invoices" replace>` | |
| `/invoices` | `InvoiceListPage` | **home** |
| `/invoices/new` | `CreateInvoicePage` | |
| `/invoices/:invoiceId` | `InvoiceDetailPage` | |
| `*` | `NotFoundPage` | inside the protected layout, so an anonymous User goes to login first |

### 6.2 Session handling (ADR-0002)

- **The axios instance** (`api/http.ts`) uses `baseURL = import.meta.env.VITE_API_BASE_URL || '/api'` (an empty value also falls back) and sends `X-Requested-With: XMLHttpRequest` with every request. It never reads, stores or sends the token itself.
- **`AuthProvider`:**
  - **State** is `checking | authenticated | anonymous | signedOut`, plus `user`. `signedOut` means that the User logged out, so the next sign-in starts at the Invoice list.
  - **On mount** it calls `GET /auth/me`. 200 means authenticated; any other outcome (401, network error) means anonymous. While checking, it shows `FullPageSpinner`, so the login screen never flashes.
  - **`login()`** posts the credentials, stores only `user`, and ignores `accessToken`.
  - **`logout()`** calls `POST /auth/logout` and ignores the result. It then clears the query cache and sets the state to `signedOut`. It does not navigate: `RequireAuth` does that.
- **`RequireAuth`:** when anonymous, `<Navigate to="/login" replace state={{ from: location }}>`. When `signedOut`, the same redirect without `from`, so a sign-in after a logout opens the Invoice list.
- **Session expiry.** A response interceptor watches every request except `/auth/login`, `/auth/me` and `/auth/logout`. On a 401 it calls `onUnauthorized`, which:
  1. sets the state to anonymous;
  2. clears the query cache;
  3. shows the toast "Your session has expired. Please sign in again." once, even when several requests fail together (a fixed notistack key with `preventDuplicate`).

  `RequireAuth` then redirects to `/login` with `from` set to the current location, so login returns there.
- **Retries.** Queries never retry a 4xx response; other failures retry once.

### 6.3 Pages

**`LoginPage`:**
- A centred card with email and password, validated by React Hook Form and Zod: the email is required and must be valid, and the password is required.
- The submit button shows a loading state.
- An `Alert` reports a failed login:

  | Response | Text |
  |---|---|
  | 401 | "Invalid email or password." |
  | 429 | "Too many login attempts. Please try again later." |
  | anything else | "Something went wrong. Please try again." |

**`InvoiceListPage` (home):**
- **Header:** "Invoices" plus a "New invoice" button.
- **Filters:**
  - debounced (300 ms) search, "Search invoice number or customer";
  - Status select: All, Draft, Pending, Paid, Overdue;
  - Sort select: "Date created" (the default, which sends no `sortBy`), "Invoice date", "Due date" and "Total amount", with an Asc/Desc toggle that applies to all of them (default Desc, so the default view is newest first);
  - Invoice-date range: from and to, as native date inputs (`type="date"`; no date-picker library);
  - "Clear filters".

  On mobile, the controls other than search sit in a collapsible "Filters" panel.
- **State:**
  - The URL query string is the single source of truth: `page, pageSize, sortBy, ordering, status, keyword, fromDate, toDate`.
  - `useInvoiceListParams()` parses it with Zod (an invalid value falls back to its default) and resets `page` to 1 whenever a filter changes.
  - TanStack Query fetches with key `['invoices', 'list', params]` and `placeholderData: keepPreviousData`. A thin `LinearProgress` shows while it refetches.
- **Desktop (≥ md):**
  - A table with the columns Invoice number (a link), Customer, Invoice date, Due date, Total (right-aligned, formatted with the currency symbol) and Status (a chip).
  - `TableSortLabel` on Invoice date, Due date and Total, kept in sync with the Sort controls.
  - Clicking a row opens the detail page.
  - `TablePagination` with 10, 20, 50 or 100 rows.
- **Mobile:** a card per Invoice (number and status chip, Customer, dates, Total), each card a link, plus `Pagination` and a page-size select.
- **States:**
  - Loading: skeleton rows.
  - Empty: "No invoices match your filters" with a Clear-filters action, or "No invoices yet" with a Create action. A page past the end offers a link back to page 1.
  - Error: an `Alert` with Retry.

**`InvoiceDetailPage`:**
- **Header:** a back link that restores the list's query string (carried in location state), then the invoice number and a status chip.
- **Cards**, in a responsive grid:
  - **Invoice:** number, reference, invoice date, due date, currency, description, created at.
  - **Customer:** name, email (a mailto link), mobile, address.
  - **Invoice Items** table: name, quantity, Rate, amount.
  - **Summary:** Sub-total, Tax (`taxRate` %), Discount, Total Amount, Total Paid, and **Balance**, emphasised.
- **States:** 404 or 400 shows "Invoice not found" and "There is no invoice at this address. Check the link, or go back to the list." with a back link; loading shows skeletons; an error shows Retry.

**`CreateInvoicePage`:**
- **Layout:** cards for Customer, Invoice details, Item, and Tax & discount, in one column on mobile and two on desktop.
- **Defaults:**
  - Invoice date: today (local date).
  - Due date: today + 30 days.
  - Currency AUD, Tax Rate 10, Discount 0, quantity 1.
- **Inputs:** both dates are native date inputs (`type="date"`), and the currency is a select over the supported list.
- **Validation.** The Zod schema mirrors §5.3, including `dueDate ≥ invoiceDate`, except two rules that only the server can check: Invoice Number uniqueness (only the database can tell) and the Discount limit (it depends on the server's decimal rounding). Their server messages appear on their fields (see Submit). Fields are validated on blur and on submit, and the first invalid field gets focus.
- **Submit:**
  - The button is disabled while pending.
  - **201:** invalidate `['invoices']`, show the toast "Invoice <number> created", and navigate to `/invoices`. The new Invoice appears at the top because the default sort is newest first.
  - **409:** set a field error on `invoiceNumber`.
  - **400:** attach each server message to the field its path names (`customer.email …` → `customer.email`, `items.0.rate …` → the item rate, `discount …` → `discount`). Messages that match no field go into a form-level `Alert`.
- No totals preview: totals come from the server only (A§2.1.4).

### 6.4 Shared UI and formatting

- **`formatMoney(amount, symbol)`** produces `AU$2,180.00`: grouped, always 2 decimal places, no arithmetic.
- **`formatDate('2026-06-03')`** produces `03 Jun 2026`: parsed as UTC, so the date never shifts.
- **`StatusChip` colours:** Draft default/grey, Pending info/blue, Paid success/green, Overdue error/red.
- **Theme:** MUI `createTheme` (brand primary, responsive typography), `CssBaseline`, and self-hosted Roboto via `@fontsource/roboto`.
- **Accessibility:** labelled inputs, links for navigation (not only row clicks), toasts announced to screen readers through notistack, focus on the first invalid field, and colour plus text in the status chips.

### 6.5 nginx (frontend container)

- **Routing:** `try_files $uri /index.html`, and `location /api/ { proxy_pass http://backend:3000/; }` with `X-Forwarded-Proto` and `X-Forwarded-For $remote_addr`. nginx is the edge, so it overwrites `X-Forwarded-For` instead of appending to it: a client cannot choose the address that the login throttle counts.
- **Compression:** gzip.
- **Caching:** `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`; `no-cache` for `index.html`.
- **Security headers:**
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`. `'unsafe-inline'` applies to styles only, because Emotion injects style tags.
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and a minimal `Permissions-Policy`.
  - nginx sends them with the SPA's responses (`/` and `/assets/`). API responses pass through with the API's own helmet headers, so no header appears twice.

## 7. Testing strategy

### 7.1 Backend unit tests (Vitest, `src/**/*.spec.ts`)

| Suite | Cases |
|---|---|
| `invoice-totals.spec.ts` | Appendix A figures (2000 / 200 / 20 / 2180 / 1451.34 / 728.66); default 10 % tax; 0 % tax; rounding half-up (a tie: 0.05 at 10 % → 0.01; otherwise 33.33 at 7.5 % → 2.50); float trap (0.1 × 3 = 0.30 exactly); multiple items summed; Discount equal to Sub-total + Tax → Total 0; Discount above → error; Balance from Total Paid |
| `invoice-status.spec.ts` | Paid past due → Paid; Draft and Pending past due → Overdue; due today → not Overdue; future due → Stored Status; **the matrix showing `STATUS_CRITERIA` ⇔ `deriveInvoiceStatus`** |
| `create-invoice.dto.spec.ts` | runs class-validator on plain objects: due before invoice date → the exact message; equal dates allowed; impossible dates (`2026-02-30`) rejected; items not exactly 1; quantity 0 or 1.5; Rate 0, negative or 3 decimal places; Tax Rate −1 or 101; Discount above Sub-total + Tax; invalid email; unsupported currency; unknown field rejected |
| `list-invoices-query.dto.spec.ts` | defaults; case-insensitive `status` and `ordering`; the `sortBy` whitelist; `page` and `pageSize` bounds; `fromDate` after `toDate` → the exact message |
| `invoice.mapper.spec.ts` | the Appendix A entity → exactly the JSON in §5.3; Decimal → number; Status derived from the given today; item `amount` |
| `generate-invoices.spec.ts` | the same output for the same date; 40 Invoices; every fixed edge case present; totals agree with `calculateInvoiceTotals`; Paid ⇒ Balance 0; Due Date ≥ Invoice Date |
| `config.spec.ts` | `JWT_SECRET` missing or shorter than 32 characters → error; `JWT_EXPIRES_IN` defaults to 3600 and is parsed as a number; an invalid `COOKIE_SECURE` → error |
| `invoices.service.spec.ts` | mocked repository: create saves Draft, Total Paid 0, server totals, `createdBy`, currency symbol; **`23505` on the number index → `ConflictException`**; other DB errors rethrown; `findOne` on a missing id → `NotFoundException` |
| `auth.service.spec.ts` | valid login → token and user; wrong password → 401; unknown email → 401 and bcrypt still runs |
| `jwt-extractor.spec.ts` | Bearer accepted; cookie without header ignored; cookie with header accepted; Bearer wins over cookie |
| `all-exceptions.filter.spec.ts` | HttpException shape; validation message array; unknown error → 500 without internals |
| `clock.service.spec.ts` | "today" in `APP_TIMEZONE` around midnight (fake timers) |

### 7.2 Backend e2e tests (Vitest + supertest + Testcontainers `postgres:17-alpine`, `test/**/*.e2e-spec.ts`)

Each run boots `AppModule` through the shared `app.setup.ts` against a fresh container, so the real migrations, real seed and real HTTP pipeline are under test. A fixed clock makes Overdue deterministic, and the seed runs with the same fixed date.

Each e2e file logs in once and reuses the token. Every login sends its own client IP in `X-Forwarded-For`, which the app trusts as it trusts the bundled nginx (`TRUST_PROXY`). So each login has its own throttle bucket, and the login limit never trips another test. The throttle test reuses one IP on purpose.

- **Auth:**
  - Login 200 with the cookie flags (`HttpOnly`, `SameSite=Strict`, `Max-Age`); wrong password 401; invalid email 400.
  - `/auth/me`: Bearer → 200; cookie + header → 200; **cookie only → 401**; no credentials → 401.
  - Logout with cookie + header → 204 and the cookie is cleared; logout with a cookie but no header → 401.
  - A form-encoded login body → 400; the login throttle → 429.
- **Invoices (the key workflow):**
  - **Create (201, Draft, server-computed totals), then find it in `GET /invoices?keyword=<partial lower-case number>`, then `GET /invoices/:id` returns the same data.**
  - Duplicate number, including a case variant → 409. Due date before invoice date → 400 with the exact message.
  - Each status filter returns only Invoices whose computed Status matches.
  - Keyword is case-insensitive and partial, on both the number and the Customer name.
  - `sortBy` × `ordering` comes back ordered; `fromDate`/`toDate` is inclusive; `page`/`pageSize`/`total` are correct.
  - 404 shape; invalid UUID → 400; every `/invoices` route without auth → 401.
- **Seed:** running the seeder twice gives the same row counts. The Appendix A Invoice exists with Status Overdue and its exact amounts.
- **Swagger:** `GET /api/docs-json` returns 200 and lists every endpoint.

### 7.3 Frontend tests (Vitest 5 + Testing Library + user-event + MSW 3)

| Area | Cases |
|---|---|
| Login | required and invalid-email messages; success → `/invoices`; success → back to `from`; 401 alert; 429 alert |
| Guard and session | anonymous visit to `/invoices` → `/login`; authenticated → page renders; a 401 during use → login with the "session expired" toast |
| List | rows rendered from the API; debounced search sends `keyword`; Status select sends `status`; header sort toggles `sortBy`/`ordering`; pagination sends `page`/`pageSize`; the URL reflects the state and the state is restored from the URL; empty and error states; mobile cards (stubbed `matchMedia`) |
| Detail | every section and amount shown as served; 404 state |
| Create | required and format errors; due before invoice date; success → exact POST body, success toast, navigation to the list; 409 → invoice-number field error; server 400 messages attached to their fields |
| Units | `formatMoney`, `formatDate`, `StatusChip`, the list-params parser |

### 7.4 CI (`.github/workflows/ci.yml`, on push and PR)

The three jobs run in parallel.

1. **backend:** `npm ci` → lint → Prettier check → type-check → build → unit tests → e2e tests (Docker is available on `ubuntu-latest`).
2. **frontend:** `npm ci` → lint → Prettier check → type-check → tests → build.
3. **compose-smoke:**
   1. `docker compose up -d --build --wait`, with no `.env` file: compose waits until every service is healthy.
   2. `scripts/smoke-test.sh`, through the frontend container: `GET /` returns the SPA with its security headers; `GET /api/invoices` without a session returns 401; `POST /api/auth/login` sets the session cookie; `GET /api/auth/me` returns the User; an authenticated `GET /api/invoices` finds the seeded Appendix A Invoice; logout ends the session; and the backend serves the OpenAPI document.
   3. The container logs on failure, and `docker compose down -v` always.

## 8. Delivery

- **README.md** contains:
  - an overview and an architecture diagram (Mermaid), and the tech stack;
  - a Docker quick start and a ports table;
  - **the default credentials**;
  - how to run without Docker (Postgres via `docker compose up db` or a local install);
  - the seed commands and an env-variable table;
  - an API summary with curl examples and the Swagger link, and the test commands;
  - the project structure and the monorepo rationale;
  - design decisions and assumptions (linking CONTEXT.md, the ADRs and this spec), security notes, and known limitations.
- **Code documentation:** each module, service, hook and key component starts with a short doc comment stating its job. Comments explain *why*, not *what*. Swagger documents the HTTP API.
- **Definition of done:**
  1. All lint, type-check, unit and e2e suites are green.
  2. A clean `docker compose up --build` reaches a healthy stack.
  3. The full flow, driven in Chrome at mobile (390 px) and desktop (1440 px) widths, works: login, then list (search, filter, sort, paginate), then detail, then create (success toast and redirect), then logout.
  4. Swagger documents every endpoint.

## 9. Assumptions (decided without asking; approved by the User on 2026-10-02)

Each entry gives the decision, then its justification.

**Project and stack**
1. **A monorepo at `simple-invoice/`** with `frontend/`, `backend/`, `docker-compose.yml` and `README.md`. This is A§2.4.1's suggested layout, and it keeps the assessment PDF out of the repo. There is no shared workspace package; the currency list is mirrored instead, which keeps each Dockerfile self-contained.
2. **The backend is NestJS 12 as `nest new` generates it today:** ESM, TS 6.0 and Vitest, plus TypeORM 1.1 and PostgreSQL 17. It was verified end to end by a spike. TypeORM is the first-party `@nestjs/typeorm` integration, which matches the spec's other first-party choices (ValidationPipe, `@nestjs/swagger`).
3. **The frontend is React 19, Vite 8 and TS 6.0**, with React Router 8, TanStack Query 5, React Hook Form + Zod 4, axios, MUI 9 and notistack. Each is the most widely adopted option in its category (A§2.2 encourages such libraries), and all were verified together by a spike.
4. **Both apps use Vitest, oxlint and Prettier**, which is what both official scaffolds now generate.
5. **Migrations are hand-written in SQL and `synchronize` is off**, so constraints and indexes are explicit for the "Database Design" criterion.

**Domain rules**

6. **The Overdue rule is applied literally:** a Draft past its Due Date reads Overdue (A§2.3.2 exempts only Paid).
7. **"today" is the server date in `APP_TIMEZONE`** (UTC by default), taken from one injectable clock. Dates are calendar dates, and one clock keeps the list, the detail view and the tests consistent.
8. **The status filter matches the computed Status, not the Stored Status.** It is evaluated in SQL, so the filter results agree with the badges and the pagination totals stay correct.
9. **The Discount is an amount, not a percentage** (Appendix A: 2000 + 200 − 20 = 2180). A Discount larger than Sub-total + Tax Amount is rejected with 400, so a Total Amount can never be negative.
10. **Money uses exact decimal maths, `NUMERIC(15,2)` columns, and half-up rounding of the Tax Amount to 2 decimal places.** The JSON carries numbers, as Appendix A does. The bounds (quantity ≤ 1,000,000; Rate ≤ 1,000,000 with at most 2 decimal places; Tax Rate 0–100) keep every amount within `NUMERIC(15,2)`, and small enough that its JSON number converts back to the exact cent.
11. **The Tax Rate is stored on each Invoice**, although it is absent from the A§3 model, so the detail view can show "Tax (10%)" as stored (A§2.1.3, "accurately reflect").
12. **Invoice Numbers are trimmed and unique regardless of case**, using the characters ``[A-Za-z0-9-_/.#]``, starting with a letter or digit, up to 50 long. `INV-001` and `inv-001` would confuse people, and search is case-insensitive too.
13. **The Customer is a snapshot on the Invoice** (ADR-0001): an Invoice is a financial record, and nothing in scope manages Customers.
14. **Currencies come from a curated list of 2-decimal ISO codes, with symbols derived on the server.** The form has only a currency field (A§2.1.4), while the model needs `currencySymbol` (A§3.1). JPY and VND are excluded because their amounts don't use 2 decimal places.
15. **The create form also accepts the model's optional `invoiceReference` and `description`.** The mobile number, when given, accepts digits, spaces and `+ - ( )`, 6–20 characters. This keeps the A§3.1 fields populated, and the format check catches typing mistakes.
16. **A new Invoice gets Stored Status Draft, Total Paid 0, and `createdBy` = the signed-in User.** Every User sees every Invoice: A§2.1 says "all available invoices within the system".

**API**

17. **Paths are exactly A§2.3.1's, with no global prefix.** Swagger is at `/api/docs`, and the SPA reaches the API through a same-origin `/api` proxy. Reviewers can call the documented paths directly, and the proxy keeps the auth cookie first-party.
18. **The create payload mirrors the response:** `customer {…}` and `items[]`, with exactly one item enforced. Response items carry a server-computed `amount`. This keeps the shapes symmetric and the model ready for more items (A§2.1.4), and the UI does no arithmetic.
19. **One InvoiceDto serves the list, detail and create**, and `paging` is exactly `{page, pageSize, total}`. A§2.3.1 takes precedence over the mock's `pageNumber/totalRecords`. The defaults are page 1, pageSize 10 (max 100), newest first, `ordering` DESC, and `invoice_id` as tie-breaker. `status` and `ordering` are case-insensitive. `fromDate > toDate` returns 400. The mock's `type` and `invoiceGrossTotal` are not modelled. These choices give consistent response shapes (A§4.1), and a just-created Invoice tops the list.
20. **Search trims the keyword, runs `ILIKE` with the wildcards escaped, and is backed by `pg_trgm` GIN indexes.** This gives case-insensitive partial matching (A§2.1.2) with index support.
21. **Every error has the shape `{statusCode, message, error}`:** 400, 401, 404, 409, 429 and 500, where a 500 never includes internals. A malformed UUID or an unknown field returns 400. This follows A§2.3.5 and A§2.3.6 and the "appropriate HTTP status codes" criterion.

**Security and operations**

22. **Credentials and the JWT are handled safely:**
    - HS256, with a required secret of at least 32 characters and no default in code.
    - `JWT_EXPIRES_IN` is parsed as seconds (default 3600).
    - bcrypt at cost 12, through bcryptjs, which needs no native build.
    - A generic login error with a dummy-hash compare.
    - A global guard with `@Public()` as the opt-out, which re-checks that the User exists.
    - helmet, a 5-per-minute-per-IP login throttle, and nginx CSP and security headers.

    This serves the "Secure JWT implementation" criterion and the security priority.
23. **`docker compose up` works on a fresh clone with no `.env` file.** The compose file holds labelled local-only defaults, ports are bound to 127.0.0.1 and can be overridden, the app code has no secret defaults, and the `.env.example` files hold placeholders only. This reconciles "single command from zero" (A§2.4.2) with "no hardcoded secrets" (A§2.4.3).
24. **The container runs migrations and an idempotent seed on start.** `npm run seed` applies pending migrations first, and `seed:reset` restores the demo data. A reviewer needs no manual database steps, and A§2.3.4 requires seeding with one command.
25. **The seed contains the Appendix A Invoice verbatim (stored as Pending) plus 40 deterministic generated Invoices with dates relative to the seed day.** The default User reuses Appendix A's `createdBy` UUID, and its credentials are `admin@example.com` / `Password123!`. This follows A§2.3.4 and the seed guidance (20–50 records with varied statuses, dates and amounts), and the relative dates keep Overdue meaningful whenever it runs.
26. **Value-add stays lean.** Included:
    - health checks;
    - GitHub Actions CI with a compose smoke test;
    - URL-synced list filters with debounced search;
    - session-expiry handling that returns you to the page you were on;
    - responsive table-to-card layouts;
    - skeleton, empty and error states;
    - logout.

    Excluded: a dashboard, editing, payments or status changes, a totals preview, a print/PDF view, Playwright tests and dark mode. The User ranked polish below conventions and security.

## 10. Out of scope / known limitations (to repeat in the README)

- Only one Invoice Item per Invoice in the UI and API. The model supports more.
- No Invoice editing, deletion, status transitions or payment recording. Total Paid changes only through seed data.
- No User registration, password reset or roles. Every signed-in User sees every Invoice.
- No refresh tokens: when the JWT expires (60 minutes by default), the User signs in again. Logout cannot revoke a token that was already issued (it is stateless, per A§2.3.3).
- Only currencies with 2 decimal places, from a curated list.
- "today" for Overdue follows a single server time zone (`APP_TIMEZONE`).
- The default `TRUST_PROXY` trusts any proxy on a private network, which suits the bundled nginx. A production deployment must name its real proxy, or clients could spoof `X-Forwarded-For` and get around the per-IP login throttle.
- The compose file's local-only defaults (database password, JWT secret, demo password) are for running on one machine only. A real deployment overrides every one of them in `.env`.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Very new library majors (Nest 12, TypeORM 1.x, MUI 9, React Router 8, MSW 3) | Versions pinned exactly as verified by the spikes; gotchas listed in §3; CI catches regressions |
| A port conflict on a reviewer's machine (3000, 5432, 8080) | Host ports overridable through env; documented in the README |
| Overdue depends on the day the stack runs | Seed dates are relative to the seed day; tests use a fixed clock |
| The cookie path and the Bearer path drift apart | Each has its own e2e tests (§7.2) |
| helmet's default Content-Security-Policy blocks part of Swagger UI | Swagger UI's files are same-origin, which helmet's CSP allows. Only `upgrade-insecure-requests` is dropped, because the stack runs over plain http://localhost. `localhost:3000/api/docs` is checked in Chrome during the live test. |

## 12. Glossary and decision references

- `CONTEXT.md`: domain terms and resolved ambiguities.
- ADR-0001: Customer snapshot on the Invoice.
- ADR-0002: the JWT in an httpOnly cookie for the SPA, Bearer for API tools.

## 13. Requirements traceability

| A§ | Requirement | Design (§ of this spec) | Verified by |
|---|---|---|---|
| 1.2 | React frontend, NestJS backend, own DB, no third-party APIs | §2, §3 | build plus compose smoke test |
| 2.1.1 | Login screen with email and password | §6.3 `LoginPage` | FE login tests |
| 2.1.1 | Client- and server-side validation | Zod (§6.3), `LoginDto` with class-validator (§5.3) | FE login tests; e2e 400 |
| 2.1.1 | JWT issued and stored securely on the client | §5.4, ADR-0002 (httpOnly cookie) | e2e cookie flags |
| 2.1.1 | Protected routes; redirect to Login | §6.1 `RequireAuth`, §6.2 | FE guard tests; e2e 401s |
| 2.1.2 | List is the default home after login | §6.1 (`/` → `/invoices`; login → `/invoices`) | FE login-success test |
| 2.1.2 | Paginated list with Number, Customer, Invoice Date, Due Date, Total, Status | §6.3 list, §5.3 | FE list test |
| 2.1.2 | Search on number or Customer name, case-insensitive and partial | §5.3 `keyword` + trigram index | e2e keyword; FE search test |
| 2.1.2 | Filter by Draft, Pending, Paid, Overdue | §5.2 `STATUS_CRITERIA`, §5.3 | unit matrix; e2e filters; FE filter test |
| 2.1.2 | Sort by invoiceDate, dueDate, totalAmount, ASC or DESC | §5.3 sort map | e2e sorting; FE sort test |
| 2.1.2 | Server-side pagination, configurable page size | §5.3 `page`/`pageSize` | e2e paging; FE pagination test |
| 2.1.3 | Select from the list → Details view | §6.3 links and row click | FE list and detail tests |
| 2.1.3 | Invoice and Customer info, items, Sub-total, Tax, Discount, Total, Balance, Status | §6.3 detail, §5.3 `InvoiceDto` | FE detail test; e2e detail |
| 2.1.3 | Detail matches the stored record | the mapper reads the stored values; only Status and item `amount` are computed | e2e create → detail |
| 2.1.4 | Create form | §6.3 create | FE create tests |
| 2.1.4 | Exactly one item; model ready for more | `items` array of size 1, separate `invoice_items` table | DTO unit test |
| 2.1.4 | New Invoices are Draft | §5.3 create flow | service unit test; e2e |
| 2.1.4 | Invoice number user-provided and unique | DTO and unique index; 409 | service unit test; e2e 409 |
| 2.1.4 | Field validation table | §5.3 `CreateInvoiceDto` and the mirrored Zod schema | DTO unit tests; FE create tests |
| 2.1.4 | Success notification, redirect to the list | §6.3 create submit | FE create success test |
| 2.1.4 | Total calculated by the backend | §5.2 `calculateInvoiceTotals` | unit totals; e2e create |
| 2.2 | React + TypeScript, responsive, clean and documented | §6, §3 | FE mobile-cards test; manual 390 px and 1440 px check |
| 2.2 | FE unit tests for critical flows and key components | §7.3 | `npm test` (frontend) |
| 2.3 | NestJS + TypeScript, REST, relational DB, modular | §5.1 | build; e2e |
| 2.3.1 | Five endpoints and the eight query parameters | §5.3 | e2e; Swagger |
| 2.3.1 | Response shape `{data, paging:{page,pageSize,total}}` | §5.3 | e2e list |
| 2.3.2 | Formulas for subTotal, tax, total and balance | §5.2 | unit totals |
| 2.3.2 | Number uniqueness enforced by the DB | unique index on `lower(invoice_number)` | e2e 409 |
| 2.3.2 | Due date validated on the server | `@IsOnOrAfter('invoiceDate')` (§5.3) plus a DB CHECK (§4.2) | DTO unit test; e2e 400 |
| 2.3.2 | Overdue computed when read; DB stores only Draft, Pending, Paid | §5.2; the enum has no Overdue | unit status; e2e filters |
| 2.3.3 | JWT access tokens; `/invoices` guarded | §5.4 global guard | e2e 401s |
| 2.3.3 | Expiry from env, default 3600 s | `JWT_EXPIRES_IN` (§5.7) | config test; e2e cookie `Max-Age` |
| 2.3.3 | A seeded default User, documented in the README | §5.8, §8 | e2e seed; README |
| 2.3.4 | Seed script based on Appendix A; 20–50 extra varied records; `npm run seed` | §5.8 | e2e seed idempotency |
| 2.3.5 | class-validator + class-transformer on all endpoints; structured 400 | §5.3, §5.5 | DTO unit tests; e2e 400 |
| 2.3.6 | Global exception filter, consistent shape | §5.5 | filter unit test; e2e 404 |
| 2.3.7 | Unit tests: totals, Overdue, due date, uniqueness; at least 1 e2e workflow | §7.1, §7.2 | `npm test`, `npm run test:e2e` |
| 2.3.8 | Swagger via `@nestjs/swagger` at `/api/docs`, fully documented | §5.6 | manual check; e2e `GET /api/docs-json` returns 200 |
| 2.4.1 | Monorepo, documented | §2.2, README | README |
| 2.4.2 | One compose command; a Dockerfile per service; ports in the README | §2.1, §8 | compose smoke test (CI) |
| 2.4.3 | `.env` configuration, `.env.example`, no hardcoded secrets | §5.7 | config validation at boot; review |
| 3.x | Invoice, Customer (choice documented), Invoice Item, User (bcrypt) | §4, ADR-0001 | migrations; e2e |
| 4.2 | README contents | §8 | README |
