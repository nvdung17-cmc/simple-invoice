# SimpleInvoice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SimpleInvoice — a NestJS 12 + PostgreSQL 17 REST API and a React 19 SPA that let a signed-in User list, search, filter, sort, view and create Invoices — so that one `docker compose up --build` starts the whole stack with seeded demo data.

**Architecture:** A monorepo with `backend/` (conventional NestJS feature modules around a pure, framework-free domain core: totals, Status derivation and the status-filter criteria) and `frontend/` (Vite SPA with React Router data routes, TanStack Query, React Hook Form + Zod and MUI). In Docker, nginx serves the SPA and proxies the same-origin `/api/*` to the backend, stripping the `/api` prefix, because the API paths have no global prefix. The SPA authenticates with an httpOnly cookie that the API accepts only together with `X-Requested-With: XMLHttpRequest`; API tools use `Authorization: Bearer` (ADR-0002).

**Tech Stack:** Node 24 · NestJS 12.1.2 (ESM) · TypeScript 6.0.3 · TypeORM 1.1.1 · PostgreSQL 17 · passport-jwt · class-validator · decimal.js · Swagger · Vitest 4 + supertest + Testcontainers · React 19.3 · Vite 8.3 · React Router 8.4 · TanStack Query 5 · React Hook Form 7 + Zod 4 · axios · MUI 9 · notistack · Vitest 5 + Testing Library + MSW 3 · oxlint · Prettier · Docker Compose · nginx · GitHub Actions.

**Source documents (read before starting any task):**
- Spec: `docs/specs/2026-10-02-simple-invoice-design.md` (§ numbers below refer to it).
- Domain language: `CONTEXT.md`.
- Decisions: `docs/adr/0001-customer-snapshot-on-invoice.md`, `docs/adr/0002-jwt-in-httponly-cookie.md`.

## Global Constraints

Every task's requirements implicitly include this section.

**Security (assessment A§2.4.3, verbatim):**
- "All environment-specific configuration values (including database connection strings, JWT secrets, and application ports) must be managed via .env files."
- "A .env.example file must be provided, containing all required configuration keys without any real or sensitive values."
- "All secrets, credentials, and configuration parameters must be sourced exclusively from environment variables."
- "Hardcoding of sensitive information within the codebase is strictly prohibited."
- So: application code never contains a default for `JWT_SECRET`, `DATABASE_URL` or any password. Only `docker-compose.yml` holds clearly labelled **local-only** defaults (§5.7), and tests generate their own secrets at run time.
- Never commit a `.env` file. Never commit `Assessment_Fullstack_v3.0.0.pdf` (it lives outside the repo).

**Domain language:** use the `CONTEXT.md` terms in code, UI copy, API docs and tests — User, Customer, Invoice, Invoice Number, Invoice Reference, Invoice Item, Rate, Invoice Date, Due Date, Stored Status, Status, Draft, Pending, Paid, Overdue, Currency, Sub-total, Tax Rate, Tax Amount, Discount, Total Amount, Total Paid, Balance. Do not use the words the glossary says to avoid: "client", "line item", "price", "deadline", "derived status", "grand total", "outstanding amount".

**Pinned versions (exact; write them without `^` or `~`):**
- Backend dependencies: `@nestjs/common` 12.1.2, `@nestjs/core` 12.1.2, `@nestjs/platform-express` 12.1.2, `@nestjs/config` 12.0.1, `@nestjs/jwt` 12.0.2, `@nestjs/passport` 12.0.0, `@nestjs/swagger` 12.0.2, `@nestjs/terminus` 12.1.0, `@nestjs/throttler` 6.7.1, `@nestjs/typeorm` 12.0.2, `typeorm` 1.1.1, `pg` 8.23.1, `passport` 0.7.0, `passport-jwt` 4.0.1, `class-validator` 0.15.1, `class-transformer` 0.5.1, `bcryptjs` 3.0.3, `decimal.js` 10.6.0, `helmet` 8.3.0, `cookie-parser` 1.4.7, `reflect-metadata` 0.2.2, `rxjs` 7.8.2.
- Backend dev dependencies: `typescript` 6.0.3, `vitest` 4.1.11, `@vitest/coverage-v8` 4.1.11, `@nestjs/cli` 12.0.8, `@nestjs/schematics` 12.0.6, `@nestjs/testing` 12.1.2, `@testcontainers/postgresql` 12.2.0, `supertest` 7.3.0, `@types/supertest` 7.2.1, `@types/express` 5.0.6, `@types/node` 24.19.1, `@types/passport-jwt` 4.0.1, `@types/pg` 8.23.1, `@types/cookie-parser` 1.4.10, `oxlint` 1.86.0, `oxlint-tsgolint` 7.0.2003, `prettier` 3.9.9, `source-map-support` 0.5.21. No `@nestjs/mau`, no `vite-tsconfig-paths`, no Jest.
- Frontend dependencies: `react` 19.3.0, `react-dom` 19.3.0, `react-router` 8.4.0, `@tanstack/react-query` 5.104.0, `react-hook-form` 7.89.0, `zod` 4.6.5, `@hookform/resolvers` 5.9.1, `axios` 1.20.0, `@mui/material` 9.4.0, `@mui/icons-material` 9.4.0, `@emotion/react` 11.14.0, `@emotion/styled` 11.14.1, `notistack` 3.0.2, `@fontsource/roboto` 5.3.0.
- Frontend dev dependencies: `typescript` 6.0.3, `vite` 8.3.2, `@vitejs/plugin-react` 6.1.1, `vitest` 5.0.3, `jsdom` 30.1.1, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.7, `@testing-library/jest-dom` 7.0.1, `msw` 3.0.1, `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `@types/node` 24.19.1, `oxlint` 1.86.0, `prettier` 3.9.9. No ESLint.
- Both `package.json` files: `"engines": { "node": "^22.22.2 || >=24.15.0" }`.
- Docker images: `node:24-alpine`, `postgres:17-alpine`, `nginxinc/nginx-unprivileged:1.30-alpine`. CI: `actions/checkout@v7`, `actions/setup-node@v7`, Node 24.

**Backend code rules (§3):**
- ESM (`"type": "module"`, `module: nodenext`): every relative import ends in `.js` (`import { X } from './x.js'`). Top-level `await` is allowed.
- DTO classes used as `@Body()`, `@Query()` or nested `@Type()` targets must be **value imports**, never `import type`, or the `ValidationPipe` silently stops validating.
- No TypeScript `enum`s; use `as const` arrays and string-literal unions.
- `import { Decimal } from 'decimal.js'` (named import). `import bcrypt from 'bcryptjs'` (default import).
- Circular entity relations use TypeORM's `Relation<T>` wrapper.
- `@nestjs/jwt` `expiresIn` is a **number of seconds**.
- Style: Prettier `{ "singleQuote": true, "trailingComma": "all" }`; oxlint must pass with `--type-aware`.

**Frontend code rules (§3):**
- `verbatimModuleSyntax` + `erasableSyntaxOnly`: type-only imports use `import type`; no `enum`s; no constructor parameter properties. `noUnusedLocals`/`noUnusedParameters` are on: no unused imports or variables.
- React Router 8: import from `react-router`, except `RouterProvider` from `react-router/dom`.
- MUI 9: no system props (use `sx`); `Grid` takes `size={{ xs: 12, md: 6 }}`; TextField customisation goes through `slotProps`.
- Zod 4: `z.email()`; numeric text inputs use `z.coerce.number<string>()` and forms are typed `useForm<z.input<S>, unknown, z.output<S>>`.
- React Hook Form + MUI: pass `inputRef={field.ref}`.
- MSW 3: `server.listen({ onUnhandledFrame: 'error' })`.
- Style: Prettier `{ "semi": false, "singleQuote": true, "printWidth": 100 }`; oxlint must pass.

**Documentation rule (§8):** each module, service, hook and key component starts with a short doc comment stating its job. Comments explain *why*, not *what*.

**Commits:** one commit per task (more are fine), message in Conventional Commits style, ending with this trailer line:

```
Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```

The repo-local git identity is already configured. Do not push, and do not create a GitHub repository.

**Working directory:** the repository root is `/Users/nvdung17/Downloads/SBU1/simple-invoice`. All paths in this plan are relative to it. Commands that start with `cd backend` or `cd frontend` run from the repository root.

**Docker is required** for the backend e2e tests (Testcontainers starts `postgres:17-alpine`).

---

## File structure

```
simple-invoice/
├── .gitignore · .env.example · docker-compose.yml · README.md · CONTEXT.md
├── .github/workflows/ci.yml
├── scripts/smoke-test.sh
├── docs/adr/ · docs/specs/ · docs/superpowers/plans/
├── backend/
│   ├── package.json · package-lock.json · tsconfig.json · tsconfig.build.json · nest-cli.json
│   ├── vitest.config.ts · vitest.config.e2e.ts · .oxlintrc.json · .prettierrc
│   ├── Dockerfile · docker-entrypoint.sh · .dockerignore · .env.example
│   ├── src/
│   │   ├── main.ts · app.module.ts · app.setup.ts
│   │   ├── config/        env.validation.ts · load-env-file.ts · config.spec.ts
│   │   ├── common/        iso-date.ts · transforms.ts · validators.ts · clock.service.ts
│   │   │                  all-exceptions.filter.ts · public.decorator.ts · current-user.decorator.ts
│   │   │                  error-response.dto.ts  (+ *.spec.ts)
│   │   ├── users/         user.entity.ts · password-hasher.ts · users.service.ts · users.module.ts
│   │   ├── auth/          auth.module.ts · auth.controller.ts · auth.service.ts · auth-cookie.ts
│   │   │                  jwt-payload.ts · jwt-extractor.ts · jwt.strategy.ts · jwt-auth.guard.ts
│   │   │                  dto/  (+ specs)
│   │   ├── invoices/      invoices.module.ts · invoices.controller.ts · invoices.service.ts
│   │   │                  invoice.mapper.ts · domain/ · dto/ · entities/  (+ specs)
│   │   ├── health/        health.module.ts · health.controller.ts
│   │   └── database/      data-source.ts · decimal.transformer.ts · migrate.ts
│   │                      migrations/1790812800000-InitialSchema.ts
│   │                      seed/ seed-invoice.ts · appendix-a.ts · generate-invoices.ts · seeder.ts · run-seed.ts
│   └── test/              utils/database.ts · utils/test-app.ts · *.e2e-spec.ts
└── frontend/
    ├── package.json · package-lock.json · index.html · vite.config.ts · tsconfig*.json
    ├── .oxlintrc.json · .prettierrc · Dockerfile · nginx.conf · security-headers.conf
    ├── .dockerignore · .env.example · public/favicon.svg
    └── src/
        ├── main.tsx · App.tsx · routes.tsx · theme.ts · queryClient.ts
        ├── api/           http.ts · errors.ts · auth.ts · invoices.ts · types.ts
        ├── auth/          auth-context.ts · AuthProvider.tsx · useAuth.ts · RequireAuth.tsx · LoginPage.tsx
        ├── components/    AppLayout · PageHeader · StatusChip · EmptyState · ErrorState
        │                  FullPageSpinner · NotFoundPage · SectionCard
        ├── features/invoices/
        │   ├── listParams.ts · schema.ts
        │   ├── hooks/     useInvoiceListParams.ts · useDebouncedValue.ts · useInvoiceList.ts
        │   ├── list/      InvoiceListPage · SearchField · InvoiceFilters · InvoiceTable · InvoiceCards
        │   │              linkState.ts
        │   ├── detail/    InvoiceDetailPage · DetailList
        │   └── create/    CreateInvoicePage · FormTextField
        ├── lib/           format.ts · dates.ts · currencies.ts
        └── test/          setup.ts · renderApp.tsx · fixtures.ts · httpError.ts · mockMatchMedia.ts · msw/
```

Task order: backend Tasks 1–8, frontend Tasks 9–14, delivery Tasks 15–17. Each task leaves every existing suite green.

---
### Task 1: Backend scaffold and pure domain core

Sets up the backend toolchain (NestJS 12 ESM layout, TypeScript 6, Vitest 4, oxlint, Prettier) and the framework-free business rules of §5.2: calendar-date helpers, the Currency map, `calculateInvoiceTotals` and the Status rules.

**Files:**
- Create: `.gitignore`
- Create: `backend/package.json` (then `npm install` creates `backend/package-lock.json`)
- Create: `backend/tsconfig.json`, `backend/tsconfig.build.json`, `backend/nest-cli.json`
- Create: `backend/vitest.config.ts`, `backend/vitest.config.e2e.ts`
- Create: `backend/.oxlintrc.json`, `backend/.prettierrc`
- Create: `backend/src/common/iso-date.ts`
- Create: `backend/src/invoices/domain/currencies.ts`
- Create: `backend/src/invoices/domain/invoice-totals.ts`
- Create: `backend/src/invoices/domain/invoice-status.ts`
- Test: `backend/src/common/iso-date.spec.ts`
- Test: `backend/src/invoices/domain/invoice-totals.spec.ts`
- Test: `backend/src/invoices/domain/invoice-status.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `common/iso-date.ts`: `todayIn(timeZone: string, now?: Date): string`, `addDays(isoDate: string, days: number): string`, `isIsoDate(value: unknown): value is string`.
  - `invoices/domain/currencies.ts`: `CURRENCY_SYMBOLS` (readonly map `AUD → 'AU$'` …), `type CurrencyCode`, `CURRENCY_CODES: CurrencyCode[]`.
  - `invoices/domain/invoice-totals.ts`: `type DecimalInput = Decimal | number | string`, `DEFAULT_TAX_RATE = 10`, `class DiscountExceedsTotalError extends Error` (message `discount must not exceed the sub-total plus tax`), `interface TotalsInput { items: ReadonlyArray<{ quantity: number; rate: DecimalInput }>; taxRate: DecimalInput; discount: DecimalInput; totalPaid?: DecimalInput }`, `interface InvoiceTotals { subTotal; taxAmount; discount; totalAmount; totalPaid; balanceAmount }` (all `Decimal`), `calculateInvoiceTotals(input: TotalsInput): InvoiceTotals`.
  - `invoices/domain/invoice-status.ts`: `STORED_STATUSES`, `type StoredStatus = 'Draft' | 'Pending' | 'Paid'`, `INVOICE_STATUSES`, `type InvoiceStatus = StoredStatus | 'Overdue'`, `type DuePosition`, `interface StatusCriteria { storedIn: readonly StoredStatus[]; due: DuePosition }`, `STATUS_CRITERIA: Readonly<Record<InvoiceStatus, StatusCriteria>>`, `deriveInvoiceStatus(stored, dueDate, today): InvoiceStatus`, `matchesStatusCriteria(row: { status: StoredStatus; dueDate: string }, criteria, today): boolean`.

- [ ] **Step 1: Create the root `.gitignore`**

```gitignore
# Dependencies and build output
node_modules/
dist/
coverage/
*.tsbuildinfo

# Local environment files: never commit real values (see the .env.example files)
.env
.env.*
!.env.example

# Logs and OS/editor files
*.log
.DS_Store
.idea/
.vscode/
```

- [ ] **Step 2: Create `backend/package.json`**

```json
{
  "name": "simple-invoice-backend",
  "version": "1.0.0",
  "description": "SimpleInvoice REST API (NestJS + PostgreSQL)",
  "private": true,
  "license": "UNLICENSED",
  "type": "module",
  "engines": {
    "node": "^22.22.2 || >=24.15.0"
  },
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main.js",
    "lint": "oxlint --type-aware src/ test/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "test:e2e": "vitest run --config ./vitest.config.e2e.ts",
    "preseed": "nest build",
    "seed": "node dist/database/seed/run-seed.js",
    "preseed:reset": "nest build",
    "seed:reset": "node dist/database/seed/run-seed.js --reset",
    "premigration:run": "nest build",
    "migration:run": "node dist/database/migrate.js run",
    "premigration:revert": "nest build",
    "migration:revert": "node dist/database/migrate.js revert"
  },
  "dependencies": {
    "@nestjs/common": "12.1.2",
    "@nestjs/config": "12.0.1",
    "@nestjs/core": "12.1.2",
    "@nestjs/jwt": "12.0.2",
    "@nestjs/passport": "12.0.0",
    "@nestjs/platform-express": "12.1.2",
    "@nestjs/swagger": "12.0.2",
    "@nestjs/terminus": "12.1.0",
    "@nestjs/throttler": "6.7.1",
    "@nestjs/typeorm": "12.0.2",
    "bcryptjs": "3.0.3",
    "class-transformer": "0.5.1",
    "class-validator": "0.15.1",
    "cookie-parser": "1.4.7",
    "decimal.js": "10.6.0",
    "helmet": "8.3.0",
    "passport": "0.7.0",
    "passport-jwt": "4.0.1",
    "pg": "8.23.1",
    "reflect-metadata": "0.2.2",
    "rxjs": "7.8.2",
    "typeorm": "1.1.1"
  },
  "devDependencies": {
    "@nestjs/cli": "12.0.8",
    "@nestjs/schematics": "12.0.6",
    "@nestjs/testing": "12.1.2",
    "@testcontainers/postgresql": "12.2.0",
    "@types/cookie-parser": "1.4.10",
    "@types/express": "5.0.6",
    "@types/node": "24.19.1",
    "@types/passport-jwt": "4.0.1",
    "@types/pg": "8.23.1",
    "@types/supertest": "7.2.1",
    "@vitest/coverage-v8": "4.1.11",
    "oxlint": "1.86.0",
    "oxlint-tsgolint": "7.0.2003",
    "prettier": "3.9.9",
    "source-map-support": "0.5.21",
    "supertest": "7.3.0",
    "typescript": "6.0.3",
    "vitest": "4.1.11"
  }
}
```

The `pre*` hooks build first, so `npm run seed` and the migration scripts always run current code. The Docker image deletes those hooks (Task 15) because it already holds `dist/`.

- [ ] **Step 3: Create the TypeScript, Nest CLI, Vitest, oxlint and Prettier configs**

`backend/tsconfig.json` (TypeScript 6 defaults `types` to `[]`, so the list is explicit; `strictPropertyInitialization` is off because entities and DTOs are filled by TypeORM and class-transformer):

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": ".",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "strictPropertyInitialization": false,
    "types": ["vitest/globals", "node"]
  }
}
```

`backend/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

`backend/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

`backend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

// Unit tests: pure functions, DTOs and services with mocked dependencies.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
```

`backend/vitest.config.e2e.ts`:

```ts
import { defineConfig } from 'vitest/config';

// E2E tests: each file starts its own PostgreSQL container, so files run one at a time.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});
```

`backend/.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "rules": {
    "typescript/no-explicit-any": "off",
    "typescript/no-floating-promises": "error"
  },
  "env": {
    "node": true
  }
}
```

`backend/.prettierrc`:

```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

- [ ] **Step 4: Install dependencies**

Run: `cd backend && npm install`
Expected: exits 0 and creates `backend/package-lock.json`. (Deprecation warnings from transitive packages are fine.)

- [ ] **Step 5: Write the failing date-helper test**

`backend/src/common/iso-date.spec.ts`:

```ts
import { addDays, isIsoDate, todayIn } from './iso-date.js';

describe('todayIn', () => {
  const instant = new Date('2026-06-30T17:30:00.000Z');

  it('returns the calendar date in the given time zone', () => {
    expect(todayIn('UTC', instant)).toBe('2026-06-30');
    expect(todayIn('Asia/Ho_Chi_Minh', instant)).toBe('2026-07-01');
    expect(todayIn('America/Los_Angeles', instant)).toBe('2026-06-30');
  });
});

describe('addDays', () => {
  it('adds and subtracts whole days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-06-03', 30)).toBe('2026-07-03');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('isIsoDate', () => {
  it.each(['2026-06-03', '2028-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each([
    '2026-02-30',
    '2027-02-29',
    '2026-13-01',
    '2026-6-3',
    '03/06/2026',
    '',
    20260603,
    null,
  ])('rejects %s', (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd backend && npx vitest run src/common/iso-date.spec.ts`
Expected: FAIL — cannot resolve `./iso-date.js`.

- [ ] **Step 7: Implement the date helpers**

`backend/src/common/iso-date.ts`:

```ts
/**
 * Calendar-date helpers. Dates travel as ISO `YYYY-MM-DD` strings: they compare
 * correctly as text and never shift with the host time zone.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar date (`YYYY-MM-DD`) of `now` in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Adds whole days to an ISO date; negative values go back in time. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** True for a real calendar date in `YYYY-MM-DD` form, so `2026-02-30` is rejected. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `cd backend && npx vitest run src/common/iso-date.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 9: Write the failing totals test**

`backend/src/invoices/domain/invoice-totals.spec.ts`:

```ts
import {
  calculateInvoiceTotals,
  DEFAULT_TAX_RATE,
  DiscountExceedsTotalError,
  type InvoiceTotals,
} from './invoice-totals.js';

/** Totals as 2-decimal strings, so expectations read like money. */
function asMoney(totals: InvoiceTotals): Record<keyof InvoiceTotals, string> {
  return {
    subTotal: totals.subTotal.toFixed(2),
    taxAmount: totals.taxAmount.toFixed(2),
    discount: totals.discount.toFixed(2),
    totalAmount: totals.totalAmount.toFixed(2),
    totalPaid: totals.totalPaid.toFixed(2),
    balanceAmount: totals.balanceAmount.toFixed(2),
  };
}

describe('calculateInvoiceTotals', () => {
  it('reproduces the Appendix A figures', () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 2, rate: 1000 }],
      taxRate: 10,
      discount: 20,
      totalPaid: '1451.34',
    });
    expect(asMoney(totals)).toEqual({
      subTotal: '2000.00',
      taxAmount: '200.00',
      discount: '20.00',
      totalAmount: '2180.00',
      totalPaid: '1451.34',
      balanceAmount: '728.66',
    });
  });

  it('applies the default 10 % Tax Rate', () => {
    expect(DEFAULT_TAX_RATE).toBe(10);
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: '250.00' }],
      taxRate: DEFAULT_TAX_RATE,
      discount: 0,
    });
    expect(totals.taxAmount.toFixed(2)).toBe('25.00');
    expect(totals.totalAmount.toFixed(2)).toBe('275.00');
  });

  it('charges no tax at a 0 % Tax Rate', () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 4, rate: '12.50' }],
      taxRate: 0,
      discount: 0,
    });
    expect(totals.taxAmount.toFixed(2)).toBe('0.00');
    expect(totals.totalAmount.toFixed(2)).toBe('50.00');
  });

  it('rounds the Tax Amount half-up to the cent', () => {
    const tie = calculateInvoiceTotals({ items: [{ quantity: 1, rate: '0.05' }], taxRate: 10, discount: 0 });
    expect(tie.taxAmount.toFixed(2)).toBe('0.01');

    const other = calculateInvoiceTotals({ items: [{ quantity: 1, rate: '33.33' }], taxRate: '7.5', discount: 0 });
    expect(other.taxAmount.toFixed(2)).toBe('2.50');
  });

  it('avoids binary floating-point errors (0.1 × 3 = 0.30)', () => {
    const totals = calculateInvoiceTotals({ items: [{ quantity: 3, rate: 0.1 }], taxRate: 0, discount: 0 });
    expect(totals.subTotal.equals('0.3')).toBe(true);
    expect(totals.subTotal.toFixed(2)).toBe('0.30');
  });

  it('sums several Invoice Items into the Sub-total', () => {
    const totals = calculateInvoiceTotals({
      items: [
        { quantity: 2, rate: '10.50' },
        { quantity: 3, rate: '1.25' },
      ],
      taxRate: 10,
      discount: 0,
    });
    expect(totals.subTotal.toFixed(2)).toBe('24.75');
    expect(totals.taxAmount.toFixed(2)).toBe('2.48');
  });

  it('allows a Discount equal to the Sub-total plus Tax Amount (Total Amount 0)', () => {
    const totals = calculateInvoiceTotals({ items: [{ quantity: 1, rate: 100 }], taxRate: 10, discount: 110 });
    expect(totals.totalAmount.toFixed(2)).toBe('0.00');
    expect(totals.balanceAmount.toFixed(2)).toBe('0.00');
  });

  it('rejects a Discount above the Sub-total plus Tax Amount', () => {
    const call = () =>
      calculateInvoiceTotals({ items: [{ quantity: 1, rate: 100 }], taxRate: 10, discount: '110.01' });
    expect(call).toThrow(DiscountExceedsTotalError);
    expect(call).toThrow('discount must not exceed the sub-total plus tax');
  });

  it('computes the Balance from the Total Paid, which defaults to 0', () => {
    const unpaid = calculateInvoiceTotals({ items: [{ quantity: 1, rate: 100 }], taxRate: 10, discount: 0 });
    expect(unpaid.totalPaid.toFixed(2)).toBe('0.00');
    expect(unpaid.balanceAmount.toFixed(2)).toBe('110.00');

    const partPaid = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: 100 }],
      taxRate: 10,
      discount: 0,
      totalPaid: '60.50',
    });
    expect(partPaid.balanceAmount.toFixed(2)).toBe('49.50');
  });
});
```

- [ ] **Step 10: Run it to verify it fails**

Run: `cd backend && npx vitest run src/invoices/domain/invoice-totals.spec.ts`
Expected: FAIL — cannot resolve `./invoice-totals.js`.

- [ ] **Step 11: Implement the Currency map and the totals**

`backend/src/invoices/domain/currencies.ts`:

```ts
/**
 * Supported Currencies and their symbols. Only ISO 4217 codes with 2 decimal
 * places are listed, because every amount is stored as NUMERIC(15,2).
 * The frontend mirrors this list in frontend/src/lib/currencies.ts; this file
 * is the source of truth.
 */
export const CURRENCY_SYMBOLS = {
  AUD: 'AU$',
  USD: 'US$',
  GBP: '£',
  EUR: '€',
  SGD: 'S$',
  NZD: 'NZ$',
  CAD: 'CA$',
  HKD: 'HK$',
} as const;

export type CurrencyCode = keyof typeof CURRENCY_SYMBOLS;

export const CURRENCY_CODES = Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[];
```

`backend/src/invoices/domain/invoice-totals.ts`:

```ts
import { Decimal } from 'decimal.js';

/**
 * Invoice money rules (CONTEXT.md, "Money"). Pure and framework-free: the
 * service, the create DTO's Discount check and the seeder all call this one
 * function, so the Total Amount is always computed the same way.
 */

export type DecimalInput = Decimal | number | string;

/** The Tax Rate applied when the User does not set one. */
export const DEFAULT_TAX_RATE = 10;

export class DiscountExceedsTotalError extends Error {
  constructor() {
    super('discount must not exceed the sub-total plus tax');
    this.name = 'DiscountExceedsTotalError';
  }
}

export interface TotalsInput {
  items: ReadonlyArray<{ quantity: number; rate: DecimalInput }>;
  taxRate: DecimalInput;
  discount: DecimalInput;
  totalPaid?: DecimalInput;
}

export interface InvoiceTotals {
  subTotal: Decimal;
  taxAmount: Decimal;
  discount: Decimal;
  totalAmount: Decimal;
  totalPaid: Decimal;
  balanceAmount: Decimal;
}

/**
 * Sub-total = Σ quantity × Rate. Tax Amount = Sub-total × Tax Rate ÷ 100,
 * rounded half-up to the cent. Total Amount = Sub-total + Tax Amount − Discount.
 * Balance = Total Amount − Total Paid. Decimal arithmetic keeps every cent exact.
 *
 * @throws DiscountExceedsTotalError when the Discount would make the Total Amount negative.
 */
export function calculateInvoiceTotals(input: TotalsInput): InvoiceTotals {
  const subTotal = input.items.reduce(
    (sum, item) => sum.plus(new Decimal(item.rate).times(item.quantity)),
    new Decimal(0),
  );
  const taxAmount = subTotal
    .times(input.taxRate)
    .dividedBy(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const discount = new Decimal(input.discount);
  const totalAmount = subTotal.plus(taxAmount).minus(discount);
  if (totalAmount.lt(0)) {
    throw new DiscountExceedsTotalError();
  }
  const totalPaid = new Decimal(input.totalPaid ?? 0);
  return {
    subTotal,
    taxAmount,
    discount,
    totalAmount,
    totalPaid,
    balanceAmount: totalAmount.minus(totalPaid),
  };
}
```

- [ ] **Step 12: Run it to verify it passes**

Run: `cd backend && npx vitest run src/invoices/domain/invoice-totals.spec.ts`
Expected: PASS (9 tests).

- [ ] **Step 13: Write the failing Status test**

`backend/src/invoices/domain/invoice-status.spec.ts`:

```ts
import {
  deriveInvoiceStatus,
  INVOICE_STATUSES,
  matchesStatusCriteria,
  STATUS_CRITERIA,
  STORED_STATUSES,
} from './invoice-status.js';

const TODAY = '2026-09-15';

describe('deriveInvoiceStatus', () => {
  it('keeps Paid even when the Due Date has passed', () => {
    expect(deriveInvoiceStatus('Paid', '2026-09-01', TODAY)).toBe('Paid');
  });

  it.each(['Draft', 'Pending'] as const)('reports a %s past its Due Date as Overdue', (stored) => {
    expect(deriveInvoiceStatus(stored, '2026-09-14', TODAY)).toBe('Overdue');
  });

  it.each(STORED_STATUSES)('keeps %s when the Due Date is today', (stored) => {
    expect(deriveInvoiceStatus(stored, TODAY, TODAY)).toBe(stored);
  });

  it.each(STORED_STATUSES)('keeps %s when the Due Date is in the future', (stored) => {
    expect(deriveInvoiceStatus(stored, '2026-10-01', TODAY)).toBe(stored);
  });
});

describe('STATUS_CRITERIA', () => {
  const dueDates = { before: '2026-09-14', on: TODAY, after: '2026-09-16' };
  const rows = STORED_STATUSES.flatMap((status) =>
    Object.entries(dueDates).map(([position, dueDate]) => ({ status, dueDate, position })),
  );

  it.each(INVOICE_STATUSES)('selects exactly the rows whose Status is %s', (status) => {
    for (const row of rows) {
      expect(
        matchesStatusCriteria(row, STATUS_CRITERIA[status], TODAY),
        `${row.status} due ${row.position} today`,
      ).toBe(deriveInvoiceStatus(row.status, row.dueDate, TODAY) === status);
    }
  });

  it('places every row in exactly one Status', () => {
    for (const row of rows) {
      const matching = INVOICE_STATUSES.filter((status) =>
        matchesStatusCriteria(row, STATUS_CRITERIA[status], TODAY),
      );
      expect(matching).toHaveLength(1);
    }
  });
});
```

- [ ] **Step 14: Run it to verify it fails**

Run: `cd backend && npx vitest run src/invoices/domain/invoice-status.spec.ts`
Expected: FAIL — cannot resolve `./invoice-status.js`.

- [ ] **Step 15: Implement the Status rules**

`backend/src/invoices/domain/invoice-status.ts`:

```ts
/**
 * Status rules (CONTEXT.md, "Status"). The Stored Status is Draft, Pending or
 * Paid; Overdue is computed when read and never stored. STATUS_CRITERIA
 * describes each Status as a condition on Stored Status and Due Date. The list
 * query builds its SQL from it, so the status filter can never disagree with
 * the Status an Invoice displays.
 */

export const STORED_STATUSES = ['Draft', 'Pending', 'Paid'] as const;
export type StoredStatus = (typeof STORED_STATUSES)[number];

export const INVOICE_STATUSES = ['Draft', 'Pending', 'Paid', 'Overdue'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Where the Due Date must sit relative to today for a Status to apply. */
export type DuePosition = 'beforeToday' | 'todayOrLater' | 'any';

export interface StatusCriteria {
  storedIn: readonly StoredStatus[];
  due: DuePosition;
}

export const STATUS_CRITERIA: Readonly<Record<InvoiceStatus, StatusCriteria>> = {
  Draft: { storedIn: ['Draft'], due: 'todayOrLater' },
  Pending: { storedIn: ['Pending'], due: 'todayOrLater' },
  Paid: { storedIn: ['Paid'], due: 'any' },
  Overdue: { storedIn: ['Draft', 'Pending'], due: 'beforeToday' },
};

/**
 * An Invoice that is not Paid and whose Due Date is before today is Overdue;
 * otherwise its Status is its Stored Status. ISO dates compare correctly as text.
 */
export function deriveInvoiceStatus(
  stored: StoredStatus,
  dueDate: string,
  today: string,
): InvoiceStatus {
  return stored !== 'Paid' && dueDate < today ? 'Overdue' : stored;
}

/** Evaluates STATUS_CRITERIA in TypeScript, mirroring the SQL predicate of the list query. */
export function matchesStatusCriteria(
  row: { status: StoredStatus; dueDate: string },
  criteria: StatusCriteria,
  today: string,
): boolean {
  if (!criteria.storedIn.includes(row.status)) return false;
  switch (criteria.due) {
    case 'beforeToday':
      return row.dueDate < today;
    case 'todayOrLater':
      return row.dueDate >= today;
    case 'any':
      return true;
  }
}
```

- [ ] **Step 16: Run the whole unit suite, lint and type-check**

Run: `cd backend && npx prettier --write "src/**/*.ts" && npm test && npm run lint && npm run typecheck`
Expected: Vitest reports 3 passed files and 0 failures; oxlint reports `Found 0 warnings and 0 errors`; `tsc --noEmit` prints nothing and exits 0.

- [ ] **Step 17: Commit**

```bash
git add .gitignore backend
git commit -m "feat(backend): scaffold NestJS project and add the pure domain core

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 2: Environment configuration

The env schema of §5.7, validated at start-up, plus the `.env` loader used by the standalone scripts and the backend `.env.example`. Secrets have no defaults in code (A§2.4.3).

**Files:**
- Create: `backend/src/config/env.validation.ts`
- Create: `backend/src/config/load-env-file.ts`
- Create: `backend/.env.example`
- Test: `backend/src/config/config.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (`config/env.validation.ts`):
  - `COOKIE_SECURE_MODES = ['auto', 'true', 'false'] as const`, `type CookieSecureMode`.
  - `class DatabaseEnvironmentVariables { DATABASE_URL: string; APP_TIMEZONE: string /* default 'UTC' */ }`.
  - `class EnvironmentVariables extends DatabaseEnvironmentVariables { PORT: number /* 3000 */; JWT_SECRET: string; JWT_EXPIRES_IN: number /* 3600 */; COOKIE_SECURE: CookieSecureMode /* 'auto' */; LOGIN_THROTTLE_LIMIT: number /* 5 */; LOGIN_THROTTLE_TTL: number /* 60 */; TRUST_PROXY: string /* 'loopback, linklocal, uniquelocal' */ }`.
  - `class SeedEnvironmentVariables extends DatabaseEnvironmentVariables { SEED_USER_EMAIL: string; SEED_USER_PASSWORD: string; SEED_USER_FULLNAME: string }`.
  - `validateConfig<T extends object>(schema: new () => T, config: Record<string, unknown>): T` — throws `Error('Invalid environment configuration:\n- …')`.
  - `validateEnv(config: Record<string, unknown>): EnvironmentVariables` — the `ConfigModule.forRoot({ validate })` hook.
  - `parseTrustProxy(value: string): boolean | number | string`.
- Produces (`config/load-env-file.ts`): `loadEnvFile(path?: string): void`.
- Later tasks read typed values with `ConfigService<EnvironmentVariables, true>` and `config.get('KEY', { infer: true })`. `ConfigService.get` returns the validated (converted) value, so numbers come back as numbers.

- [ ] **Step 1: Write the failing test**

`backend/src/config/config.spec.ts`:

```ts
import {
  EnvironmentVariables,
  parseTrustProxy,
  SeedEnvironmentVariables,
  validateConfig,
  validateEnv,
} from './env.validation.js';

const SECRET = 'x'.repeat(32);
const base = {
  DATABASE_URL: 'postgres://simple_invoice:pw@localhost:5432/simple_invoice',
  JWT_SECRET: SECRET,
};

describe('validateEnv', () => {
  it('applies the documented defaults', () => {
    const env = validateEnv(base);
    expect(env).toBeInstanceOf(EnvironmentVariables);
    expect(env).toMatchObject({
      PORT: 3000,
      JWT_EXPIRES_IN: 3600,
      COOKIE_SECURE: 'auto',
      APP_TIMEZONE: 'UTC',
      LOGIN_THROTTLE_LIMIT: 5,
      LOGIN_THROTTLE_TTL: 60,
      TRUST_PROXY: 'loopback, linklocal, uniquelocal',
    });
  });

  it('parses numbers from env strings (JWT_EXPIRES_IN is a number of seconds)', () => {
    const env = validateEnv({ ...base, PORT: '8081', JWT_EXPIRES_IN: '900' });
    expect(env.PORT).toBe(8081);
    expect(env.JWT_EXPIRES_IN).toBe(900);
  });

  it('treats empty values as unset, so the defaults apply', () => {
    const env = validateEnv({ ...base, PORT: '', JWT_EXPIRES_IN: '', COOKIE_SECURE: '' });
    expect(env.PORT).toBe(3000);
    expect(env.JWT_EXPIRES_IN).toBe(3600);
    expect(env.COOKIE_SECURE).toBe('auto');
  });

  it('requires JWT_SECRET', () => {
    expect(() => validateEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(/JWT_SECRET/);
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'x'.repeat(31) })).toThrow(
      'JWT_SECRET must be at least 32 characters long',
    );
  });

  it('requires a postgres DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_SECRET: SECRET })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...base, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      'DATABASE_URL must be a postgres:// connection URL',
    );
  });

  it.each([
    ['JWT_EXPIRES_IN', '15m'],
    ['JWT_EXPIRES_IN', '0'],
    ['COOKIE_SECURE', 'yes'],
    ['APP_TIMEZONE', 'Mars/Olympus'],
    ['PORT', '70000'],
    ['LOGIN_THROTTLE_LIMIT', 'many'],
  ])('rejects %s=%s', (key, value) => {
    expect(() => validateEnv({ ...base, [key]: value })).toThrow(new RegExp(key));
  });
});

describe('SeedEnvironmentVariables', () => {
  const seedEnv = {
    DATABASE_URL: base.DATABASE_URL,
    SEED_USER_EMAIL: 'admin@example.com',
    SEED_USER_PASSWORD: 'Password123!',
    SEED_USER_FULLNAME: 'Admin User',
  };

  it('accepts the seed keys without any API secret', () => {
    const env = validateConfig(SeedEnvironmentVariables, seedEnv);
    expect(env.SEED_USER_EMAIL).toBe('admin@example.com');
    expect(env.APP_TIMEZONE).toBe('UTC');
  });

  it('rejects a missing password and an invalid email', () => {
    expect(() =>
      validateConfig(SeedEnvironmentVariables, { ...seedEnv, SEED_USER_PASSWORD: '' }),
    ).toThrow(/SEED_USER_PASSWORD/);
    expect(() =>
      validateConfig(SeedEnvironmentVariables, { ...seedEnv, SEED_USER_EMAIL: 'admin' }),
    ).toThrow(/SEED_USER_EMAIL/);
  });
});

describe('parseTrustProxy', () => {
  it.each([
    ['true', true],
    ['false', false],
    ['1', 1],
    ['loopback, linklocal, uniquelocal', 'loopback, linklocal, uniquelocal'],
  ])('maps %s', (input, expected) => {
    expect(parseTrustProxy(input)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx vitest run src/config/config.spec.ts`
Expected: FAIL — cannot resolve `./env.validation.js`.

- [ ] **Step 3: Implement the env schema**

`backend/src/config/env.validation.ts`:

```ts
// class-transformer's @Type() needs the reflect-metadata polyfill as soon as the
// decorators run. Nest and TypeORM load it, but this module also runs without
// them (its unit test, for example), so it loads the polyfill itself.
import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsTimeZone,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Environment schema (§5.7), validated at start-up: the API and the seeder
 * refuse to run on a missing or invalid value. Secrets deliberately have no
 * defaults here; they must come from the environment (A§2.4.3).
 */

export const COOKIE_SECURE_MODES = ['auto', 'true', 'false'] as const;
export type CookieSecureMode = (typeof COOKIE_SECURE_MODES)[number];

/** Keys shared by the API, the seeder and the migration CLI. */
export class DatabaseEnvironmentVariables {
  @IsString()
  @Matches(/^postgres(ql)?:\/\/\S+$/, {
    message: 'DATABASE_URL must be a postgres:// connection URL',
  })
  DATABASE_URL: string;

  /** IANA time zone that defines "today" for the Overdue rule. */
  @IsTimeZone()
  APP_TIMEZONE: string = 'UTC';
}

/** Keys the API process reads. */
export class EnvironmentVariables extends DatabaseEnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters long' })
  JWT_SECRET: string;

  /** Token lifetime in seconds; jsonwebtoken would read a bare string as milliseconds. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  JWT_EXPIRES_IN: number = 3600;

  @IsIn(COOKIE_SECURE_MODES)
  COOKIE_SECURE: CookieSecureMode = 'auto';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  LOGIN_THROTTLE_LIMIT: number = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  LOGIN_THROTTLE_TTL: number = 60;

  /** Express `trust proxy` value; the default trusts the bundled nginx on the private Docker network. */
  @IsString()
  @IsNotEmpty()
  TRUST_PROXY: string = 'loopback, linklocal, uniquelocal';
}

/** Keys the seeder reads in addition to the database keys. */
export class SeedEnvironmentVariables extends DatabaseEnvironmentVariables {
  @IsEmail()
  SEED_USER_EMAIL: string;

  @IsString()
  @Length(8, 128)
  SEED_USER_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  SEED_USER_FULLNAME: string;
}

/**
 * Validates raw env values against a schema class. Empty strings count as
 * unset, so `KEY=` in a .env file falls back to the default.
 *
 * @throws Error listing every invalid key.
 */
export function validateConfig<T extends object>(
  schema: new () => T,
  config: Record<string, unknown>,
): T {
  const present = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== ''),
  );
  const instance = plainToInstance(schema, present);
  const errors = validateSync(instance);
  if (errors.length > 0) {
    const details = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new Error(
      `Invalid environment configuration:\n- ${details.join('\n- ')}`,
    );
  }
  return instance;
}

/** The `validate` hook of `ConfigModule.forRoot`. */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  return validateConfig(EnvironmentVariables, config);
}

/**
 * Converts TRUST_PROXY into Express's `trust proxy` setting: booleans and hop
 * counts get their real types; anything else (an address list) stays a string.
 */
export function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}
```

`backend/src/config/load-env-file.ts`:

```ts
/**
 * Loads `.env` into process.env for the standalone scripts (seed and
 * migrations); the API itself uses ConfigModule. Variables that are already set
 * win, and a missing file is fine: in Docker the values come from the container
 * environment.
 */
export function loadEnvFile(path = '.env'): void {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx vitest run src/config/config.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Create `backend/.env.example`**

```dotenv
# SimpleInvoice API and seeder, for running without Docker: cp .env.example .env
# Secrets below are empty or placeholders. Never commit a real .env file.

# HTTP port of the API
PORT=3000

# PostgreSQL connection URL. Replace <db-password> with your database password.
# With `docker compose up db` and no root .env, the password is the compose
# local-only default documented in the README.
DATABASE_URL=postgres://simple_invoice:<db-password>@localhost:5432/simple_invoice

# HS256 signing secret, at least 32 characters. Generate one with:
#   openssl rand -base64 48
JWT_SECRET=

# Access-token lifetime in seconds
JWT_EXPIRES_IN=3600

# Secure flag of the auth cookie: auto (on behind TLS) | true | false
COOKIE_SECURE=auto

# IANA time zone that defines "today" for the Overdue Status
APP_TIMEZONE=UTC

# Login throttle: attempts per TTL seconds, per client IP
LOGIN_THROTTLE_LIMIT=5
LOGIN_THROTTLE_TTL=60

# Express "trust proxy" value. The default trusts proxies on private networks;
# a production deployment must name its real proxy instead.
TRUST_PROXY=loopback, linklocal, uniquelocal

# Default User created by `npm run seed`. Choose a password (8-128 characters).
SEED_USER_EMAIL=admin@example.com
SEED_USER_PASSWORD=
SEED_USER_FULLNAME=Admin User
```

- [ ] **Step 6: Run the unit suite, lint and type-check**

Run: `cd backend && npx prettier --write "src/**/*.ts" && npm test && npm run lint && npm run typecheck`
Expected: all unit tests pass; oxlint `Found 0 warnings and 0 errors`; `tsc` exits 0.

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(backend): validate environment configuration at start-up

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 3: Database schema, entities and migration CLI

The §4 data model as one hand-written SQL migration, the TypeORM entities that map it, shared DataSource options, a migration CLI, and an e2e suite that checks the real schema on PostgreSQL 17.

**Files:**
- Create: `backend/src/database/decimal.transformer.ts`
- Create: `backend/src/users/user.entity.ts`
- Create: `backend/src/invoices/entities/invoice.entity.ts`
- Create: `backend/src/invoices/entities/invoice-item.entity.ts`
- Create: `backend/src/database/migrations/1790812800000-InitialSchema.ts`
- Create: `backend/src/database/data-source.ts`
- Create: `backend/src/database/migrate.ts`
- Create: `backend/test/utils/database.ts`
- Test: `backend/test/database.e2e-spec.ts`

**Interfaces:**
- Consumes: `STORED_STATUSES`, `StoredStatus` (Task 1); `DatabaseEnvironmentVariables`, `validateConfig` (Task 2); `loadEnvFile` (Task 2).
- Produces:
  - `decimalTransformer: ValueTransformer` (NUMERIC string ⇄ `Decimal`, written with 2 decimals).
  - `User` entity (`users`): `id`, `email`, `passwordHash` (`select: false`), `fullname`, `createdAt: Date`.
  - `Invoice` entity (`invoices`): `invoiceId`, `invoiceNumber`, `invoiceReference: string | null`, `invoiceDate: string`, `dueDate: string`, `currency`, `currencySymbol`, `description: string | null`, `status: StoredStatus`, `customerFullname`, `customerEmail`, `customerMobileNumber: string | null`, `customerAddress: string | null`, `taxRate`, `invoiceSubTotal`, `totalTax`, `totalDiscount`, `totalAmount`, `totalPaid`, `balanceAmount` (all `Decimal`), `createdAt: Date`, `createdBy: string`, `items: Relation<InvoiceItem[]>` (cascade insert).
  - `InvoiceItem` entity (`invoice_items`): `id`, `invoiceId`, `invoice: Relation<Invoice>`, `name`, `quantity: number`, `rate: Decimal`.
  - `InitialSchema1790812800000` migration (name `'InitialSchema1790812800000'`).
  - `buildDataSourceOptions(url: string): DataSourceOptions` (also registers the DATE type parser).
  - `test/utils/database.ts`: `interface TestDatabase { container; dataSource }`, `startDatabase(): Promise<TestDatabase>` (migrations not run), `stopDatabase(db?: TestDatabase): Promise<void>`.
  - Constraint and index names exactly as in the migration below (tests and the service match on them, e.g. `invoices_invoice_number_lower_uq`).

- [ ] **Step 1: Write the decimal transformer and the entities**

`backend/src/database/decimal.transformer.ts`:

```ts
import { Decimal } from 'decimal.js';
import type { ValueTransformer } from 'typeorm';

/**
 * Maps NUMERIC columns to Decimal. The pg driver returns NUMERIC as a string to
 * avoid float rounding; Decimal keeps that exactness in the domain code.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: Decimal | string | null) =>
    value === undefined || value === null
      ? value
      : new Decimal(value).toFixed(2),
  from: (value: string | null) => (value === null ? null : new Decimal(value)),
};
```

`backend/src/users/user.entity.ts`:

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** A person who signs in to SimpleInvoice and creates Invoices (CONTEXT.md, "User"). */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique regardless of case (`users_email_lower_uq`); stored in lower case. */
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** bcrypt hash. Not selected by default, so it can never leak into a response. */
  @Column({ name: 'password_hash', type: 'varchar', length: 100, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255 })
  fullname: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

`backend/src/invoices/entities/invoice.entity.ts`:

```ts
import { Decimal } from 'decimal.js';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { decimalTransformer } from '../../database/decimal.transformer.js';
import {
  STORED_STATUSES,
  type StoredStatus,
} from '../domain/invoice-status.js';
import { InvoiceItem } from './invoice-item.entity.js';

/**
 * An Invoice with its Customer snapshot (ADR-0001) and the totals computed by
 * calculateInvoiceTotals when it was created. `status` is the Stored Status;
 * the Status shown to Users is derived from it and `dueDate` when read.
 */
@Entity({ name: 'invoices' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid', { name: 'invoice_id' })
  invoiceId: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber: string;

  @Column({
    name: 'invoice_reference',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  invoiceReference: string | null;

  @Column({ name: 'invoice_date', type: 'date' })
  invoiceDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'currency_symbol', type: 'varchar', length: 8 })
  currencySymbol: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: [...STORED_STATUSES],
    enumName: 'invoice_status',
    default: 'Draft',
  })
  status: StoredStatus;

  @Column({ name: 'customer_fullname', type: 'varchar', length: 255 })
  customerFullname: string;

  @Column({ name: 'customer_email', type: 'varchar', length: 255 })
  customerEmail: string;

  @Column({
    name: 'customer_mobile_number',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  customerMobileNumber: string | null;

  @Column({
    name: 'customer_address',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  customerAddress: string | null;

  @Column({
    name: 'tax_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: decimalTransformer,
  })
  taxRate: Decimal;

  @Column({
    name: 'invoice_sub_total',
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: decimalTransformer,
  })
  invoiceSubTotal: Decimal;

  @Column({
    name: 'total_tax',
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalTax: Decimal;

  @Column({
    name: 'total_discount',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalDiscount: Decimal;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount: Decimal;

  @Column({
    name: 'total_paid',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalPaid: Decimal;

  @Column({
    name: 'balance_amount',
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: decimalTransformer,
  })
  balanceAmount: Decimal;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** The creating User's id. A plain column: no feature navigates to the User. */
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: ['insert'] })
  items: Relation<InvoiceItem[]>;
}
```

`backend/src/invoices/entities/invoice-item.entity.ts`:

```ts
import { Decimal } from 'decimal.js';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { decimalTransformer } from '../../database/decimal.transformer.js';
import { Invoice } from './invoice.entity.js';

/**
 * One priced entry on an Invoice: a name, a whole-number quantity and a Rate.
 * Its amount (quantity × Rate) is computed when read, never stored.
 */
@Entity({ name: 'invoice_items' })
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Explicit FK column, so a page of Invoice Items loads with one `IN` query. */
  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Relation<Invoice>;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: decimalTransformer,
  })
  rate: Decimal;
}
```

- [ ] **Step 2: Write the migration**

`backend/src/database/migrations/1790812800000-InitialSchema.ts`:

```ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The initial schema (spec §4), in hand-written SQL so every constraint and
 * index is explicit. The CHECK constraints are a safety net: the API computes
 * the values. Overdue is not in the enum because it is never stored.
 */
export class InitialSchema1790812800000 implements MigrationInterface {
  name = 'InitialSchema1790812800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(
      `CREATE TYPE invoice_status AS ENUM ('Draft', 'Pending', 'Paid')`,
    );

    await queryRunner.query(`
      CREATE TABLE users (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL,
        password_hash varchar(100) NOT NULL,
        fullname varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT users_pkey PRIMARY KEY (id)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email))`,
    );

    await queryRunner.query(`
      CREATE TABLE invoices (
        invoice_id uuid NOT NULL DEFAULT gen_random_uuid(),
        invoice_number varchar(50) NOT NULL,
        invoice_reference varchar(100),
        invoice_date date NOT NULL,
        due_date date NOT NULL,
        currency char(3) NOT NULL,
        currency_symbol varchar(8) NOT NULL,
        description varchar(1000),
        status invoice_status NOT NULL DEFAULT 'Draft',
        customer_fullname varchar(255) NOT NULL,
        customer_email varchar(255) NOT NULL,
        customer_mobile_number varchar(20),
        customer_address varchar(500),
        tax_rate numeric(5,2) NOT NULL,
        invoice_sub_total numeric(15,2) NOT NULL,
        total_tax numeric(15,2) NOT NULL,
        total_discount numeric(15,2) NOT NULL DEFAULT 0,
        total_amount numeric(15,2) NOT NULL,
        total_paid numeric(15,2) NOT NULL DEFAULT 0,
        balance_amount numeric(15,2) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid NOT NULL,
        CONSTRAINT invoices_pkey PRIMARY KEY (invoice_id),
        CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by)
          REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT invoices_due_date_check CHECK (due_date >= invoice_date),
        CONSTRAINT invoices_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
        CONSTRAINT invoices_tax_rate_check CHECK (tax_rate BETWEEN 0 AND 100),
        CONSTRAINT invoices_amounts_non_negative_check CHECK (
          invoice_sub_total >= 0 AND total_tax >= 0 AND total_discount >= 0
          AND total_amount >= 0 AND total_paid >= 0 AND balance_amount >= 0
        ),
        CONSTRAINT invoices_total_amount_check
          CHECK (total_amount = invoice_sub_total + total_tax - total_discount),
        CONSTRAINT invoices_balance_amount_check
          CHECK (balance_amount = total_amount - total_paid),
        CONSTRAINT invoices_total_paid_check CHECK (total_paid <= total_amount),
        CONSTRAINT invoices_paid_balance_check
          CHECK (status <> 'Paid' OR balance_amount = 0)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX invoices_invoice_number_lower_uq ON invoices (lower(invoice_number))`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_invoice_number_trgm ON invoices USING gin (invoice_number gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_customer_fullname_trgm ON invoices USING gin (customer_fullname gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_invoice_date_idx ON invoices (invoice_date)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_due_date_idx ON invoices (due_date)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_total_amount_idx ON invoices (total_amount)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_created_at_idx ON invoices (created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_status_due_date_idx ON invoices (status, due_date)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_created_by_idx ON invoices (created_by)`,
    );

    await queryRunner.query(`
      CREATE TABLE invoice_items (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        invoice_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        quantity integer NOT NULL,
        rate numeric(15,2) NOT NULL,
        CONSTRAINT invoice_items_pkey PRIMARY KEY (id),
        CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id)
          REFERENCES invoices (invoice_id) ON DELETE CASCADE,
        CONSTRAINT invoice_items_quantity_check CHECK (quantity > 0),
        CONSTRAINT invoice_items_rate_check CHECK (rate > 0)
      )`);
    await queryRunner.query(
      `CREATE INDEX invoice_items_invoice_id_idx ON invoice_items (invoice_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE invoice_items`);
    await queryRunner.query(`DROP TABLE invoices`);
    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`DROP TYPE invoice_status`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS pg_trgm`);
  }
}
```

- [ ] **Step 3: Write the DataSource options, the migration CLI and the test helper**

`backend/src/database/data-source.ts`:

```ts
import pg from 'pg';
import type { DataSourceOptions } from 'typeorm';
import { Invoice } from '../invoices/entities/invoice.entity.js';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity.js';
import { User } from '../users/user.entity.js';
import { InitialSchema1790812800000 } from './migrations/1790812800000-InitialSchema.js';

// Return DATE columns (type OID 1082) as 'YYYY-MM-DD' strings everywhere. By
// default pg turns them into local-midnight Date objects in raw queries, which
// shift with the host time zone.
pg.types.setTypeParser(1082, (value: string) => value);

/** One set of TypeORM options for the API, the seeder, the migration CLI and the tests. */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: [User, Invoice, InvoiceItem],
    migrations: [InitialSchema1790812800000],
    migrationsTableName: 'migrations',
    synchronize: false,
    logging: ['error', 'warn'],
  };
}
```

`backend/src/database/migrate.ts`:

```ts
import { DataSource } from 'typeorm';
import {
  DatabaseEnvironmentVariables,
  validateConfig,
} from '../config/env.validation.js';
import { loadEnvFile } from '../config/load-env-file.js';
import { buildDataSourceOptions } from './data-source.js';

/**
 * Migration CLI: `npm run migration:run` and `npm run migration:revert`.
 * The API also applies pending migrations at start-up (`migrationsRun`).
 */
loadEnvFile();

const command = process.argv[2];
if (command !== 'run' && command !== 'revert') {
  console.error('Usage: node dist/database/migrate.js <run|revert>');
  process.exit(1);
}

const env = validateConfig(DatabaseEnvironmentVariables, process.env);
const dataSource = new DataSource(buildDataSourceOptions(env.DATABASE_URL));
await dataSource.initialize();
try {
  if (command === 'run') {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length > 0
        ? `Applied migrations: ${applied.map((m) => m.name).join(', ')}`
        : 'No pending migrations.',
    );
  } else {
    await dataSource.undoLastMigration({ transaction: 'each' });
    console.log('Reverted the last migration.');
  }
} finally {
  await dataSource.destroy();
}
```

`backend/test/utils/database.ts`:

```ts
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/database/data-source.js';

/** A throwaway PostgreSQL 17 container and a DataSource on it (migrations not run yet). */
export interface TestDatabase {
  container: StartedPostgreSqlContainer;
  dataSource: DataSource;
}

export async function startDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const dataSource = new DataSource(
    buildDataSourceOptions(container.getConnectionUri()),
  );
  await dataSource.initialize();
  return { container, dataSource };
}

export async function stopDatabase(db?: TestDatabase): Promise<void> {
  await db?.dataSource.destroy();
  await db?.container.stop();
}
```

- [ ] **Step 4: Write the schema e2e test**

`backend/test/database.e2e-spec.ts`:

```ts
import { Decimal } from 'decimal.js';
import { QueryFailedError } from 'typeorm';
import { Invoice } from '../src/invoices/entities/invoice.entity.js';
import { InvoiceItem } from '../src/invoices/entities/invoice-item.entity.js';
import {
  startDatabase,
  stopDatabase,
  type TestDatabase,
} from './utils/database.js';

interface PgError {
  code?: string;
  constraint?: string;
}

describe('Database schema (e2e)', () => {
  let db: TestDatabase;
  let userId: string;
  let invoiceCounter = 0;

  beforeAll(async () => {
    db = await startDatabase();
    const applied = await db.dataSource.runMigrations({ transaction: 'each' });
    expect(applied.map((m) => m.name)).toEqual(['InitialSchema1790812800000']);
    const [user] = await db.dataSource.query<{ id: string }[]>(
      `INSERT INTO users (email, password_hash, fullname)
       VALUES ('owner@example.com', 'not-a-real-hash', 'Owner') RETURNING id`,
    );
    userId = user.id;
  });

  afterAll(async () => {
    await stopDatabase(db);
  });

  /** Inserts a valid Invoice row; `overrides` replaces column values. */
  async function insertInvoice(
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    invoiceCounter += 1;
    const row: Record<string, unknown> = {
      invoice_number: `T-${invoiceCounter}`,
      invoice_date: '2026-09-01',
      due_date: '2026-09-30',
      currency: 'AUD',
      currency_symbol: 'AU$',
      customer_fullname: 'Test Customer',
      customer_email: 'customer@example.com',
      tax_rate: '10',
      invoice_sub_total: '100',
      total_tax: '10',
      total_discount: '0',
      total_amount: '110',
      total_paid: '0',
      balance_amount: '110',
      created_by: userId,
      ...overrides,
    };
    const columns = Object.keys(row);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const [inserted] = await db.dataSource.query<{ invoice_id: string }[]>(
      `INSERT INTO invoices (${columns.join(', ')})
       VALUES (${placeholders.join(', ')}) RETURNING invoice_id`,
      Object.values(row),
    );
    return inserted.invoice_id;
  }

  /** Awaits a query that must fail and returns the PostgreSQL error. */
  async function pgError(query: Promise<unknown>): Promise<PgError> {
    const error = await query.then(
      () => undefined,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(QueryFailedError);
    return (error as QueryFailedError).driverError as PgError;
  }

  it('creates the tables, the Stored Status enum and the indexes', async () => {
    const tables = await db.dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(tables.map((t) => t.table_name)).toEqual([
      'invoice_items',
      'invoices',
      'migrations',
      'users',
    ]);

    const [statusType] = await db.dataSource.query<{ labels: string[] }[]>(
      `SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
       FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'invoice_status'`,
    );
    expect(statusType.labels).toEqual(['Draft', 'Pending', 'Paid']);

    const indexes = await db.dataSource.query<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    expect(indexes.map((i) => i.indexname)).toEqual(
      expect.arrayContaining([
        'users_email_lower_uq',
        'invoices_invoice_number_lower_uq',
        'invoices_invoice_number_trgm',
        'invoices_customer_fullname_trgm',
        'invoices_invoice_date_idx',
        'invoices_due_date_idx',
        'invoices_total_amount_idx',
        'invoices_created_at_idx',
        'invoices_status_due_date_idx',
        'invoices_created_by_idx',
        'invoice_items_invoice_id_idx',
      ]),
    );
  });

  it.each([
    ['invoices_due_date_check', { invoice_date: '2026-09-02', due_date: '2026-09-01' }],
    ['invoices_currency_check', { currency: 'aud' }],
    ['invoices_tax_rate_check', { tax_rate: '100.5' }],
    [
      'invoices_amounts_non_negative_check',
      { total_discount: '-1', total_amount: '111', balance_amount: '111' },
    ],
    ['invoices_total_amount_check', { total_amount: '120', balance_amount: '120' }],
    ['invoices_balance_amount_check', { balance_amount: '100' }],
    ['invoices_paid_balance_check', { status: 'Paid' }],
  ])('enforces %s', async (constraint, overrides) => {
    expect(await pgError(insertInvoice(overrides))).toMatchObject({
      code: '23514',
      constraint,
    });
  });

  it('rejects a Total Paid above the Total Amount', async () => {
    const error = await pgError(
      insertInvoice({ total_paid: '120', balance_amount: '-10' }),
    );
    expect(error.code).toBe('23514');
  });

  it('cannot store Overdue as a Stored Status', async () => {
    expect(await pgError(insertInvoice({ status: 'Overdue' }))).toMatchObject({
      code: '22P02',
    });
  });

  it('keeps Invoice Numbers unique regardless of case', async () => {
    await insertInvoice({ invoice_number: 'CASE-001' });
    expect(
      await pgError(insertInvoice({ invoice_number: 'case-001' })),
    ).toMatchObject({
      code: '23505',
      constraint: 'invoices_invoice_number_lower_uq',
    });
  });

  it('keeps User emails unique regardless of case', async () => {
    const duplicate = db.dataSource.query(
      `INSERT INTO users (email, password_hash, fullname)
       VALUES ('Owner@Example.com', 'x', 'Copy')`,
    );
    expect(await pgError(duplicate)).toMatchObject({
      code: '23505',
      constraint: 'users_email_lower_uq',
    });
  });

  it('enforces the Invoice Item quantity and Rate checks', async () => {
    const invoiceId = await insertInvoice();
    const insertItem = (quantity: number, rate: string) =>
      db.dataSource.query(
        `INSERT INTO invoice_items (invoice_id, name, quantity, rate)
         VALUES ($1, 'Item', $2, $3)`,
        [invoiceId, quantity, rate],
      );
    expect(await pgError(insertItem(0, '1'))).toMatchObject({
      code: '23514',
      constraint: 'invoice_items_quantity_check',
    });
    expect(await pgError(insertItem(1, '0'))).toMatchObject({
      code: '23514',
      constraint: 'invoice_items_rate_check',
    });
  });

  it('deletes Invoice Items together with their Invoice', async () => {
    const invoiceId = await insertInvoice();
    await db.dataSource.query(
      `INSERT INTO invoice_items (invoice_id, name, quantity, rate)
       VALUES ($1, 'Item', 1, 100)`,
      [invoiceId],
    );
    await db.dataSource.query(`DELETE FROM invoices WHERE invoice_id = $1`, [
      invoiceId,
    ]);
    const [{ count }] = await db.dataSource.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM invoice_items WHERE invoice_id = $1`,
      [invoiceId],
    );
    expect(count).toBe(0);
  });

  it('round-trips entities with Decimal amounts and string dates', async () => {
    const invoices = db.dataSource.getRepository(Invoice);
    const items = db.dataSource.getRepository(InvoiceItem);
    const saved = await invoices.save(
      invoices.create({
        invoiceNumber: 'ROUND-TRIP-1',
        invoiceReference: null,
        invoiceDate: '2026-06-03',
        dueDate: '2026-07-03',
        currency: 'AUD',
        currencySymbol: 'AU$',
        description: null,
        status: 'Pending',
        customerFullname: 'Paul',
        customerEmail: 'paul@101digital.io',
        customerMobileNumber: null,
        customerAddress: null,
        taxRate: new Decimal(10),
        invoiceSubTotal: new Decimal(2000),
        totalTax: new Decimal(200),
        totalDiscount: new Decimal(20),
        totalAmount: new Decimal(2180),
        totalPaid: new Decimal('1451.34'),
        balanceAmount: new Decimal('728.66'),
        createdBy: userId,
        items: [
          items.create({
            name: 'Honda RC150',
            quantity: 2,
            rate: new Decimal(1000),
          }),
        ],
      }),
    );

    const loaded = await invoices.findOneOrFail({
      where: { invoiceId: saved.invoiceId },
      relations: { items: true },
    });
    expect(loaded.invoiceDate).toBe('2026-06-03');
    expect(loaded.dueDate).toBe('2026-07-03');
    expect(loaded.totalPaid).toBeInstanceOf(Decimal);
    expect(loaded.totalPaid.toFixed(2)).toBe('1451.34');
    expect(loaded.taxRate.toFixed(2)).toBe('10.00');
    expect(loaded.status).toBe('Pending');
    expect(loaded.createdAt).toBeInstanceOf(Date);
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0]).toMatchObject({
      invoiceId: saved.invoiceId,
      name: 'Honda RC150',
      quantity: 2,
    });
    expect(loaded.items[0].rate.toFixed(2)).toBe('1000.00');
  });

  it('returns DATE columns as strings in raw queries too', async () => {
    const [row] = await db.dataSource.query<{ invoice_date: unknown }[]>(
      `SELECT invoice_date FROM invoices LIMIT 1`,
    );
    expect(typeof row.invoice_date).toBe('string');
  });

  // Keep this test last: it drops the schema and recreates it.
  it('reverts the migration and applies it again', async () => {
    await db.dataSource.undoLastMigration({ transaction: 'each' });
    const [afterRevert] = await db.dataSource.query<
      { invoices: boolean; status: boolean }[]
    >(
      `SELECT to_regclass('public.invoices') IS NOT NULL AS invoices,
              to_regtype('invoice_status') IS NOT NULL AS status`,
    );
    expect(afterRevert).toEqual({ invoices: false, status: false });

    const applied = await db.dataSource.runMigrations({ transaction: 'each' });
    expect(applied).toHaveLength(1);
  });
});
```

- [ ] **Step 5: Run the e2e suite to verify it passes**

Run: `cd backend && npm run test:e2e`
Expected: PASS — `test/database.e2e-spec.ts` with all tests green (the first run may take longer while Docker pulls `postgres:17-alpine`).

If a CHECK test reports a different constraint name, do not loosen the test: each row of the table violates exactly one constraint, so a mismatch means the migration differs from the SQL above.

- [ ] **Step 6: Run the unit suite, lint, type-check and build**

Run: `cd backend && npm run format && npm test && npm run lint && npm run typecheck && npm run build`
Expected: all pass; `npm run build` creates `dist/database/migrate.js` and `dist/database/data-source.js` (no `dist/src` folder).

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(backend): add the database schema, entities and migration CLI

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 4: Seed data (`npm run seed`)

The idempotent seeder of §5.8: pending migrations, the default User, the Appendix A Invoice verbatim and 40 deterministic generated Invoices relative to "today". Also the `PasswordHasher` that the auth flow reuses in Task 6.

**Files:**
- Create: `backend/src/users/password-hasher.ts`
- Create: `backend/src/database/seed/seed-invoice.ts`
- Create: `backend/src/database/seed/appendix-a.ts`
- Create: `backend/src/database/seed/generate-invoices.ts`
- Create: `backend/src/database/seed/seeder.ts`
- Create: `backend/src/database/seed/run-seed.ts`
- Test: `backend/src/database/seed/generate-invoices.spec.ts`
- Test: `backend/test/seed.e2e-spec.ts`

**Interfaces:**
- Consumes: `addDays`, `todayIn` (Task 1); `CURRENCY_SYMBOLS`, `CurrencyCode` (Task 1); `StoredStatus`, `deriveInvoiceStatus` (Task 1); `calculateInvoiceTotals` (Task 1); `SeedEnvironmentVariables`, `validateConfig`, `loadEnvFile` (Task 2); `User`, `Invoice`, `InvoiceItem`, `buildDataSourceOptions` (Task 3); `startDatabase`, `stopDatabase` (Task 3).
- Produces:
  - `users/password-hasher.ts`: `BCRYPT_COST = 12`; `@Injectable() class PasswordHasher { hash(password: string): Promise<string>; verify(password: string, hash: string): Promise<boolean> }`.
  - `seed/seed-invoice.ts`: `interface SeedInvoice` (shape below).
  - `seed/appendix-a.ts`: `DEFAULT_USER_ID = 'ad1e0902-1928-4345-b513-60c86c94fc91'`, `APPENDIX_A_INVOICE: SeedInvoice`.
  - `seed/generate-invoices.ts`: `GENERATED_INVOICE_COUNT = 40`, `generateInvoices(today: string, now: Date, createdBy: string): SeedInvoice[]`.
  - `seed/seeder.ts`: `interface SeedOptions { user: { email; password; fullname }; today: string; now: Date; reset?: boolean }`, `seedDatabase(dataSource: DataSource, options: SeedOptions): Promise<{ invoicesInserted: number }>`.
  - Seeded data facts later tasks rely on: 1 User (`admin@example.com` when seeded with it), 41 Invoices (Appendix A + `INV-0001`…`INV-0040`), one Invoice Item each. Generated ids are `5eed0000-0000-4000-8000-<n:12>` (Invoices) and `5eed0000-0000-4000-9000-<n:12>` (items). Generated Customer emails end in `@example.com`.

- [ ] **Step 1: Write the password hasher and the seed types**

`backend/src/users/password-hasher.ts`:

```ts
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

/** bcrypt work factor (§4.1). bcryptjs is pure JavaScript, so no native build is needed. */
export const BCRYPT_COST = 12;

/** Hashes and verifies passwords. Shared by the login flow and the seeder. */
@Injectable()
export class PasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
```

`backend/src/database/seed/seed-invoice.ts`:

```ts
import type { CurrencyCode } from '../../invoices/domain/currencies.js';
import type { StoredStatus } from '../../invoices/domain/invoice-status.js';

/**
 * One seed Invoice with exactly one Invoice Item. Amounts are decimal strings;
 * the seeder computes the totals with calculateInvoiceTotals when inserting.
 */
export interface SeedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceReference: string | null;
  invoiceDate: string;
  dueDate: string;
  currency: CurrencyCode;
  description: string | null;
  status: StoredStatus;
  customer: {
    fullname: string;
    email: string;
    mobileNumber: string | null;
    address: string | null;
  };
  item: { id: string; name: string; quantity: number; rate: string };
  taxRate: string;
  discount: string;
  totalPaid: string;
  createdAt: Date;
  createdBy: string;
}
```

`backend/src/database/seed/appendix-a.ts`:

```ts
import type { SeedInvoice } from './seed-invoice.js';

/** Appendix A's `createdBy`, reused as the id of the default User. */
export const DEFAULT_USER_ID = 'ad1e0902-1928-4345-b513-60c86c94fc91';

/**
 * The Appendix A Invoice, verbatim. The assessment's mock shows it as
 * "Overdue", which is never stored (CONTEXT.md, flagged ambiguities): it is
 * part-paid, so it was issued, and its Stored Status is Pending. It reads
 * Overdue because its Due Date has passed.
 */
export const APPENDIX_A_INVOICE: SeedInvoice = {
  invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  description: 'Invoice is issued to Kanglee',
  status: 'Pending',
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  item: {
    id: 'b1c2d3e4-0000-0000-0000-000000000001',
    name: 'Honda RC150',
    quantity: 2,
    rate: '1000',
  },
  taxRate: '10',
  discount: '20',
  totalPaid: '1451.34',
  createdAt: new Date('2026-06-03T12:03:26.995Z'),
  createdBy: DEFAULT_USER_ID,
};
```

- [ ] **Step 2: Write the failing generator test**

`backend/src/database/seed/generate-invoices.spec.ts`:

```ts
import { addDays } from '../../common/iso-date.js';
import { deriveInvoiceStatus } from '../../invoices/domain/invoice-status.js';
import { calculateInvoiceTotals } from '../../invoices/domain/invoice-totals.js';
import { DEFAULT_USER_ID } from './appendix-a.js';
import {
  GENERATED_INVOICE_COUNT,
  generateInvoices,
} from './generate-invoices.js';

const TODAY = '2026-09-15';
const NOW = new Date('2026-09-15T10:00:00.000Z');

describe('generateInvoices', () => {
  const invoices = generateInvoices(TODAY, NOW, DEFAULT_USER_ID);

  it('produces the same Invoices for the same day', () => {
    expect(generateInvoices(TODAY, NOW, DEFAULT_USER_ID)).toEqual(invoices);
  });

  it('creates 40 Invoices numbered INV-0001 to INV-0040', () => {
    expect(GENERATED_INVOICE_COUNT).toBe(40);
    expect(invoices).toHaveLength(40);
    expect(invoices[0].invoiceNumber).toBe('INV-0001');
    expect(invoices[39].invoiceNumber).toBe('INV-0040');
  });

  it('uses unique ids and Invoice Numbers', () => {
    expect(new Set(invoices.map((i) => i.invoiceId)).size).toBe(40);
    expect(new Set(invoices.map((i) => i.item.id)).size).toBe(40);
    expect(new Set(invoices.map((i) => i.invoiceNumber)).size).toBe(40);
  });

  it('always includes the fixed edge cases', () => {
    const [overdueDraft, overduePending, dueToday, paidPastDue, futureDraft] =
      invoices;
    const statusOf = (invoice: (typeof invoices)[number]) =>
      deriveInvoiceStatus(invoice.status, invoice.dueDate, TODAY);

    expect(overdueDraft.status).toBe('Draft');
    expect(statusOf(overdueDraft)).toBe('Overdue');
    expect(overduePending.status).toBe('Pending');
    expect(statusOf(overduePending)).toBe('Overdue');
    expect(dueToday).toMatchObject({ status: 'Pending', dueDate: TODAY });
    expect(statusOf(dueToday)).toBe('Pending');
    expect(paidPastDue.status).toBe('Paid');
    expect(paidPastDue.dueDate < TODAY).toBe(true);
    expect(statusOf(paidPastDue)).toBe('Paid');
    expect(futureDraft.status).toBe('Draft');
    expect(futureDraft.invoiceDate > TODAY).toBe(true);
  });

  it('mixes Stored Statuses: 14 Paid, 16 Pending, 10 Draft', () => {
    const count = (status: string) =>
      invoices.filter((i) => i.status === status).length;
    expect([count('Paid'), count('Pending'), count('Draft')]).toEqual([
      14, 16, 10,
    ]);
  });

  it('produces consistent money: Paid means Balance 0, Draft means nothing paid', () => {
    for (const invoice of invoices) {
      const totals = calculateInvoiceTotals({
        items: [invoice.item],
        taxRate: invoice.taxRate,
        discount: invoice.discount,
        totalPaid: invoice.totalPaid,
      });
      expect(totals.balanceAmount.gte(0)).toBe(true);
      if (invoice.status === 'Paid') {
        expect(totals.balanceAmount.isZero()).toBe(true);
      }
      if (invoice.status === 'Draft') {
        expect(totals.totalPaid.isZero()).toBe(true);
      }
    }
  });

  it('keeps every value inside the create rules', () => {
    for (const invoice of invoices) {
      expect(invoice.item.quantity).toBeGreaterThanOrEqual(1);
      expect(invoice.item.quantity).toBeLessThanOrEqual(50);
      expect(invoice.item.rate).toMatch(/^\d+\.\d{2}$/);
      expect(Number(invoice.item.rate)).toBeGreaterThanOrEqual(5);
      expect(Number(invoice.item.rate)).toBeLessThanOrEqual(5000);
      expect(['0', '7.5', '10', '15']).toContain(invoice.taxRate);
      expect(invoice.customer.email).toMatch(/^[a-z0-9.]+@example\.com$/);
      if (invoice.customer.mobileNumber !== null) {
        expect(invoice.customer.mobileNumber).toMatch(/^\+?[0-9\s\-()]{6,20}$/);
      }
    }
  });

  it('keeps dates consistent and never creates anything in the future', () => {
    for (const invoice of invoices) {
      expect(invoice.dueDate >= invoice.invoiceDate).toBe(true);
      expect(invoice.invoiceDate >= addDays(TODAY, -180)).toBe(true);
      expect(invoice.invoiceDate <= addDays(TODAY, 10)).toBe(true);
      expect(invoice.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(invoice.createdBy).toBe(DEFAULT_USER_ID);
    }
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd backend && npx vitest run src/database/seed/generate-invoices.spec.ts`
Expected: FAIL — cannot resolve `./generate-invoices.js`.

- [ ] **Step 4: Implement the generator**

`backend/src/database/seed/generate-invoices.ts`:

```ts
import { Decimal } from 'decimal.js';
import { addDays } from '../../common/iso-date.js';
import type { CurrencyCode } from '../../invoices/domain/currencies.js';
import type { StoredStatus } from '../../invoices/domain/invoice-status.js';
import { calculateInvoiceTotals } from '../../invoices/domain/invoice-totals.js';
import type { SeedInvoice } from './seed-invoice.js';

/**
 * Deterministic demo Invoices (spec §5.8). A fixed-seed PRNG (no faker) makes
 * every run produce the same data for the same day. Dates are relative to
 * `today`, so Overdue stays meaningful whenever the stack starts.
 */

export const GENERATED_INVOICE_COUNT = 40;

const PRNG_SEED = 20261002;

/** About 20 names that overlap partially, for the search demo. */
const CUSTOMER_NAMES = [
  'Nguyen Van An',
  'Nguyen Thi Binh',
  'Tran Minh Chau',
  'Le Hoang Dung',
  'Pham Thu Ha',
  'Acme Corp',
  'Acme Pty Ltd',
  'Globex Corporation',
  'Globex Asia',
  'Initech',
  'Umbrella Holdings',
  'Stark Industries',
  'Wayne Enterprises',
  'Wayne Logistics',
  'Kanglee Trading',
  'Paul Tan',
  'Paula Smith',
  'Sarah Connor',
  'Sarah Lee',
  'Oceanic Airlines',
];

const ITEM_NAMES = [
  'Website redesign',
  'Monthly hosting',
  'Consulting hours',
  'Mobile app sprint',
  'Logo design',
  'SEO audit',
  'Cloud migration',
  'Support retainer',
  'Analytics report',
  'Security review',
];

const ADDRESSES = [
  '12 George St, Sydney NSW 2000',
  '200 Collins St, Melbourne VIC 3000',
  '88 Market St, Singapore 048948',
  '5 Queen St, Auckland 1010',
  '1 Le Duan, District 1, Ho Chi Minh City',
];

const DUE_OFFSETS = [0, 7, 14, 30, 45, 60];
const OTHER_CURRENCIES: CurrencyCode[] = ['USD', 'SGD', 'GBP', 'EUR'];

interface InvoicePlan {
  status: StoredStatus;
  /** Days from today to the Invoice Date. */
  invoiceOffset: number;
  /** Days from the Invoice Date to the Due Date. */
  dueOffset: number;
}

/** Edge cases that are always present, whatever the PRNG produces. */
const FIXED_PLANS: InvoicePlan[] = [
  { status: 'Draft', invoiceOffset: -40, dueOffset: 30 }, // Overdue Draft
  { status: 'Pending', invoiceOffset: -60, dueOffset: 30 }, // Overdue Pending
  { status: 'Pending', invoiceOffset: -14, dueOffset: 14 }, // due today: not Overdue
  { status: 'Paid', invoiceOffset: -90, dueOffset: 30 }, // Paid past its Due Date: not Overdue
  { status: 'Draft', invoiceOffset: 5, dueOffset: 30 }, // future-dated Draft
];

/** With the fixed cases: 14 Paid (35 %), 16 Pending (40 %), 10 Draft (25 %). */
const RANDOM_STATUSES: StoredStatus[] = [
  ...Array<StoredStatus>(13).fill('Paid'),
  ...Array<StoredStatus>(14).fill('Pending'),
  ...Array<StoredStatus>(8).fill('Draft'),
];

interface Random {
  int(min: number, max: number): number;
  pick<T>(values: readonly T[]): T;
  chance(probability: number): boolean;
}

/** mulberry32: a small, well-known 32-bit PRNG returning floats in [0, 1). */
function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int: (min: number, max: number) =>
      min + Math.floor(next() * (max - min + 1)),
    pick: <T>(values: readonly T[]): T =>
      values[Math.floor(next() * values.length)],
    chance: (probability: number) => next() < probability,
  };
}

function shuffle<T>(values: readonly T[], random: Random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random.int(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateInvoices(
  today: string,
  now: Date,
  createdBy: string,
): SeedInvoice[] {
  const random = createRandom(PRNG_SEED);
  const plans: InvoicePlan[] = [
    ...FIXED_PLANS,
    ...shuffle(RANDOM_STATUSES, random).map((status) => ({
      status,
      // Only a Draft may be dated in the future (up to 10 days ahead).
      invoiceOffset:
        status === 'Draft' ? random.int(-180, 10) : random.int(-180, 0),
      dueOffset: random.pick(DUE_OFFSETS),
    })),
  ];
  return plans.map((plan, index) =>
    buildInvoice(index + 1, plan, today, now, createdBy, random),
  );
}

function buildInvoice(
  n: number,
  plan: InvoicePlan,
  today: string,
  now: Date,
  createdBy: string,
  random: Random,
): SeedInvoice {
  const invoiceDate = addDays(today, plan.invoiceOffset);
  const dueDate = addDays(invoiceDate, plan.dueOffset);
  const fullname = random.pick(CUSTOMER_NAMES);
  const itemName = random.pick(ITEM_NAMES);
  const quantity = random.int(1, 50);
  const rate = new Decimal(random.int(500, 500_000)).dividedBy(100).toFixed(2);
  const taxRate = random.chance(0.7) ? '10' : random.pick(['0', '7.5', '15']);
  const subTotal = new Decimal(rate).times(quantity);
  const discount = random.chance(0.75)
    ? '0'
    : subTotal
        .times(random.int(5, 10))
        .dividedBy(100)
        .toDecimalPlaces(2, Decimal.ROUND_DOWN)
        .toFixed(2);
  const { totalAmount } = calculateInvoiceTotals({
    items: [{ quantity, rate }],
    taxRate,
    discount,
  });
  const totalPaid = paidAmount(plan.status, totalAmount, random);
  const currency: CurrencyCode = random.chance(0.6)
    ? 'AUD'
    : random.pick(OTHER_CURRENCIES);
  const invoiceReference = random.chance(0.5)
    ? `PO-${random.int(10000, 99999)}`
    : null;
  const mobileNumber = random.chance(0.7)
    ? `+61 4${random.int(10, 99)} ${random.int(100, 999)} ${random.int(100, 999)}`
    : null;
  const address = random.chance(0.7) ? random.pick(ADDRESSES) : null;
  const description = random.chance(0.6) ? `${itemName} for ${fullname}` : null;
  const createdAt = createdAtFor(invoiceDate, now, random);
  const idSuffix = String(n).padStart(12, '0');

  return {
    invoiceId: `5eed0000-0000-4000-8000-${idSuffix}`,
    invoiceNumber: `INV-${String(n).padStart(4, '0')}`,
    invoiceReference,
    invoiceDate,
    dueDate,
    currency,
    description,
    status: plan.status,
    customer: {
      fullname,
      email: `${emailLocalPart(fullname)}@example.com`,
      mobileNumber,
      address,
    },
    item: {
      id: `5eed0000-0000-4000-9000-${idSuffix}`,
      name: itemName,
      quantity,
      rate,
    },
    taxRate,
    discount,
    totalPaid: totalPaid.toFixed(2),
    createdAt,
    createdBy,
  };
}

/** Paid in full, part-paid (some Pending Invoices) or nothing paid yet. */
function paidAmount(
  status: StoredStatus,
  totalAmount: Decimal,
  random: Random,
): Decimal {
  if (status === 'Paid') return totalAmount;
  if (status === 'Pending' && random.chance(0.5)) {
    return totalAmount
      .times(random.pick([0.25, 0.5, 0.75]))
      .toDecimalPlaces(2, Decimal.ROUND_DOWN);
  }
  return new Decimal(0);
}

/**
 * A working-hours time on the Invoice Date, but never later than `now`, so the
 * default "newest first" order roughly follows the Invoice Date.
 */
function createdAtFor(invoiceDate: string, now: Date, random: Random): Date {
  const createdAt = new Date(`${invoiceDate}T00:00:00.000Z`);
  createdAt.setUTCHours(random.int(9, 17), random.int(0, 59), random.int(0, 59));
  return createdAt.getTime() > now.getTime() ? new Date(now) : createdAt;
}

function emailLocalPart(fullname: string): string {
  return fullname
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd backend && npx vitest run src/database/seed/generate-invoices.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Implement the seeder and its entry point**

`backend/src/database/seed/seeder.ts`:

```ts
import { Decimal } from 'decimal.js';
import type { DataSource } from 'typeorm';
import { CURRENCY_SYMBOLS } from '../../invoices/domain/currencies.js';
import { calculateInvoiceTotals } from '../../invoices/domain/invoice-totals.js';
import { Invoice } from '../../invoices/entities/invoice.entity.js';
import { InvoiceItem } from '../../invoices/entities/invoice-item.entity.js';
import { PasswordHasher } from '../../users/password-hasher.js';
import { User } from '../../users/user.entity.js';
import { APPENDIX_A_INVOICE, DEFAULT_USER_ID } from './appendix-a.js';
import { generateInvoices } from './generate-invoices.js';
import type { SeedInvoice } from './seed-invoice.js';

export interface SeedOptions {
  user: { email: string; password: string; fullname: string };
  /** "today" in APP_TIMEZONE; generated dates are relative to it. */
  today: string;
  /** Upper bound for generated `created_at` values. */
  now: Date;
  /** Truncate the Invoices (their items cascade) first. Users are kept. */
  reset?: boolean;
}

/**
 * Seeds the database (spec §5.8): pending migrations, the default User
 * (upserted by a fixed id), the Appendix A Invoice and the generated Invoices.
 * Every insert uses ON CONFLICT DO NOTHING, and an Invoice Item is inserted only
 * when its Invoice was, so a second run changes nothing.
 */
export async function seedDatabase(
  dataSource: DataSource,
  options: SeedOptions,
): Promise<{ invoicesInserted: number }> {
  await dataSource.runMigrations({ transaction: 'each' });
  const passwordHash = await new PasswordHasher().hash(options.user.password);
  const seeds = [
    APPENDIX_A_INVOICE,
    ...generateInvoices(options.today, options.now, DEFAULT_USER_ID),
  ];

  return dataSource.transaction(async (manager) => {
    if (options.reset) {
      await manager.query('TRUNCATE TABLE invoices CASCADE');
    }
    await manager.upsert(
      User,
      {
        id: DEFAULT_USER_ID,
        email: options.user.email.toLowerCase(),
        passwordHash,
        fullname: options.user.fullname,
      },
      ['id'],
    );

    let invoicesInserted = 0;
    for (const seed of seeds) {
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(Invoice)
        .values(toInvoiceRow(seed))
        .orIgnore()
        .execute();
      // RETURNING yields no row when ON CONFLICT DO NOTHING skipped the insert.
      if ((inserted.raw as unknown[]).length === 0) continue;

      await manager
        .createQueryBuilder()
        .insert()
        .into(InvoiceItem)
        .values({
          id: seed.item.id,
          invoiceId: seed.invoiceId,
          name: seed.item.name,
          quantity: seed.item.quantity,
          rate: new Decimal(seed.item.rate),
        })
        .orIgnore()
        .execute();
      invoicesInserted += 1;
    }
    return { invoicesInserted };
  });
}

function toInvoiceRow(seed: SeedInvoice) {
  const totals = calculateInvoiceTotals({
    items: [seed.item],
    taxRate: seed.taxRate,
    discount: seed.discount,
    totalPaid: seed.totalPaid,
  });
  return {
    invoiceId: seed.invoiceId,
    invoiceNumber: seed.invoiceNumber,
    invoiceReference: seed.invoiceReference,
    invoiceDate: seed.invoiceDate,
    dueDate: seed.dueDate,
    currency: seed.currency,
    currencySymbol: CURRENCY_SYMBOLS[seed.currency],
    description: seed.description,
    status: seed.status,
    customerFullname: seed.customer.fullname,
    customerEmail: seed.customer.email,
    customerMobileNumber: seed.customer.mobileNumber,
    customerAddress: seed.customer.address,
    taxRate: new Decimal(seed.taxRate),
    invoiceSubTotal: totals.subTotal,
    totalTax: totals.taxAmount,
    totalDiscount: totals.discount,
    totalAmount: totals.totalAmount,
    totalPaid: totals.totalPaid,
    balanceAmount: totals.balanceAmount,
    createdAt: seed.createdAt,
    createdBy: seed.createdBy,
  };
}
```

`backend/src/database/seed/run-seed.ts`:

```ts
import { DataSource } from 'typeorm';
import { todayIn } from '../../common/iso-date.js';
import {
  SeedEnvironmentVariables,
  validateConfig,
} from '../../config/env.validation.js';
import { loadEnvFile } from '../../config/load-env-file.js';
import { buildDataSourceOptions } from '../data-source.js';
import { seedDatabase } from './seeder.js';

/**
 * Seed entry point: `npm run seed` (idempotent) and `npm run seed:reset`
 * (`--reset`: truncates the Invoices first). Reads `.env` when present.
 */
loadEnvFile();
const env = validateConfig(SeedEnvironmentVariables, process.env);
const now = new Date();
const reset = process.argv.includes('--reset');

const dataSource = new DataSource(buildDataSourceOptions(env.DATABASE_URL));
await dataSource.initialize();
try {
  const { invoicesInserted } = await seedDatabase(dataSource, {
    user: {
      email: env.SEED_USER_EMAIL,
      password: env.SEED_USER_PASSWORD,
      fullname: env.SEED_USER_FULLNAME,
    },
    today: todayIn(env.APP_TIMEZONE, now),
    now,
    reset,
  });
  console.log(
    `Seed complete${reset ? ' (reset)' : ''}: default User ${env.SEED_USER_EMAIL.toLowerCase()}, ` +
      `${invoicesInserted} Invoice(s) inserted.`,
  );
} finally {
  await dataSource.destroy();
}
```

- [ ] **Step 7: Write the seeder e2e test**

`backend/test/seed.e2e-spec.ts`:

```ts
import {
  APPENDIX_A_INVOICE,
  DEFAULT_USER_ID,
} from '../src/database/seed/appendix-a.js';
import { seedDatabase } from '../src/database/seed/seeder.js';
import { PasswordHasher } from '../src/users/password-hasher.js';
import {
  startDatabase,
  stopDatabase,
  type TestDatabase,
} from './utils/database.js';

const TODAY = '2026-09-15';
const NOW = new Date('2026-09-15T10:00:00.000Z');
const USER = {
  email: 'Admin@Example.com',
  password: 'Password123!',
  fullname: 'Admin User',
};

describe('Seeder (e2e)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startDatabase();
  });

  afterAll(async () => {
    await stopDatabase(db);
  });

  async function counts() {
    const [row] = await db.dataSource.query<
      { users: number; invoices: number; items: number }[]
    >(
      `SELECT (SELECT count(*)::int FROM users) AS users,
              (SELECT count(*)::int FROM invoices) AS invoices,
              (SELECT count(*)::int FROM invoice_items) AS items`,
    );
    return row;
  }

  it('applies the migrations and inserts the User, Appendix A and 40 generated Invoices', async () => {
    const result = await seedDatabase(db.dataSource, {
      user: USER,
      today: TODAY,
      now: NOW,
    });
    expect(result).toEqual({ invoicesInserted: 41 });
    expect(await counts()).toEqual({ users: 1, invoices: 41, items: 41 });
  });

  it('changes nothing when run again', async () => {
    const result = await seedDatabase(db.dataSource, {
      user: USER,
      today: TODAY,
      now: NOW,
    });
    expect(result).toEqual({ invoicesInserted: 0 });
    expect(await counts()).toEqual({ users: 1, invoices: 41, items: 41 });
  });

  it('stores the Appendix A Invoice verbatim', async () => {
    const [invoice] = await db.dataSource.query(
      `SELECT invoice_number, invoice_reference, invoice_date, due_date, currency,
              currency_symbol, description, status, customer_fullname, customer_email,
              customer_mobile_number, customer_address, tax_rate::text,
              invoice_sub_total::text, total_tax::text, total_discount::text,
              total_amount::text, total_paid::text, balance_amount::text,
              created_at, created_by
       FROM invoices WHERE invoice_id = $1`,
      [APPENDIX_A_INVOICE.invoiceId],
    );
    expect(invoice).toEqual({
      invoice_number: 'IV1780488206995',
      invoice_reference: '#5721662',
      invoice_date: '2026-06-03',
      due_date: '2026-07-03',
      currency: 'AUD',
      currency_symbol: 'AU$',
      description: 'Invoice is issued to Kanglee',
      status: 'Pending',
      customer_fullname: 'Paul',
      customer_email: 'paul@101digital.io',
      customer_mobile_number: '947717364111',
      customer_address: 'Singapore',
      tax_rate: '10.00',
      invoice_sub_total: '2000.00',
      total_tax: '200.00',
      total_discount: '20.00',
      total_amount: '2180.00',
      total_paid: '1451.34',
      balance_amount: '728.66',
      created_at: new Date('2026-06-03T12:03:26.995Z'),
      created_by: DEFAULT_USER_ID,
    });

    const items = await db.dataSource.query(
      `SELECT id, name, quantity, rate::text FROM invoice_items WHERE invoice_id = $1`,
      [APPENDIX_A_INVOICE.invoiceId],
    );
    expect(items).toEqual([
      {
        id: 'b1c2d3e4-0000-0000-0000-000000000001',
        name: 'Honda RC150',
        quantity: 2,
        rate: '1000.00',
      },
    ]);
  });

  it('stores the default User with a lower-case email and a bcrypt hash', async () => {
    const [user] = await db.dataSource.query(
      `SELECT id, email, fullname, password_hash FROM users`,
    );
    expect(user).toMatchObject({
      id: DEFAULT_USER_ID,
      email: 'admin@example.com',
      fullname: 'Admin User',
    });
    expect(
      await new PasswordHasher().verify(USER.password, user.password_hash),
    ).toBe(true);
  });

  it('reset restores every demo Invoice and updates the default User', async () => {
    await db.dataSource.query(
      `DELETE FROM invoices WHERE invoice_number IN ('INV-0001', 'INV-0002')`,
    );
    expect(await counts()).toEqual({ users: 1, invoices: 39, items: 39 });

    const result = await seedDatabase(db.dataSource, {
      user: { ...USER, password: 'NewPassword456!' },
      today: TODAY,
      now: NOW,
      reset: true,
    });

    expect(result).toEqual({ invoicesInserted: 41 });
    expect(await counts()).toEqual({ users: 1, invoices: 41, items: 41 });
    const [user] = await db.dataSource.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [DEFAULT_USER_ID],
    );
    expect(
      await new PasswordHasher().verify('NewPassword456!', user.password_hash),
    ).toBe(true);
  });
});
```

- [ ] **Step 8: Run the e2e suites to verify they pass**

Run: `cd backend && npm run test:e2e`
Expected: PASS — `database.e2e-spec.ts` and `seed.e2e-spec.ts`.

- [ ] **Step 9: Run the unit suite, lint and type-check**

Run: `cd backend && npm run format && npm test && npm run lint && npm run typecheck && npm run build`
Expected: all pass; `dist/database/seed/run-seed.js` exists. (Task 15 runs `npm run seed` against the compose database.)

- [ ] **Step 10: Commit**

```bash
git add backend
git commit -m "feat(backend): add the idempotent seeder with Appendix A and generated Invoices

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 5: HTTP foundation (app bootstrap, error filter, clock, health, Swagger)

The shared HTTP pipeline of §5.4–§5.6: JSON-only body parser, helmet, cookie-parser, trust proxy, global `ValidationPipe`, the `AllExceptionsFilter`, Swagger at `/api/docs`, `GET /health`, the injectable clock, and the e2e harness every later e2e file uses.

**Files:**
- Create: `backend/src/common/error-response.dto.ts`
- Create: `backend/src/common/all-exceptions.filter.ts`
- Create: `backend/src/common/clock.service.ts`
- Create: `backend/src/common/public.decorator.ts`
- Create: `backend/src/health/health.controller.ts`, `backend/src/health/health.module.ts`
- Create: `backend/src/app.module.ts`, `backend/src/app.setup.ts`, `backend/src/main.ts`
- Create: `backend/test/utils/test-app.ts`
- Test: `backend/src/common/all-exceptions.filter.spec.ts`
- Test: `backend/src/common/clock.service.spec.ts`
- Test: `backend/test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: `todayIn` (Task 1); `EnvironmentVariables`, `validateEnv`, `parseTrustProxy` (Task 2); `buildDataSourceOptions` (Task 3); `seedDatabase` (Task 4).
- Produces:
  - `ErrorResponseDto { statusCode: number; message: string | string[]; error: string }` (Swagger type for every error response).
  - `AllExceptionsFilter` (constructor `(adapterHost: HttpAdapterHost)`).
  - `@Injectable() ClockService { today(): string }` — provided by `InvoicesModule` in Task 7; tests override it.
  - `IS_PUBLIC_KEY = 'isPublic'`, `Public(): CustomDecorator` — the guard in Task 6 skips routes marked with it.
  - `appOptions: NestApplicationOptions` (`{ bodyParser: false }`) and `applyAppSetup(app: NestExpressApplication): void`.
  - `AppModule` (Tasks 6 and 7 add `AuthModule` and `InvoicesModule` to its `imports`).
  - `test/utils/test-app.ts`: `TEST_TODAY = '2026-09-15'`, `TEST_NOW = new Date('2026-09-15T10:00:00.000Z')`, `TEST_USER = { email: 'admin@example.com', password: 'Password123!', fullname: 'Admin User' }`, `interface TestContext { app: NestExpressApplication; container: StartedPostgreSqlContainer }`, `startTestApp(): Promise<TestContext>` (fresh container, real `AppModule`, `ClockService` pinned to `TEST_TODAY`, database seeded), `stopTestApp(context?: TestContext): Promise<void>`.

- [ ] **Step 1: Write the failing unit tests**

`backend/src/common/all-exceptions.filter.spec.ts`:

```ts
import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function setup() {
  const reply = vi.fn();
  const adapterHost = { httpAdapter: { reply } } as unknown as HttpAdapterHost;
  const request = { method: 'GET', originalUrl: '/invoices' };
  const response = {};
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter(adapterHost);
  return {
    reply,
    response,
    handle: (exception: unknown) => filter.catch(exception, host),
  };
}

describe('AllExceptionsFilter', () => {
  it('keeps the message of an HttpException and adds the reason phrase', () => {
    const { reply, response, handle } = setup();
    handle(new NotFoundException('Invoice not found'));
    expect(reply).toHaveBeenCalledWith(
      response,
      { statusCode: 404, message: 'Invoice not found', error: 'Not Found' },
      404,
    );
  });

  it('keeps the message array of a validation error', () => {
    const { reply, handle } = setup();
    handle(
      new BadRequestException([
        'dueDate must be on or after invoiceDate',
        'items must contain exactly 1 item',
      ]),
    );
    expect(reply.mock.calls[0][1]).toEqual({
      statusCode: 400,
      message: [
        'dueDate must be on or after invoiceDate',
        'items must contain exactly 1 item',
      ],
      error: 'Bad Request',
    });
  });

  it('wraps a string response, such as the throttler message', () => {
    const { reply, handle } = setup();
    handle(
      new HttpException(
        'Too many login attempts, please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
    expect(reply.mock.calls[0][1]).toEqual({
      statusCode: 429,
      message: 'Too many login attempts, please try again later',
      error: 'Too Many Requests',
    });
    expect(reply.mock.calls[0][2]).toBe(429);
  });

  it('passes through bodies without a message, such as the health report', () => {
    const report = {
      status: 'error',
      info: {},
      error: { database: { status: 'down' } },
      details: { database: { status: 'down' } },
    };
    const { reply, handle } = setup();
    handle(new ServiceUnavailableException(report));
    expect(reply.mock.calls[0][1]).toEqual(report);
    expect(reply.mock.calls[0][2]).toBe(503);
  });

  it('exposes 4xx errors raised by Express middleware, such as a body that is too large', () => {
    const { reply, handle } = setup();
    handle(
      Object.assign(new Error('request entity too large'), {
        status: 413,
        expose: true,
      }),
    );
    expect(reply.mock.calls[0][1]).toEqual({
      statusCode: 413,
      message: 'request entity too large',
      error: 'Payload Too Large',
    });
  });

  it('hides unknown errors behind a 500 and logs them with the request', () => {
    const logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { reply, handle } = setup();
    handle(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    expect(reply.mock.calls[0][1]).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(reply.mock.calls[0][2]).toBe(500);
    expect(logError).toHaveBeenCalledWith(
      'GET /invoices failed',
      expect.stringContaining('ECONNREFUSED'),
    );
  });
});
```

`backend/src/common/clock.service.spec.ts`:

```ts
import { ClockService } from './clock.service.js';

type ClockConfig = ConstructorParameters<typeof ClockService>[0];

function clockIn(timeZone: string): ClockService {
  const config = { get: vi.fn().mockReturnValue(timeZone) };
  return new ClockService(config as unknown as ClockConfig);
}

describe('ClockService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today in APP_TIMEZONE, which can differ from the UTC date near midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T17:30:00.000Z'));
    expect(clockIn('UTC').today()).toBe('2026-06-30');
    expect(clockIn('Asia/Ho_Chi_Minh').today()).toBe('2026-07-01');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && npx vitest run src/common`
Expected: FAIL — cannot resolve `./all-exceptions.filter.js` and `./clock.service.js` (`iso-date.spec.ts` still passes).

- [ ] **Step 3: Implement the filter, the clock, `@Public()` and the error DTO**

`backend/src/common/all-exceptions.filter.ts`:

```ts
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { STATUS_CODES } from 'node:http';

/**
 * Global exception filter (spec §5.5): every error leaves the API as
 * `{ statusCode, message, error }`. Unknown errors become a 500 that never
 * reveals internals; their stack trace is logged with the request.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<{
      method?: string;
      originalUrl?: string;
    }>();
    const [status, body] = this.toResponse(exception, request);
    this.adapterHost.httpAdapter.reply(context.getResponse(), body, status);
  }

  private toResponse(
    exception: unknown,
    request: { method?: string; originalUrl?: string },
  ): [number, unknown] {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return [status, errorBody(status, payload)];
      }
      if (hasMessage(payload)) {
        const error =
          typeof payload.error === 'string'
            ? payload.error
            : reasonPhrase(status);
        return [status, { statusCode: status, message: payload.message, error }];
      }
      // Bodies without a message, such as the Terminus health report, pass through.
      return [status, payload];
    }

    const clientError = exposedClientError(exception);
    if (clientError) {
      return [
        clientError.status,
        errorBody(clientError.status, clientError.message),
      ];
    }

    this.logger.error(
      `${request.method} ${request.originalUrl} failed`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    return [
      HttpStatus.INTERNAL_SERVER_ERROR,
      errorBody(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error'),
    ];
  }
}

function reasonPhrase(status: number): string {
  return STATUS_CODES[status] ?? 'Error';
}

function errorBody(status: number, message: string) {
  return { statusCode: status, message, error: reasonPhrase(status) };
}

function hasMessage(
  payload: object,
): payload is { message: string | string[]; error?: unknown } {
  const { message } = payload as { message?: unknown };
  return (
    typeof message === 'string' ||
    (Array.isArray(message) && message.every((m) => typeof m === 'string'))
  );
}

/**
 * Errors from Express middleware (the JSON body parser) carry an HTTP status
 * and an `expose` flag. Exposed 4xx ones are safe to show, e.g. 413
 * "request entity too large".
 */
function exposedClientError(
  exception: unknown,
): { status: number; message: string } | undefined {
  if (!(exception instanceof Error)) return undefined;
  const { status, expose } = exception as Error & {
    status?: unknown;
    expose?: unknown;
  };
  if (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    expose === true
  ) {
    return { status, message: exception.message };
  }
  return undefined;
}
```

`backend/src/common/clock.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { todayIn } from './iso-date.js';

/**
 * The single source of "today": the calendar date in APP_TIMEZONE. The Overdue
 * rule reads it, and tests replace it to make Overdue deterministic.
 */
@Injectable()
export class ClockService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  today(): string {
    return todayIn(this.config.get('APP_TIMEZONE', { infer: true }));
  }
}
```

`backend/src/common/public.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the global JWT guard; every other route requires a valid token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

`backend/src/common/error-response.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

/** The body of every error response (spec §5.5), for the Swagger documentation. */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' } },
    ],
    description:
      'A message, or one message per invalid field for validation errors (400).',
    example: 'Invoice not found',
  })
  message: string | string[];

  @ApiProperty({ example: 'Not Found', description: 'The HTTP reason phrase.' })
  error: string;
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `cd backend && npx vitest run src/common`
Expected: PASS (`all-exceptions.filter.spec.ts` 6 tests, `clock.service.spec.ts` 1 test, `iso-date.spec.ts`).

- [ ] **Step 5: Implement health, the app module, the shared setup and `main.ts`**

`backend/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../common/public.decorator.js';

/** Liveness and database readiness, used by the Docker health check. */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Report API and database health',
    description: '200 when the database answers a ping within 1.5 s, else 503.',
  })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database').withTimeout(1500),
    ]);
  }
}
```

`backend/src/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';

/** GET /health: a Terminus report with a database ping. */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

`backend/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  type EnvironmentVariables,
  validateEnv,
} from './config/env.validation.js';
import { buildDataSourceOptions } from './database/data-source.js';
import { HealthModule } from './health/health.module.js';

/**
 * Root module: validated configuration, TypeORM (pending migrations run at
 * start-up; `synchronize` stays off) and the feature modules.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...buildDataSourceOptions(config.get('DATABASE_URL', { infer: true })),
        migrationsRun: true,
      }),
    }),
    HealthModule,
  ],
})
export class AppModule {}
```

`backend/src/app.setup.ts`:

```ts
import { type NestApplicationOptions, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import {
  type EnvironmentVariables,
  parseTrustProxy,
} from './config/env.validation.js';

/**
 * Creation options. Nest's default body parsers are off, so the only parser is
 * the JSON one registered below: form-encoded and text bodies are never parsed.
 */
export const appOptions: NestApplicationOptions = { bodyParser: false };

/**
 * The HTTP pipeline, shared by main.ts and the e2e tests so both run exactly
 * the same middleware, validation, error handling and Swagger setup.
 */
export function applyAppSetup(app: NestExpressApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Behind nginx, req.ip must be the real client (login throttle) and
  // req.secure must reflect TLS (the cookie's Secure flag).
  app.set(
    'trust proxy',
    parseTrustProxy(config.get('TRUST_PROXY', { infer: true })),
  );
  app.use(
    helmet({
      // Keep helmet's CSP but drop upgrade-insecure-requests, so Swagger UI's
      // assets still load over plain http://localhost.
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '100kb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  const documentConfig = new DocumentBuilder()
    .setTitle('SimpleInvoice API')
    .setDescription(
      'REST API of SimpleInvoice. Call POST /auth/login, then click "Authorize" ' +
        'and paste the accessToken (Bearer scheme). The SPA uses the httpOnly ' +
        '`access_token` cookie set by the same call instead; the API accepts that ' +
        'cookie only together with the header `X-Requested-With: XMLHttpRequest`.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('auth', 'Sign in, current User and sign out')
    .addTag('invoices', 'List, view and create Invoices')
    .addTag('health', 'Liveness and database readiness')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    () => SwaggerModule.createDocument(app, documentConfig),
    {
      jsonDocumentUrl: 'api/docs-json',
      swaggerOptions: { persistAuthorization: true },
    },
  );
}
```

`backend/src/main.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { appOptions, applyAppSetup } from './app.setup.js';
import type { EnvironmentVariables } from './config/env.validation.js';

/** Starts the API: create the app, apply the shared HTTP setup, listen on PORT. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    appOptions,
  );
  app.enableShutdownHooks();
  applyAppSetup(app);
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

await bootstrap();
```

- [ ] **Step 6: Write the e2e harness**

`backend/test/utils/test-app.ts`:

```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { appOptions, applyAppSetup } from '../../src/app.setup.js';
import { ClockService } from '../../src/common/clock.service.js';
import { seedDatabase } from '../../src/database/seed/seeder.js';

/** The pinned "today" of every e2e run, so Overdue is deterministic. */
export const TEST_TODAY = '2026-09-15';
export const TEST_NOW = new Date('2026-09-15T10:00:00.000Z');
export const TEST_USER = {
  email: 'admin@example.com',
  password: 'Password123!',
  fullname: 'Admin User',
};

export interface TestContext {
  app: NestExpressApplication;
  container: StartedPostgreSqlContainer;
}

/**
 * Boots the real AppModule with the shared HTTP setup against a fresh
 * PostgreSQL container, then seeds it for TEST_TODAY: the real migrations,
 * seed and HTTP pipeline are under test.
 */
export async function startTestApp(): Promise<TestContext> {
  const container = await new PostgreSqlContainer(
    'postgres:17-alpine',
  ).start();
  setTestEnv(container.getConnectionUri());
  const app = await createApp();
  await seedDatabase(app.get(DataSource), {
    user: TEST_USER,
    today: TEST_TODAY,
    now: TEST_NOW,
  });
  return { app, container };
}

export async function stopTestApp(context?: TestContext): Promise<void> {
  await context?.app.close();
  await context?.container.stop();
}

/** Every API key. The JWT secret is random per run: no secret lives in the code. */
function setTestEnv(databaseUrl: string): void {
  Object.assign(process.env, {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: randomBytes(32).toString('base64'),
    JWT_EXPIRES_IN: '3600',
    COOKIE_SECURE: 'auto',
    APP_TIMEZONE: 'UTC',
    LOGIN_THROTTLE_LIMIT: '5',
    LOGIN_THROTTLE_TTL: '60',
    TRUST_PROXY: 'loopback, linklocal, uniquelocal',
    PORT: '3000',
  });
}

async function createApp(): Promise<NestExpressApplication> {
  // Imported only now: ConfigModule.forRoot validates process.env as soon as
  // app.module.ts is evaluated, so the env must be set first.
  const { AppModule } = await import('../../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ClockService)
    .useValue({ today: () => TEST_TODAY })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...appOptions,
    logger: ['error', 'warn'],
  });
  applyAppSetup(app);
  await app.init();
  return app;
}
```

- [ ] **Step 7: Write the e2e test**

`backend/test/app.e2e-spec.ts`:

```ts
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  startTestApp,
  stopTestApp,
  type TestContext,
} from './utils/test-app.js';

describe('HTTP foundation (e2e)', () => {
  let context: TestContext;
  let server: App;

  beforeAll(async () => {
    context = await startTestApp();
    server = context.app.getHttpServer();
  });

  afterAll(async () => {
    await stopTestApp(context);
  });

  it('GET /health reports the database as up', async () => {
    const res = await request(server).get('/health').expect(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
  });

  it('answers unknown routes with the standard error shape', async () => {
    const res = await request(server).get('/nope').expect(404);
    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Cannot GET /nope',
      error: 'Not Found',
    });
  });

  it('sets helmet security headers and hides Express', async () => {
    const res = await request(server).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(res.headers['content-security-policy']).not.toContain(
      'upgrade-insecure-requests',
    );
  });

  it('serves Swagger UI at /api/docs and the OpenAPI document at /api/docs-json', async () => {
    const ui = await request(server).get('/api/docs').expect(200);
    expect(ui.headers['content-type']).toContain('text/html');
    const doc = await request(server).get('/api/docs-json').expect(200);
    expect(doc.body.info).toMatchObject({
      title: 'SimpleInvoice API',
      version: '1.0.0',
    });
  });

  it('rejects a JSON body over 100 kB with 413', async () => {
    const res = await request(server)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(200_000) }))
      .expect(413);
    expect(res.body).toEqual({
      statusCode: 413,
      message: 'request entity too large',
      error: 'Payload Too Large',
    });
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(server)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
  });
});
```

- [ ] **Step 8: Run the e2e suites to verify they pass**

Run: `cd backend && npm run test:e2e`
Expected: PASS — `app.e2e-spec.ts`, `database.e2e-spec.ts`, `seed.e2e-spec.ts`.

- [ ] **Step 9: Check that the API refuses to start without its secrets**

Run: `cd backend && npm run build && env -u JWT_SECRET -u DATABASE_URL node dist/main.js; echo "exit=$?"`
Expected: the process exits with an error that contains `Invalid environment configuration:` and lists `DATABASE_URL` and `JWT_SECRET`, then `exit=1`. (Make sure `backend/.env` does not exist; delete it if you created one.)

- [ ] **Step 10: Run the unit suite, lint and type-check**

Run: `cd backend && npm run format && npm test && npm run lint && npm run typecheck`
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add backend
git commit -m "feat(backend): add the HTTP pipeline, error filter, clock, health and Swagger

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 6: Users and authentication (login, `/auth/me`, logout, global JWT guard)

Spec §5.3 auth rows, §5.4 and ADR-0002: bcrypt login with a per-IP throttle, an HS256 access token returned in the body **and** set as the httpOnly `access_token` cookie, a global guard that accepts the Bearer header first and the cookie only with `X-Requested-With: XMLHttpRequest`, and logout that clears the cookie.

**Files:**
- Create: `backend/src/common/transforms.ts`
- Create: `backend/src/common/current-user.decorator.ts`
- Create: `backend/src/users/users.service.ts`, `backend/src/users/users.module.ts`
- Create: `backend/src/auth/jwt-payload.ts`
- Create: `backend/src/auth/dto/login.dto.ts`, `backend/src/auth/dto/user.dto.ts`, `backend/src/auth/dto/login-response.dto.ts`
- Create: `backend/src/auth/auth.service.ts`
- Create: `backend/src/auth/auth-cookie.ts`
- Create: `backend/src/auth/jwt-extractor.ts`
- Create: `backend/src/auth/jwt.strategy.ts`, `backend/src/auth/jwt-auth.guard.ts`
- Create: `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.module.ts`
- Modify: `backend/src/app.module.ts` (import `AuthModule`)
- Modify: `backend/test/utils/test-app.ts` (add `nextClientIp` and `loginAs`)
- Test: `backend/src/common/transforms.spec.ts`
- Test: `backend/src/auth/jwt-extractor.spec.ts`
- Test: `backend/src/auth/auth.service.spec.ts`
- Test: `backend/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `User` entity (Task 3); `PasswordHasher` (Task 4); `DEFAULT_USER_ID` (Task 4, the id of the seeded User); `EnvironmentVariables`, `CookieSecureMode` (Task 2); `Public`, `IS_PUBLIC_KEY`, `ErrorResponseDto` (Task 5); `startTestApp`, `stopTestApp`, `TEST_USER`, `TestContext` (Task 5).
- Produces:
  - `common/transforms.ts`: `trim`, `trimToUndefined` (blank string → `undefined`), `trimToUpperCase` — each `({ value }: TransformFnParams) => unknown`, for `@Transform(...)`. Tasks 7 and 8 use all three.
  - `common/current-user.decorator.ts`: `CurrentUser()` parameter decorator → the `User` loaded by the guard.
  - `UsersService { findByEmail(email: string): Promise<User | null>; findById(id: string): Promise<User | null> }`; `UsersModule` exports `UsersService` and `PasswordHasher`.
  - `JwtPayload { sub: string; email: string }`.
  - `UserDto { id; email; fullname; createdAt: string }`, `toUserDto(user: User): UserDto`, `LoginDto { email; password }`, `LoginResponseDto { accessToken; tokenType: 'Bearer'; expiresIn: number; user: UserDto }`.
  - `AuthService.login(credentials: LoginDto): Promise<LoginResponseDto>`.
  - `ACCESS_TOKEN_COOKIE = 'access_token'`, `authCookieOptions(request: Request, mode: CookieSecureMode): CookieOptions`.
  - `fromSpaCookie`, `extractJwt` (passport-jwt extractors).
  - `JwtAuthGuard` registered as `APP_GUARD`: **every route requires a valid token unless marked `@Public()`** (Task 7's and Task 8's invoice routes are protected without extra code).
  - `AuthModule`.
  - `test/utils/test-app.ts`: `nextClientIp(): string` (a fresh `192.0.2.n` per call) and `loginAs(server: App, credentials?: { email: string; password: string }): Promise<string>` (signs in from a fresh client IP and returns the access token). Later e2e files call `loginAs(server)` and send `Authorization: Bearer <token>`.

- [ ] **Step 1: Write the failing unit tests**

`backend/src/common/transforms.spec.ts`:

```ts
import type { TransformFnParams } from 'class-transformer';
import { trim, trimToUndefined, trimToUpperCase } from './transforms.js';

function run(
  transform: (params: TransformFnParams) => unknown,
  value: unknown,
): unknown {
  return transform({ value } as TransformFnParams);
}

describe('transforms', () => {
  it('trim removes surrounding whitespace and leaves other types alone', () => {
    expect(run(trim, '  Paul  ')).toBe('Paul');
    expect(run(trim, 42)).toBe(42);
  });

  it('trimToUndefined turns a blank string into undefined', () => {
    expect(run(trimToUndefined, '   ')).toBeUndefined();
    expect(run(trimToUndefined, ' Singapore ')).toBe('Singapore');
    expect(run(trimToUndefined, null)).toBeNull();
  });

  it('trimToUpperCase trims and upper-cases strings only', () => {
    expect(run(trimToUpperCase, ' aud ')).toBe('AUD');
    expect(run(trimToUpperCase, undefined)).toBeUndefined();
  });
});
```

`backend/src/auth/jwt-extractor.spec.ts`:

```ts
import type { Request } from 'express';
import { extractJwt } from './jwt-extractor.js';

function requestWith(
  headers: Record<string, string>,
  cookies: Record<string, string> = {},
): Request {
  return { headers, cookies } as unknown as Request;
}

describe('extractJwt', () => {
  it('reads a Bearer token from the Authorization header', () => {
    expect(
      extractJwt(requestWith({ authorization: 'Bearer header-token' })),
    ).toBe('header-token');
  });

  it('ignores the cookie when X-Requested-With is missing', () => {
    expect(
      extractJwt(requestWith({}, { access_token: 'cookie-token' })),
    ).toBeNull();
  });

  it('reads the cookie when X-Requested-With is XMLHttpRequest', () => {
    expect(
      extractJwt(
        requestWith(
          { 'x-requested-with': 'XMLHttpRequest' },
          { access_token: 'cookie-token' },
        ),
      ),
    ).toBe('cookie-token');
  });

  it('prefers the Bearer header over the cookie', () => {
    expect(
      extractJwt(
        requestWith(
          {
            authorization: 'Bearer header-token',
            'x-requested-with': 'XMLHttpRequest',
          },
          { access_token: 'cookie-token' },
        ),
      ),
    ).toBe('header-token');
  });

  it('returns null when the request has no token', () => {
    expect(extractJwt(requestWith({}))).toBeNull();
  });
});
```

`backend/src/auth/auth.service.spec.ts`:

```ts
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';

type Dependencies = ConstructorParameters<typeof AuthService>;

const storedUser = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: 'admin@example.com',
  passwordHash: '$2b$12$stored-hash',
  fullname: 'Admin User',
  createdAt: new Date('2026-10-02T08:00:00.000Z'),
};

function setup(found: typeof storedUser | null, passwordMatches: boolean) {
  const users = { findByEmail: vi.fn().mockResolvedValue(found) };
  const hasher = {
    hash: vi.fn().mockResolvedValue('$2b$12$dummy-hash'),
    verify: vi.fn().mockResolvedValue(passwordMatches),
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('signed-token') };
  const config = { get: vi.fn().mockReturnValue(3600) };
  const service = new AuthService(
    users as unknown as Dependencies[0],
    hasher as unknown as Dependencies[1],
    jwt as unknown as Dependencies[2],
    config as unknown as Dependencies[3],
  );
  return { service, hasher, jwt };
}

describe('AuthService.login', () => {
  it('returns a Bearer token and the User for valid credentials', async () => {
    const { service, hasher, jwt } = setup(storedUser, true);
    const result = await service.login({
      email: 'admin@example.com',
      password: 'Password123!',
    });
    expect(hasher.verify).toHaveBeenCalledWith(
      'Password123!',
      '$2b$12$stored-hash',
    );
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: storedUser.id,
      email: 'admin@example.com',
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: storedUser.id,
        email: 'admin@example.com',
        fullname: 'Admin User',
        createdAt: '2026-10-02T08:00:00.000Z',
      },
    });
  });

  it('rejects a wrong password with the generic message', async () => {
    const { service, jwt } = setup(storedUser, false);
    const attempt = service.login({
      email: 'admin@example.com',
      password: 'wrong-password',
    });
    await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(attempt).rejects.toThrow('Invalid email or password');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('still compares a hash for an unknown email, so the timing does not reveal it', async () => {
    const { service, hasher } = setup(null, true);
    await expect(
      service.login({ email: 'nobody@example.com', password: 'Password123!' }),
    ).rejects.toThrow('Invalid email or password');
    expect(hasher.verify).toHaveBeenCalledWith(
      'Password123!',
      '$2b$12$dummy-hash',
    );
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && npx vitest run src/common/transforms.spec.ts src/auth`
Expected: FAIL — cannot resolve `./transforms.js`, `./jwt-extractor.js` and `./auth.service.js`.

- [ ] **Step 3: Implement the transforms, the Users service and module, and the auth DTOs**

`backend/src/common/transforms.ts`:

```ts
import type { TransformFnParams } from 'class-transformer';

// Helpers for @Transform(...) on request DTOs. Values of other types pass
// through unchanged, so the validators still report them.

/** Removes surrounding whitespace. */
export const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Trims, and turns a blank string into undefined, so an empty optional field counts as absent. */
export const trimToUndefined = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/** Trims and upper-cases, for case-insensitive codes such as a Currency or a sort order. */
export const trimToUpperCase = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
```

`backend/src/users/users.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity.js';

/** Reads Users. There is no sign-up: the seeder creates the only User. */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * Finds a User by email regardless of case (this uses the unique index on
   * lower(email)), including the password hash for the login check.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }
}
```

`backend/src/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordHasher } from './password-hasher.js';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';

/** Users and password hashing, for the auth module. */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, PasswordHasher],
  exports: [UsersService, PasswordHasher],
})
export class UsersModule {}
```

`backend/src/auth/jwt-payload.ts`:

```ts
/** Claims of the access token. `sub` is the id of the User. */
export interface JwtPayload {
  sub: string;
  email: string;
}
```

`backend/src/auth/dto/login.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { trim } from '../../common/transforms.js';

/** Body of POST /auth/login. */
export class LoginDto {
  @ApiProperty({ example: 'admin@example.com', maxLength: 255 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Password123!', minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  password: string;
}
```

`backend/src/auth/dto/user.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../users/user.entity.js';

/** The signed-in User as the API returns it. The password hash is never included. */
export class UserDto {
  @ApiProperty({
    format: 'uuid',
    example: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  })
  id: string;

  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: 'Admin User' })
  fullname: string;

  @ApiProperty({ format: 'date-time', example: '2026-10-02T08:00:00.000Z' })
  createdAt: string;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    fullname: user.fullname,
    createdAt: user.createdAt.toISOString(),
  };
}
```

`backend/src/auth/dto/login-response.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto.js';

/**
 * Response of POST /auth/login. The same token is also set as the httpOnly
 * `access_token` cookie; the SPA uses the cookie and ignores this field.
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT for the `Authorization: Bearer` header (Swagger, curl).',
  })
  accessToken: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ description: 'Lifetime of the token in seconds.', example: 3600 })
  expiresIn: number;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}
```

- [ ] **Step 4: Implement the cookie options, the extractor and the auth service**

`backend/src/auth/auth-cookie.ts`:

```ts
import type { CookieOptions, Request } from 'express';
import type { CookieSecureMode } from '../config/env.validation.js';

/** Name of the httpOnly cookie that carries the SPA's access token (ADR-0002). */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Flags of the access-token cookie (spec §5.4). `Secure` follows COOKIE_SECURE;
 * `auto` sets it when the request came over HTTPS, directly or through a
 * trusted proxy (X-Forwarded-Proto).
 */
export function authCookieOptions(
  request: Request,
  mode: CookieSecureMode,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: mode === 'auto' ? request.secure : mode === 'true',
  };
}
```

`backend/src/auth/jwt-extractor.ts`:

```ts
import type { Request } from 'express';
import { ExtractJwt, type JwtFromRequestFunction } from 'passport-jwt';
import { ACCESS_TOKEN_COOKIE } from './auth-cookie.js';

/**
 * Reads the token from the httpOnly cookie, but only on requests that carry
 * `X-Requested-With: XMLHttpRequest`. A cross-site form or link cannot set that
 * header, so the cookie alone never authenticates a request (ADR-0002).
 */
export const fromSpaCookie: JwtFromRequestFunction<Request> = (request) => {
  if (request.headers['x-requested-with'] !== 'XMLHttpRequest') return null;
  const token: unknown = request.cookies?.[ACCESS_TOKEN_COOKIE];
  return typeof token === 'string' && token !== '' ? token : null;
};

/** The Bearer header first (Swagger, curl), then the SPA cookie. */
export const extractJwt: JwtFromRequestFunction<Request> =
  ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    fromSpaCookie,
  ]);
```

`backend/src/auth/auth.service.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PasswordHasher } from '../users/password-hasher.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { toUserDto } from './dto/user.dto.js';
import type { JwtPayload } from './jwt-payload.js';

/** Checks credentials and issues access tokens. */
@Injectable()
export class AuthService {
  /** A hash of a random password, compared when the email is unknown. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /**
   * Returns an access token for valid credentials. An unknown email costs the
   * same bcrypt comparison as a wrong password, and both get the same 401, so
   * neither the response nor its timing reveals which emails exist.
   */
  async login(credentials: LoginDto): Promise<LoginResponseDto> {
    const user = await this.users.findByEmail(credentials.email);
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await this.hasher.verify(credentials.password, hash);
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_EXPIRES_IN', { infer: true }),
      user: toUserDto(user),
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomUUID());
    return this.dummyHash;
  }
}
```

- [ ] **Step 5: Run the unit tests to verify they pass**

Run: `cd backend && npx vitest run src/common/transforms.spec.ts src/auth`
Expected: PASS (3 + 5 + 3 tests).

- [ ] **Step 6: Add the login helpers to the e2e harness**

Replace `backend/test/utils/test-app.ts` with this version (unchanged from Task 5 except the `supertest` imports and the two functions at the end):

```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { appOptions, applyAppSetup } from '../../src/app.setup.js';
import { ClockService } from '../../src/common/clock.service.js';
import { seedDatabase } from '../../src/database/seed/seeder.js';

/** The pinned "today" of every e2e run, so Overdue is deterministic. */
export const TEST_TODAY = '2026-09-15';
export const TEST_NOW = new Date('2026-09-15T10:00:00.000Z');
export const TEST_USER = {
  email: 'admin@example.com',
  password: 'Password123!',
  fullname: 'Admin User',
};

export interface TestContext {
  app: NestExpressApplication;
  container: StartedPostgreSqlContainer;
}

/**
 * Boots the real AppModule with the shared HTTP setup against a fresh
 * PostgreSQL container, then seeds it for TEST_TODAY: the real migrations,
 * seed and HTTP pipeline are under test.
 */
export async function startTestApp(): Promise<TestContext> {
  const container = await new PostgreSqlContainer(
    'postgres:17-alpine',
  ).start();
  setTestEnv(container.getConnectionUri());
  const app = await createApp();
  await seedDatabase(app.get(DataSource), {
    user: TEST_USER,
    today: TEST_TODAY,
    now: TEST_NOW,
  });
  return { app, container };
}

export async function stopTestApp(context?: TestContext): Promise<void> {
  await context?.app.close();
  await context?.container.stop();
}

/** Every API key. The JWT secret is random per run: no secret lives in the code. */
function setTestEnv(databaseUrl: string): void {
  Object.assign(process.env, {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: randomBytes(32).toString('base64'),
    JWT_EXPIRES_IN: '3600',
    COOKIE_SECURE: 'auto',
    APP_TIMEZONE: 'UTC',
    LOGIN_THROTTLE_LIMIT: '5',
    LOGIN_THROTTLE_TTL: '60',
    TRUST_PROXY: 'loopback, linklocal, uniquelocal',
    PORT: '3000',
  });
}

async function createApp(): Promise<NestExpressApplication> {
  // Imported only now: ConfigModule.forRoot validates process.env as soon as
  // app.module.ts is evaluated, so the env must be set first.
  const { AppModule } = await import('../../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ClockService)
    .useValue({ today: () => TEST_TODAY })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...appOptions,
    logger: ['error', 'warn'],
  });
  applyAppSetup(app);
  await app.init();
  return app;
}

let clientCount = 0;

/**
 * A new client IP (TEST-NET-1) for each call, sent as X-Forwarded-For. The app
 * trusts the loopback proxy, so every login gets its own throttle bucket and
 * no test trips the login limit by accident.
 */
export function nextClientIp(): string {
  clientCount += 1;
  return `192.0.2.${clientCount}`;
}

/**
 * Signs in through the API and returns the token for `Authorization: Bearer`.
 * Only email and password are sent: the API rejects unknown fields with 400.
 */
export async function loginAs(
  server: App,
  { email, password }: { email: string; password: string } = TEST_USER,
): Promise<string> {
  const res = await request(server)
    .post('/auth/login')
    .set('X-Forwarded-For', nextClientIp())
    .send({ email, password })
    .expect(200);
  return (res.body as { accessToken: string }).accessToken;
}
```

- [ ] **Step 7: Write the failing e2e test**

`backend/test/auth.e2e-spec.ts`:

```ts
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DEFAULT_USER_ID } from '../src/database/seed/appendix-a.js';
import {
  loginAs,
  nextClientIp,
  startTestApp,
  stopTestApp,
  TEST_USER,
  type TestContext,
} from './utils/test-app.js';

const XHR = { 'X-Requested-With': 'XMLHttpRequest' };
const CREDENTIALS = { email: TEST_USER.email, password: TEST_USER.password };
const UNAUTHORIZED = {
  statusCode: 401,
  message: 'Unauthorized',
  error: 'Unauthorized',
};

function setCookies(res: request.Response): string[] {
  const header: unknown = res.headers['set-cookie'];
  return Array.isArray(header) ? (header as string[]) : [];
}

/** The full Set-Cookie line of the access-token cookie. */
function accessTokenCookie(res: request.Response): string {
  const cookie = setCookies(res).find((c) => c.startsWith('access_token='));
  if (!cookie) throw new Error('The response set no access_token cookie');
  return cookie;
}

/** The attributes of a Set-Cookie line, without the name=value pair. */
function cookieAttributes(cookie: string): string[] {
  return cookie
    .split(';')
    .slice(1)
    .map((attribute) => attribute.trim());
}

/** The `name=value` pair to send back in a Cookie header. */
function cookiePair(cookie: string): string {
  return cookie.split(';')[0];
}

describe('Auth (e2e)', () => {
  let context: TestContext;
  let server: App;

  beforeAll(async () => {
    context = await startTestApp();
    server = context.app.getHttpServer();
  });

  afterAll(async () => {
    await stopTestApp(context);
  });

  /** POST /auth/login from a new client IP. */
  function login(body: object, headers: Record<string, string> = {}) {
    return request(server)
      .post('/auth/login')
      .set('X-Forwarded-For', nextClientIp())
      .set(headers)
      .send(body);
  }

  async function signTestToken(
    payload: object,
    options: { expiresIn?: number; secret?: string } = {},
  ): Promise<string> {
    return context.app.get(JwtService).signAsync(payload, options);
  }

  describe('POST /auth/login', () => {
    it('returns the token and the User, and sets the httpOnly cookie', async () => {
      const res = await login(CREDENTIALS).expect(200);
      expect(res.body).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: DEFAULT_USER_ID,
          email: 'admin@example.com',
          fullname: 'Admin User',
          createdAt: expect.any(String),
        },
      });
      const cookie = accessTokenCookie(res);
      expect(cookiePair(cookie)).toBe(`access_token=${res.body.accessToken}`);
      const attributes = cookieAttributes(cookie);
      expect(attributes).toEqual(
        expect.arrayContaining([
          'Max-Age=3600',
          'Path=/',
          'HttpOnly',
          'SameSite=Strict',
        ]),
      );
      expect(attributes).not.toContain('Secure');
    });

    it('accepts the email in any case and with surrounding spaces', async () => {
      await login({
        email: '  ADMIN@Example.com ',
        password: TEST_USER.password,
      }).expect(200);
    });

    it('marks the cookie Secure when the request came over HTTPS through the proxy', async () => {
      const res = await login(CREDENTIALS, {
        'X-Forwarded-Proto': 'https',
      }).expect(200);
      expect(cookieAttributes(accessTokenCookie(res))).toContain('Secure');
    });

    it('rejects a wrong password with 401 and the generic message', async () => {
      const res = await login({
        email: TEST_USER.email,
        password: 'wrong-password',
      }).expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'Unauthorized',
      });
      expect(setCookies(res)).toEqual([]);
    });

    it('gives an unknown email the same 401', async () => {
      const res = await login({
        email: 'nobody@example.com',
        password: TEST_USER.password,
      }).expect(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('rejects an invalid email with 400', async () => {
      const res = await login({ email: 'not-an-email', password: 'x' }).expect(
        400,
      );
      expect(res.body).toEqual({
        statusCode: 400,
        message: ['email must be an email'],
        error: 'Bad Request',
      });
    });

    it('does not parse form-encoded bodies (JSON only)', async () => {
      await request(server)
        .post('/auth/login')
        .set('X-Forwarded-For', nextClientIp())
        .type('form')
        .send(CREDENTIALS)
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the User for a Bearer token', async () => {
      const token = await loginAs(server);
      const res = await request(server)
        .get('/auth/me')
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(res.body).toEqual({
        id: DEFAULT_USER_ID,
        email: 'admin@example.com',
        fullname: 'Admin User',
        createdAt: expect.any(String),
      });
    });

    it('accepts the cookie together with X-Requested-With', async () => {
      const cookie = cookiePair(
        accessTokenCookie(await login(CREDENTIALS).expect(200)),
      );
      await request(server)
        .get('/auth/me')
        .set('Cookie', cookie)
        .set(XHR)
        .expect(200);
    });

    it('rejects the cookie without X-Requested-With', async () => {
      const cookie = cookiePair(
        accessTokenCookie(await login(CREDENTIALS).expect(200)),
      );
      const res = await request(server)
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(401);
      expect(res.body).toEqual(UNAUTHORIZED);
    });

    it('rejects a request without a token', async () => {
      const res = await request(server).get('/auth/me').expect(401);
      expect(res.body).toEqual(UNAUTHORIZED);
    });

    it('rejects an expired token', async () => {
      const token = await signTestToken(
        { sub: DEFAULT_USER_ID, email: TEST_USER.email },
        { expiresIn: -10 },
      );
      await request(server)
        .get('/auth/me')
        .auth(token, { type: 'bearer' })
        .expect(401);
    });

    it('rejects a token signed with another secret', async () => {
      const token = await signTestToken(
        { sub: DEFAULT_USER_ID, email: TEST_USER.email },
        { secret: randomUUID() + randomUUID() },
      );
      await request(server)
        .get('/auth/me')
        .auth(token, { type: 'bearer' })
        .expect(401);
    });

    it('rejects a token whose User does not exist', async () => {
      const token = await signTestToken({
        sub: randomUUID(),
        email: 'ghost@example.com',
      });
      await request(server)
        .get('/auth/me')
        .auth(token, { type: 'bearer' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the cookie for the SPA', async () => {
      const cookie = cookiePair(
        accessTokenCookie(await login(CREDENTIALS).expect(200)),
      );
      const res = await request(server)
        .post('/auth/logout')
        .set('Cookie', cookie)
        .set(XHR)
        .expect(204);
      const cleared = accessTokenCookie(res);
      expect(cookiePair(cleared)).toBe('access_token=');
      expect(cookieAttributes(cleared)).toEqual(
        expect.arrayContaining([
          'Path=/',
          'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
          'HttpOnly',
          'SameSite=Strict',
        ]),
      );
    });

    it('requires authentication', async () => {
      const cookie = cookiePair(
        accessTokenCookie(await login(CREDENTIALS).expect(200)),
      );
      await request(server).post('/auth/logout').set('Cookie', cookie).expect(401);
    });

    it('accepts a Bearer token', async () => {
      const token = await loginAs(server);
      await request(server)
        .post('/auth/logout')
        .auth(token, { type: 'bearer' })
        .expect(204);
    });
  });

  describe('login throttle', () => {
    it('blocks the 6th attempt from one client IP, but not other clients', async () => {
      const ip = nextClientIp();
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await request(server)
          .post('/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ email: TEST_USER.email, password: 'wrong-password' })
          .expect(401);
      }
      const blocked = await request(server)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send(CREDENTIALS)
        .expect(429);
      expect(blocked.body).toEqual({
        statusCode: 429,
        message: 'Too many login attempts, please try again later',
        error: 'Too Many Requests',
      });
      await login(CREDENTIALS).expect(200);
    });
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `cd backend && npx vitest run --config ./vitest.config.e2e.ts test/auth.e2e-spec.ts`
Expected: FAIL — `POST /auth/login` answers 404 (no auth routes yet).

- [ ] **Step 9: Implement the strategy, the guard, the decorator, the controller and the module**

`backend/src/common/current-user.decorator.ts`:

```ts
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { User } from '../users/user.entity.js';

/** The User that the JWT guard loaded for this request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<{ user: User }>().user,
);
```

`backend/src/auth/jwt.strategy.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { isUUID } from 'class-validator';
import { Strategy } from 'passport-jwt';
import type { EnvironmentVariables } from '../config/env.validation.js';
import type { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { extractJwt } from './jwt-extractor.js';
import type { JwtPayload } from './jwt-payload.js';

/**
 * Verifies the access token (HS256 only, expiry enforced) and loads its User,
 * so the token of a User that no longer exists is rejected at once.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: extractJwt,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // A non-UUID `sub` would make PostgreSQL reject the query with a 500.
    const user = isUUID(payload.sub)
      ? await this.users.findById(payload.sub)
      : null;
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
```

`backend/src/auth/jwt-auth.guard.ts`:

```ts
import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../common/public.decorator.js';

/**
 * The global guard: every route needs a valid access token unless the route
 * or its controller is marked with @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic ? true : super.canActivate(context);
  }
}
```

`backend/src/auth/auth.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ErrorResponseDto } from '../common/error-response.dto.js';
import { Public } from '../common/public.decorator.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { User } from '../users/user.entity.js';
import { ACCESS_TOKEN_COOKIE, authCookieOptions } from './auth-cookie.js';
import { AuthService } from './auth.service.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { toUserDto, UserDto } from './dto/user.dto.js';

/** Sign in, the current User and sign out (spec §5.3, §5.4, ADR-0002). */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Returns an access token for the Authorization header and sets the same token as the httpOnly `access_token` cookie. ' +
      'Each client IP gets LOGIN_THROTTLE_LIMIT attempts per LOGIN_THROTTLE_TTL seconds.',
  })
  @ApiOkResponse({
    type: LoginResponseDto,
    headers: {
      'Set-Cookie': {
        description:
          '`access_token=<JWT>; Max-Age=<expiresIn>; Path=/; HttpOnly; SameSite=Strict`, plus `Secure` over HTTPS',
        schema: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'The body is not valid',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Invalid email or password',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Too many login attempts from this client',
  })
  async login(
    @Body() credentials: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.auth.login(credentials);
    response.cookie(ACCESS_TOKEN_COOKIE, result.accessToken, {
      ...authCookieOptions(request, this.cookieSecureMode()),
      maxAge: result.expiresIn * 1000,
    });
    return result;
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the signed-in User',
    description: 'The SPA calls this at start-up to restore the session.',
  })
  @ApiOkResponse({ type: UserDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'The token is missing, invalid or expired',
  })
  me(@CurrentUser() user: User): UserDto {
    return toUserDto(user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sign out',
    description:
      'Clears the `access_token` cookie. A Bearer token stays valid until it expires (the tokens are stateless).',
  })
  @ApiNoContentResponse({ description: 'Signed out; the cookie is cleared' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'The token is missing, invalid or expired',
  })
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): void {
    response.clearCookie(
      ACCESS_TOKEN_COOKIE,
      authCookieOptions(request, this.cookieSecureMode()),
    );
  }

  private cookieSecureMode() {
    return this.config.get('COOKIE_SECURE', { infer: true });
  }
}
```

`backend/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtStrategy } from './jwt.strategy.js';

/**
 * Authentication (spec §5.4, ADR-0002): login with a per-IP throttle, HS256
 * access tokens, and the global guard that protects every non-public route.
 */
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        throttlers: [
          {
            name: 'login',
            ttl: seconds(config.get('LOGIN_THROTTLE_TTL', { infer: true })),
            limit: config.get('LOGIN_THROTTLE_LIMIT', { infer: true }),
          },
        ],
        errorMessage: 'Too many login attempts, please try again later',
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
```

Replace `backend/src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import {
  type EnvironmentVariables,
  validateEnv,
} from './config/env.validation.js';
import { buildDataSourceOptions } from './database/data-source.js';
import { HealthModule } from './health/health.module.js';

/**
 * Root module: validated configuration, TypeORM (pending migrations run at
 * start-up; `synchronize` stays off) and the feature modules.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...buildDataSourceOptions(config.get('DATABASE_URL', { infer: true })),
        migrationsRun: true,
      }),
    }),
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 10: Run all e2e suites to verify they pass**

Run: `cd backend && npm run test:e2e`
Expected: PASS — `auth.e2e-spec.ts` (18 tests) and the earlier suites. `app.e2e-spec.ts` still passes: `/health` is `@Public()`, and `/api/docs` is served outside the Nest router, so the global guard does not apply to it.

- [ ] **Step 11: Run the unit suite, lint, type-check and build**

Run: `cd backend && npm run format && npm test && npm run lint && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add backend
git commit -m "feat(backend): add login, the session endpoints and the global JWT guard

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 7: Invoice list and detail (`GET /invoices`, `GET /invoices/:id`)

Spec §5.3 (`InvoiceDto`, the list query and its behaviour), §5.5 (bad id) and Appendix A: search, the Status filter (Overdue derived through `STATUS_CRITERIA`), the Invoice Date range, whitelisted sorting with a tie-breaker, server pagination with the true total, items loaded in one extra query, and one `today` per request.

**Files:**
- Create: `backend/src/common/validators.ts`
- Create: `backend/src/invoices/dto/list-invoices-query.dto.ts`
- Create: `backend/src/invoices/dto/invoice.dto.ts`
- Create: `backend/src/invoices/dto/invoice-list-response.dto.ts`
- Create: `backend/src/invoices/invoice.mapper.ts`
- Create: `backend/src/invoices/invoices.service.ts`
- Create: `backend/src/invoices/invoices.controller.ts`
- Create: `backend/src/invoices/invoices.module.ts`
- Modify: `backend/src/app.module.ts` (import `InvoicesModule`)
- Test: `backend/src/common/validators.spec.ts`
- Test: `backend/src/invoices/dto/list-invoices-query.dto.spec.ts`
- Test: `backend/src/invoices/invoice.mapper.spec.ts`
- Test: `backend/src/invoices/invoices.service.spec.ts`
- Test: `backend/test/invoices-list.e2e-spec.ts`

**Interfaces:**
- Consumes: `isIsoDate` (Task 1); `INVOICE_STATUSES`, `InvoiceStatus`, `STATUS_CRITERIA`, `deriveInvoiceStatus` (Task 1); `CURRENCY_CODES` (Task 1); `Invoice`, `InvoiceItem` entities (Task 3); `ClockService`, `ErrorResponseDto` (Task 5); `trimToUndefined`, `trimToUpperCase` (Task 6); `startTestApp`, `stopTestApp`, `loginAs`, `TestContext` (Tasks 5–6). The seeded data (Task 4): 41 Invoices, including Appendix A (`099ca7da-a290-40fa-93b9-1c43ae7bb887`, Stored Status Pending, due 2026-07-03, so Overdue on `TEST_TODAY` 2026-09-15) and `INV-0001`…`INV-0040`.
- Produces:
  - `common/validators.ts`: `IsDateOnly(options?: ValidationOptions): PropertyDecorator` (message `$property must be a valid date in YYYY-MM-DD format`); `IsOnOrAfter(property: string, options?: ValidationOptions): PropertyDecorator` (message `$property must be on or after <property>`; passes when either value is not a valid date). Task 8 adds `MaxDecimalPlaces` to this file.
  - `ListInvoicesQueryDto`, `SORT_FIELDS`, `type SortField`, `SORT_ORDERS`, `type SortOrder`.
  - `CustomerDto`, `InvoiceItemDto`, `InvoiceDto` (Appendix A field names plus `taxRate`, item `amount`, and `status` = the Status), `PagingDto`, `InvoiceListResponseDto`.
  - `toInvoiceDto(invoice: Invoice, today: string): InvoiceDto` (reads `invoice.items`).
  - `escapeLike(keyword: string): string`.
  - `InvoicesService { list(query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto>; findOne(invoiceId: string): Promise<InvoiceDto> }` — constructor `(invoices: Repository<Invoice>, items: Repository<InvoiceItem>, clock: ClockService)`. Task 8 adds `create`.
  - `InvoicesController` (`@Controller('invoices')`) and `InvoicesModule` (provides `InvoicesService` and `ClockService`). Task 8 adds the POST route.

- [ ] **Step 1: Write the failing validator and query tests**

`backend/src/common/validators.spec.ts`:

```ts
import { validateSync } from 'class-validator';
import { IsDateOnly, IsOnOrAfter } from './validators.js';

class DateRange {
  @IsDateOnly()
  start: unknown;

  @IsDateOnly()
  @IsOnOrAfter('start')
  end: unknown;
}

function messagesFor(start: unknown, end: unknown): string[] {
  const range = Object.assign(new DateRange(), { start, end });
  return validateSync(range).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
}

describe('IsDateOnly', () => {
  it('accepts real YYYY-MM-DD dates', () => {
    expect(messagesFor('2026-02-28', '2028-02-29')).toEqual([]);
  });

  it.each(['2026-02-30', '2026-6-3', '03/06/2026', 20260603, null])(
    'rejects %s',
    (value) => {
      expect(messagesFor(value, '2026-12-31')).toEqual([
        'start must be a valid date in YYYY-MM-DD format',
      ]);
    },
  );
});

describe('IsOnOrAfter', () => {
  it('accepts the same day and later days', () => {
    expect(messagesFor('2026-06-03', '2026-06-03')).toEqual([]);
    expect(messagesFor('2026-06-03', '2026-07-03')).toEqual([]);
  });

  it('rejects an earlier day with a message that names both properties', () => {
    expect(messagesFor('2026-06-03', '2026-06-02')).toEqual([
      'end must be on or after start',
    ]);
  });

  it('leaves an invalid date to IsDateOnly', () => {
    expect(messagesFor('not-a-date', '2026-06-02')).toEqual([
      'start must be a valid date in YYYY-MM-DD format',
    ]);
  });
});
```

`backend/src/invoices/dto/list-invoices-query.dto.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListInvoicesQueryDto } from './list-invoices-query.dto.js';

/** Transforms and validates like the global ValidationPipe does. */
function parse(query: Record<string, string>) {
  const dto = plainToInstance(ListInvoicesQueryDto, query);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return {
    dto,
    messages: errors.flatMap((error) => Object.values(error.constraints ?? {})),
  };
}

describe('ListInvoicesQueryDto', () => {
  it('applies the defaults', () => {
    const { dto, messages } = parse({});
    expect(messages).toEqual([]);
    expect(dto).toMatchObject({ page: 1, pageSize: 10, ordering: 'DESC' });
    expect(dto.sortBy).toBeUndefined();
    expect(dto.status).toBeUndefined();
    expect(dto.keyword).toBeUndefined();
  });

  it('converts numbers and accepts any case for the ordering and the Status', () => {
    const { dto, messages } = parse({
      page: '3',
      pageSize: '25',
      sortBy: 'totalAmount',
      ordering: 'asc',
      status: 'overdue',
    });
    expect(messages).toEqual([]);
    expect(dto).toMatchObject({
      page: 3,
      pageSize: 25,
      sortBy: 'totalAmount',
      ordering: 'ASC',
      status: 'Overdue',
    });
  });

  it('trims the keyword and ignores blank optional filters', () => {
    const { dto, messages } = parse({
      keyword: '  acme ',
      status: ' ',
      sortBy: '',
      fromDate: '',
      toDate: '',
    });
    expect(messages).toEqual([]);
    expect(dto.keyword).toBe('acme');
    expect(dto.status).toBeUndefined();
    expect(dto.sortBy).toBeUndefined();
    expect(dto.fromDate).toBeUndefined();
    expect(dto.toDate).toBeUndefined();
  });

  const invalidQueries: Array<[Record<string, string>, string]> = [
    [{ page: '0' }, 'page must not be less than 1'],
    [{ page: 'two' }, 'page must be an integer number'],
    [{ pageSize: '101' }, 'pageSize must not be greater than 100'],
    [
      { sortBy: 'customer' },
      'sortBy must be one of the following values: invoiceDate, dueDate, totalAmount',
    ],
    [{ ordering: 'up' }, 'ordering must be one of the following values: ASC, DESC'],
    [
      { status: 'Late' },
      'status must be one of the following values: Draft, Pending, Paid, Overdue',
    ],
    [
      { keyword: 'x'.repeat(101) },
      'keyword must be shorter than or equal to 100 characters',
    ],
    [
      { fromDate: '2026-02-30' },
      'fromDate must be a valid date in YYYY-MM-DD format',
    ],
    [
      { fromDate: '2026-07-01', toDate: '2026-06-30' },
      'toDate must be on or after fromDate',
    ],
    [{ foo: 'bar' }, 'property foo should not exist'],
  ];

  it.each(invalidQueries)('rejects %o', (query, message) => {
    expect(parse(query).messages).toContain(message);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && npx vitest run src/common/validators.spec.ts src/invoices/dto`
Expected: FAIL — cannot resolve `./validators.js` and `./list-invoices-query.dto.js`.

- [ ] **Step 3: Implement the validators and the query DTO**

`backend/src/common/validators.ts`:

```ts
import {
  buildMessage,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';
import { isIsoDate } from './iso-date.js';

/** A real calendar date in YYYY-MM-DD format: 2026-02-30 is rejected. */
export function IsDateOnly(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDateOnly',
      validator: {
        validate: (value: unknown) => isIsoDate(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a valid date in YYYY-MM-DD format`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/**
 * The date is on or after the date in another property of the same object,
 * e.g. dueDate on or after invoiceDate. It passes when either value is not a
 * valid date, because @IsDateOnly reports those.
 */
export function IsOnOrAfter(
  property: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isOnOrAfter',
      constraints: [property],
      validator: {
        validate: (value: unknown, args) => {
          const other = (args?.object as Record<string, unknown> | undefined)?.[
            property
          ];
          if (!isIsoDate(value) || !isIsoDate(other)) return true;
          return value >= other;
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be on or after $constraint1`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
```

`backend/src/invoices/dto/list-invoices-query.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimToUndefined, trimToUpperCase } from '../../common/transforms.js';
import { IsDateOnly, IsOnOrAfter } from '../../common/validators.js';
import {
  INVOICE_STATUSES,
  type InvoiceStatus,
} from '../domain/invoice-status.js';

export const SORT_FIELDS = ['invoiceDate', 'dueDate', 'totalAmount'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_ORDERS = ['ASC', 'DESC'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/** Maps a Status in any case to its canonical spelling; a blank value counts as absent. */
function toInvoiceStatus({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  const wanted = value.trim().toLowerCase();
  if (wanted === '') return undefined;
  return INVOICE_STATUSES.find((s) => s.toLowerCase() === wanted) ?? value;
}

/** Query of GET /invoices (spec §5.3). Blank optional filters are ignored. */
export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;

  @ApiPropertyOptional({
    enum: [...SORT_FIELDS],
    description: 'Sort key. Without it, Invoices are sorted by creation time.',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sortBy?: SortField;

  @ApiPropertyOptional({
    enum: [...SORT_ORDERS],
    default: 'DESC',
    description:
      'Direction of the sort key in effect (case-insensitive). The default with no sortBy is newest first.',
  })
  @Transform(trimToUpperCase)
  @IsIn(SORT_ORDERS)
  ordering: SortOrder = 'DESC';

  @ApiPropertyOptional({
    enum: [...INVOICE_STATUSES],
    description:
      'Status filter (case-insensitive). Overdue means: not Paid, and the Due Date is before today.',
  })
  @Transform(toInvoiceStatus)
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    maxLength: 100,
    description:
      'Matches part of the Invoice Number or of the Customer name, ignoring case.',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-06-01',
    description: 'Earliest Invoice Date (inclusive).',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsDateOnly()
  fromDate?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-06-30',
    description: 'Latest Invoice Date (inclusive); must not be before fromDate.',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsDateOnly()
  @IsOnOrAfter('fromDate')
  toDate?: string;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd backend && npx vitest run src/common/validators.spec.ts src/invoices/dto`
Expected: PASS (`validators.spec.ts` 9 tests, `list-invoices-query.dto.spec.ts` 13 tests).

- [ ] **Step 5: Write the failing mapper and service tests**

`backend/src/invoices/invoice.mapper.spec.ts`:

```ts
import { Decimal } from 'decimal.js';
import { InvoiceItem } from './entities/invoice-item.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { toInvoiceDto } from './invoice.mapper.js';

/** Appendix A of the assessment, as the API must return it on 2026-09-15. */
const APPENDIX_A_JSON = {
  invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  currencySymbol: 'AU$',
  description: 'Invoice is issued to Kanglee',
  status: 'Overdue',
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  items: [
    {
      id: 'b1c2d3e4-0000-0000-0000-000000000001',
      name: 'Honda RC150',
      quantity: 2,
      rate: 1000,
      amount: 2000,
    },
  ],
  taxRate: 10,
  invoiceSubTotal: 2000,
  totalTax: 200,
  totalDiscount: 20,
  totalAmount: 2180,
  totalPaid: 1451.34,
  balanceAmount: 728.66,
  createdAt: '2026-06-03T12:03:26.995Z',
  createdBy: 'ad1e0902-1928-4345-b513-60c86c94fc91',
};

/** The Appendix A Invoice as TypeORM loads it: NUMERIC columns are Decimals. */
function appendixAInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const item = Object.assign(new InvoiceItem(), {
    id: 'b1c2d3e4-0000-0000-0000-000000000001',
    invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
    name: 'Honda RC150',
    quantity: 2,
    rate: new Decimal('1000.00'),
  } satisfies Partial<InvoiceItem>);
  return Object.assign(new Invoice(), {
    invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
    invoiceNumber: 'IV1780488206995',
    invoiceReference: '#5721662',
    invoiceDate: '2026-06-03',
    dueDate: '2026-07-03',
    currency: 'AUD',
    currencySymbol: 'AU$',
    description: 'Invoice is issued to Kanglee',
    status: 'Pending',
    customerFullname: 'Paul',
    customerEmail: 'paul@101digital.io',
    customerMobileNumber: '947717364111',
    customerAddress: 'Singapore',
    taxRate: new Decimal('10.00'),
    invoiceSubTotal: new Decimal('2000.00'),
    totalTax: new Decimal('200.00'),
    totalDiscount: new Decimal('20.00'),
    totalAmount: new Decimal('2180.00'),
    totalPaid: new Decimal('1451.34'),
    balanceAmount: new Decimal('728.66'),
    createdAt: new Date('2026-06-03T12:03:26.995Z'),
    createdBy: 'ad1e0902-1928-4345-b513-60c86c94fc91',
    items: [item],
    ...overrides,
  } satisfies Partial<Invoice>);
}

describe('toInvoiceDto', () => {
  it('maps the Appendix A Invoice to exactly the documented JSON', () => {
    expect(toInvoiceDto(appendixAInvoice(), '2026-09-15')).toEqual(
      APPENDIX_A_JSON,
    );
  });

  it('shows the Stored Status until the Due Date has passed', () => {
    expect(toInvoiceDto(appendixAInvoice(), '2026-07-03').status).toBe(
      'Pending',
    );
  });

  it('returns null for empty optional fields', () => {
    const dto = toInvoiceDto(
      appendixAInvoice({
        invoiceReference: null,
        description: null,
        customerMobileNumber: null,
        customerAddress: null,
      }),
      '2026-06-03',
    );
    expect(dto.invoiceReference).toBeNull();
    expect(dto.description).toBeNull();
    expect(dto.customer).toEqual({
      fullname: 'Paul',
      email: 'paul@101digital.io',
      mobileNumber: null,
      address: null,
    });
  });

  it('computes the item amount as quantity × Rate, to 2 decimal places', () => {
    const item = Object.assign(new InvoiceItem(), {
      id: 'b1c2d3e4-0000-0000-0000-000000000002',
      name: 'Consulting',
      quantity: 3,
      rate: new Decimal('19.99'),
    } satisfies Partial<InvoiceItem>);
    const dto = toInvoiceDto(appendixAInvoice({ items: [item] }), '2026-06-03');
    expect(dto.items).toEqual([
      {
        id: 'b1c2d3e4-0000-0000-0000-000000000002',
        name: 'Consulting',
        quantity: 3,
        rate: 19.99,
        amount: 59.97,
      },
    ]);
  });
});
```

`backend/src/invoices/invoices.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { escapeLike, InvoicesService } from './invoices.service.js';

type Dependencies = ConstructorParameters<typeof InvoicesService>;

describe('escapeLike', () => {
  it('escapes the LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('leaves other characters alone', () => {
    expect(escapeLike('IV-178/2026#1')).toBe('IV-178/2026#1');
  });
});

describe('InvoicesService.findOne', () => {
  it('throws NotFoundException("Invoice not found") for an unknown id', async () => {
    const invoices = { findOne: vi.fn().mockResolvedValue(null) };
    const service = new InvoicesService(
      invoices as unknown as Dependencies[0],
      {} as Dependencies[1],
      { today: () => '2026-09-15' } as Dependencies[2],
    );
    const attempt = service.findOne('5eed0000-0000-4000-8000-000000000999');
    await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
    await expect(attempt).rejects.toThrow('Invoice not found');
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `cd backend && npx vitest run src/invoices/invoice.mapper.spec.ts src/invoices/invoices.service.spec.ts`
Expected: FAIL — cannot resolve `./invoice.mapper.js` and `./invoices.service.js`.

- [ ] **Step 7: Implement the response DTOs, the mapper and the service**

`backend/src/invoices/dto/invoice.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { CURRENCY_CODES } from '../domain/currencies.js';
import {
  INVOICE_STATUSES,
  type InvoiceStatus,
} from '../domain/invoice-status.js';

/** The Customer an Invoice is issued to, as recorded on the Invoice (ADR-0001). */
export class CustomerDto {
  @ApiProperty({ example: 'Paul' })
  fullname: string;

  @ApiProperty({ example: 'paul@101digital.io' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: '947717364111' })
  mobileNumber: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Singapore' })
  address: string | null;
}

/** The one Invoice Item of an Invoice. */
export class InvoiceItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Honda RC150' })
  name: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 1000, description: 'Rate: the price of one unit.' })
  rate: number;

  @ApiProperty({ example: 2000, description: 'quantity × rate' })
  amount: number;
}

/**
 * The single Invoice representation of the list, the detail view and create
 * (spec §5.3). Money fields are numbers with at most 2 decimal places; empty
 * optional fields are null.
 */
export class InvoiceDto {
  @ApiProperty({
    format: 'uuid',
    example: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  })
  invoiceId: string;

  @ApiProperty({ example: 'IV1780488206995' })
  invoiceNumber: string;

  @ApiProperty({ type: String, nullable: true, example: '#5721662' })
  invoiceReference: string | null;

  @ApiProperty({ format: 'date', example: '2026-06-03' })
  invoiceDate: string;

  @ApiProperty({ format: 'date', example: '2026-07-03' })
  dueDate: string;

  @ApiProperty({ enum: CURRENCY_CODES, example: 'AUD' })
  currency: string;

  @ApiProperty({ example: 'AU$' })
  currencySymbol: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Invoice is issued to Kanglee',
  })
  description: string | null;

  @ApiProperty({
    enum: [...INVOICE_STATUSES],
    example: 'Overdue',
    description:
      'The Status. Overdue is computed: not Paid, and the Due Date is before today.',
  })
  status: InvoiceStatus;

  @ApiProperty({ type: CustomerDto })
  customer: CustomerDto;

  @ApiProperty({ type: [InvoiceItemDto] })
  items: InvoiceItemDto[];

  @ApiProperty({ example: 10, description: 'Tax Rate in percent.' })
  taxRate: number;

  @ApiProperty({ example: 2000, description: 'Sub-total: the sum of the item amounts.' })
  invoiceSubTotal: number;

  @ApiProperty({ example: 200, description: 'Tax Amount, rounded half-up.' })
  totalTax: number;

  @ApiProperty({ example: 20 })
  totalDiscount: number;

  @ApiProperty({ example: 2180, description: 'Sub-total + tax − discount.' })
  totalAmount: number;

  @ApiProperty({ example: 1451.34 })
  totalPaid: number;

  @ApiProperty({ example: 728.66, description: 'Total Amount − Total Paid.' })
  balanceAmount: number;

  @ApiProperty({ format: 'date-time', example: '2026-06-03T12:03:26.995Z' })
  createdAt: string;

  @ApiProperty({
    format: 'uuid',
    example: 'ad1e0902-1928-4345-b513-60c86c94fc91',
    description: 'Id of the User who created the Invoice.',
  })
  createdBy: string;
}
```

`backend/src/invoices/dto/invoice-list-response.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { InvoiceDto } from './invoice.dto.js';

export class PagingDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({
    example: 41,
    description: 'Number of Invoices that match the filters, on all pages.',
  })
  total: number;
}

/** Response of GET /invoices: one page of Invoices and the paging facts. */
export class InvoiceListResponseDto {
  @ApiProperty({ type: [InvoiceDto] })
  data: InvoiceDto[];

  @ApiProperty({ type: PagingDto })
  paging: PagingDto;
}
```

`backend/src/invoices/invoice.mapper.ts`:

```ts
import { Decimal } from 'decimal.js';
import { deriveInvoiceStatus } from './domain/invoice-status.js';
import type { InvoiceDto, InvoiceItemDto } from './dto/invoice.dto.js';
import type { InvoiceItem } from './entities/invoice-item.entity.js';
import type { Invoice } from './entities/invoice.entity.js';

/** Money as a JSON number with at most 2 decimal places. */
function toMoney(value: Decimal): number {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

function toInvoiceItemDto(item: InvoiceItem): InvoiceItemDto {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    rate: toMoney(item.rate),
    amount: toMoney(item.rate.times(item.quantity)),
  };
}

/**
 * Maps an Invoice row and its loaded items to the API representation.
 * `today` (in APP_TIMEZONE) decides whether the Status is Overdue.
 */
export function toInvoiceDto(invoice: Invoice, today: string): InvoiceDto {
  return {
    invoiceId: invoice.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceReference: invoice.invoiceReference,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    currencySymbol: invoice.currencySymbol,
    description: invoice.description,
    status: deriveInvoiceStatus(invoice.status, invoice.dueDate, today),
    customer: {
      fullname: invoice.customerFullname,
      email: invoice.customerEmail,
      mobileNumber: invoice.customerMobileNumber,
      address: invoice.customerAddress,
    },
    items: invoice.items.map(toInvoiceItemDto),
    taxRate: invoice.taxRate.toNumber(),
    invoiceSubTotal: toMoney(invoice.invoiceSubTotal),
    totalTax: toMoney(invoice.totalTax),
    totalDiscount: toMoney(invoice.totalDiscount),
    totalAmount: toMoney(invoice.totalAmount),
    totalPaid: toMoney(invoice.totalPaid),
    balanceAmount: toMoney(invoice.balanceAmount),
    createdAt: invoice.createdAt.toISOString(),
    createdBy: invoice.createdBy,
  };
}
```

`backend/src/invoices/invoices.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service.js';
import { STATUS_CRITERIA } from './domain/invoice-status.js';
import { InvoiceListResponseDto } from './dto/invoice-list-response.dto.js';
import { InvoiceDto } from './dto/invoice.dto.js';
import {
  ListInvoicesQueryDto,
  type SortField,
} from './dto/list-invoices-query.dto.js';
import { InvoiceItem } from './entities/invoice-item.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { toInvoiceDto } from './invoice.mapper.js';

/** The whitelist of sort keys. Without sortBy, the list is sorted by creation time. */
const SORT_PROPERTIES: Record<SortField | 'createdAt', keyof Invoice> = {
  createdAt: 'createdAt',
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  totalAmount: 'totalAmount',
};

/** Escapes the LIKE wildcards (and the escape character), so a keyword matches literally. */
export function escapeLike(keyword: string): string {
  return keyword.replace(/[\\%_]/g, '\\$&');
}

/** Reads Invoices. Each request reads "today" once, so every row agrees on Overdue. */
@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoices: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly items: Repository<InvoiceItem>,
    private readonly clock: ClockService,
  ) {}

  /** One page of Invoices plus the total that match the filters (spec §5.3). */
  async list(query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    const today = this.clock.today();
    const qb = this.invoices.createQueryBuilder('invoice');

    if (query.keyword) {
      const pattern = `%${escapeLike(query.keyword)}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('invoice.invoiceNumber ILIKE :pattern', { pattern })
            .orWhere('invoice.customerFullname ILIKE :pattern', { pattern });
        }),
      );
    }

    if (query.status) {
      // The same criteria that derive the displayed Status (invoice-status.ts).
      const criteria = STATUS_CRITERIA[query.status];
      qb.andWhere('invoice.status IN (:...storedIn)', {
        storedIn: criteria.storedIn,
      });
      if (criteria.due === 'beforeToday') {
        qb.andWhere('invoice.dueDate < :today', { today });
      } else if (criteria.due === 'todayOrLater') {
        qb.andWhere('invoice.dueDate >= :today', { today });
      }
    }

    if (query.fromDate) {
      qb.andWhere('invoice.invoiceDate >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('invoice.invoiceDate <= :toDate', { toDate: query.toDate });
    }

    const sortProperty = SORT_PROPERTIES[query.sortBy ?? 'createdAt'];
    const [rows, total] = await qb
      .orderBy(`invoice.${sortProperty}`, query.ordering)
      .addOrderBy('invoice.invoiceId', query.ordering)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();

    await this.attachItems(rows);
    return {
      data: rows.map((invoice) => toInvoiceDto(invoice, today)),
      paging: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async findOne(invoiceId: string): Promise<InvoiceDto> {
    const invoice = await this.invoices.findOne({
      where: { invoiceId },
      relations: { items: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return toInvoiceDto(invoice, this.clock.today());
  }

  /** Loads the items of a whole page in one query (no N+1). */
  private async attachItems(invoices: Invoice[]): Promise<void> {
    if (invoices.length === 0) return;
    const items = await this.items.find({
      where: { invoiceId: In(invoices.map((invoice) => invoice.invoiceId)) },
      order: { id: 'ASC' },
    });
    const byInvoice = new Map<string, InvoiceItem[]>();
    for (const item of items) {
      const list = byInvoice.get(item.invoiceId) ?? [];
      list.push(item);
      byInvoice.set(item.invoiceId, list);
    }
    for (const invoice of invoices) {
      invoice.items = byInvoice.get(invoice.invoiceId) ?? [];
    }
  }
}
```

- [ ] **Step 8: Run the unit tests to verify they pass**

Run: `cd backend && npx vitest run src/invoices`
Expected: PASS (mapper 4 tests, service 3 tests, query DTO 13 tests, and the Task 1 domain tests).

- [ ] **Step 9: Write the failing e2e test**

`backend/test/invoices-list.e2e-spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  loginAs,
  startTestApp,
  stopTestApp,
  type TestContext,
} from './utils/test-app.js';

const APPENDIX_A_ID = '099ca7da-a290-40fa-93b9-1c43ae7bb887';

/** Appendix A of the assessment, as the API returns it on TEST_TODAY (2026-09-15). */
const APPENDIX_A_JSON = {
  invoiceId: APPENDIX_A_ID,
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  currencySymbol: 'AU$',
  description: 'Invoice is issued to Kanglee',
  status: 'Overdue',
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  items: [
    {
      id: 'b1c2d3e4-0000-0000-0000-000000000001',
      name: 'Honda RC150',
      quantity: 2,
      rate: 1000,
      amount: 2000,
    },
  ],
  taxRate: 10,
  invoiceSubTotal: 2000,
  totalTax: 200,
  totalDiscount: 20,
  totalAmount: 2180,
  totalPaid: 1451.34,
  balanceAmount: 728.66,
  createdAt: '2026-06-03T12:03:26.995Z',
  createdBy: 'ad1e0902-1928-4345-b513-60c86c94fc91',
};

interface InvoiceBody {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  customer: { fullname: string };
  items: unknown[];
}

interface ListBody {
  data: InvoiceBody[];
  paging: { page: number; pageSize: number; total: number };
}

type Query = Record<string, string | number>;

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const [x, y] = [String(a), String(b)];
  return x < y ? -1 : x > y ? 1 : 0;
}

describe('Invoices: list and detail (e2e)', () => {
  let context: TestContext;
  let server: App;
  let token: string;

  beforeAll(async () => {
    context = await startTestApp();
    server = context.app.getHttpServer();
    token = await loginAs(server);
  });

  afterAll(async () => {
    await stopTestApp(context);
  });

  async function list(query: Query = {}): Promise<ListBody> {
    const res = await request(server)
      .get('/invoices')
      .query(query)
      .auth(token, { type: 'bearer' })
      .expect(200);
    return res.body as ListBody;
  }

  function listRejected(query: Query) {
    return request(server)
      .get('/invoices')
      .query(query)
      .auth(token, { type: 'bearer' })
      .expect(400);
  }

  describe('GET /invoices', () => {
    it('returns the first page, newest first, by default', async () => {
      const body = await list();
      expect(body.paging).toEqual({ page: 1, pageSize: 10, total: 41 });
      expect(body.data).toHaveLength(10);
      const createdAt = body.data.map((invoice) => invoice.createdAt);
      expect(createdAt).toEqual([...createdAt].sort().reverse());
      for (const invoice of body.data) expect(invoice.items).toHaveLength(1);
    });

    it('filters by each Status, and the four Statuses cover every Invoice once', async () => {
      let sum = 0;
      for (const status of ['Draft', 'Pending', 'Paid', 'Overdue']) {
        const body = await list({ status, pageSize: 100 });
        expect(body.data.every((invoice) => invoice.status === status)).toBe(
          true,
        );
        expect(body.data).toHaveLength(body.paging.total);
        sum += body.paging.total;
      }
      expect(sum).toBe(41);
    });

    it('matches the Status in any case', async () => {
      const lower = await list({ status: 'overdue', pageSize: 100 });
      const canonical = await list({ status: 'Overdue', pageSize: 100 });
      expect(lower.paging.total).toBe(canonical.paging.total);
      expect(lower.data.map((invoice) => invoice.invoiceId)).toContain(
        APPENDIX_A_ID,
      );
    });

    it('finds an Invoice by part of its number, ignoring case', async () => {
      const body = await list({ keyword: 'iv178' });
      expect(body.paging.total).toBe(1);
      expect(body.data[0]).toEqual(APPENDIX_A_JSON);
    });

    it('finds Invoices by part of the Customer name, ignoring case', async () => {
      const body = await list({ keyword: 'PAUL', pageSize: 100 });
      expect(body.data.map((invoice) => invoice.invoiceId)).toContain(
        APPENDIX_A_ID,
      );
      for (const invoice of body.data) {
        expect(
          `${invoice.invoiceNumber} ${invoice.customer.fullname}`.toLowerCase(),
        ).toContain('paul');
      }
    });

    it('matches the keyword against every Invoice Number', async () => {
      expect((await list({ keyword: 'inv-00' })).paging.total).toBe(40);
    });

    it('treats LIKE wildcards in the keyword as plain characters', async () => {
      expect((await list({ keyword: '%' })).paging.total).toBe(0);
      expect((await list({ keyword: '_' })).paging.total).toBe(0);
    });

    it('ignores a blank keyword and other blank filters', async () => {
      const body = await list({
        keyword: '   ',
        status: '',
        sortBy: '',
        fromDate: '',
        toDate: '',
      });
      expect(body.paging.total).toBe(41);
    });

    it.each([
      ['invoiceDate', 'asc'],
      ['invoiceDate', 'desc'],
      ['dueDate', 'asc'],
      ['dueDate', 'desc'],
      ['totalAmount', 'asc'],
      ['totalAmount', 'desc'],
    ] as const)('sorts by %s %s', async (sortBy, ordering) => {
      const body = await list({ sortBy, ordering, pageSize: 100 });
      const values = body.data.map((invoice) => invoice[sortBy]);
      const ascending = [...values].sort(compareValues);
      expect(values).toEqual(
        ordering === 'asc' ? ascending : ascending.reverse(),
      );
    });

    it('filters by Invoice Date, including both ends of the range', async () => {
      const day = await list({
        fromDate: '2026-06-03',
        toDate: '2026-06-03',
        pageSize: 100,
      });
      expect(day.data.map((invoice) => invoice.invoiceId)).toContain(
        APPENDIX_A_ID,
      );
      expect(day.data.every((invoice) => invoice.invoiceDate === '2026-06-03')).toBe(
        true,
      );

      const june = await list({
        fromDate: '2026-06-01',
        toDate: '2026-06-30',
        pageSize: 100,
      });
      expect(
        june.data.every(
          (invoice) =>
            invoice.invoiceDate >= '2026-06-01' &&
            invoice.invoiceDate <= '2026-06-30',
        ),
      ).toBe(true);
    });

    it('rejects a date range that ends before it starts', async () => {
      const res = await listRejected({
        fromDate: '2026-07-01',
        toDate: '2026-06-01',
      });
      expect(res.body).toEqual({
        statusCode: 400,
        message: ['toDate must be on or after fromDate'],
        error: 'Bad Request',
      });
    });

    it('rejects a date that does not exist', async () => {
      const res = await listRejected({ fromDate: '2026-02-30' });
      expect(res.body.message).toEqual([
        'fromDate must be a valid date in YYYY-MM-DD format',
      ]);
    });

    it('paginates and always reports the true total', async () => {
      const first = await list({ page: 1, pageSize: 10 });
      const second = await list({ page: 2, pageSize: 10 });
      expect(second.paging).toEqual({ page: 2, pageSize: 10, total: 41 });
      const firstIds = new Set(first.data.map((invoice) => invoice.invoiceId));
      expect(second.data.some((invoice) => firstIds.has(invoice.invoiceId))).toBe(
        false,
      );

      expect((await list({ page: 5, pageSize: 10 })).data).toHaveLength(1);
      const pastTheEnd = await list({ page: 6, pageSize: 10 });
      expect(pastTheEnd.data).toEqual([]);
      expect(pastTheEnd.paging).toEqual({ page: 6, pageSize: 10, total: 41 });
    });

    const invalidQueries: Array<[Query, string]> = [
      [{ pageSize: 101 }, 'pageSize must not be greater than 100'],
      [{ page: 0 }, 'page must not be less than 1'],
      [{ foo: 'bar' }, 'property foo should not exist'],
    ];

    it.each(invalidQueries)('rejects the query %o', async (query, message) => {
      const res = await listRejected(query);
      expect(res.body.message).toContain(message);
    });

    it('requires authentication', async () => {
      await request(server).get('/invoices').expect(401);
    });
  });

  describe('GET /invoices/:id', () => {
    it('returns the Appendix A Invoice exactly as documented', async () => {
      const res = await request(server)
        .get(`/invoices/${APPENDIX_A_ID}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(res.body).toEqual(APPENDIX_A_JSON);
    });

    it('rejects an id that is not a UUID', async () => {
      const res = await request(server)
        .get('/invoices/not-a-uuid')
        .auth(token, { type: 'bearer' })
        .expect(400);
      expect(res.body).toEqual({
        statusCode: 400,
        message: 'id must be a valid UUID',
        error: 'Bad Request',
      });
    });

    it('answers 404 for an unknown id', async () => {
      const res = await request(server)
        .get(`/invoices/${randomUUID()}`)
        .auth(token, { type: 'bearer' })
        .expect(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: 'Invoice not found',
        error: 'Not Found',
      });
    });

    it('requires authentication', async () => {
      await request(server).get(`/invoices/${APPENDIX_A_ID}`).expect(401);
    });
  });
});
```

- [ ] **Step 10: Run it to verify it fails**

Run: `cd backend && npx vitest run --config ./vitest.config.e2e.ts test/invoices-list.e2e-spec.ts`
Expected: FAIL — the authenticated `GET /invoices` calls answer 404 (no invoices routes yet).

- [ ] **Step 11: Implement the controller and the module, and register the module**

`backend/src/invoices/invoices.controller.ts`:

```ts
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/error-response.dto.js';
import { InvoiceListResponseDto } from './dto/invoice-list-response.dto.js';
import { InvoiceDto } from './dto/invoice.dto.js';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto.js';
import { InvoicesService } from './invoices.service.js';

/** A malformed id is a client error with a clear message, not a database error. */
const invoiceIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('id must be a valid UUID'),
});

/** List, view and create Invoices (spec §5.3). Every route needs a token. */
@ApiTags('invoices')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'The token is missing, invalid or expired',
})
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List Invoices',
    description:
      'Search by Invoice Number or Customer name, filter by Status and Invoice Date range, sort, and paginate on the server.',
  })
  @ApiOkResponse({ type: InvoiceListResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'A query parameter is not valid',
  })
  list(@Query() query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    return this.invoices.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one Invoice with its item and totals' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The invoiceId' })
  @ApiOkResponse({ type: InvoiceDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'id is not a valid UUID',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Invoice not found',
  })
  findOne(@Param('id', invoiceIdPipe) id: string): Promise<InvoiceDto> {
    return this.invoices.findOne(id);
  }
}
```

`backend/src/invoices/invoices.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClockService } from '../common/clock.service.js';
import { InvoiceItem } from './entities/invoice-item.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';

/** Invoices: the list, the detail view and create. */
@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem])],
  controllers: [InvoicesController],
  providers: [InvoicesService, ClockService],
})
export class InvoicesModule {}
```

Replace `backend/src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import {
  type EnvironmentVariables,
  validateEnv,
} from './config/env.validation.js';
import { buildDataSourceOptions } from './database/data-source.js';
import { HealthModule } from './health/health.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';

/**
 * Root module: validated configuration, TypeORM (pending migrations run at
 * start-up; `synchronize` stays off) and the feature modules.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...buildDataSourceOptions(config.get('DATABASE_URL', { infer: true })),
        migrationsRun: true,
      }),
    }),
    HealthModule,
    AuthModule,
    InvoicesModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 12: Run all e2e suites to verify they pass**

Run: `cd backend && npm run test:e2e`
Expected: PASS — `invoices-list.e2e-spec.ts` (26 tests) and the earlier suites.

- [ ] **Step 13: Run the unit suite, lint, type-check and build**

Run: `cd backend && npm run format && npm test && npm run lint && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 14: Commit**

```bash
git add backend
git commit -m "feat(backend): list and view Invoices with search, Status filter, sort and paging

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 8: Create an Invoice (`POST /invoices`) and the complete Swagger document

Spec §5.3 (`CreateInvoiceDto` rules and the create flow) and §5.6: a validated body with exactly one item, totals computed on the server, Stored Status Draft, `created_by` = the signed-in User, 409 for a duplicate Invoice Number regardless of case (enforced only by the unique index), 201 with a `Location` header. The Swagger document is then complete, so this task also asserts its shape.

**Files:**
- Modify: `backend/src/common/validators.ts` (add `MaxDecimalPlaces`)
- Modify: `backend/src/common/validators.spec.ts` (add its tests)
- Create: `backend/src/invoices/dto/create-invoice.dto.ts`
- Modify: `backend/src/invoices/invoices.service.ts` (add `create`)
- Modify: `backend/src/invoices/invoices.service.spec.ts` (add `create` tests)
- Modify: `backend/src/invoices/invoices.controller.ts` (add the POST route)
- Modify: `backend/test/app.e2e-spec.ts` (assert the OpenAPI document)
- Test: `backend/src/invoices/dto/create-invoice.dto.spec.ts`
- Test: `backend/test/invoices-create.e2e-spec.ts`

**Interfaces:**
- Consumes: `CURRENCY_CODES`, `CURRENCY_SYMBOLS`, `CurrencyCode` (Task 1); `calculateInvoiceTotals`, `DEFAULT_TAX_RATE`, `DiscountExceedsTotalError` (Task 1); `IsDateOnly`, `IsOnOrAfter` (Task 7); `trim`, `trimToUndefined`, `trimToUpperCase` (Task 6); `CurrentUser`, `User` (Tasks 3 and 6); `InvoicesService`, `InvoiceDto`, `escapeLike` (Task 7); `DEFAULT_USER_ID` (Task 4); the e2e harness (Tasks 5–6).
- Produces:
  - `MaxDecimalPlaces(places: number, options?: ValidationOptions): PropertyDecorator` (message `$property must have at most <places> decimal places`; values that are not finite numbers are left to `@IsNumber`).
  - `CustomerInputDto`, `InvoiceItemInputDto`, `CreateInvoiceDto` (defaults `taxRate = 10`, `discount = 0`).
  - `INVOICE_NUMBER_UNIQUE_INDEX = 'invoices_invoice_number_lower_uq'`; `InvoicesService.create(dto: CreateInvoiceDto, createdBy: string): Promise<InvoiceDto>`.
  - `POST /invoices` → 201 `InvoiceDto` + `Location: /invoices/{invoiceId}`; 400; 401; 409 `Invoice number <invoiceNumber> already exists`.
  - Error messages the frontend maps to fields (Task 14): `customer.<field> …`, `<field> …`, `items.0.<field> …`, e.g. `dueDate must be on or after invoiceDate`, `discount must not exceed the sub-total plus tax`.

- [ ] **Step 1: Write the failing tests for `MaxDecimalPlaces` and the create DTO**

In `backend/src/common/validators.spec.ts`, change the import line to:

```ts
import { IsDateOnly, IsOnOrAfter, MaxDecimalPlaces } from './validators.js';
```

and append:

```ts
class Money {
  @MaxDecimalPlaces(2)
  amount: unknown;
}

function moneyMessages(amount: unknown): string[] {
  return validateSync(Object.assign(new Money(), { amount })).flatMap(
    (error) => Object.values(error.constraints ?? {}),
  );
}

describe('MaxDecimalPlaces', () => {
  it.each([0, 10, 19.99, 0.01, 1_000_000])('accepts %s', (amount) => {
    expect(moneyMessages(amount)).toEqual([]);
  });

  it.each([1.005, 0.001, 1e-7])('rejects %s', (amount) => {
    expect(moneyMessages(amount)).toEqual([
      'amount must have at most 2 decimal places',
    ]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, '1.005', null])(
    'leaves %s to @IsNumber',
    (amount) => {
      expect(moneyMessages(amount)).toEqual([]);
    },
  );
});
```

`backend/src/invoices/dto/create-invoice.dto.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { type ValidationError, validateSync } from 'class-validator';
import { CreateInvoiceDto } from './create-invoice.dto.js';

const VALID = {
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  invoiceNumber: 'IV-2026/10.001#A_1',
  invoiceReference: '#5721662',
  invoiceDate: '2026-10-02',
  dueDate: '2026-11-01',
  currency: 'AUD',
  description: 'Invoice is issued to Kanglee',
  items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
  taxRate: 10,
  discount: 20,
};

/** Flattens nested errors to messages such as "items.0.rate …", like the ValidationPipe. */
function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) =>
      parent ? `${parent}.${message}` : message,
    );
    return [...own, ...flatten(error.children ?? [], path)];
  });
}

function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateInvoiceDto, body);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, messages: flatten(errors) };
}

describe('CreateInvoiceDto', () => {
  it('accepts a valid Invoice', () => {
    expect(parse(VALID).messages).toEqual([]);
  });

  it('defaults the Tax Rate to 10 and the discount to 0', () => {
    const body: Record<string, unknown> = { ...VALID };
    delete body.taxRate;
    delete body.discount;
    const { dto, messages } = parse(body);
    expect(messages).toEqual([]);
    expect(dto.taxRate).toBe(10);
    expect(dto.discount).toBe(0);
  });

  it('trims strings, upper-cases the currency and drops blank optional fields', () => {
    const { dto, messages } = parse({
      ...VALID,
      customer: {
        fullname: '  Paul  ',
        email: ' paul@101digital.io ',
        mobileNumber: '  ',
        address: '',
      },
      invoiceNumber: ' INV-1 ',
      invoiceReference: '   ',
      description: '',
      invoiceDate: ' 2026-10-02 ',
      currency: ' usd ',
    });
    expect(messages).toEqual([]);
    expect(dto.customer.fullname).toBe('Paul');
    expect(dto.customer.email).toBe('paul@101digital.io');
    expect(dto.customer.mobileNumber).toBeUndefined();
    expect(dto.customer.address).toBeUndefined();
    expect(dto.invoiceNumber).toBe('INV-1');
    expect(dto.invoiceReference).toBeUndefined();
    expect(dto.description).toBeUndefined();
    expect(dto.invoiceDate).toBe('2026-10-02');
    expect(dto.currency).toBe('USD');
  });

  const item = VALID.items[0];
  const invalidBodies: Array<[string, Record<string, unknown>, string]> = [
    [
      'a Due Date before the Invoice Date',
      { dueDate: '2026-10-01' },
      'dueDate must be on or after invoiceDate',
    ],
    [
      'a date that does not exist',
      { invoiceDate: '2026-02-30' },
      'invoiceDate must be a valid date in YYYY-MM-DD format',
    ],
    ['no item', { items: [] }, 'items must contain exactly 1 item'],
    ['two items', { items: [item, item] }, 'items must contain exactly 1 item'],
    [
      'a quantity of 0',
      { items: [{ ...item, quantity: 0 }] },
      'items.0.quantity must not be less than 1',
    ],
    [
      'a fractional quantity',
      { items: [{ ...item, quantity: 1.5 }] },
      'items.0.quantity must be an integer number',
    ],
    [
      'a Rate of 0',
      { items: [{ ...item, rate: 0 }] },
      'items.0.rate must be a positive number',
    ],
    [
      'a Rate with 3 decimal places',
      { items: [{ ...item, rate: 1.005 }] },
      'items.0.rate must have at most 2 decimal places',
    ],
    [
      'a tiny Rate in exponent notation',
      { items: [{ ...item, rate: 1e-7 }] },
      'items.0.rate must have at most 2 decimal places',
    ],
    [
      'a Rate above 1,000,000',
      { items: [{ ...item, rate: 1_000_000.01 }] },
      'items.0.rate must not be greater than 1000000',
    ],
    [
      'a blank item name',
      { items: [{ ...item, name: '   ' }] },
      'items.0.name should not be empty',
    ],
    ['a negative Tax Rate', { taxRate: -1 }, 'taxRate must not be less than 0'],
    [
      'a Tax Rate above 100',
      { taxRate: 100.5 },
      'taxRate must not be greater than 100',
    ],
    [
      'a null Tax Rate',
      { taxRate: null },
      'taxRate must be a number conforming to the specified constraints',
    ],
    [
      'a discount above the sub-total plus tax',
      { discount: 2200.01 },
      'discount must not exceed the sub-total plus tax',
    ],
    ['a negative discount', { discount: -1 }, 'discount must not be less than 0'],
    [
      'an invalid Customer email',
      { customer: { ...VALID.customer, email: 'paul' } },
      'customer.email must be an email',
    ],
    [
      'a blank Customer name',
      { customer: { ...VALID.customer, fullname: '  ' } },
      'customer.fullname should not be empty',
    ],
    [
      'a mobile number with letters',
      { customer: { ...VALID.customer, mobileNumber: '0912-ABC-789' } },
      'customer.mobileNumber must contain only digits, spaces, "-", "(" and ")", with an optional leading "+"',
    ],
    [
      'a mobile number that is too short',
      { customer: { ...VALID.customer, mobileNumber: '12345' } },
      'customer.mobileNumber must be longer than or equal to 6 characters',
    ],
    ['no Customer', { customer: undefined }, 'customer must be an object'],
    [
      'an Invoice Number with a space',
      { invoiceNumber: 'INV 1' },
      'invoiceNumber must start with a letter or digit and contain only letters, digits and - _ / . #',
    ],
    [
      'an Invoice Number over 50 characters',
      { invoiceNumber: 'A'.repeat(51) },
      'invoiceNumber must be shorter than or equal to 50 characters',
    ],
    [
      'an unsupported currency',
      { currency: 'XXX' },
      'currency must be one of: AUD, USD, GBP, EUR, SGD, NZD, CAD, HKD',
    ],
    ['an unknown field', { status: 'Paid' }, 'property status should not exist'],
    [
      'a total sent by the client',
      { totalAmount: 1 },
      'property totalAmount should not exist',
    ],
  ];

  it.each(invalidBodies)('rejects %s', (_case, overrides, message) => {
    expect(parse({ ...VALID, ...overrides }).messages).toContain(message);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && npx vitest run src/common/validators.spec.ts src/invoices/dto/create-invoice.dto.spec.ts`
Expected: FAIL — `MaxDecimalPlaces` is not exported from `./validators.js`, and `./create-invoice.dto.js` cannot be resolved.

- [ ] **Step 3: Implement `MaxDecimalPlaces` and the create DTO**

Replace `backend/src/common/validators.ts` with:

```ts
import {
  buildMessage,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';
import { Decimal } from 'decimal.js';
import { isIsoDate } from './iso-date.js';

/** A real calendar date in YYYY-MM-DD format: 2026-02-30 is rejected. */
export function IsDateOnly(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDateOnly',
      validator: {
        validate: (value: unknown) => isIsoDate(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a valid date in YYYY-MM-DD format`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/**
 * The date is on or after the date in another property of the same object,
 * e.g. dueDate on or after invoiceDate. It passes when either value is not a
 * valid date, because @IsDateOnly reports those.
 */
export function IsOnOrAfter(
  property: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isOnOrAfter',
      constraints: [property],
      validator: {
        validate: (value: unknown, args) => {
          const other = (args?.object as Record<string, unknown> | undefined)?.[
            property
          ];
          if (!isIsoDate(value) || !isIsoDate(other)) return true;
          return value >= other;
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be on or after $constraint1`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/**
 * A number with at most `places` decimal places, counted exactly with Decimal
 * (class-validator's own maxDecimalPlaces option fails on values such as 1e-7).
 * Values that are not finite numbers pass, because @IsNumber reports those.
 */
export function MaxDecimalPlaces(
  places: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxDecimalPlaces',
      constraints: [places],
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          new Decimal(value).decimalPlaces() <= places,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must have at most $constraint1 decimal places`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
```

`backend/src/invoices/dto/create-invoice.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  buildMessage,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator';
import {
  trim,
  trimToUndefined,
  trimToUpperCase,
} from '../../common/transforms.js';
import {
  IsDateOnly,
  IsOnOrAfter,
  MaxDecimalPlaces,
} from '../../common/validators.js';
import { CURRENCY_CODES, type CurrencyCode } from '../domain/currencies.js';
import {
  calculateInvoiceTotals,
  DEFAULT_TAX_RATE,
  DiscountExceedsTotalError,
} from '../domain/invoice-totals.js';

const FINITE_NUMBER = { allowNaN: false, allowInfinity: false };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The discount must not exceed the sub-total plus tax (spec §5.3). The check
 * runs the real totals calculation, so it can never disagree with the saved
 * totals. Inputs that break their own rules are left to those rules.
 */
function DiscountWithinTotal(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'discountWithinTotal',
      validator: {
        validate: (discount: unknown, args) => {
          const body = args?.object as Partial<CreateInvoiceDto>;
          const item = Array.isArray(body.items) ? body.items[0] : undefined;
          const quantity: unknown = item?.quantity;
          const rate: unknown = item?.rate;
          const taxRate: unknown = body.taxRate;
          if (
            !isFiniteNumber(discount) ||
            !isFiniteNumber(quantity) ||
            !isFiniteNumber(rate) ||
            !isFiniteNumber(taxRate) ||
            discount < 0 ||
            quantity < 1 ||
            rate <= 0 ||
            taxRate < 0
          ) {
            return true;
          }
          try {
            calculateInvoiceTotals({
              items: [{ quantity, rate }],
              taxRate,
              discount,
            });
            return true;
          } catch (error) {
            if (error instanceof DiscountExceedsTotalError) return false;
            throw error;
          }
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must not exceed the sub-total plus tax`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/** The Customer, recorded on the Invoice as entered (ADR-0001). */
export class CustomerInputDto {
  @ApiProperty({ example: 'Paul', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullname: string;

  @ApiProperty({ example: 'paul@101digital.io', maxLength: 255 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({
    example: '+65 9477 1736',
    minLength: 6,
    maxLength: 20,
    description:
      'Digits, spaces, "-", "(" and ")", with an optional leading "+".',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @Length(6, 20)
  @Matches(/^\+?[0-9\s\-()]+$/, {
    message:
      '$property must contain only digits, spaces, "-", "(" and ")", with an optional leading "+"',
  })
  mobileNumber?: string;

  @ApiPropertyOptional({ example: 'Singapore', maxLength: 500 })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

/** The one Invoice Item of a new Invoice. */
export class InvoiceItemInputDto {
  @ApiProperty({ example: 'Honda RC150', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 1_000_000 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  @ApiProperty({
    example: 1000,
    minimum: 0.01,
    maximum: 1_000_000,
    description: 'Rate: the price of one unit; greater than 0, at most 2 decimal places.',
  })
  @IsNumber(FINITE_NUMBER)
  @IsPositive()
  @Max(1_000_000)
  @MaxDecimalPlaces(2)
  rate: number;
}

/**
 * Body of POST /invoices (spec §5.3). Totals and the Stored Status are never
 * accepted from the client: the server computes them.
 */
export class CreateInvoiceDto {
  @ApiProperty({ type: CustomerInputDto })
  @IsObject()
  @ValidateNested()
  @Type(() => CustomerInputDto)
  customer: CustomerInputDto;

  @ApiProperty({
    example: 'INV-2026-0042',
    maxLength: 50,
    description:
      'Unique regardless of case. Starts with a letter or digit; then letters, digits and - _ / . #',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9\-_/.#]*$/, {
    message:
      '$property must start with a letter or digit and contain only letters, digits and - _ / . #',
  })
  invoiceNumber: string;

  @ApiPropertyOptional({ example: '#5721662', maxLength: 100 })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceReference?: string;

  @ApiProperty({ format: 'date', example: '2026-10-02' })
  @Transform(trim)
  @IsDateOnly()
  invoiceDate: string;

  @ApiProperty({
    format: 'date',
    example: '2026-11-01',
    description: 'On or after invoiceDate.',
  })
  @Transform(trim)
  @IsDateOnly()
  @IsOnOrAfter('invoiceDate')
  dueDate: string;

  @ApiProperty({
    enum: CURRENCY_CODES,
    example: 'AUD',
    description: 'Case-insensitive.',
  })
  @Transform(trimToUpperCase)
  @IsIn(CURRENCY_CODES, {
    message: `$property must be one of: ${CURRENCY_CODES.join(', ')}`,
  })
  currency: CurrencyCode;

  @ApiPropertyOptional({
    example: 'Invoice is issued to Kanglee',
    maxLength: 1000,
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    type: [InvoiceItemInputDto],
    minItems: 1,
    maxItems: 1,
    description: 'Exactly one item.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: '$property must contain exactly 1 item' })
  @ArrayMaxSize(1, { message: '$property must contain exactly 1 item' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInputDto)
  items: InvoiceItemInputDto[];

  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    maximum: 100,
    default: DEFAULT_TAX_RATE,
    description: 'Tax Rate in percent, at most 2 decimal places.',
  })
  @IsNumber(FINITE_NUMBER)
  @Min(0)
  @Max(100)
  @MaxDecimalPlaces(2)
  taxRate: number = DEFAULT_TAX_RATE;

  @ApiPropertyOptional({
    example: 20,
    minimum: 0,
    default: 0,
    description:
      'An amount (not a percentage), at most 2 decimal places; must not exceed the sub-total plus tax.',
  })
  @IsNumber(FINITE_NUMBER)
  @Min(0)
  @MaxDecimalPlaces(2)
  @DiscountWithinTotal()
  discount: number = 0;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd backend && npx vitest run src/common/validators.spec.ts src/invoices/dto/create-invoice.dto.spec.ts`
Expected: PASS (`validators.spec.ts` 21 tests, `create-invoice.dto.spec.ts` 29 tests).

- [ ] **Step 5: Write the failing service tests for `create`**

Append to `backend/src/invoices/invoices.service.spec.ts`, and add these imports at the top of the file (keep the existing ones):

```ts
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import type { InvoiceDto } from './dto/invoice.dto.js';
import type { Invoice } from './entities/invoice.entity.js';
```

```ts
describe('InvoicesService.create', () => {
  const body: CreateInvoiceDto = {
    customer: { fullname: 'Kanglee Trading', email: 'billing@kanglee.example' },
    invoiceNumber: 'INV-2026-0042',
    invoiceDate: '2026-10-02',
    dueDate: '2026-11-01',
    currency: 'USD',
    items: [{ name: 'Consulting', quantity: 3, rate: 19.99 }],
    taxRate: 10,
    discount: 1.97,
  };

  function setup(save: (invoice: Invoice) => Promise<Invoice>) {
    const invoices = {
      create: vi.fn((fields: Partial<Invoice>) => fields as Invoice),
      save: vi.fn(save),
    };
    const items = { create: vi.fn((fields: object) => fields) };
    const service = new InvoicesService(
      invoices as unknown as Dependencies[0],
      items as unknown as Dependencies[1],
      { today: () => '2026-10-02' } as Dependencies[2],
    );
    const created = { invoiceId: 'new-id' } as InvoiceDto;
    const findOne = vi.spyOn(service, 'findOne').mockResolvedValue(created);
    return { service, invoices, findOne, created };
  }

  function uniqueViolation(constraint: string): QueryFailedError {
    return new QueryFailedError(
      'INSERT INTO "invoices"',
      [],
      Object.assign(new Error('duplicate key value violates unique constraint'), {
        code: '23505',
        constraint,
      }),
    );
  }

  it('saves a Draft with server-computed totals, then returns the reloaded Invoice', async () => {
    const { service, invoices, findOne, created } = setup(async (invoice) =>
      // Like TypeORM's save: fill in the generated id on the same object.
      Object.assign(invoice, { invoiceId: 'new-id' }),
    );

    await expect(service.create(body, 'user-id')).resolves.toBe(created);

    const saved = invoices.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      invoiceNumber: 'INV-2026-0042',
      invoiceReference: null,
      description: null,
      status: 'Draft',
      currency: 'USD',
      currencySymbol: 'US$',
      customerFullname: 'Kanglee Trading',
      customerMobileNumber: null,
      customerAddress: null,
      createdBy: 'user-id',
    });
    expect(saved.taxRate.toFixed(2)).toBe('10.00');
    expect(saved.invoiceSubTotal.toFixed(2)).toBe('59.97');
    expect(saved.totalTax.toFixed(2)).toBe('6.00');
    expect(saved.totalDiscount.toFixed(2)).toBe('1.97');
    expect(saved.totalAmount.toFixed(2)).toBe('64.00');
    expect(saved.totalPaid.toFixed(2)).toBe('0.00');
    expect(saved.balanceAmount.toFixed(2)).toBe('64.00');
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0]).toMatchObject({ name: 'Consulting', quantity: 3 });
    expect(saved.items[0].rate.toFixed(2)).toBe('19.99');
    expect(findOne).toHaveBeenCalledWith('new-id');
  });

  it('turns a duplicate Invoice Number into 409 with the number in the message', async () => {
    const { service } = setup(() =>
      Promise.reject(uniqueViolation('invoices_invoice_number_lower_uq')),
    );
    const attempt = service.create(body, 'user-id');
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toThrow(
      'Invoice number INV-2026-0042 already exists',
    );
  });

  it('rethrows other database errors', async () => {
    const other = uniqueViolation('some_other_index');
    const { service } = setup(() => Promise.reject(other));
    await expect(service.create(body, 'user-id')).rejects.toBe(other);
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `cd backend && npx vitest run src/invoices/invoices.service.spec.ts`
Expected: FAIL — `service.create is not a function` in the three new tests (the Task 7 tests still pass).

- [ ] **Step 7: Implement `create`**

Replace `backend/src/invoices/invoices.service.ts` with (the `list` and `findOne` code is unchanged from Task 7):

```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Decimal } from 'decimal.js';
import { Brackets, In, QueryFailedError, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service.js';
import { CURRENCY_SYMBOLS } from './domain/currencies.js';
import { STATUS_CRITERIA } from './domain/invoice-status.js';
import { calculateInvoiceTotals } from './domain/invoice-totals.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { InvoiceListResponseDto } from './dto/invoice-list-response.dto.js';
import { InvoiceDto } from './dto/invoice.dto.js';
import {
  ListInvoicesQueryDto,
  type SortField,
} from './dto/list-invoices-query.dto.js';
import { InvoiceItem } from './entities/invoice-item.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { toInvoiceDto } from './invoice.mapper.js';

/** The unique index on lower(invoice_number): the only uniqueness check. */
export const INVOICE_NUMBER_UNIQUE_INDEX = 'invoices_invoice_number_lower_uq';

/** The whitelist of sort keys. Without sortBy, the list is sorted by creation time. */
const SORT_PROPERTIES: Record<SortField | 'createdAt', keyof Invoice> = {
  createdAt: 'createdAt',
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  totalAmount: 'totalAmount',
};

/** Escapes the LIKE wildcards (and the escape character), so a keyword matches literally. */
export function escapeLike(keyword: string): string {
  return keyword.replace(/[\\%_]/g, '\\$&');
}

/** A PostgreSQL unique violation (23505) on the given constraint or index. */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const { code, constraint: violated } = error.driverError as {
    code?: unknown;
    constraint?: unknown;
  };
  return code === '23505' && violated === constraint;
}

/** Reads and creates Invoices. Each request reads "today" once, so every row agrees on Overdue. */
@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoices: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly items: Repository<InvoiceItem>,
    private readonly clock: ClockService,
  ) {}

  /** One page of Invoices plus the total that match the filters (spec §5.3). */
  async list(query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    const today = this.clock.today();
    const qb = this.invoices.createQueryBuilder('invoice');

    if (query.keyword) {
      const pattern = `%${escapeLike(query.keyword)}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('invoice.invoiceNumber ILIKE :pattern', { pattern })
            .orWhere('invoice.customerFullname ILIKE :pattern', { pattern });
        }),
      );
    }

    if (query.status) {
      // The same criteria that derive the displayed Status (invoice-status.ts).
      const criteria = STATUS_CRITERIA[query.status];
      qb.andWhere('invoice.status IN (:...storedIn)', {
        storedIn: criteria.storedIn,
      });
      if (criteria.due === 'beforeToday') {
        qb.andWhere('invoice.dueDate < :today', { today });
      } else if (criteria.due === 'todayOrLater') {
        qb.andWhere('invoice.dueDate >= :today', { today });
      }
    }

    if (query.fromDate) {
      qb.andWhere('invoice.invoiceDate >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('invoice.invoiceDate <= :toDate', { toDate: query.toDate });
    }

    const sortProperty = SORT_PROPERTIES[query.sortBy ?? 'createdAt'];
    const [rows, total] = await qb
      .orderBy(`invoice.${sortProperty}`, query.ordering)
      .addOrderBy('invoice.invoiceId', query.ordering)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();

    await this.attachItems(rows);
    return {
      data: rows.map((invoice) => toInvoiceDto(invoice, today)),
      paging: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async findOne(invoiceId: string): Promise<InvoiceDto> {
    const invoice = await this.invoices.findOne({
      where: { invoiceId },
      relations: { items: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return toInvoiceDto(invoice, this.clock.today());
  }

  /**
   * Creates a Draft Invoice with its one item (spec §5.3, create flow). The
   * totals are computed here, never taken from the client. `save` writes the
   * Invoice and its item in one transaction. The unique index is the only
   * uniqueness check, so two concurrent requests cannot both succeed.
   */
  async create(dto: CreateInvoiceDto, createdBy: string): Promise<InvoiceDto> {
    const [item] = dto.items;
    const totals = calculateInvoiceTotals({
      items: [{ quantity: item.quantity, rate: item.rate }],
      taxRate: dto.taxRate,
      discount: dto.discount,
    });
    const invoice = this.invoices.create({
      invoiceNumber: dto.invoiceNumber,
      invoiceReference: dto.invoiceReference ?? null,
      invoiceDate: dto.invoiceDate,
      dueDate: dto.dueDate,
      currency: dto.currency,
      currencySymbol: CURRENCY_SYMBOLS[dto.currency],
      description: dto.description ?? null,
      status: 'Draft',
      customerFullname: dto.customer.fullname,
      customerEmail: dto.customer.email,
      customerMobileNumber: dto.customer.mobileNumber ?? null,
      customerAddress: dto.customer.address ?? null,
      taxRate: new Decimal(dto.taxRate),
      invoiceSubTotal: totals.subTotal,
      totalTax: totals.taxAmount,
      totalDiscount: totals.discount,
      totalAmount: totals.totalAmount,
      totalPaid: totals.totalPaid,
      balanceAmount: totals.balanceAmount,
      createdBy,
      items: [
        this.items.create({
          name: item.name,
          quantity: item.quantity,
          rate: new Decimal(item.rate),
        }),
      ],
    });

    let saved: Invoice;
    try {
      saved = await this.invoices.save(invoice);
    } catch (error) {
      if (isUniqueViolation(error, INVOICE_NUMBER_UNIQUE_INDEX)) {
        throw new ConflictException(
          `Invoice number ${dto.invoiceNumber} already exists`,
        );
      }
      throw error;
    }
    // Reload, so the response has the database values and the computed Status.
    return this.findOne(saved.invoiceId);
  }

  /** Loads the items of a whole page in one query (no N+1). */
  private async attachItems(invoices: Invoice[]): Promise<void> {
    if (invoices.length === 0) return;
    const items = await this.items.find({
      where: { invoiceId: In(invoices.map((invoice) => invoice.invoiceId)) },
      order: { id: 'ASC' },
    });
    const byInvoice = new Map<string, InvoiceItem[]>();
    for (const item of items) {
      const list = byInvoice.get(item.invoiceId) ?? [];
      list.push(item);
      byInvoice.set(item.invoiceId, list);
    }
    for (const invoice of invoices) {
      invoice.items = byInvoice.get(invoice.invoiceId) ?? [];
    }
  }
}
```

- [ ] **Step 8: Run the unit tests to verify they pass**

Run: `cd backend && npx vitest run src/invoices`
Expected: PASS (`invoices.service.spec.ts` now 6 tests).

- [ ] **Step 9: Write the failing e2e tests**

`backend/test/invoices-create.e2e-spec.ts`:

```ts
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DEFAULT_USER_ID } from '../src/database/seed/appendix-a.js';
import {
  loginAs,
  startTestApp,
  stopTestApp,
  type TestContext,
} from './utils/test-app.js';

const BODY = {
  customer: {
    fullname: '  Kanglee Trading  ',
    email: 'billing@kanglee.example',
    mobileNumber: '+65 9477 1736',
    address: '1 Raffles Place, Singapore',
  },
  invoiceNumber: 'INV-2026-0042',
  invoiceReference: 'PO-7781',
  invoiceDate: '2026-09-15',
  dueDate: '2026-10-15',
  currency: 'usd',
  description: 'Consulting for September',
  items: [{ name: 'Consulting', quantity: 3, rate: 19.99 }],
  taxRate: 10,
  discount: 1.97,
};

describe('Invoices: create (e2e)', () => {
  let context: TestContext;
  let server: App;
  let token: string;

  beforeAll(async () => {
    context = await startTestApp();
    server = context.app.getHttpServer();
    token = await loginAs(server);
  });

  afterAll(async () => {
    await stopTestApp(context);
  });

  function create(body: object) {
    return request(server)
      .post('/invoices')
      .auth(token, { type: 'bearer' })
      .send(body);
  }

  function get(path: string) {
    return request(server).get(path).auth(token, { type: 'bearer' });
  }

  it('creates a Draft Invoice with server-computed totals', async () => {
    const res = await create(BODY).expect(201);
    expect(res.body).toEqual({
      invoiceId: expect.any(String),
      invoiceNumber: 'INV-2026-0042',
      invoiceReference: 'PO-7781',
      invoiceDate: '2026-09-15',
      dueDate: '2026-10-15',
      currency: 'USD',
      currencySymbol: 'US$',
      description: 'Consulting for September',
      status: 'Draft',
      customer: {
        fullname: 'Kanglee Trading',
        email: 'billing@kanglee.example',
        mobileNumber: '+65 9477 1736',
        address: '1 Raffles Place, Singapore',
      },
      items: [
        {
          id: expect.any(String),
          name: 'Consulting',
          quantity: 3,
          rate: 19.99,
          amount: 59.97,
        },
      ],
      taxRate: 10,
      invoiceSubTotal: 59.97,
      totalTax: 6,
      totalDiscount: 1.97,
      totalAmount: 64,
      totalPaid: 0,
      balanceAmount: 64,
      createdAt: expect.any(String),
      createdBy: DEFAULT_USER_ID,
    });
    expect(res.headers.location).toBe(`/invoices/${res.body.invoiceId}`);

    // The detail view and the list return the same representation.
    const detail = await get(res.headers.location).expect(200);
    expect(detail.body).toEqual(res.body);
    const search = await get('/invoices?keyword=INV-2026-0042').expect(200);
    expect(search.body.data).toEqual([res.body]);
    // It is the newest Invoice, so it heads the default list.
    const newest = await get('/invoices').expect(200);
    expect(newest.body.data[0].invoiceId).toBe(res.body.invoiceId);
    expect(newest.body.paging.total).toBe(42);
  });

  it('applies the default Tax Rate and stores blank optional fields as null', async () => {
    const res = await create({
      customer: {
        fullname: 'Sarah Lee',
        email: 'sarah@example.com',
        mobileNumber: '',
        address: '   ',
      },
      invoiceNumber: 'INV-DEFAULTS',
      invoiceReference: '  ',
      invoiceDate: '2026-09-15',
      dueDate: '2026-09-15',
      currency: 'aud',
      description: '',
      items: [{ name: 'Audit', quantity: 1, rate: 100 }],
    }).expect(201);
    expect(res.body).toMatchObject({
      invoiceReference: null,
      description: null,
      currency: 'AUD',
      currencySymbol: 'AU$',
      customer: { mobileNumber: null, address: null },
      taxRate: 10,
      invoiceSubTotal: 100,
      totalTax: 10,
      totalDiscount: 0,
      totalAmount: 110,
      balanceAmount: 110,
    });
  });

  it('rejects a duplicate Invoice Number, ignoring case', async () => {
    await create({ ...BODY, invoiceNumber: 'DUP-001' }).expect(201);

    const exact = await create({ ...BODY, invoiceNumber: 'DUP-001' }).expect(409);
    expect(exact.body).toEqual({
      statusCode: 409,
      message: 'Invoice number DUP-001 already exists',
      error: 'Conflict',
    });
    const otherCase = await create({ ...BODY, invoiceNumber: 'dup-001' }).expect(
      409,
    );
    expect(otherCase.body.message).toBe('Invoice number dup-001 already exists');
  });

  it('rejects a Due Date before the Invoice Date', async () => {
    const res = await create({
      ...BODY,
      invoiceNumber: 'INV-DATES',
      dueDate: '2026-09-14',
    }).expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      message: ['dueDate must be on or after invoiceDate'],
      error: 'Bad Request',
    });
  });

  it('rejects a discount above the sub-total plus tax', async () => {
    const res = await create({
      ...BODY,
      invoiceNumber: 'INV-DISCOUNT',
      discount: 100,
    }).expect(400);
    expect(res.body.message).toEqual([
      'discount must not exceed the sub-total plus tax',
    ]);
  });

  it('names nested fields in the messages', async () => {
    const res = await create({
      ...BODY,
      invoiceNumber: 'INV-NESTED',
      customer: { ...BODY.customer, email: 'paul' },
      items: [{ name: 'Consulting', quantity: 3, rate: 1.005 }],
    }).expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'customer.email must be an email',
        'items.0.rate must have at most 2 decimal places',
      ]),
    );
  });

  it('rejects fields the client may not set, such as the Status or totals', async () => {
    const res = await create({
      ...BODY,
      invoiceNumber: 'INV-EXTRA',
      status: 'Paid',
      totalAmount: 1,
    }).expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'property status should not exist',
        'property totalAmount should not exist',
      ]),
    );
  });

  it('requires authentication', async () => {
    await request(server).post('/invoices').send(BODY).expect(401);
  });
});
```

Add this test at the end of the `describe` block in `backend/test/app.e2e-spec.ts`:

```ts
  it('documents every endpoint, with Bearer as the only security scheme', async () => {
    interface Operation {
      summary?: string;
      tags?: string[];
      security?: unknown;
      responses: Record<string, unknown>;
    }
    const doc = (await request(server).get('/api/docs-json').expect(200))
      .body as {
      paths: Record<string, Record<string, Operation>>;
      components: { securitySchemes: unknown };
    };

    expect(Object.keys(doc.paths).sort()).toEqual([
      '/auth/login',
      '/auth/logout',
      '/auth/me',
      '/health',
      '/invoices',
      '/invoices/{id}',
    ]);
    expect(doc.components.securitySchemes).toEqual({
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    });
    for (const [path, operations] of Object.entries(doc.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        expect(operation.summary, `${method} ${path}`).toBeTruthy();
        expect(operation.tags, `${method} ${path}`).toHaveLength(1);
      }
    }

    const createOperation = doc.paths['/invoices'].post;
    expect(Object.keys(createOperation.responses).sort()).toEqual([
      '201',
      '400',
      '401',
      '409',
    ]);
    expect(createOperation.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(doc.paths['/invoices/{id}'].get.responses).sort()).toEqual(
      ['200', '400', '401', '404'],
    );
    expect(Object.keys(doc.paths['/auth/login'].post.responses).sort()).toEqual([
      '200',
      '400',
      '401',
      '429',
    ]);
  });
```

- [ ] **Step 10: Run them to verify they fail**

Run: `cd backend && npx vitest run --config ./vitest.config.e2e.ts test/invoices-create.e2e-spec.ts test/app.e2e-spec.ts`
Expected: FAIL — `POST /invoices` answers 404, and the OpenAPI document has no `post` operation on `/invoices`.

- [ ] **Step 11: Add the POST route**

Replace `backend/src/invoices/invoices.controller.ts` with:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ErrorResponseDto } from '../common/error-response.dto.js';
import { User } from '../users/user.entity.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { InvoiceListResponseDto } from './dto/invoice-list-response.dto.js';
import { InvoiceDto } from './dto/invoice.dto.js';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto.js';
import { InvoicesService } from './invoices.service.js';

/** A malformed id is a client error with a clear message, not a database error. */
const invoiceIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('id must be a valid UUID'),
});

/** List, view and create Invoices (spec §5.3). Every route needs a token. */
@ApiTags('invoices')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'The token is missing, invalid or expired',
})
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List Invoices',
    description:
      'Search by Invoice Number or Customer name, filter by Status and Invoice Date range, sort, and paginate on the server.',
  })
  @ApiOkResponse({ type: InvoiceListResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'A query parameter is not valid',
  })
  list(@Query() query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    return this.invoices.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one Invoice with its item and totals' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The invoiceId' })
  @ApiOkResponse({ type: InvoiceDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'id is not a valid UUID',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Invoice not found',
  })
  findOne(@Param('id', invoiceIdPipe) id: string): Promise<InvoiceDto> {
    return this.invoices.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a Draft Invoice',
    description:
      'Creates an Invoice with exactly one item and Stored Status Draft. The server computes the totals; the signed-in User becomes createdBy.',
  })
  @ApiCreatedResponse({
    type: InvoiceDto,
    headers: {
      Location: {
        description: 'Path of the new Invoice: /invoices/{invoiceId}',
        schema: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'The body is not valid; one message per problem',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'The Invoice Number already exists (ignoring case)',
  })
  async create(
    @Body() body: CreateInvoiceDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ): Promise<InvoiceDto> {
    const invoice = await this.invoices.create(body, user.id);
    response.location(`/invoices/${invoice.invoiceId}`);
    return invoice;
  }
}
```

- [ ] **Step 12: Run all e2e suites to verify they pass**

Run: `cd backend && npm run test:e2e`
Expected: PASS — `invoices-create.e2e-spec.ts` (8 tests), `app.e2e-spec.ts` (7 tests) and the other suites.

- [ ] **Step 13: Run the unit suite, lint, type-check and build**

Run: `cd backend && npm run format && npm test && npm run lint && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 14: Smoke-test the compiled API against a local database**

This checks the compiled `dist/` the way the container runs it (Task 15): the seed script, then the API, against a throwaway PostgreSQL container. Run the whole block in **one** shell (the variables do not survive between separate commands):

```bash
set -e
cd backend
docker run -d --rm --name si-task8-db -e POSTGRES_USER=simple_invoice \
  -e POSTGRES_PASSWORD=task8-local-only -e POSTGRES_DB=simple_invoice \
  -p 127.0.0.1:55432:5432 postgres:17-alpine
trap 'kill "$API_PID" 2>/dev/null || true; docker stop si-task8-db >/dev/null' EXIT
# -h 127.0.0.1: during its first start the image runs a socket-only temporary
# server; only the final server answers on TCP.
until docker exec si-task8-db pg_isready -h 127.0.0.1 -U simple_invoice -d simple_invoice >/dev/null 2>&1; do :; done
export DATABASE_URL=postgres://simple_invoice:task8-local-only@127.0.0.1:55432/simple_invoice
export JWT_SECRET="$(openssl rand -base64 48)" PORT=3999
export SEED_USER_EMAIL=admin@example.com SEED_USER_PASSWORD='Password123!' SEED_USER_FULLNAME='Admin User'
npm run seed
node dist/main.js > "$(mktemp -d)/api.log" 2>&1 &
API_PID=$!
curl -sf --retry 30 --retry-connrefused --retry-delay 1 http://127.0.0.1:3999/health; echo
TOKEN=$(curl -sf -X POST http://127.0.0.1:3999/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Password123!"}' \
  | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0, "utf8")).accessToken)')
curl -sf "http://127.0.0.1:3999/invoices?pageSize=1" -H "Authorization: Bearer $TOKEN" \
  | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).paging)'
```

Expected output, in order:
- `Seed complete: default User admin@example.com, 41 Invoice(s) inserted.`
- `{"status":"ok","info":{"database":{"status":"up"}},"error":{},"details":{"database":{"status":"up"}}}`
- `{ page: 1, pageSize: 1, total: 41 }`

The `trap` stops the API and the database container when the block ends, also on failure.

- [ ] **Step 15: Commit**

```bash
git add backend
git commit -m "feat(backend): create Draft Invoices with server-computed totals

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 9: Frontend scaffold, shared UI and formatting

Spec §3 (the frontend stack and its rules), §6.2 (the HTTP client and the retry policy) and §6.4 (shared UI and formatting). This task creates the Vite + React + TypeScript project with its test, lint and format tooling. It also adds the API types, the HTTP client, the error helpers, the display formatting and the shared components that every page uses. At the end of this task the app shows only the "Page not found" page; Tasks 10–14 add the routes.

**Files:**
- Create: `frontend/package.json` (then `npm install` creates `frontend/package-lock.json`)
- Create: `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`, `frontend/vite.config.ts`
- Create: `frontend/.oxlintrc.json`, `frontend/.prettierrc`, `frontend/.env.example`, `frontend/index.html`, `frontend/public/favicon.svg`
- Create: `frontend/src/api/types.ts`, `frontend/src/api/errors.ts`, `frontend/src/api/http.ts`
- Create: `frontend/src/lib/format.ts`, `frontend/src/lib/dates.ts`, `frontend/src/lib/currencies.ts`
- Create: `frontend/src/queryClient.ts`, `frontend/src/theme.ts`, `frontend/src/App.tsx`, `frontend/src/routes.tsx`, `frontend/src/main.tsx`
- Create: `frontend/src/components/StatusChip.tsx`, `FullPageSpinner.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `PageHeader.tsx`, `NotFoundPage.tsx` (all in `frontend/src/components/`)
- Create: `frontend/src/test/setup.ts`, `frontend/src/test/httpError.ts`
- Test: `frontend/src/lib/format.test.ts`, `frontend/src/lib/dates.test.ts`, `frontend/src/api/errors.test.ts`, `frontend/src/queryClient.test.ts`, `frontend/src/components/StatusChip.test.tsx`

**Interfaces:**
- Consumes: the API contract of Tasks 6–8. This task only writes its types; nothing calls the API yet:
  - `POST /auth/login` → `{ accessToken, tokenType: 'Bearer', expiresIn, user }`;
  - the `InvoiceDto` JSON;
  - `GET /invoices` → `{ data, paging: { page, pageSize, total } }`;
  - the error body `{ statusCode, message: string | string[], error }`.

  The frontend's Currency list copies the list in Task 1 (`backend/src/invoices/domain/currencies.ts`).
- Produces:
  - `src/api/types.ts`: `StoredStatus`, `InvoiceStatus`, `SortField`, `SortOrder`, `User`, `LoginRequest`, `LoginResponse`, `Customer`, `InvoiceItem`, `Invoice`, `Paging`, `InvoiceListResponse`, `InvoiceListQuery { page; pageSize; ordering; sortBy?; status?; keyword?; fromDate?; toDate? }`, `CreateInvoiceRequest`, `ApiErrorBody`.
  - `src/api/http.ts`:
    - `http`, the one axios instance. Its base URL is `import.meta.env.VITE_API_BASE_URL || '/api'`, and it sends `X-Requested-With: XMLHttpRequest` with every request.
    - `onUnauthorized(handler: () => void): () => void` calls `handler` when a request fails with 401, except a request to `/auth/login`, `/auth/me` or `/auth/logout`. It returns the function that removes the hook.
  - `src/api/errors.ts`: `errorStatus(error: unknown): number | undefined`, `errorMessages(error: unknown): string[]`.
  - `src/queryClient.ts`: `shouldRetry(failureCount: number, error: unknown): boolean`, `createQueryClient(): QueryClient`.
  - `src/lib/format.ts`: `formatMoney(amount: number, symbol: string): string` (`AU$2,180.00`), `formatDate(isoDate: string): string` (`03 Jun 2026`), `formatDateTime(isoDateTime: string): string`.
  - `src/lib/dates.ts`: `todayIsoDate(now?: Date): string`, `addDaysIso(isoDate: string, days: number): string`.
  - `src/lib/currencies.ts`: `CURRENCIES` (a list of `{ code, symbol }`), `type CurrencyCode`, `CURRENCY_CODES` (a non-empty tuple, for `z.enum`).
  - Components:
    - `StatusChip({ status, size? })`, `FullPageSpinner()` and `NotFoundPage()`.
    - `EmptyState({ title, description?, action? })`.
    - `ErrorState({ message, onRetry })`: an error Alert with a "Retry" button.
    - `PageHeader({ title, back?, chip?, actions? })`: the page's only `h1`. It also sets the browser tab title to `<title> · SimpleInvoice`.
  - `App({ router, queryClient }: { router: DataRouter; queryClient: QueryClient })`, `routes: RouteObject[]`, `theme`.
  - Test helper `httpError(status: number, data?: unknown): AxiosError` (`src/test/httpError.ts`).

- [ ] **Step 1: Create `frontend/package.json` and install the dependencies**

`frontend/package.json`:

```json
{
  "name": "simple-invoice-frontend",
  "version": "1.0.0",
  "description": "SimpleInvoice single-page app (React + Vite + MUI)",
  "private": true,
  "license": "UNLICENSED",
  "type": "module",
  "engines": {
    "node": "^22.22.2 || >=24.15.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b",
    "lint": "oxlint --deny-warnings src vite.config.ts",
    "format": "prettier --write src vite.config.ts",
    "format:check": "prettier --check src vite.config.ts",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@emotion/react": "11.14.0",
    "@emotion/styled": "11.14.1",
    "@fontsource/roboto": "5.3.0",
    "@hookform/resolvers": "5.9.1",
    "@mui/icons-material": "9.4.0",
    "@mui/material": "9.4.0",
    "@tanstack/react-query": "5.104.0",
    "axios": "1.20.0",
    "notistack": "3.0.2",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-hook-form": "7.89.0",
    "react-router": "8.4.0",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "@testing-library/dom": "10.4.2",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.7",
    "@types/node": "24.19.1",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "jsdom": "30.1.1",
    "msw": "3.0.1",
    "oxlint": "1.86.0",
    "prettier": "3.9.9",
    "typescript": "6.0.3",
    "vite": "8.3.2",
    "vitest": "5.0.3"
  }
}
```

Run: `cd frontend && npm install`
Expected: the install finishes without errors and creates `frontend/package-lock.json`. Commit the lock file with this task.

- [ ] **Step 2: Add the TypeScript, Vite, lint and format configuration**

`vite.config.ts` does three jobs:
- In development, it proxies `/api` to the backend and strips the prefix, as nginx does in Docker (Task 15). The SPA therefore always calls its own origin, and the session cookie stays first-party.
- It puts the libraries in `react`, `mui` and `vendor` chunks. Browsers keep these cached across releases.
- It configures Vitest: jsdom, the setup file, and the UTC time zone for the date assertions.

`frontend/tsconfig.json`:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`frontend/tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "types": ["vite/client", "vitest/globals"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Type checking */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`frontend/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,

    /* vite.config.ts runs in Node */
    "module": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Type checking */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

`frontend/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// In development the Vite server proxies /api to the backend and strips the
// prefix, exactly as nginx does in Docker. The SPA therefore always calls the
// same origin, and the httpOnly session cookie stays first-party (ADR-0002).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    build: {
      rolldownOptions: {
        output: {
          // Libraries change less often than the app, so their chunks stay cached across releases.
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
                priority: 3,
              },
              { name: 'mui', test: /node_modules[\\/](@mui|@emotion)[\\/]/, priority: 2 },
              { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
            ],
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
      unstubGlobals: true,
      // Whole-page tests type into many fields; leave room for slower CI machines.
      testTimeout: 15_000,
      // Dates and times in assertions are written for UTC.
      env: { TZ: 'UTC' },
    },
  }
})
```

`frontend/.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "env": { "browser": true, "es2024": true },
  "ignorePatterns": ["dist"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "warn",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  },
  "overrides": [
    {
      "files": ["src/routes.tsx", "src/test/**"],
      "rules": { "react/only-export-components": "off" }
    }
  ]
}
```

`frontend/.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100
}
```

The SPA has no secrets. Vite puts only `VITE_*` variables into the bundle, and only the development server reads `API_PROXY_TARGET`:

`frontend/.env.example`:

```dotenv
# Base URL of the API as the browser sees it. Keep "/api": nginx (Docker) and
# the Vite dev server both proxy /api to the backend on the same origin, which
# keeps the httpOnly session cookie first-party (ADR-0002).
VITE_API_BASE_URL=/api

# Where the Vite dev server sends /api during `npm run dev` (unused in Docker).
API_PROXY_TARGET=http://localhost:3000
```

`frontend/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="SimpleInvoice: list, search and create invoices." />
    <title>SimpleInvoice</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/public/favicon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1e5eff"/><path d="M10 7h12v18l-3-2-3 2-3-2-3 2z" fill="#fff"/><path d="M13 12h6M13 16h6M13 20h4" stroke="#1e5eff" stroke-width="1.6" stroke-linecap="round"/></svg>
```

- [ ] **Step 3: Write the failing unit tests**

The setup file loads the jest-dom matchers. It also lets `findBy*` and `waitFor` wait 5 s instead of the default 1 s. A whole page renders only after several mocked requests, and on a busy CI machine that can take more than 1 s. `httpError` builds the error that axios gives for a failed request.

`frontend/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// A whole page renders only after a few mocked requests. On a busy CI machine that can take
// longer than the 1 s that findBy* and waitFor wait by default.
configure({ asyncUtilTimeout: 5_000 })
```

`frontend/src/test/httpError.ts`:

```ts
import { AxiosError, AxiosHeaders } from 'axios'

/** An axios error carrying an HTTP response, as the API client rejects with. */
export function httpError(status: number, data: unknown = {}): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  })
}
```

`frontend/src/lib/format.test.ts`:

```ts
import { formatDate, formatDateTime, formatMoney } from './format'

describe('formatMoney', () => {
  it.each([
    [2180, 'AU$', 'AU$2,180.00'],
    [1451.34, 'AU$', 'AU$1,451.34'],
    [0, 'US$', 'US$0.00'],
    [1234567.5, '€', '€1,234,567.50'],
    [-20, 'AU$', '-AU$20.00'],
  ])('formats %d with %s as %s', (amount, symbol, expected) => {
    expect(formatMoney(amount, symbol)).toBe(expected)
  })
})

describe('formatDate', () => {
  it('shows an ISO date as day, short month and year', () => {
    expect(formatDate('2026-06-03')).toBe('03 Jun 2026')
    expect(formatDate('2026-09-30')).toBe('30 Sep 2026')
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026')
  })
})

describe('formatDateTime', () => {
  it('shows a timestamp in the local time zone (UTC in tests)', () => {
    expect(formatDateTime('2026-06-03T12:03:26.995Z')).toBe('03 Jun 2026, 12:03')
  })
})
```

`frontend/src/lib/dates.test.ts`:

```ts
import { addDaysIso, todayIsoDate } from './dates'

describe('todayIsoDate', () => {
  it('returns the local calendar date as YYYY-MM-DD', () => {
    expect(todayIsoDate(new Date('2026-10-02T23:59:59Z'))).toBe('2026-10-02')
  })
})

describe('addDaysIso', () => {
  it('adds days across month and year ends', () => {
    expect(addDaysIso('2026-10-02', 30)).toBe('2026-11-01')
    expect(addDaysIso('2026-12-15', 30)).toBe('2027-01-14')
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29')
  })
})
```

`frontend/src/api/errors.test.ts`:

```ts
import { AxiosError } from 'axios'
import { httpError } from '../test/httpError'
import { errorMessages, errorStatus } from './errors'

describe('errorStatus', () => {
  it('reads the HTTP status of a failed request', () => {
    expect(errorStatus(httpError(409))).toBe(409)
  })

  it('is undefined when there was no HTTP response', () => {
    expect(errorStatus(new AxiosError('Network Error', 'ERR_NETWORK'))).toBeUndefined()
    expect(errorStatus(new Error('boom'))).toBeUndefined()
  })
})

describe('errorMessages', () => {
  it('wraps a single message in a list', () => {
    const error = httpError(404, {
      statusCode: 404,
      message: 'Invoice not found',
      error: 'Not Found',
    })
    expect(errorMessages(error)).toEqual(['Invoice not found'])
  })

  it('keeps the list of validation messages', () => {
    const message = ['customer.email must be an email', 'dueDate must be on or after invoiceDate']
    expect(
      errorMessages(httpError(400, { statusCode: 400, message, error: 'Bad Request' })),
    ).toEqual(message)
  })

  it('returns an empty list when the body has no message', () => {
    expect(errorMessages(httpError(502, '<html>Bad gateway</html>'))).toEqual([])
    expect(errorMessages(new Error('boom'))).toEqual([])
  })
})
```

`frontend/src/queryClient.test.ts`:

```ts
import { AxiosError } from 'axios'
import { shouldRetry } from './queryClient'
import { httpError } from './test/httpError'

describe('shouldRetry', () => {
  it.each([400, 401, 404, 409, 429])('never retries a %i answer', (status) => {
    expect(shouldRetry(0, httpError(status))).toBe(false)
  })

  it('retries a server or network failure once', () => {
    expect(shouldRetry(0, httpError(500))).toBe(true)
    expect(shouldRetry(1, httpError(500))).toBe(false)
    expect(shouldRetry(0, new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(true)
  })
})
```

`frontend/src/components/StatusChip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import type { InvoiceStatus } from '../api/types'
import { StatusChip } from './StatusChip'

describe('StatusChip', () => {
  it.each<[InvoiceStatus, string]>([
    ['Draft', 'MuiChip-colorDefault'],
    ['Pending', 'MuiChip-colorInfo'],
    ['Paid', 'MuiChip-colorSuccess'],
    ['Overdue', 'MuiChip-colorError'],
  ])('shows %s with its colour', (status, colorClass) => {
    render(<StatusChip status={status} />)
    expect(screen.getByText(status).closest('.MuiChip-root')).toHaveClass(colorClass)
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL. None of the 5 test files loads. Each one reports its missing module, for example `Error: Failed to resolve import "./format" from "src/lib/format.test.ts". Does the file exist?`. The same error occurs for `./dates`, `./errors`, `./queryClient` and `./StatusChip`. The summary shows `Test Files  5 failed (5)` and `Tests  no tests`.

- [ ] **Step 5: Write the API types, the error helpers, the formatting, the Currencies, the query client and the Status chip**

`frontend/src/api/types.ts`:

```ts
/** The API's request and response shapes (backend DTOs, spec §5.3). */

export type StoredStatus = 'Draft' | 'Pending' | 'Paid'
/** The Status shown to Users: the Stored Status, or Overdue when an unpaid Invoice is past its Due Date. */
export type InvoiceStatus = StoredStatus | 'Overdue'
export type SortField = 'invoiceDate' | 'dueDate' | 'totalAmount'
export type SortOrder = 'ASC' | 'DESC'

export interface User {
  id: string
  email: string
  fullname: string
  createdAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: User
}

export interface Customer {
  fullname: string
  email: string
  mobileNumber: string | null
  address: string | null
}

export interface InvoiceItem {
  id: string
  name: string
  quantity: number
  rate: number
  amount: number
}

export interface Invoice {
  invoiceId: string
  invoiceNumber: string
  invoiceReference: string | null
  invoiceDate: string
  dueDate: string
  currency: string
  currencySymbol: string
  description: string | null
  status: InvoiceStatus
  customer: Customer
  items: InvoiceItem[]
  taxRate: number
  invoiceSubTotal: number
  totalTax: number
  totalDiscount: number
  totalAmount: number
  totalPaid: number
  balanceAmount: number
  createdAt: string
  createdBy: string
}

export interface Paging {
  page: number
  pageSize: number
  total: number
}

export interface InvoiceListResponse {
  data: Invoice[]
  paging: Paging
}

/** The query of `GET /invoices`. Unset filters are left out of the request. */
export interface InvoiceListQuery {
  page: number
  pageSize: number
  ordering: SortOrder
  sortBy?: SortField
  status?: InvoiceStatus
  keyword?: string
  fromDate?: string
  toDate?: string
}

export interface CreateInvoiceRequest {
  customer: {
    fullname: string
    email: string
    mobileNumber?: string
    address?: string
  }
  invoiceNumber: string
  invoiceReference?: string
  invoiceDate: string
  dueDate: string
  currency: string
  description?: string
  items: Array<{ name: string; quantity: number; rate: number }>
  taxRate: number
  discount: number
}

/** The body of every API error (spec §5.5). Validation errors carry one message per problem. */
export interface ApiErrorBody {
  statusCode: number
  message: string | string[]
  error: string
}
```

`frontend/src/api/errors.ts`:

```ts
import { isAxiosError } from 'axios'
import type { ApiErrorBody } from './types'

/** The HTTP status of a failed request; undefined for network failures and non-HTTP errors. */
export function errorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

/**
 * The API's error messages as a list. `message` is one string, or one string
 * per problem for a validation error (spec §5.5).
 */
export function errorMessages(error: unknown): string[] {
  if (!isAxiosError<Partial<ApiErrorBody>>(error)) return []
  const message = error.response?.data?.message
  if (Array.isArray(message)) return message.filter((item) => typeof item === 'string')
  return typeof message === 'string' ? [message] : []
}
```

`frontend/src/lib/format.ts`:

```ts
/** Display formatting. Values are shown exactly as the API serves them; nothing is recalculated. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const amountFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const pad = (value: number) => String(value).padStart(2, '0')

/** `formatMoney(2180, 'AU$')` → `AU$2,180.00`. A negative amount puts the sign first: `-AU$20.00`. */
export function formatMoney(amount: number, symbol: string): string {
  const sign = amount < 0 ? '-' : ''
  return `${sign}${symbol}${amountFormat.format(Math.abs(amount))}`
}

/**
 * `formatDate('2026-06-03')` → `03 Jun 2026`. The ISO date is split, not parsed
 * into a Date, so the time zone can never shift the calendar day.
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`
}

/** A timestamp in the viewer's time zone: `03 Jun 2026, 12:03`. */
export function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
```

`frontend/src/lib/dates.ts`:

```ts
/** Calendar-date helpers for form defaults. Dates are `YYYY-MM-DD` strings, as the API uses them. */

/** Today's date in the viewer's time zone. */
export function todayIsoDate(now: Date = new Date()): string {
  // Shift by the zone offset so the UTC fields equal the local ones.
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** Adds whole days to a date. Computed in UTC, so a daylight-saving change never skips a day. */
export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
```

`frontend/src/lib/currencies.ts`:

```ts
/**
 * The supported Currencies and their symbols, for the create form. The backend
 * owns the list (backend/src/invoices/domain/currencies.ts) and derives the
 * symbol itself; keep this copy in step with it.
 */
export const CURRENCIES = [
  { code: 'AUD', symbol: 'AU$' },
  { code: 'USD', symbol: 'US$' },
  { code: 'GBP', symbol: '£' },
  { code: 'EUR', symbol: '€' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'NZD', symbol: 'NZ$' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'HKD', symbol: 'HK$' },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

export const CURRENCY_CODES = CURRENCIES.map(({ code }) => code) as [
  CurrencyCode,
  ...CurrencyCode[],
]
```

`frontend/src/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'
import { errorStatus } from './api/errors'

/**
 * Retry policy (spec §6.2). A 4xx answer will not change on a retry (bad input,
 * a missing Invoice, an expired session), so only other failures retry, once.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = errorStatus(error)
  if (status !== undefined && status >= 400 && status < 500) return false
  return failureCount < 1
}

/** The app's query client: cached data stays fresh for 30 s, and there is no refetch on focus. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000, refetchOnWindowFocus: false },
    },
  })
}
```

`frontend/src/components/StatusChip.tsx`:

```tsx
import Chip, { type ChipProps } from '@mui/material/Chip'
import type { InvoiceStatus } from '../api/types'

const STATUS_COLORS: Record<InvoiceStatus, ChipProps['color']> = {
  Draft: 'default',
  Pending: 'info',
  Paid: 'success',
  Overdue: 'error',
}

/** An Invoice's Status as a coloured chip. The text is always shown, so colour is never the only cue. */
export function StatusChip({
  status,
  size = 'small',
}: {
  status: InvoiceStatus
  size?: ChipProps['size']
}) {
  return <Chip label={status} color={STATUS_COLORS[status]} size={size} />
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (5 test files, 24 tests).

- [ ] **Step 7: Write the HTTP client, the theme, the shared components and the app shell**

`App` is the provider stack. `main.tsx` renders it with the browser router, and the tests render the same tree with a memory router (Task 10). React 19 moves the `<title>` that `PageHeader` renders into the document head.

`frontend/src/api/http.ts`:

```ts
import axios from 'axios'

/**
 * The one HTTP client. It calls the same-origin `/api` proxy (nginx in Docker,
 * Vite in development), so the browser attaches the httpOnly session cookie by
 * itself. `X-Requested-With` is the header the API requires before it accepts
 * that cookie (ADR-0002). The SPA never reads, stores or sends the token.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
})

/** For these requests a 401 is a normal answer, not an expired session. */
const SESSION_PATHS = ['/auth/login', '/auth/me', '/auth/logout']

/**
 * Calls `handler` whenever another request fails with 401, which means the
 * session has expired. Returns the function that removes the hook.
 */
export function onUnauthorized(handler: () => void): () => void {
  const id = http.interceptors.response.use(undefined, (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !SESSION_PATHS.includes(error.config?.url ?? '')
    ) {
      handler()
    }
    return Promise.reject(error)
  })
  return () => http.interceptors.response.eject(id)
}
```

`frontend/src/theme.ts`:

```ts
import { createTheme, responsiveFontSizes } from '@mui/material/styles'

/** The app theme: the brand primary colour, a soft page background and responsive type sizes. */
export const theme = responsiveFontSizes(
  createTheme({
    palette: {
      primary: { main: '#1e5eff' },
      background: { default: '#f5f7fb' },
    },
    shape: { borderRadius: 8 },
  }),
)
```

`frontend/src/components/FullPageSpinner.tsx`:

```tsx
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

/** Fills the screen while the session check runs, so the sign-in page never flashes. */
export function FullPageSpinner() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress aria-label="Loading" />
    </Box>
  )
}
```

`frontend/src/components/EmptyState.tsx`:

```tsx
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

/** Explains why there is nothing to show and offers the next step. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', py: 6, px: 2 }}>
      <Typography variant="h6" component="p">
        {title}
      </Typography>
      {description && <Typography sx={{ color: 'text.secondary' }}>{description}</Typography>}
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  )
}
```

`frontend/src/components/ErrorState.tsx`:

```tsx
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'

/** A failed load, with a Retry button. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      {message}
    </Alert>
  )
}
```

`frontend/src/components/PageHeader.tsx`:

```tsx
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

/**
 * The top of every page: an optional back link, the page's only h1 (also the
 * browser tab title), an optional chip beside it, and optional actions.
 */
export function PageHeader({
  title,
  back,
  chip,
  actions,
}: {
  title: string
  back?: ReactNode
  chip?: ReactNode
  actions?: ReactNode
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <title>{`${title} · SimpleInvoice`}</title>
      {back}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          {chip}
        </Stack>
        {actions && (
          <Stack direction="row" spacing={1}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
```

`frontend/src/components/NotFoundPage.tsx`:

```tsx
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router'
import { PageHeader } from './PageHeader'

/** Any path the app does not know. */
export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Typography sx={{ mb: 2 }}>The page you are looking for does not exist.</Typography>
      <Button variant="contained" component={RouterLink} to="/invoices">
        Go to invoices
      </Button>
    </>
  )
}
```

`frontend/src/App.tsx`:

```tsx
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { SnackbarProvider } from 'notistack'
import type { DataRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { theme } from './theme'

/**
 * The provider stack. The app (main.tsx) and the tests (renderApp) both render
 * it, so tests run the production tree with only the router swapped.
 */
export function App({ router, queryClient }: { router: DataRouter; queryClient: QueryClient }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={3}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </SnackbarProvider>
    </ThemeProvider>
  )
}
```

`frontend/src/routes.tsx`:

```tsx
import type { RouteObject } from 'react-router'
import { NotFoundPage } from './components/NotFoundPage'

/** The route table, shared by the app's browser router and the tests' memory router. */
export const routes: RouteObject[] = [{ path: '*', element: <NotFoundPage /> }]
```

`frontend/src/main.tsx`:

```tsx
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { App } from './App'
import { createQueryClient } from './queryClient'
import { routes } from './routes'

const router = createBrowserRouter(routes)
const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App router={router} queryClient={queryClient} />
  </StrictMode>,
)
```

- [ ] **Step 8: Run every check and the production build**

Run: `cd frontend && npm run format && npm test && npm run lint && npm run typecheck && npm run build`
Expected:
- 24 tests pass.
- `npm run lint` prints nothing. oxlint is silent when there is nothing to report.
- The type check passes.
- The build ends with `✓ built in …` and prints no warning about chunks larger than 500 kB.
- `dist/assets/` holds the JS chunks `rolldown-runtime-*.js`, `index-*.js`, `vendor-*.js`, `mui-*.js` and `react-*.js`.

- [ ] **Step 9: Commit**

```bash
git add frontend
git commit -m "feat(frontend): scaffold the SPA with shared UI and formatting

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 10: Sign-in, session handling and the app shell

Spec §6.1 (routes), §6.2 (session handling, ADR-0002) and §6.3 (`LoginPage`). This task adds:
- the session check on start-up;
- sign-in and logout;
- the redirect of visitors who have no session;
- one toast when the session expires;
- the signed-in layout.

It also builds the test harness that all page tests use. MSW handlers act as the API, and `renderApp` renders the whole app at a URL, as a browser does.

**Files:**
- Create: `frontend/src/test/fixtures.ts`, `frontend/src/test/msw/handlers.ts`, `frontend/src/test/msw/server.ts`, `frontend/src/test/renderApp.tsx`
- Modify: `frontend/src/test/setup.ts` (start the MSW server)
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/auth/auth-context.ts`, `frontend/src/auth/useAuth.ts`, `frontend/src/auth/AuthProvider.tsx`, `frontend/src/auth/RequireAuth.tsx`, `frontend/src/auth/LoginPage.tsx`
- Create: `frontend/src/components/AppLayout.tsx`
- Modify: `frontend/src/App.tsx` (put `AuthProvider` around the router)
- Modify: `frontend/src/routes.tsx` (add `/login` and the protected layout)
- Test: `frontend/src/auth/LoginPage.test.tsx`, `frontend/src/auth/session.test.tsx`

**Interfaces:**
- Consumes:
  - From Task 9: `http`, `onUnauthorized`, `errorStatus`, `User`, `LoginRequest`, `LoginResponse`, `App`, `createQueryClient`, `routes`, `FullPageSpinner`, `NotFoundPage`.
  - From the backend (Task 6): `POST /auth/login`; `GET /auth/me` → `UserDto`; `POST /auth/logout` → 204. A 401 body is `{ statusCode: 401, message, error: 'Unauthorized' }`. Too many sign-in attempts give 429.
- Produces:
  - `src/api/auth.ts`: `login(credentials: LoginRequest): Promise<User>`, `getCurrentUser(signal?: AbortSignal): Promise<User>`, `logout(): Promise<void>`.
  - `src/auth/auth-context.ts`:
    - `type AuthStatus = 'checking' | 'authenticated' | 'anonymous' | 'signedOut'`;
    - `interface AuthContextValue { status: AuthStatus; user: User | null; login(credentials: LoginRequest): Promise<User>; logout(): Promise<void> }`;
    - `AuthContext`.
  - `useAuth(): AuthContextValue`, `AuthProvider`, `RequireAuth({ children })`, `LoginPage`, `AppLayout`.
  - Session rules:
    - `logout()` sets `signedOut` and does not navigate. `RequireAuth` then sends the User to `/login` without `from`, so the next sign-in opens `/invoices`.
    - An expired session sets `anonymous`. `RequireAuth` then keeps `state.from`, and the next sign-in returns to that page.
  - Routes:
    - `/login`;
    - a pathless route `<RequireAuth><AppLayout /></RequireAuth>`. Its children are the index route (→ `/invoices`) and `*` → `NotFoundPage`.

    Tasks 12–14 add their pages as children of this layout route, before `*`.
  - Test helpers:
    - `userFixture: User` and `USER_PASSWORD = 'Password123!'` (`src/test/fixtures.ts`).
    - `handlers` and `server` (`src/test/msw/`). By default `GET /api/auth/me` answers 401, and only the seeded credentials sign in.
    - `renderApp(entry: InitialEntry, options?: { signedIn?: boolean })` returns the Testing Library render result plus `router` and `queryClient`. With `signedIn: true`, `GET /api/auth/me` returns `userFixture`.

- [ ] **Step 1: Build the test harness: fixtures, the MSW server and `renderApp`**

MSW intercepts the requests that axios sends in jsdom, so the tests use the real HTTP client. A request that no handler matches fails the test (`onUnhandledFrame: 'error'`).

`frontend/src/test/fixtures.ts`:

```ts
import type { User } from '../api/types'

/** The seeded default User (backend seed, spec §5.8). */
export const userFixture: User = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: 'admin@example.com',
  fullname: 'Admin User',
  createdAt: '2026-06-01T09:00:00.000Z',
}

export const USER_PASSWORD = 'Password123!'
```

`frontend/src/test/msw/handlers.ts`:

```ts
import { http, HttpResponse } from 'msw'
import type { LoginRequest } from '../../api/types'
import { USER_PASSWORD, userFixture } from '../fixtures'

const unauthorized = { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' }

/**
 * The API as every test starts with it: nobody is signed in, and the seeded
 * credentials sign in. Tests add or replace handlers with `server.use`.
 */
export const handlers = [
  http.get('/api/auth/me', () => HttpResponse.json(unauthorized, { status: 401 })),
  http.post<never, LoginRequest>('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json()
    if (email === userFixture.email && password === USER_PASSWORD) {
      return HttpResponse.json({
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: userFixture,
      })
    }
    return HttpResponse.json(
      { statusCode: 401, message: 'Invalid email or password', error: 'Unauthorized' },
      { status: 401 },
    )
  }),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
]
```

`frontend/src/test/msw/server.ts`:

```ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** The mock API for all tests (Node interceptors; no service worker). */
export const server = setupServer(...handlers)
```

`frontend/src/test/renderApp.tsx`:

```tsx
import { render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, type InitialEntry } from 'react-router'
import { App } from '../App'
import { createQueryClient } from '../queryClient'
import { routes } from '../routes'
import { userFixture } from './fixtures'
import { server } from './msw/server'

/**
 * Renders the whole app at `entry`, the way a browser would: providers,
 * session check, routes. With `signedIn`, `GET /auth/me` answers with the
 * seeded User, as it does when the session cookie is set.
 */
export function renderApp(entry: InitialEntry, { signedIn = false }: { signedIn?: boolean } = {}) {
  if (signedIn) server.use(http.get('/api/auth/me', () => HttpResponse.json(userFixture)))
  const queryClient = createQueryClient()
  // Keep failures immediate in tests; the retry policy has its own unit test.
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  })
  const router = createMemoryRouter(routes, { initialEntries: [entry] })
  const view = render(<App router={router} queryClient={queryClient} />)
  return { ...view, router, queryClient }
}
```

Replace the whole of `frontend/src/test/setup.ts` with:

```ts
import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { server } from './msw/server'

// A whole page renders only after a few mocked requests. On a busy CI machine that can take
// longer than the 1 s that findBy* and waitFor wait by default.
configure({ asyncUtilTimeout: 5_000 })

// MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`; the old key is ignored.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

- [ ] **Step 2: Write the failing tests**

`frontend/src/auth/LoginPage.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { USER_PASSWORD, userFixture } from '../test/fixtures'
import { server } from '../test/msw/server'
import { renderApp } from '../test/renderApp'

async function signInWith(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('LoginPage', () => {
  it('requires an email and a password, and checks the email format', async () => {
    const user = userEvent.setup()
    renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('signs in and opens the Invoice list', async () => {
    const { router } = renderApp('/login')

    await signInWith(userFixture.email, USER_PASSWORD)

    await waitFor(() => expect(router.state.location.pathname).toBe('/invoices'))
    expect(await screen.findByRole('button', { name: 'Account menu' })).toBeInTheDocument()
  })

  it('returns to the page that asked for a sign-in', async () => {
    const { router } = renderApp('/invoices/new?from=link')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))

    await signInWith(userFixture.email, USER_PASSWORD)

    await waitFor(() => expect(router.state.location.pathname).toBe('/invoices/new'))
    expect(router.state.location.search).toBe('?from=link')
  })

  it('says so when the credentials are wrong', async () => {
    renderApp('/login')
    await signInWith(userFixture.email, 'wrong-password')
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
  })

  it('says so when there were too many attempts', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          {
            statusCode: 429,
            message: 'Too many login attempts, please try again later',
            error: 'Too Many Requests',
          },
          { status: 429 },
        ),
      ),
    )
    renderApp('/login')
    await signInWith(userFixture.email, USER_PASSWORD)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many login attempts. Please try again later.',
    )
  })

  it('reports any other failure in general terms', async () => {
    server.use(http.post('/api/auth/login', () => new HttpResponse(null, { status: 500 })))
    renderApp('/login')
    await signInWith(userFixture.email, USER_PASSWORD)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
  })
})
```

`frontend/src/auth/session.test.tsx`:

```tsx
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mockHttp, HttpResponse } from 'msw'
import { http } from '../api/http'
import { server } from '../test/msw/server'
import { renderApp } from '../test/renderApp'

describe('session', () => {
  it('sends an anonymous visitor to the sign-in page', async () => {
    const { router } = renderApp('/invoices/new')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('shows the app to a signed-in User', async () => {
    const { router } = renderApp('/', { signedIn: true })

    expect(await screen.findByRole('button', { name: 'Account menu' })).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/invoices'))
  })

  it('signs the User out with one toast when the session expires', async () => {
    const { router } = renderApp('/invoices/new', { signedIn: true })
    await screen.findByRole('button', { name: 'Account menu' })
    server.use(
      mockHttp.get('/api/invoices', () =>
        HttpResponse.json(
          { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' },
          { status: 401 },
        ),
      ),
    )

    // Two requests fail together, as when a page loads several things at once.
    await act(() => Promise.allSettled([http.get('/invoices'), http.get('/invoices')]))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.state).toMatchObject({ from: { pathname: '/invoices/new' } })
    expect(screen.getAllByText('Your session has expired. Please sign in again.')).toHaveLength(1)
  })

  it('logs out from the account menu', async () => {
    let loggedOut = false
    server.use(
      mockHttp.post('/api/auth/logout', () => {
        loggedOut = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/invoices/new', { signedIn: true })

    await user.click(await screen.findByRole('button', { name: 'Account menu' }))
    expect(screen.getByText('Admin User')).toBeInTheDocument()
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(loggedOut).toBe(true)
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.state).toBeNull()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL with `Tests  10 failed | 24 passed (34)`. The app has no sign-in page yet, so every new test fails. Examples: `Unable to find a label with the text of: Email` and `Unable to find role="button" and name "Account menu"`.

- [ ] **Step 4: Write the session, the sign-in page and the signed-in layout**

`AuthProvider` sits outside the router, so it cannot navigate. It only changes the session state, and `RequireAuth` turns that state into a redirect. React 19 accepts `<AuthContext value={…}>` as a provider.

`frontend/src/api/auth.ts`:

```ts
import { http } from './http'
import type { LoginRequest, LoginResponse, User } from './types'

/**
 * Session endpoints (spec §5.3). The login response also carries the token for
 * API tools; the SPA ignores it, because the httpOnly cookie carries the session.
 */
export async function login(credentials: LoginRequest): Promise<User> {
  const { data } = await http.post<LoginResponse>('/auth/login', credentials)
  return data.user
}

export async function getCurrentUser(signal?: AbortSignal): Promise<User> {
  const { data } = await http.get<User>('/auth/me', { signal })
  return data
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}
```

`frontend/src/auth/auth-context.ts`:

```ts
import { createContext } from 'react'
import type { LoginRequest, User } from '../api/types'

/**
 * `anonymous`: nobody is signed in, or the session expired.
 * `signedOut`: the User logged out, so the next sign-in starts at the Invoice list.
 */
export type AuthStatus = 'checking' | 'authenticated' | 'anonymous' | 'signedOut'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  login: (credentials: LoginRequest) => Promise<User>
  logout: () => Promise<void>
}

/** The session state. AuthProvider provides it; components read it with useAuth(). */
export const AuthContext = createContext<AuthContextValue | null>(null)
```

`frontend/src/auth/useAuth.ts`:

```ts
import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './auth-context'

/** The current session. Outside AuthProvider this throws, because that is a wiring mistake. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
```

`frontend/src/auth/AuthProvider.tsx`:

```tsx
import { useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import { onUnauthorized } from '../api/http'
import type { LoginRequest, User } from '../api/types'
import { FullPageSpinner } from '../components/FullPageSpinner'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

/**
 * Owns the session (spec §6.2, ADR-0002). JavaScript cannot see the httpOnly
 * cookie, so on start-up it asks the API who is signed in. A 401 on any other
 * request means the session expired: the User is signed out, cached data is
 * dropped, and one toast explains why, even when several requests fail at once.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { enqueueSnackbar } = useSnackbar()
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    authApi.getCurrentUser(controller.signal).then(
      (current) => {
        setUser(current)
        setStatus('authenticated')
      },
      () => {
        if (controller.signal.aborted) return
        setUser(null)
        setStatus('anonymous')
      },
    )
    return () => controller.abort()
  }, [])

  useEffect(
    () =>
      onUnauthorized(() => {
        setUser(null)
        setStatus('anonymous')
        queryClient.clear()
        enqueueSnackbar('Your session has expired. Please sign in again.', {
          key: 'session-expired',
          preventDuplicate: true,
          variant: 'warning',
        })
      }),
    [queryClient, enqueueSnackbar],
  )

  const login = useCallback(async (credentials: LoginRequest) => {
    const signedIn = await authApi.login(credentials)
    setUser(signedIn)
    setStatus('authenticated')
    return signedIn
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Sign out locally even when the API is unreachable; the cookie expires by itself.
    }
    queryClient.clear()
    setUser(null)
    setStatus('signedOut')
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout }),
    [status, user, login, logout],
  )

  if (status === 'checking') return <FullPageSpinner />
  return <AuthContext value={value}>{children}</AuthContext>
}
```

`frontend/src/auth/RequireAuth.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './useAuth'

/**
 * Guards the signed-in part of the app. A visitor without a session goes to
 * /login, which brings them back here after they sign in. After a logout there
 * is nothing to come back to, so the next sign-in opens the Invoice list.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status !== 'authenticated') {
    const state = status === 'signedOut' ? undefined : { from: location }
    return <Navigate to="/login" replace state={state} />
  }
  return children
}
```

`frontend/src/auth/LoginPage.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useMutation } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { Navigate, useLocation, type Location } from 'react-router'
import { z } from 'zod'
import { errorStatus } from '../api/errors'
import { useAuth } from './useAuth'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

function loginErrorMessage(error: unknown): string {
  switch (errorStatus(error)) {
    case 401:
      return 'Invalid email or password.'
    case 429:
      return 'Too many login attempts. Please try again later.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

/** After signing in: back to the page that asked for it, or the Invoice list. */
function redirectTarget(state: unknown): string {
  const from = (state as { from?: Location } | null)?.from
  return from ? `${from.pathname}${from.search}${from.hash}` : '/invoices'
}

/** The sign-in screen (spec §6.3). A signed-in User is sent on to the app. */
export function LoginPage() {
  const { status, login } = useAuth()
  const location = useLocation()
  const { control, handleSubmit } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const mutation = useMutation({ mutationFn: login })

  if (status === 'authenticated') {
    return <Navigate to={redirectTarget(location.state)} replace />
  }

  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <title>Sign in · SimpleInvoice</title>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 420 }}>
        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700 }}>
          SimpleInvoice
        </Typography>
        <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
          Sign in
        </Typography>
        <Stack
          component="form"
          noValidate
          spacing={2}
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          {mutation.isError && <Alert severity="error">{loginErrorMessage(mutation.error)}</Alert>}
          <Controller
            name="email"
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <TextField
                {...field}
                inputRef={ref}
                label="Email"
                type="email"
                autoComplete="username"
                fullWidth
                error={fieldState.invalid}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="password"
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <TextField
                {...field}
                inputRef={ref}
                label="Password"
                type="password"
                autoComplete="current-password"
                fullWidth
                error={fieldState.invalid}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Button type="submit" variant="contained" size="large" loading={mutation.isPending}>
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
```

`frontend/src/components/AppLayout.tsx`:

```tsx
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import AddIcon from '@mui/icons-material/Add'
import LogoutIcon from '@mui/icons-material/Logout'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import AppBar from '@mui/material/AppBar'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useState } from 'react'
import { Outlet, Link as RouterLink } from 'react-router'
import { useAuth } from '../auth/useAuth'

/**
 * The signed-in shell (spec §6.1): an app bar with the navigation and the
 * account menu, and the current page below it. On small screens the
 * navigation moves into the account menu.
 */
export function AppLayout() {
  const { user, logout } = useAuth()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const closeMenu = () => setMenuAnchor(null)

  function handleLogout() {
    closeMenu()
    // RequireAuth then sends the User to /login.
    void logout()
  }

  return (
    <>
      <AppBar position="sticky" elevation={0}>
        <Toolbar>
          <Link
            component={RouterLink}
            to="/invoices"
            variant="h6"
            color="inherit"
            underline="none"
            sx={{ fontWeight: 700, flexGrow: 1 }}
          >
            SimpleInvoice
          </Link>
          {!isMobile && (
            <Stack direction="row" spacing={1} sx={{ mr: 1 }}>
              <Button color="inherit" component={RouterLink} to="/invoices">
                Invoices
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/invoices/new"
                startIcon={<AddIcon />}
              >
                New invoice
              </Button>
            </Stack>
          )}
          <IconButton
            color="inherit"
            aria-label="Account menu"
            aria-controls={menuAnchor ? 'account-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={menuAnchor ? 'true' : undefined}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
          >
            <AccountCircleIcon />
          </IconButton>
          <Menu
            id="account-menu"
            anchorEl={menuAnchor}
            open={menuAnchor !== null}
            onClose={closeMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <ListSubheader sx={{ lineHeight: 1.5, py: 1 }}>
              <Typography sx={{ color: 'text.primary', fontWeight: 500 }}>
                {user?.fullname}
              </Typography>
              <Typography variant="body2">{user?.email}</Typography>
            </ListSubheader>
            <Divider />
            {isMobile && [
              <MenuItem key="invoices" component={RouterLink} to="/invoices" onClick={closeMenu}>
                <ListItemIcon>
                  <ReceiptLongIcon fontSize="small" />
                </ListItemIcon>
                Invoices
              </MenuItem>,
              <MenuItem key="new" component={RouterLink} to="/invoices/new" onClick={closeMenu}>
                <ListItemIcon>
                  <AddIcon fontSize="small" />
                </ListItemIcon>
                New invoice
              </MenuItem>,
              <Divider key="divider" />,
            ]}
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Log out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
        <Outlet />
      </Container>
    </>
  )
}
```

Replace the whole of `frontend/src/App.tsx` with:

```tsx
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { SnackbarProvider } from 'notistack'
import type { DataRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from './auth/AuthProvider'
import { theme } from './theme'

/**
 * The provider stack. The app (main.tsx) and the tests (renderApp) both render
 * it, so tests run the production tree with only the router swapped.
 */
export function App({ router, queryClient }: { router: DataRouter; queryClient: QueryClient }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={3}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
      </SnackbarProvider>
    </ThemeProvider>
  )
}
```

Replace the whole of `frontend/src/routes.tsx` with:

```tsx
import { Navigate, type RouteObject } from 'react-router'
import { LoginPage } from './auth/LoginPage'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { NotFoundPage } from './components/NotFoundPage'

/** The route table (spec §6.1), shared by the app's browser router and the tests' memory router. */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/invoices" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (7 test files, 34 tests).

- [ ] **Step 6: Run every check and the production build**

Run: `cd frontend && npm run format && npm test && npm run lint && npm run typecheck && npm run build`
Expected:
- 34 tests pass.
- `npm run lint` prints nothing. oxlint is silent when there is nothing to report.
- The type check passes.
- The build ends with `✓ built in …` and prints no warning about chunks larger than 500 kB.

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "feat(frontend): sign-in, session handling and the app shell

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 11: URL-driven Invoice list state and the Invoice API client

Spec §6.3 (`InvoiceListPage`, the "State" rules). The URL query string is the only source of truth for the list: `page`, `pageSize`, `sortBy`, `ordering`, `status`, `keyword`, `fromDate` and `toDate`. This task adds:
- the parser that turns any URL into valid list parameters;
- the hook that reads these parameters and writes them back to the URL;
- the debounce hook for the search;
- the Invoice endpoints and their TanStack Query keys.

Task 12 builds the page on top of these.

**Files:**
- Modify: `frontend/src/lib/dates.ts` (add `isIsoDate`)
- Modify: `frontend/src/lib/dates.test.ts`
- Create: `frontend/src/api/invoices.ts`
- Create: `frontend/src/features/invoices/listParams.ts`
- Create: `frontend/src/features/invoices/hooks/useDebouncedValue.ts`, `frontend/src/features/invoices/hooks/useInvoiceListParams.ts`
- Test: `frontend/src/api/invoices.test.ts`, `frontend/src/features/invoices/listParams.test.ts`, `frontend/src/features/invoices/hooks/useDebouncedValue.test.ts`, `frontend/src/features/invoices/hooks/useInvoiceListParams.test.tsx`

**Interfaces:**
- Consumes:
  - From Task 9: `http`, `Invoice`, `InvoiceListQuery`, `InvoiceListResponse`, `CreateInvoiceRequest`, `InvoiceStatus`, `SortField`.
  - From Task 10: `server`.
  - From the backend (Tasks 7–8), `GET /invoices` accepts:
    - `page` ≥ 1 and `pageSize` from 1 to 100;
    - `sortBy`: `invoiceDate`, `dueDate` or `totalAmount`;
    - `ordering`: `ASC` or `DESC` (the default is `DESC`);
    - `status`: `Draft`, `Pending`, `Paid` or `Overdue`;
    - a `keyword` of at most 100 characters;
    - `fromDate` and `toDate` as `YYYY-MM-DD`, with `toDate` ≥ `fromDate`.

    The backend also serves `GET /invoices/:invoiceId` and `POST /invoices`.
- Produces:
  - `src/lib/dates.ts` also exports `isIsoDate(value: string): boolean`: true only for a real calendar date in `YYYY-MM-DD` form.
  - `src/api/invoices.ts`:
    - `invoiceKeys.all` is `['invoices']`, `invoiceKeys.list(query)` is `['invoices', 'list', query]` and `invoiceKeys.detail(invoiceId)` is `['invoices', 'detail', invoiceId]`.
    - `listInvoices(query: InvoiceListQuery, signal?: AbortSignal): Promise<InvoiceListResponse>`.
    - `getInvoice(invoiceId: string, signal?: AbortSignal): Promise<Invoice>`.
    - `createInvoice(body: CreateInvoiceRequest): Promise<Invoice>`.
  - `src/features/invoices/listParams.ts`:
    - `type InvoiceListParams = InvoiceListQuery`;
    - `PAGE_SIZES` (`[10, 20, 50, 100]`), `DEFAULT_PAGE_SIZE = 10`, `KEYWORD_MAX_LENGTH = 100`, `SORT_FIELDS`, `STATUS_OPTIONS`;
    - `parseListParams(searchParams: URLSearchParams): InvoiceListParams`;
    - `toSearchParams(params: InvoiceListParams): URLSearchParams`, which leaves default values out of the URL;
    - `hasActiveFilters(params: InvoiceListParams): boolean`. A filter is a Status, a keyword or a date. Sorting and paging are not filters.
  - `useDebouncedValue<T>(value: T, delayMs: number): T`.
  - `useInvoiceListParams()` returns:
    - `params: InvoiceListParams`;
    - `update(changes: Partial<InvoiceListParams>, options?: { replace?: boolean }): void`, which goes back to page 1 unless `changes` contains `page`;
    - `clearFilters(): void`, which keeps `pageSize`, `sortBy` and `ordering`.

- [ ] **Step 1: Write the failing tests**

Replace the whole of `frontend/src/lib/dates.test.ts` with:

```ts
import { addDaysIso, isIsoDate, todayIsoDate } from './dates'

describe('todayIsoDate', () => {
  it('returns the local calendar date as YYYY-MM-DD', () => {
    expect(todayIsoDate(new Date('2026-10-02T23:59:59Z'))).toBe('2026-10-02')
  })
})

describe('addDaysIso', () => {
  it('adds days across month and year ends', () => {
    expect(addDaysIso('2026-10-02', 30)).toBe('2026-11-01')
    expect(addDaysIso('2026-12-15', 30)).toBe('2027-01-14')
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('isIsoDate', () => {
  it.each(['2026-06-03', '2028-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isIsoDate(value)).toBe(true)
  })

  it.each(['2026-02-30', '2027-02-29', '2026-13-01', '2026-6-3', '03/06/2026', ''])(
    'rejects %j',
    (value) => {
      expect(isIsoDate(value)).toBe(false)
    },
  )
})
```

`frontend/src/api/invoices.test.ts`:

```ts
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw/server'
import { createInvoice, getInvoice, invoiceKeys, listInvoices } from './invoices'
import type { CreateInvoiceRequest } from './types'

describe('invoice API', () => {
  it('sends the list query without unset filters', async () => {
    let url: URL | undefined
    server.use(
      http.get('/api/invoices', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ data: [], paging: { page: 2, pageSize: 20, total: 0 } })
      }),
    )

    const result = await listInvoices({
      page: 2,
      pageSize: 20,
      ordering: 'ASC',
      sortBy: 'dueDate',
      status: 'Overdue',
      keyword: undefined,
    })

    expect(result.paging).toEqual({ page: 2, pageSize: 20, total: 0 })
    expect(Object.fromEntries(url!.searchParams)).toEqual({
      page: '2',
      pageSize: '20',
      ordering: 'ASC',
      sortBy: 'dueDate',
      status: 'Overdue',
    })
  })

  it('escapes the Invoice id in the detail path', async () => {
    let path: string | undefined
    server.use(
      http.get('/api/invoices/*', ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json({ invoiceId: 'a/b' })
      }),
    )

    await getInvoice('a/b')

    expect(path).toBe('/api/invoices/a%2Fb')
  })

  it('posts a new Invoice as JSON', async () => {
    let received: unknown
    server.use(
      http.post('/api/invoices', async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({ invoiceNumber: 'INV-1' }, { status: 201 })
      }),
    )
    const body: CreateInvoiceRequest = {
      customer: { fullname: 'Paul', email: 'paul@101digital.io' },
      invoiceNumber: 'INV-1',
      invoiceDate: '2026-10-02',
      dueDate: '2026-11-01',
      currency: 'AUD',
      items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
      taxRate: 10,
      discount: 0,
    }

    await expect(createInvoice(body)).resolves.toEqual({ invoiceNumber: 'INV-1' })
    expect(received).toEqual(body)
  })

  it('nests every query key under the same root', () => {
    const query = { page: 1, pageSize: 10, ordering: 'DESC' as const }
    expect(invoiceKeys.list(query)).toEqual(['invoices', 'list', query])
    expect(invoiceKeys.detail('id-1')).toEqual(['invoices', 'detail', 'id-1'])
  })
})
```

`frontend/src/features/invoices/listParams.test.ts`:

```ts
import {
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  type InvoiceListParams,
} from './listParams'

const DEFAULTS: InvoiceListParams = { page: 1, pageSize: 10, ordering: 'DESC' }

const parse = (query: string) => parseListParams(new URLSearchParams(query))

describe('parseListParams', () => {
  it('uses the defaults for an empty query', () => {
    expect(parse('')).toEqual(DEFAULTS)
  })

  it('reads every parameter', () => {
    expect(
      parse(
        'page=3&pageSize=50&sortBy=totalAmount&ordering=ASC&status=Overdue' +
          '&keyword=%20Kanglee%20&fromDate=2026-01-01&toDate=2026-12-31',
      ),
    ).toEqual({
      page: 3,
      pageSize: 50,
      sortBy: 'totalAmount',
      ordering: 'ASC',
      status: 'Overdue',
      keyword: 'Kanglee',
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    })
  })

  it('falls back to the default for each invalid value', () => {
    expect(
      parse(
        'page=0&pageSize=7&sortBy=customer&ordering=sideways&status=Lost' +
          '&keyword=%20%20&fromDate=2026-02-30&toDate=yesterday',
      ),
    ).toEqual(DEFAULTS)
    expect(parse('page=1.5&pageSize=abc')).toEqual(DEFAULTS)
    expect(parse(`keyword=${'a'.repeat(101)}`)).toEqual(DEFAULTS)
  })

  it('drops an end date before the start date', () => {
    expect(parse('fromDate=2026-06-01&toDate=2026-05-31')).toEqual({
      ...DEFAULTS,
      fromDate: '2026-06-01',
    })
  })
})

describe('toSearchParams', () => {
  it('leaves the defaults out', () => {
    expect(toSearchParams(DEFAULTS).toString()).toBe('')
  })

  it('writes the other values in a fixed order', () => {
    const params: InvoiceListParams = {
      toDate: '2026-12-31',
      fromDate: '2026-01-01',
      keyword: 'Kanglee Trading',
      status: 'Paid',
      ordering: 'ASC',
      sortBy: 'dueDate',
      pageSize: 20,
      page: 2,
    }

    const search = toSearchParams(params)

    expect(search.toString()).toBe(
      'page=2&pageSize=20&sortBy=dueDate&ordering=ASC&status=Paid' +
        '&keyword=Kanglee+Trading&fromDate=2026-01-01&toDate=2026-12-31',
    )
    expect(parseListParams(search)).toEqual(params)
  })
})

describe('hasActiveFilters', () => {
  it('ignores sorting and paging', () => {
    expect(hasActiveFilters({ ...DEFAULTS, page: 4, sortBy: 'dueDate', ordering: 'ASC' })).toBe(
      false,
    )
  })

  it.each([
    { status: 'Draft' as const },
    { keyword: 'IV' },
    { fromDate: '2026-01-01' },
    { toDate: '2026-01-31' },
  ])('is true for %j', (filter) => {
    expect(hasActiveFilters({ ...DEFAULTS, ...filter })).toBe(true)
  })
})
```

`frontend/src/features/invoices/hooks/useDebouncedValue.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('follows the value only after it stops changing', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'I' },
    })
    rerender({ value: 'IV' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: 'IV1' })
    act(() => vi.advanceTimersByTime(299))

    expect(result.current).toBe('I')

    act(() => vi.advanceTimersByTime(1))

    expect(result.current).toBe('IV1')
  })
})
```

`frontend/src/features/invoices/hooks/useInvoiceListParams.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router'
import { useInvoiceListParams } from './useInvoiceListParams'

function setup(entry: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  )
  return renderHook(
    () => ({
      ...useInvoiceListParams(),
      search: useLocation().search,
      navigationType: useNavigationType(),
    }),
    { wrapper },
  )
}

describe('useInvoiceListParams', () => {
  it('reads the list state from the URL', () => {
    const { result } = setup('/invoices?page=3&status=Paid')

    expect(result.current.params).toEqual({
      page: 3,
      pageSize: 10,
      ordering: 'DESC',
      status: 'Paid',
    })
  })

  it('goes back to page 1 when a filter changes', () => {
    const { result } = setup('/invoices?page=3&pageSize=20')

    act(() => result.current.update({ status: 'Overdue' }))

    expect(result.current.search).toBe('?pageSize=20&status=Overdue')
    expect(result.current.navigationType).toBe('PUSH')
  })

  it('keeps the filters when only the page changes', () => {
    const { result } = setup('/invoices?status=Paid')

    act(() => result.current.update({ page: 2 }))

    expect(result.current.search).toBe('?page=2&status=Paid')
  })

  it('can replace the history entry instead of adding one', () => {
    const { result } = setup('/invoices')

    act(() => result.current.update({ keyword: 'IV178' }, { replace: true }))

    expect(result.current.search).toBe('?keyword=IV178')
    expect(result.current.navigationType).toBe('REPLACE')
  })

  it('clears the filters but keeps the sort and page size', () => {
    const { result } = setup(
      '/invoices?page=2&pageSize=50&sortBy=dueDate&ordering=ASC&status=Paid' +
        '&keyword=Kanglee&fromDate=2026-01-01&toDate=2026-06-30',
    )

    act(() => result.current.clearFilters())

    expect(result.current.search).toBe('?pageSize=50&sortBy=dueDate&ordering=ASC')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL with `Tests  9 failed | 34 passed (43)`. These failures occur:
- Four new test files cannot load their modules: `Failed to resolve import "./invoices"`, `"./listParams"`, `"./useDebouncedValue"` and `"./useInvoiceListParams"`.
- The 9 new `isIsoDate` cases fail with `TypeError: isIsoDate is not a function`.

- [ ] **Step 3: Write the date check, the Invoice API client, the list parameters and the two hooks**

Replace the whole of `frontend/src/lib/dates.ts` with:

```ts
/** Calendar-date helpers for form defaults. Dates are `YYYY-MM-DD` strings, as the API uses them. */

/** Today's date in the viewer's time zone. */
export function todayIsoDate(now: Date = new Date()): string {
  // Shift by the zone offset so the UTC fields equal the local ones.
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** Adds whole days to a date. Computed in UTC, so a daylight-saving change never skips a day. */
export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** True for a real calendar date in `YYYY-MM-DD` form, so `2026-02-30` is rejected, as the API does. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}
```

`frontend/src/api/invoices.ts`:

```ts
import { http } from './http'
import type { CreateInvoiceRequest, Invoice, InvoiceListQuery, InvoiceListResponse } from './types'

/**
 * Invoice endpoints (spec §5.3) and their TanStack Query keys. Every key
 * starts with `invoiceKeys.all`, so one invalidation refreshes every list and
 * detail after an Invoice is created.
 */
export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (query: InvoiceListQuery) => [...invoiceKeys.all, 'list', query] as const,
  detail: (invoiceId: string) => [...invoiceKeys.all, 'detail', invoiceId] as const,
}

/** One page of Invoices. axios leaves unset (undefined) filters out of the query string. */
export async function listInvoices(
  query: InvoiceListQuery,
  signal?: AbortSignal,
): Promise<InvoiceListResponse> {
  const { data } = await http.get<InvoiceListResponse>('/invoices', { params: query, signal })
  return data
}

export async function getInvoice(invoiceId: string, signal?: AbortSignal): Promise<Invoice> {
  const { data } = await http.get<Invoice>(`/invoices/${encodeURIComponent(invoiceId)}`, {
    signal,
  })
  return data
}

export async function createInvoice(body: CreateInvoiceRequest): Promise<Invoice> {
  const { data } = await http.post<Invoice>('/invoices', body)
  return data
}
```

`frontend/src/features/invoices/listParams.ts`:

```ts
import { z } from 'zod'
import type { InvoiceListQuery, InvoiceStatus, SortField } from '../../api/types'
import { isIsoDate } from '../../lib/dates'

/**
 * The Invoice list's state lives in the URL query string (spec §6.3), so a
 * list can be bookmarked, shared and restored with the back button. This
 * module converts between the two. A value the API would reject (a typo, a
 * hand-edited URL) falls back to its default instead of breaking the page.
 */

export type InvoiceListParams = InvoiceListQuery

export const PAGE_SIZES: readonly number[] = [10, 20, 50, 100]
export const DEFAULT_PAGE_SIZE = 10
export const KEYWORD_MAX_LENGTH = 100
export const SORT_FIELDS = [
  'invoiceDate',
  'dueDate',
  'totalAmount',
] as const satisfies readonly SortField[]
export const STATUS_OPTIONS = [
  'Draft',
  'Pending',
  'Paid',
  'Overdue',
] as const satisfies readonly InvoiceStatus[]

const isoDate = z.string().refine(isIsoDate).optional().catch(undefined)

const paramsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .refine((size) => PAGE_SIZES.includes(size))
    .catch(DEFAULT_PAGE_SIZE),
  sortBy: z.enum(SORT_FIELDS).optional().catch(undefined),
  ordering: z.enum(['ASC', 'DESC']).catch('DESC'),
  status: z.enum(STATUS_OPTIONS).optional().catch(undefined),
  keyword: z
    .string()
    .trim()
    .max(KEYWORD_MAX_LENGTH)
    .transform((keyword) => keyword || undefined)
    .optional()
    .catch(undefined),
  fromDate: isoDate,
  toDate: isoDate,
})

export function parseListParams(searchParams: URLSearchParams): InvoiceListParams {
  const params = paramsSchema.parse(Object.fromEntries(searchParams))
  // The API rejects a range that ends before it starts; keep only its start.
  if (params.fromDate && params.toDate && params.toDate < params.fromDate) {
    params.toDate = undefined
  }
  return params
}

/** The URL for `params`: defaults are left out, so the plain list stays at `/invoices`. */
export function toSearchParams(params: InvoiceListParams): URLSearchParams {
  const search = new URLSearchParams()
  if (params.page !== 1) search.set('page', String(params.page))
  if (params.pageSize !== DEFAULT_PAGE_SIZE) search.set('pageSize', String(params.pageSize))
  if (params.sortBy) search.set('sortBy', params.sortBy)
  if (params.ordering !== 'DESC') search.set('ordering', params.ordering)
  if (params.status) search.set('status', params.status)
  if (params.keyword) search.set('keyword', params.keyword)
  if (params.fromDate) search.set('fromDate', params.fromDate)
  if (params.toDate) search.set('toDate', params.toDate)
  return search
}

/** True when the list is narrowed by a filter. Sorting and paging are not filters. */
export function hasActiveFilters(params: InvoiceListParams): boolean {
  return Boolean(params.status || params.keyword || params.fromDate || params.toDate)
}
```

`frontend/src/features/invoices/hooks/useDebouncedValue.ts`:

```ts
import { useEffect, useState } from 'react'

/** `value`, once it has stopped changing for `delayMs`. Used to send a search after typing pauses. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
```

`frontend/src/features/invoices/hooks/useInvoiceListParams.ts`:

```ts
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { parseListParams, toSearchParams, type InvoiceListParams } from '../listParams'

/**
 * The Invoice list's state, read from and written to the URL (spec §6.3).
 * Any change other than the page itself starts again at page 1, because the
 * old page number means nothing for a new filter or sort.
 */
export function useInvoiceListParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseListParams(searchParams), [searchParams])

  const update = useCallback(
    (changes: Partial<InvoiceListParams>, { replace = false }: { replace?: boolean } = {}) => {
      const next = { ...params, ...changes }
      if (!('page' in changes)) next.page = 1
      setSearchParams(toSearchParams(next), { replace })
    },
    [params, setSearchParams],
  )

  const clearFilters = useCallback(() => {
    const { pageSize, sortBy, ordering } = params
    setSearchParams(toSearchParams({ page: 1, pageSize, sortBy, ordering }))
  }, [params, setSearchParams])

  return { params, update, clearFilters }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (11 test files, 64 tests).

- [ ] **Step 5: Run the format, lint and type checks**

Run: `cd frontend && npm run format && npm run lint && npm run typecheck`
Expected: all pass. `npm run lint` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat(frontend): URL-driven Invoice list state and API client

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 12: The Invoice list page

Spec §6.3 (`InvoiceListPage`) and §6.4, for the assessment's list requirements (A§2.1.2). The page has:
- a debounced search;
- the Status filter, which includes Overdue;
- sorting by a column header or by the Sort controls;
- server-side paging;
- an Invoice Date range;
- loading, empty and error states;
- a card layout for phones.

Every control writes to the URL (Task 11). The browser's back button and a shared link therefore restore the same list.

**Files:**
- Create: `frontend/src/test/mockMatchMedia.ts`
- Modify: `frontend/src/test/fixtures.ts` (add `appendixAInvoice` and `makeInvoice`)
- Modify: `frontend/src/test/msw/handlers.ts` (by default, `GET /api/invoices` returns an empty page)
- Create: `frontend/src/features/invoices/hooks/useInvoiceList.ts`
- Create: `linkState.ts`, `SearchField.tsx`, `InvoiceFilters.tsx`, `InvoiceTable.tsx`, `InvoiceCards.tsx` and `InvoiceListPage.tsx`, all in `frontend/src/features/invoices/list/`
- Modify: `frontend/src/routes.tsx` (add `invoices`)
- Test: `frontend/src/features/invoices/list/InvoiceListPage.test.tsx`

**Interfaces:**
- Consumes:
  - From Task 11: `useInvoiceListParams`, `PAGE_SIZES`, `SORT_FIELDS`, `STATUS_OPTIONS`, `KEYWORD_MAX_LENGTH`, `hasActiveFilters`, `InvoiceListParams`, `useDebouncedValue`, `invoiceKeys`, `listInvoices`.
  - From Task 9: `StatusChip`, `EmptyState`, `ErrorState`, `PageHeader`, `formatMoney`, `formatDate`.
  - From Task 10: `renderApp`, `server`, `userFixture`.
- Produces:
  - `useInvoiceList(params: InvoiceListQuery)`: the TanStack query with the key `invoiceKeys.list(params)` and `placeholderData: keepPreviousData`.
  - `InvoiceLinkState { listSearch: string }` (`list/linkState.ts`): the location state that each link to a detail page carries. It holds the list's query string, so the detail page's back link restores the list (Task 13).
  - `SearchField`, `InvoiceFilters`, `InvoiceTable`, `InvoiceCards` and `InvoiceListPage`, and the route `invoices` → `InvoiceListPage`.
  - Test helpers:
    - `mockMatchMedia(width: number)`: a `matchMedia` for jsdom that answers as a screen `width` pixels wide (390 is a phone).
    - `appendixAInvoice: Invoice`: the Invoice of the assessment's Appendix A, as the API serves it.
    - `makeInvoice(n: number, overrides?: Partial<Invoice>): Invoice`: a distinct Invoice, `INV-0001`, `INV-0002`, and so on, for the Customer `Customer 0001`, `Customer 0002`, and so on.

- [ ] **Step 1: Add the test helpers and the default Invoice list**

`frontend/src/test/mockMatchMedia.ts`:

```ts
/**
 * jsdom has no `matchMedia`, so MUI's `useMediaQuery` reports false and every
 * test renders the desktop layout. This stub answers the min-width and
 * max-width queries MUI's breakpoints use, for a viewport `width` pixels wide.
 * The test config's `unstubGlobals` removes it after each test.
 */
export function mockMatchMedia(width: number) {
  const matches = (query: string) => {
    const min = /min-width:\s*([\d.]+)px/.exec(query)
    const max = /max-width:\s*([\d.]+)px/.exec(query)
    return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]))
  }
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}
```

Replace the whole of `frontend/src/test/fixtures.ts` with:

```ts
import type { Invoice, User } from '../api/types'

/** The seeded default User (backend seed, spec §5.8). */
export const userFixture: User = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: 'admin@example.com',
  fullname: 'Admin User',
  createdAt: '2026-06-01T09:00:00.000Z',
}

export const USER_PASSWORD = 'Password123!'

/** The Invoice from the assessment's Appendix A, exactly as the API serves it (spec §5.3). */
export const appendixAInvoice: Invoice = {
  invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  currencySymbol: 'AU$',
  description: 'Invoice is issued to Kanglee',
  status: 'Overdue',
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  items: [
    {
      id: 'b1c2d3e4-0000-0000-0000-000000000001',
      name: 'Honda RC150',
      quantity: 2,
      rate: 1000,
      amount: 2000,
    },
  ],
  taxRate: 10,
  invoiceSubTotal: 2000,
  totalTax: 200,
  totalDiscount: 20,
  totalAmount: 2180,
  totalPaid: 1451.34,
  balanceAmount: 728.66,
  createdAt: '2026-06-03T12:03:26.995Z',
  createdBy: userFixture.id,
}

/** The `n`th of a series of distinct Invoices: `INV-0001`, `INV-0002`, … */
export function makeInvoice(n: number, overrides: Partial<Invoice> = {}): Invoice {
  const number = String(n).padStart(4, '0')
  return {
    ...appendixAInvoice,
    invoiceId: `00000000-0000-4000-8000-00000000${number}`,
    invoiceNumber: `INV-${number}`,
    customer: { ...appendixAInvoice.customer, fullname: `Customer ${number}` },
    ...overrides,
  }
}
```

Replace the whole of `frontend/src/test/msw/handlers.ts` with:

```ts
import { http, HttpResponse } from 'msw'
import type { LoginRequest } from '../../api/types'
import { USER_PASSWORD, userFixture } from '../fixtures'

const unauthorized = { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' }

/**
 * The API as every test starts with it: nobody is signed in, the seeded
 * credentials sign in, and there are no Invoices. Tests add or replace
 * handlers with `server.use`.
 */
export const handlers = [
  http.get('/api/auth/me', () => HttpResponse.json(unauthorized, { status: 401 })),
  http.post<never, LoginRequest>('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json()
    if (email === userFixture.email && password === USER_PASSWORD) {
      return HttpResponse.json({
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: userFixture,
      })
    }
    return HttpResponse.json(
      { statusCode: 401, message: 'Invalid email or password', error: 'Unauthorized' },
      { status: 401 },
    )
  }),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/invoices', () =>
    HttpResponse.json({ data: [], paging: { page: 1, pageSize: 10, total: 0 } }),
  ),
]
```

- [ ] **Step 2: Write the failing test**

`serveInvoices` records the query of each `GET /api/invoices` request. The tests can therefore assert the exact query that the page sends.

`frontend/src/features/invoices/list/InvoiceListPage.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { Invoice } from '../../../api/types'
import { appendixAInvoice, makeInvoice } from '../../../test/fixtures'
import { mockMatchMedia } from '../../../test/mockMatchMedia'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'

/**
 * Serves `GET /api/invoices` from `invoices`, paged the way the API pages
 * them, and records the query of every request.
 */
function serveInvoices(invoices: Invoice[]) {
  const requests: Array<Record<string, string>> = []
  server.use(
    http.get('/api/invoices', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams)
      requests.push(query)
      const page = Number(query.page)
      const pageSize = Number(query.pageSize)
      return HttpResponse.json({
        data: invoices.slice((page - 1) * pageSize, page * pageSize),
        paging: { page, pageSize, total: invoices.length },
      })
    }),
  )
  return requests
}

const DEFAULT_QUERY = { page: '1', pageSize: '10', ordering: 'DESC' }
const manyInvoices = Array.from({ length: 25 }, (_, index) => makeInvoice(index + 1))

describe('InvoiceListPage', () => {
  it('shows the Invoices the API returns', async () => {
    const requests = serveInvoices([appendixAInvoice])
    renderApp('/invoices', { signedIn: true })

    const link = await screen.findByRole('link', { name: 'IV1780488206995' })
    const cells = within(link.closest('tr')!).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'IV1780488206995',
      'Paul',
      '03 Jun 2026',
      '03 Jul 2026',
      'AU$2,180.00',
      'Overdue',
    ])
    expect(screen.getByRole('heading', { level: 1, name: 'Invoices' })).toBeInTheDocument()
    expect(requests).toEqual([DEFAULT_QUERY])
  })

  it('searches once typing pauses', async () => {
    const requests = serveInvoices([appendixAInvoice])
    const user = userEvent.setup()
    const { router } = renderApp('/invoices', { signedIn: true })
    await screen.findByRole('link', { name: 'IV1780488206995' })

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'iv178')

    await waitFor(() => expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, keyword: 'iv178' }))
    expect(requests.filter((query) => query.keyword)).toHaveLength(1)
    expect(router.state.location.search).toBe('?keyword=iv178')
  })

  it('filters by Status and starts again at page 1', async () => {
    const requests = serveInvoices(manyInvoices)
    const user = userEvent.setup()
    const { router } = renderApp('/invoices?page=2', { signedIn: true })
    await screen.findByRole('link', { name: 'INV-0011' })

    await user.click(screen.getByRole('combobox', { name: 'Status' }))
    await user.click(screen.getByRole('option', { name: 'Overdue' }))

    await waitFor(() => expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, status: 'Overdue' }))
    expect(router.state.location.search).toBe('?status=Overdue')
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Overdue')
  })

  it('sorts by a column header and toggles the order', async () => {
    const requests = serveInvoices([appendixAInvoice])
    const user = userEvent.setup()
    renderApp('/invoices', { signedIn: true })

    await user.click(await screen.findByRole('button', { name: 'Total' }))

    await waitFor(() =>
      expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, sortBy: 'totalAmount', ordering: 'ASC' }),
    )
    expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Total amount')
    expect(screen.getByRole('button', { name: 'Ascending' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Total' }))

    await waitFor(() =>
      expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, sortBy: 'totalAmount' }),
    )
    expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  })

  it('pages through the results and changes the page size', async () => {
    const requests = serveInvoices(manyInvoices)
    const user = userEvent.setup()
    const { router } = renderApp('/invoices', { signedIn: true })
    await screen.findByRole('link', { name: 'INV-0001' })

    await user.click(screen.getByRole('button', { name: 'Go to next page' }))

    expect(await screen.findByRole('link', { name: 'INV-0011' })).toBeInTheDocument()
    expect(screen.getByText('11–20 of 25')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?page=2')

    await user.click(screen.getByRole('combobox', { name: 'Rows per page:' }))
    await user.click(screen.getByRole('option', { name: '20' }))

    expect(await screen.findByText('1–20 of 25')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?pageSize=20')
    expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, pageSize: '20' })
  })

  it('restores every control from the URL', async () => {
    const requests = serveInvoices([appendixAInvoice])
    renderApp(
      '/invoices?pageSize=20&sortBy=dueDate&ordering=ASC&status=Overdue&keyword=Paul' +
        '&fromDate=2026-01-01&toDate=2026-12-31',
      { signedIn: true },
    )

    await screen.findByRole('link', { name: 'IV1780488206995' })
    expect(requests).toEqual([
      {
        page: '1',
        pageSize: '20',
        sortBy: 'dueDate',
        ordering: 'ASC',
        status: 'Overdue',
        keyword: 'Paul',
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
      },
    ])
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('Paul')
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Overdue')
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Due date')
    expect(screen.getByRole('button', { name: 'Ascending' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Invoice date from')).toHaveValue('2026-01-01')
    expect(screen.getByLabelText('Invoice date to')).toHaveValue('2026-12-31')
    expect(screen.getByRole('combobox', { name: 'Rows per page:' })).toHaveTextContent('20')
  })

  it('clears the filters but keeps the sort', async () => {
    serveInvoices([appendixAInvoice])
    const user = userEvent.setup()
    const { router } = renderApp('/invoices?sortBy=dueDate&status=Paid&keyword=Paul', {
      signedIn: true,
    })
    await screen.findByRole('link', { name: 'IV1780488206995' })

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => expect(router.state.location.search).toBe('?sortBy=dueDate'))
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled()
  })

  it('invites the User to create the first Invoice', async () => {
    renderApp('/invoices', { signedIn: true })

    expect(await screen.findByText('No invoices yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create invoice' })).toHaveAttribute(
      'href',
      '/invoices/new',
    )
  })

  it('offers to clear filters that match nothing', async () => {
    serveInvoices([])
    const user = userEvent.setup()
    const { router } = renderApp('/invoices?status=Paid', { signedIn: true })

    const emptyState = (await screen.findByText('No invoices match your filters')).parentElement!
    await user.click(within(emptyState).getByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByText('No invoices yet')).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('leads back to page 1 from a page past the end', async () => {
    const requests = serveInvoices([appendixAInvoice])
    const user = userEvent.setup()
    renderApp('/invoices?page=5', { signedIn: true })

    expect(await screen.findByText('This page is empty')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to page 1' }))

    expect(await screen.findByRole('link', { name: 'IV1780488206995' })).toBeInTheDocument()
    expect(requests.map((query) => query.page)).toEqual(['5', '1'])
  })

  it('shows an error with Retry when the list fails to load', async () => {
    let calls = 0
    server.use(
      http.get('/api/invoices', () => {
        calls += 1
        if (calls === 1) {
          return HttpResponse.json(
            { statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' },
            { status: 500 },
          )
        }
        return HttpResponse.json({
          data: [appendixAInvoice],
          paging: { page: 1, pageSize: 10, total: 1 },
        })
      }),
    )
    const user = userEvent.setup()
    renderApp('/invoices', { signedIn: true })

    expect(await screen.findByText('Could not load invoices.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('link', { name: 'IV1780488206995' })).toBeInTheDocument()
  })

  it('opens an Invoice from its row and remembers the list', async () => {
    serveInvoices([appendixAInvoice])
    const user = userEvent.setup()
    const { router } = renderApp('/invoices?status=Overdue', { signedIn: true })

    await user.click(await screen.findByRole('cell', { name: 'Paul' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/invoices/${appendixAInvoice.invoiceId}`),
    )
    expect(router.state.location.state).toEqual({ listSearch: '?status=Overdue' })
  })

  it('shows cards, a filter panel and simple paging on a phone', async () => {
    mockMatchMedia(390)
    const requests = serveInvoices(manyInvoices)
    const user = userEvent.setup()
    renderApp('/invoices', { signedIn: true })

    const card = await screen.findByRole('link', { name: /INV-0001/ })
    expect(card).toHaveTextContent('Customer 0001')
    expect(card).toHaveTextContent('AU$2,180.00')
    expect(card).toHaveAttribute('href', `/invoices/${manyInvoices[0].invoiceId}`)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    const filtersButton = screen.getByRole('button', { name: 'Filters' })
    expect(filtersButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument()
    await user.click(filtersButton)
    expect(filtersButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }))

    expect(await screen.findByRole('link', { name: /INV-0011/ })).toBeInTheDocument()
    expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, page: '2' })
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL with `Tests  13 failed | 64 passed (77)`. `/invoices` still shows "Page not found", so every new test fails, for example with `Unable to find role="link" and name "IV1780488206995"`.

- [ ] **Step 4: Write the list page and its parts**

The behaviour that the tests check:
- `SearchField` keeps its own text and reports it 300 ms after the typing pauses. When the keyword in the URL changes for another reason (the back button, "Clear filters"), the field shows the new keyword.
- The search replaces the history entry (`replace: true`), so typing does not fill the browser history.
- Below the `md` breakpoint, a "Filters" button opens and closes the controls other than the search. The list then shows cards with simple paging.
- Sorting: a click on a column that is not sorted sorts it ascending. A click on the sorted column reverses the order.

`frontend/src/features/invoices/hooks/useInvoiceList.ts`:

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { invoiceKeys, listInvoices } from '../../../api/invoices'
import type { InvoiceListQuery } from '../../../api/types'

/**
 * One page of the Invoice list. While the next page or filter loads, the
 * previous rows stay on screen, so the table does not flash empty.
 */
export function useInvoiceList(params: InvoiceListQuery) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: ({ signal }) => listInvoices(params, signal),
    placeholderData: keepPreviousData,
  })
}
```

`frontend/src/features/invoices/list/linkState.ts`:

```ts
/**
 * Location state carried from the list to an Invoice's detail page: the
 * list's query string, so "Back to invoices" returns to the same page,
 * filters and sort (spec §6.3).
 */
export interface InvoiceLinkState {
  listSearch: string
}
```

`frontend/src/features/invoices/list/SearchField.tsx`:

```tsx
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import { useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { KEYWORD_MAX_LENGTH } from '../listParams'

const SEARCH_DELAY_MS = 300

/**
 * The list's search box (spec §6.3). It searches once typing pauses, and it
 * shows the URL's keyword whenever that changes from elsewhere: Clear filters
 * or the browser's back button.
 */
export function SearchField({
  keyword,
  onSearch,
}: {
  keyword: string
  onSearch: (keyword: string) => void
}) {
  const [text, setText] = useState(keyword)
  const [shownKeyword, setShownKeyword] = useState(keyword)
  if (keyword !== shownKeyword) {
    setShownKeyword(keyword)
    // When our own search comes back, keep what is typed (a trailing space, say).
    if (keyword !== text.trim()) setText(keyword)
  }

  const pausedText = useDebouncedValue(text, SEARCH_DELAY_MS)
  const handledText = useRef(pausedText)
  useEffect(() => {
    // Search once per pause in typing; a keyword change from elsewhere is not a pause.
    if (pausedText === handledText.current) return
    handledText.current = pausedText
    const next = pausedText.trim()
    if (next !== keyword) onSearch(next)
  }, [pausedText, keyword, onSearch])

  return (
    <TextField
      type="search"
      label="Search"
      placeholder="Search invoice number or customer"
      value={text}
      onChange={(event) => setText(event.target.value)}
      fullWidth
      size="small"
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        },
        htmlInput: { maxLength: KEYWORD_MAX_LENGTH },
      }}
    />
  )
}
```

`frontend/src/features/invoices/list/InvoiceFilters.tsx`:

```tsx
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import type { SortField, SortOrder } from '../../../api/types'
import {
  hasActiveFilters,
  SORT_FIELDS,
  STATUS_OPTIONS,
  type InvoiceListParams,
} from '../listParams'

/** "Date created" is the API's own order, so choosing it sends no `sortBy` at all. */
const DATE_CREATED = 'createdAt'

const SORT_OPTIONS = [
  { value: DATE_CREATED, label: 'Date created' },
  { value: 'invoiceDate', label: 'Invoice date' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'totalAmount', label: 'Total amount' },
] satisfies Array<{ value: SortField | typeof DATE_CREATED; label: string }>

/**
 * The list's Status, sort and Invoice-date controls (spec §6.3). They show
 * `params` and report each change through `onChange`; the page writes it to
 * the URL.
 */
export function InvoiceFilters({
  params,
  onChange,
  onClear,
}: {
  params: InvoiceListParams
  onChange: (changes: Partial<InvoiceListParams>) => void
  onClear: () => void
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      useFlexGap
      sx={{ flexWrap: 'wrap', alignItems: { md: 'center' } }}
    >
      <TextField
        select
        label="Status"
        size="small"
        value={params.status ?? ''}
        onChange={(event) =>
          onChange({ status: STATUS_OPTIONS.find((status) => status === event.target.value) })
        }
        slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="">All</MenuItem>
        {STATUS_OPTIONS.map((status) => (
          <MenuItem key={status} value={status}>
            {status}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Sort by"
        size="small"
        value={params.sortBy ?? DATE_CREATED}
        onChange={(event) =>
          onChange({ sortBy: SORT_FIELDS.find((field) => field === event.target.value) })
        }
        sx={{ minWidth: 160 }}
      >
        {SORT_OPTIONS.map(({ value, label }) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      <ToggleButtonGroup
        exclusive
        size="small"
        aria-label="Sort order"
        value={params.ordering}
        onChange={(_event, ordering: SortOrder | null) => {
          // Clicking the selected button again reports null; the order stays.
          if (ordering) onChange({ ordering })
        }}
      >
        <ToggleButton value="ASC" aria-label="Ascending">
          <ArrowUpwardIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="DESC" aria-label="Descending">
          <ArrowDownwardIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
      <TextField
        type="date"
        label="Invoice date from"
        size="small"
        value={params.fromDate ?? ''}
        onChange={(event) => onChange({ fromDate: event.target.value || undefined })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: params.toDate } }}
      />
      <TextField
        type="date"
        label="Invoice date to"
        size="small"
        value={params.toDate ?? ''}
        onChange={(event) => onChange({ toDate: event.target.value || undefined })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: params.fromDate } }}
      />
      <Button onClick={onClear} disabled={!hasActiveFilters(params)}>
        Clear filters
      </Button>
    </Stack>
  )
}
```

`frontend/src/features/invoices/list/InvoiceTable.tsx`:

```tsx
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import { Link as RouterLink, useNavigate } from 'react-router'
import type { Invoice, Paging, SortField, SortOrder } from '../../../api/types'
import { StatusChip } from '../../../components/StatusChip'
import { formatDate, formatMoney } from '../../../lib/format'
import { PAGE_SIZES } from '../listParams'
import type { InvoiceLinkState } from './linkState'

export interface InvoiceTableProps {
  invoices: Invoice[]
  paging: Paging
  sortBy?: SortField
  ordering: SortOrder
  linkState: InvoiceLinkState
  onSort: (field: SortField) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

/**
 * The desktop Invoice list (spec §6.3). The Invoice Number is a real link for
 * keyboards and screen readers; a click anywhere on the row does the same.
 */
export function InvoiceTable({
  invoices,
  paging,
  sortBy,
  ordering,
  linkState,
  onSort,
  onPageChange,
  onPageSizeChange,
}: InvoiceTableProps) {
  const navigate = useNavigate()
  const direction = ordering === 'ASC' ? 'asc' : 'desc'

  const sortableHeader = (field: SortField, label: string, align?: 'right') => (
    <TableCell align={align} sortDirection={sortBy === field ? direction : false}>
      <TableSortLabel
        active={sortBy === field}
        direction={sortBy === field ? direction : 'asc'}
        onClick={() => onSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  )

  return (
    <>
      <TableContainer>
        <Table aria-label="Invoices">
          <TableHead>
            <TableRow>
              <TableCell>Invoice number</TableCell>
              <TableCell>Customer</TableCell>
              {sortableHeader('invoiceDate', 'Invoice date')}
              {sortableHeader('dueDate', 'Due date')}
              {sortableHeader('totalAmount', 'Total', 'right')}
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((invoice) => {
              const detailPath = `/invoices/${invoice.invoiceId}`
              return (
                <TableRow
                  key={invoice.invoiceId}
                  hover
                  onClick={() => navigate(detailPath, { state: linkState })}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Link
                      component={RouterLink}
                      to={detailPath}
                      state={linkState}
                      onClick={(event) => event.stopPropagation()}
                      sx={{ fontWeight: 500 }}
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{invoice.customer.fullname}</TableCell>
                  <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell align="right">
                    {formatMoney(invoice.totalAmount, invoice.currencySymbol)}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={invoice.status} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={paging.total}
        page={paging.page - 1}
        rowsPerPage={paging.pageSize}
        rowsPerPageOptions={PAGE_SIZES}
        onPageChange={(_event, page) => onPageChange(page + 1)}
        onRowsPerPageChange={(event) => onPageSizeChange(Number(event.target.value))}
        showFirstButton
        showLastButton
      />
    </>
  )
}
```

`frontend/src/features/invoices/list/InvoiceCards.tsx`:

```tsx
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import MenuItem from '@mui/material/MenuItem'
import Pagination from '@mui/material/Pagination'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router'
import type { Invoice, Paging } from '../../../api/types'
import { StatusChip } from '../../../components/StatusChip'
import { formatDate, formatMoney } from '../../../lib/format'
import { PAGE_SIZES } from '../listParams'
import type { InvoiceLinkState } from './linkState'

/** The phone-sized Invoice list (spec §6.3): one card per Invoice, each card a link. */
export function InvoiceCards({
  invoices,
  paging,
  linkState,
  onPageChange,
  onPageSizeChange,
}: {
  invoices: Invoice[]
  paging: Paging
  linkState: InvoiceLinkState
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(paging.total / paging.pageSize))
  return (
    <>
      <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {invoices.map((invoice) => (
          <Card component="li" key={invoice.invoiceId} variant="outlined">
            <CardActionArea
              component={RouterLink}
              to={`/invoices/${invoice.invoiceId}`}
              state={linkState}
            >
              <CardContent>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}
                >
                  <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {invoice.invoiceNumber}
                  </Typography>
                  <StatusChip status={invoice.status} />
                </Stack>
                <Typography sx={{ color: 'text.secondary', mb: 1, overflowWrap: 'anywhere' }}>
                  {invoice.customer.fullname}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: 'space-between', alignItems: 'flex-end' }}
                >
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {formatDate(invoice.invoiceDate)} · Due {formatDate(invoice.dueDate)}
                  </Typography>
                  <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {formatMoney(invoice.totalAmount, invoice.currencySymbol)}
                  </Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', mt: 2 }}
      >
        <Pagination
          count={pageCount}
          page={paging.page}
          siblingCount={0}
          onChange={(_event, page) => onPageChange(page)}
        />
        <TextField
          select
          label="Per page"
          size="small"
          value={paging.pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          sx={{ minWidth: 96 }}
        >
          {PAGE_SIZES.map((size) => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
    </>
  )
}
```

`frontend/src/features/invoices/list/InvoiceListPage.tsx`:

```tsx
import AddIcon from '@mui/icons-material/Add'
import FilterListIcon from '@mui/icons-material/FilterList'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useState, type ReactNode } from 'react'
import { Link as RouterLink, useLocation } from 'react-router'
import type { SortField } from '../../../api/types'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader } from '../../../components/PageHeader'
import { useInvoiceList } from '../hooks/useInvoiceList'
import { useInvoiceListParams } from '../hooks/useInvoiceListParams'
import { hasActiveFilters } from '../listParams'
import { InvoiceCards } from './InvoiceCards'
import { InvoiceFilters } from './InvoiceFilters'
import { SearchField } from './SearchField'
import { InvoiceTable } from './InvoiceTable'
import type { InvoiceLinkState } from './linkState'

/**
 * The home page (spec §6.3): search, filter, sort and page through the
 * Invoices. The URL holds the list's state; this page only reads it and
 * writes changes back. Phones get cards and a collapsible filter panel.
 */
export function InvoiceListPage() {
  const { params, update, clearFilters } = useInvoiceListParams()
  const { data, isPending, isError, isFetching, refetch } = useInvoiceList(params)
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const linkState: InvoiceLinkState = { listSearch: location.search }

  function handleSort(field: SortField) {
    if (params.sortBy === field) {
      update({ ordering: params.ordering === 'ASC' ? 'DESC' : 'ASC' })
    } else {
      update({ sortBy: field, ordering: 'ASC' })
    }
  }

  const changePage = (page: number) => update({ page })
  const changePageSize = (pageSize: number) => update({ pageSize })
  const filters = <InvoiceFilters params={params} onChange={update} onClear={clearFilters} />
  // The search box stays visible on phones; count only the filters the panel hides.
  const hiddenFilterCount = [params.status, params.fromDate, params.toDate].filter(Boolean).length

  let content: ReactNode
  if (isPending) {
    content = (
      <Stack spacing={1} role="status" aria-label="Loading invoices">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={52} />
        ))}
      </Stack>
    )
  } else if (isError) {
    content = <ErrorState message="Could not load invoices." onRetry={() => void refetch()} />
  } else if (data.data.length === 0) {
    content = (
      <Paper variant="outlined">
        {data.paging.total > 0 ? (
          <EmptyState
            title="This page is empty"
            description="The list has fewer pages than this one."
            action={<Button onClick={() => changePage(1)}>Back to page 1</Button>}
          />
        ) : hasActiveFilters(params) ? (
          <EmptyState
            title="No invoices match your filters"
            description="Try another search or Status, or clear the filters."
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            title="No invoices yet"
            description="Invoices you create appear here."
            action={
              <Button variant="contained" component={RouterLink} to="/invoices/new">
                Create invoice
              </Button>
            }
          />
        )}
      </Paper>
    )
  } else if (isMobile) {
    content = (
      <InvoiceCards
        invoices={data.data}
        paging={data.paging}
        linkState={linkState}
        onPageChange={changePage}
        onPageSizeChange={changePageSize}
      />
    )
  } else {
    content = (
      <Paper variant="outlined">
        <InvoiceTable
          invoices={data.data}
          paging={data.paging}
          sortBy={params.sortBy}
          ordering={params.ordering}
          linkState={linkState}
          onSort={handleSort}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
        />
      </Paper>
    )
  }

  return (
    <>
      <PageHeader
        title="Invoices"
        actions={
          <Button
            variant="contained"
            component={RouterLink}
            to="/invoices/new"
            startIcon={<AddIcon />}
          >
            New invoice
          </Button>
        }
      />
      <Paper variant="outlined" sx={{ p: 2, mb: 1 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <SearchField
              keyword={params.keyword ?? ''}
              onSearch={(keyword) => update({ keyword: keyword || undefined }, { replace: true })}
            />
            {isMobile && (
              <Button
                variant="outlined"
                startIcon={<FilterListIcon />}
                aria-expanded={filtersOpen}
                aria-controls={filtersOpen ? 'invoice-filters' : undefined}
                onClick={() => setFiltersOpen((open) => !open)}
                sx={{ flexShrink: 0 }}
              >
                {hiddenFilterCount > 0 ? `Filters (${hiddenFilterCount})` : 'Filters'}
              </Button>
            )}
          </Stack>
          {isMobile ? (
            <Collapse in={filtersOpen} unmountOnExit>
              <Box id="invoice-filters">{filters}</Box>
            </Collapse>
          ) : (
            filters
          )}
        </Stack>
      </Paper>
      <Box sx={{ height: 4, mb: 1 }}>
        {isFetching && !isPending && <LinearProgress aria-label="Refreshing invoices" />}
      </Box>
      {content}
    </>
  )
}
```

Replace the whole of `frontend/src/routes.tsx` with:

```tsx
import { Navigate, type RouteObject } from 'react-router'
import { LoginPage } from './auth/LoginPage'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { NotFoundPage } from './components/NotFoundPage'
import { InvoiceListPage } from './features/invoices/list/InvoiceListPage'

/** The route table (spec §6.1), shared by the app's browser router and the tests' memory router. */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/invoices" replace /> },
      { path: 'invoices', element: <InvoiceListPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (12 test files, 77 tests).

- [ ] **Step 6: Run every check and the production build**

Run: `cd frontend && npm run format && npm test && npm run lint && npm run typecheck && npm run build`
Expected:
- 77 tests pass.
- `npm run lint` prints nothing. oxlint is silent when there is nothing to report.
- The type check passes.
- The build ends with `✓ built in …` and prints no warning about chunks larger than 500 kB.

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "feat(frontend): Invoice list with search, filters, sorting and paging

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 13: The Invoice detail page

Spec §6.3 (`InvoiceDetailPage`), for the assessment's detail requirement (A§2.1.3). The page shows every field of one Invoice exactly as the API serves it, in four cards: Invoice, Customer, Invoice items and Summary. The back link restores the list that the User came from. An unknown id, or an id that is not a UUID, shows "Invoice not found".

**Files:**
- Modify: `frontend/src/test/msw/handlers.ts` (by default, `GET /api/invoices/:invoiceId` answers 404)
- Create: `frontend/src/components/SectionCard.tsx`
- Create: `frontend/src/features/invoices/detail/DetailList.tsx`, `frontend/src/features/invoices/detail/InvoiceDetailPage.tsx`
- Modify: `frontend/src/routes.tsx` (add `invoices/:invoiceId`)
- Test: `frontend/src/features/invoices/detail/InvoiceDetailPage.test.tsx`

**Interfaces:**
- Consumes:
  - From Task 11: `invoiceKeys`, `getInvoice`.
  - From Task 12: `InvoiceLinkState`, `appendixAInvoice`, `makeInvoice`.
  - From Task 9: `PageHeader`, `StatusChip`, `ErrorState`, `formatMoney`, `formatDate`, `formatDateTime`, `errorStatus`.
  - From Task 10: `renderApp`, `server`.
  - From the backend (Task 7): `GET /invoices/:invoiceId` → `InvoiceDto`; 404 `Invoice not found`; 400 for an id that is not a UUID.
- Produces:
  - `SectionCard({ title, children })`: a card `<section>` that its `h2` labels. Task 14 uses it too.
  - `DetailList({ items: DetailItem[], amounts?: boolean })` with `DetailItem { label: string; value: ReactNode; emphasis?: boolean }`: a `<dl>`. An empty value shows "—". With `amounts`, the values are right-aligned.
  - `InvoiceDetailPage` and the route `invoices/:invoiceId`.

- [ ] **Step 1: Make an unknown Invoice the default answer**

Replace the whole of `frontend/src/test/msw/handlers.ts` with:

```ts
import { http, HttpResponse } from 'msw'
import type { LoginRequest } from '../../api/types'
import { USER_PASSWORD, userFixture } from '../fixtures'

const unauthorized = { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' }

/**
 * The API as every test starts with it: nobody is signed in, the seeded
 * credentials sign in, and there are no Invoices. Tests add or replace
 * handlers with `server.use`.
 */
export const handlers = [
  http.get('/api/auth/me', () => HttpResponse.json(unauthorized, { status: 401 })),
  http.post<never, LoginRequest>('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json()
    if (email === userFixture.email && password === USER_PASSWORD) {
      return HttpResponse.json({
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: userFixture,
      })
    }
    return HttpResponse.json(
      { statusCode: 401, message: 'Invalid email or password', error: 'Unauthorized' },
      { status: 401 },
    )
  }),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/invoices', () =>
    HttpResponse.json({ data: [], paging: { page: 1, pageSize: 10, total: 0 } }),
  ),
  http.get('/api/invoices/:invoiceId', () =>
    HttpResponse.json(
      { statusCode: 404, message: 'Invoice not found', error: 'Not Found' },
      { status: 404 },
    ),
  ),
]
```

- [ ] **Step 2: Write the failing test**

`detailsOf(title)` reads the `<dl>` in the card with that title as a `{ label: value }` object.

`frontend/src/features/invoices/detail/InvoiceDetailPage.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { Invoice } from '../../../api/types'
import { appendixAInvoice, makeInvoice } from '../../../test/fixtures'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'

function serveInvoice(invoice: Invoice) {
  server.use(http.get(`/api/invoices/${invoice.invoiceId}`, () => HttpResponse.json(invoice)))
}

/** The label → value pairs of the card titled `title`. */
function detailsOf(title: string) {
  const section = screen.getByRole('region', { name: title })
  return Object.fromEntries(
    Array.from(section.querySelectorAll('dt'), (term) => [
      term.textContent,
      term.nextElementSibling?.textContent,
    ]),
  )
}

const detailPath = `/invoices/${appendixAInvoice.invoiceId}`

describe('InvoiceDetailPage', () => {
  it('shows every section and amount exactly as served', async () => {
    serveInvoice(appendixAInvoice)
    renderApp(detailPath, { signedIn: true })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'IV1780488206995' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(detailsOf('Invoice')).toEqual({
      'Invoice number': 'IV1780488206995',
      Reference: '#5721662',
      'Invoice date': '03 Jun 2026',
      'Due date': '03 Jul 2026',
      Currency: 'AUD (AU$)',
      Description: 'Invoice is issued to Kanglee',
      'Created at': '03 Jun 2026, 12:03',
    })
    expect(detailsOf('Customer')).toEqual({
      Name: 'Paul',
      Email: 'paul@101digital.io',
      Mobile: '947717364111',
      Address: 'Singapore',
    })
    expect(screen.getByRole('link', { name: 'paul@101digital.io' })).toHaveAttribute(
      'href',
      'mailto:paul@101digital.io',
    )
    const rows = within(screen.getByRole('table', { name: 'Invoice items' })).getAllByRole('row')
    expect(rows.map((row) => Array.from(row.children, (cell) => cell.textContent))).toEqual([
      ['Item', 'Quantity', 'Rate', 'Amount'],
      ['Honda RC150', '2', 'AU$1,000.00', 'AU$2,000.00'],
    ])
    expect(detailsOf('Summary')).toEqual({
      'Sub-total': 'AU$2,000.00',
      'Tax (10%)': 'AU$200.00',
      Discount: '-AU$20.00',
      'Total amount': 'AU$2,180.00',
      'Total paid': 'AU$1,451.34',
      Balance: 'AU$728.66',
    })
  })

  it('shows a dash for each empty optional field', async () => {
    const invoice = makeInvoice(1, {
      invoiceReference: null,
      description: null,
      customer: {
        fullname: 'Paul',
        email: 'paul@101digital.io',
        mobileNumber: null,
        address: null,
      },
    })
    serveInvoice(invoice)
    renderApp(`/invoices/${invoice.invoiceId}`, { signedIn: true })

    await screen.findByRole('heading', { level: 1, name: 'INV-0001' })
    expect(detailsOf('Invoice')).toMatchObject({ Reference: '—', Description: '—' })
    expect(detailsOf('Customer')).toMatchObject({ Mobile: '—', Address: '—' })
  })

  it('goes back to the list the User came from', async () => {
    serveInvoice(appendixAInvoice)
    const user = userEvent.setup()
    const { router } = renderApp(
      { pathname: detailPath, state: { listSearch: '?page=2&status=Overdue' } },
      { signedIn: true },
    )

    // The page shows the link while loading too; click the one on the loaded page.
    await screen.findByRole('heading', { level: 1, name: 'IV1780488206995' })
    await user.click(screen.getByRole('link', { name: 'Back to invoices' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/invoices'))
    expect(router.state.location.search).toBe('?page=2&status=Overdue')
  })

  it('links back to the whole list when opened directly', async () => {
    serveInvoice(appendixAInvoice)
    renderApp(detailPath, { signedIn: true })

    await screen.findByRole('heading', { level: 1, name: 'IV1780488206995' })
    expect(screen.getByRole('link', { name: 'Back to invoices' })).toHaveAttribute(
      'href',
      '/invoices',
    )
  })

  it('says when the Invoice does not exist', async () => {
    renderApp(`/invoices/${makeInvoice(9).invoiceId}`, { signedIn: true })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invoice not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to invoices' })).toBeInTheDocument()
  })

  it('treats an id that is not a UUID as not found', async () => {
    server.use(
      http.get('/api/invoices/:invoiceId', () =>
        HttpResponse.json(
          { statusCode: 400, message: 'id must be a valid UUID', error: 'Bad Request' },
          { status: 400 },
        ),
      ),
    )
    renderApp('/invoices/not-a-uuid', { signedIn: true })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invoice not found' }),
    ).toBeInTheDocument()
  })

  it('offers Retry when loading fails', async () => {
    let calls = 0
    server.use(
      http.get(`/api/invoices/${appendixAInvoice.invoiceId}`, () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(
              { statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' },
              { status: 500 },
            )
          : HttpResponse.json(appendixAInvoice)
      }),
    )
    const user = userEvent.setup()
    renderApp(detailPath, { signedIn: true })

    expect(await screen.findByText('Could not load this invoice.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'IV1780488206995' }),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL with `Tests  7 failed | 77 passed (84)`, for example `Unable to find role="heading" and name "IV1780488206995"`.

- [ ] **Step 4: Write the detail page**

`frontend/src/components/SectionCard.tsx`:

```tsx
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { useId, type ReactNode } from 'react'

/** A titled card. It is a labelled `section`, so screen-reader users can jump from card to card. */
export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId()
  return (
    <Card component="section" variant="outlined" aria-labelledby={titleId} sx={{ height: '100%' }}>
      <CardContent>
        <Typography id={titleId} variant="h6" component="h2" sx={{ mb: 2 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  )
}
```

`frontend/src/features/invoices/detail/DetailList.tsx`:

```tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Fragment, type ReactNode } from 'react'

export interface DetailItem {
  label: string
  /** `null` is shown as a dash: the API sends `null` for an empty optional field. */
  value: ReactNode
  emphasis?: boolean
}

/**
 * Label–value pairs as a description list. With `amounts`, values are
 * right-aligned in one column so the figures line up.
 */
export function DetailList({ items, amounts = false }: { items: DetailItem[]; amounts?: boolean }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: amounts ? '1fr auto' : { xs: '1fr', sm: '140px 1fr' },
        columnGap: 2,
        rowGap: 1,
      }}
    >
      {items.map(({ label, value, emphasis }) => {
        const emphasisSx = emphasis
          ? { fontWeight: 700, borderTop: 1, borderColor: 'divider', pt: 1 }
          : undefined
        return (
          <Fragment key={label}>
            <Typography
              component="dt"
              sx={{ color: emphasis ? 'text.primary' : 'text.secondary', ...emphasisSx }}
            >
              {label}
            </Typography>
            <Typography
              component="dd"
              sx={{
                m: 0,
                mb: amounts ? 0 : { xs: 1, sm: 0 },
                textAlign: amounts ? 'right' : 'left',
                overflowWrap: 'anywhere',
                ...emphasisSx,
              }}
            >
              {value ?? '—'}
            </Typography>
          </Fragment>
        )
      })}
    </Box>
  )
}
```

`frontend/src/features/invoices/detail/InvoiceDetailPage.tsx`:

```tsx
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink, useLocation, useParams } from 'react-router'
import { errorStatus } from '../../../api/errors'
import { getInvoice, invoiceKeys } from '../../../api/invoices'
import type { Invoice } from '../../../api/types'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { StatusChip } from '../../../components/StatusChip'
import { formatDate, formatDateTime, formatMoney } from '../../../lib/format'
import type { InvoiceLinkState } from '../list/linkState'
import { DetailList } from './DetailList'

/**
 * One Invoice (spec §6.3), every value exactly as the API serves it. The back
 * link returns to the list as the User left it: the list passes its query
 * string in the location state.
 */
export function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams()
  const location = useLocation()
  const listSearch = (location.state as Partial<InvoiceLinkState> | null)?.listSearch ?? ''
  const query = useQuery({
    queryKey: invoiceKeys.detail(invoiceId),
    queryFn: ({ signal }) => getInvoice(invoiceId, signal),
  })

  const backLink = (
    <Link
      component={RouterLink}
      to={`/invoices${listSearch}`}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 1 }}
    >
      <ArrowBackIcon fontSize="small" />
      Back to invoices
    </Link>
  )

  if (query.isPending) {
    return (
      <Stack spacing={2} role="status" aria-label="Loading invoice">
        {backLink}
        <Skeleton variant="text" width={260} sx={{ fontSize: '2.5rem' }} />
        <Grid container spacing={2}>
          {[6, 6, 8, 4].map((size, index) => (
            <Grid key={index} size={{ xs: 12, md: size }}>
              <Skeleton variant="rounded" height={220} />
            </Grid>
          ))}
        </Grid>
      </Stack>
    )
  }

  if (query.isError) {
    const status = errorStatus(query.error)
    // The API answers 400 to an id that is not a UUID: to the User, that is a missing Invoice too.
    if (status === 404 || status === 400) {
      return (
        <>
          <PageHeader title="Invoice not found" back={backLink} />
          <Typography>
            There is no invoice at this address. Check the link, or go back to the list.
          </Typography>
        </>
      )
    }
    return (
      <>
        <PageHeader title="Invoice" back={backLink} />
        <ErrorState message="Could not load this invoice." onRetry={() => void query.refetch()} />
      </>
    )
  }

  const invoice = query.data
  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        back={backLink}
        chip={<StatusChip status={invoice.status} size="medium" />}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Invoice">
            <DetailList
              items={[
                { label: 'Invoice number', value: invoice.invoiceNumber },
                { label: 'Reference', value: invoice.invoiceReference },
                { label: 'Invoice date', value: formatDate(invoice.invoiceDate) },
                { label: 'Due date', value: formatDate(invoice.dueDate) },
                { label: 'Currency', value: `${invoice.currency} (${invoice.currencySymbol})` },
                { label: 'Description', value: invoice.description },
                { label: 'Created at', value: formatDateTime(invoice.createdAt) },
              ]}
            />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Customer">
            <DetailList
              items={[
                { label: 'Name', value: invoice.customer.fullname },
                {
                  label: 'Email',
                  value: (
                    <Link href={`mailto:${invoice.customer.email}`}>{invoice.customer.email}</Link>
                  ),
                },
                { label: 'Mobile', value: invoice.customer.mobileNumber },
                { label: 'Address', value: invoice.customer.address },
              ]}
            />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard title="Invoice items">
            <ItemsTable invoice={invoice} />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="Summary">
            <DetailList
              amounts
              items={[
                { label: 'Sub-total', value: money(invoice, invoice.invoiceSubTotal) },
                { label: `Tax (${invoice.taxRate}%)`, value: money(invoice, invoice.totalTax) },
                { label: 'Discount', value: money(invoice, -invoice.totalDiscount) },
                { label: 'Total amount', value: money(invoice, invoice.totalAmount) },
                { label: 'Total paid', value: money(invoice, invoice.totalPaid) },
                { label: 'Balance', value: money(invoice, invoice.balanceAmount), emphasis: true },
              ]}
            />
          </SectionCard>
        </Grid>
      </Grid>
    </>
  )
}

const money = (invoice: Invoice, amount: number) => formatMoney(amount, invoice.currencySymbol)

function ItemsTable({ invoice }: { invoice: Invoice }) {
  return (
    <TableContainer>
      <Table size="small" aria-label="Invoice items">
        <TableHead>
          <TableRow>
            <TableCell>Item</TableCell>
            <TableCell align="right">Quantity</TableCell>
            <TableCell align="right">Rate</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoice.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell sx={{ overflowWrap: 'anywhere' }}>{item.name}</TableCell>
              <TableCell align="right">{item.quantity}</TableCell>
              <TableCell align="right">{money(invoice, item.rate)}</TableCell>
              <TableCell align="right">{money(invoice, item.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
```

Replace the whole of `frontend/src/routes.tsx` with:

```tsx
import { Navigate, type RouteObject } from 'react-router'
import { LoginPage } from './auth/LoginPage'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { NotFoundPage } from './components/NotFoundPage'
import { InvoiceDetailPage } from './features/invoices/detail/InvoiceDetailPage'
import { InvoiceListPage } from './features/invoices/list/InvoiceListPage'

/** The route table (spec §6.1), shared by the app's browser router and the tests' memory router. */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/invoices" replace /> },
      { path: 'invoices', element: <InvoiceListPage /> },
      { path: 'invoices/:invoiceId', element: <InvoiceDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (13 test files, 84 tests).

- [ ] **Step 6: Run every check and the production build**

Run: `cd frontend && npm run format && npm test && npm run lint && npm run typecheck && npm run build`
Expected:
- 84 tests pass.
- `npm run lint` prints nothing. oxlint is silent when there is nothing to report.
- The type check passes.
- The build ends with `✓ built in …` and prints no warning about chunks larger than 500 kB.

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "feat(frontend): Invoice detail page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 14: Create an Invoice

Spec §6.3 (`CreateInvoicePage`) and §5.3 (the create rules), for the assessment's create requirement (A§2.1.4). The page has a form with one Invoice Item and sensible defaults. The client-side validation mirrors the API, and only the server calculates the totals. After a successful create, the page:
1. invalidates every cached Invoice query;
2. shows a toast;
3. opens the list, where the new Draft Invoice is at the top.

A duplicate Invoice Number (409) and the server's validation messages (400) appear on their fields.

The client does not check two rules, because only the server can check them reliably:
- An Invoice Number must be unique. Only the database can tell.
- The Discount must not exceed the Sub-total plus Tax. This depends on the server's decimal rounding.

The server's messages for these two rules also appear on their fields.

**Files:**
- Create: `frontend/src/features/invoices/schema.ts`
- Create: `frontend/src/features/invoices/create/FormTextField.tsx`, `frontend/src/features/invoices/create/CreateInvoicePage.tsx`
- Modify: `frontend/src/routes.tsx` (add `invoices/new`, before `invoices/:invoiceId`)
- Test: `frontend/src/features/invoices/schema.test.ts`, `frontend/src/features/invoices/create/CreateInvoicePage.test.tsx`

**Interfaces:**
- Consumes:
  - From Task 11: `createInvoice`, `invoiceKeys`, `isIsoDate`.
  - From Task 9: `CURRENCIES`, `CURRENCY_CODES`, `todayIsoDate`, `addDaysIso`, `errorStatus`, `errorMessages`, `PageHeader`, `CreateInvoiceRequest`.
  - From Task 13: `SectionCard`.
  - From Tasks 10 and 12: `renderApp`, `server`, `makeInvoice`.
  - From the backend (Task 8):
    - `POST /invoices` → 201 `InvoiceDto`;
    - 409 `Invoice number <invoiceNumber> already exists`;
    - 400 with one message per problem. Each message starts with the field's path: `customer.email …`, `items.0.rate …`, `discount must not exceed the sub-total plus tax`.
- Produces:
  - `createInvoiceSchema` (Zod), `CreateInvoiceFormInput`, `CreateInvoiceFormOutput`, `CreateInvoiceField`.
  - `createInvoiceDefaults(today: string): CreateInvoiceFormInput`:
    - the Invoice Date is today and the Due Date is 30 days later;
    - the Currency is AUD;
    - the quantity is 1, the Tax Rate is 10 and the Discount is 0.
  - `toCreateInvoiceRequest(values: CreateInvoiceFormOutput): CreateInvoiceRequest`.
  - `mapServerErrors(messages: string[]): ServerErrors`, with `ServerErrors { fieldErrors: Array<{ name: CreateInvoiceField; message: string }>; formErrors: string[] }`.
  - `FormTextField`: a React Hook Form `Controller` around an MUI `TextField`.
  - `CreateInvoicePage` and the route `invoices/new`.

- [ ] **Step 1: Write the failing schema test**

`frontend/src/features/invoices/schema.test.ts`:

```ts
import {
  createInvoiceDefaults,
  createInvoiceSchema,
  mapServerErrors,
  toCreateInvoiceRequest,
  type CreateInvoiceFormInput,
} from './schema'

const VALID: CreateInvoiceFormInput = {
  customer: {
    fullname: '  Kanglee Trading ',
    email: ' billing@kanglee.example ',
    mobileNumber: '+65 9477 1736',
    address: '',
  },
  invoiceNumber: 'INV-2026-0042',
  invoiceReference: '   ',
  invoiceDate: '2026-10-02',
  dueDate: '2026-11-01',
  currency: 'USD',
  description: '',
  item: { name: 'Consulting', quantity: '3', rate: '19.99' },
  taxRate: '10',
  discount: '1.97',
}

/** The first message on each path after `change` is applied to a valid form. */
function errorsAfter(change: (form: CreateInvoiceFormInput) => void): Record<string, string> {
  const form = structuredClone(VALID)
  change(form)
  const errors: Record<string, string> = {}
  for (const issue of createInvoiceSchema.safeParse(form).error?.issues ?? []) {
    errors[issue.path.join('.')] ??= issue.message
  }
  return errors
}

describe('createInvoiceSchema', () => {
  it('turns valid input into the request body', () => {
    const body = toCreateInvoiceRequest(createInvoiceSchema.parse(VALID))

    // Compare what is sent: blank optional fields must be left out, not sent as "".
    expect(JSON.parse(JSON.stringify(body))).toEqual({
      customer: {
        fullname: 'Kanglee Trading',
        email: 'billing@kanglee.example',
        mobileNumber: '+65 9477 1736',
      },
      invoiceNumber: 'INV-2026-0042',
      invoiceDate: '2026-10-02',
      dueDate: '2026-11-01',
      currency: 'USD',
      items: [{ name: 'Consulting', quantity: 3, rate: 19.99 }],
      taxRate: 10,
      discount: 1.97,
    })
  })

  it('starts a new form dated today and due in 30 days', () => {
    expect(createInvoiceDefaults('2026-10-02')).toMatchObject({
      invoiceDate: '2026-10-02',
      dueDate: '2026-11-01',
      currency: 'AUD',
      item: { name: '', quantity: '1', rate: '' },
      taxRate: '10',
      discount: '0',
    })
  })

  it.each<[string, (form: CreateInvoiceFormInput) => void, string, string]>([
    [
      'a blank Customer name',
      (form) => (form.customer.fullname = '  '),
      'customer.fullname',
      'Customer name is required',
    ],
    [
      'an invalid email',
      (form) => (form.customer.email = 'paul'),
      'customer.email',
      'Enter a valid email address',
    ],
    [
      'a mobile number with letters',
      (form) => (form.customer.mobileNumber = '0912-ABC-789'),
      'customer.mobileNumber',
      'Use digits, spaces, "-", "(" and ")", with an optional leading "+"',
    ],
    [
      'a short mobile number',
      (form) => (form.customer.mobileNumber = '12345'),
      'customer.mobileNumber',
      'Mobile number must be 6 to 20 characters',
    ],
    [
      'an Invoice Number with a space',
      (form) => (form.invoiceNumber = 'INV 1'),
      'invoiceNumber',
      'Start with a letter or digit; then use letters, digits and - _ / . #',
    ],
    [
      'a long Invoice Number',
      (form) => (form.invoiceNumber = 'A'.repeat(51)),
      'invoiceNumber',
      'Invoice number must be at most 50 characters',
    ],
    [
      'no Invoice Date',
      (form) => (form.invoiceDate = ''),
      'invoiceDate',
      'Invoice date is required',
    ],
    [
      'an impossible Due Date',
      (form) => (form.dueDate = '2026-02-30'),
      'dueDate',
      'Due date must be a valid date',
    ],
    [
      'a Due Date before the Invoice Date',
      (form) => (form.dueDate = '2026-10-01'),
      'dueDate',
      'Due date must be on or after the invoice date',
    ],
    [
      'a quantity that is not a number',
      (form) => (form.item.quantity = 'two'),
      'item.quantity',
      'Quantity must be a number',
    ],
    [
      'a fractional quantity',
      (form) => (form.item.quantity = '1.5'),
      'item.quantity',
      'Quantity must be a whole number',
    ],
    [
      'a quantity of 0',
      (form) => (form.item.quantity = '0'),
      'item.quantity',
      'Quantity must be at least 1',
    ],
    ['a blank Rate', (form) => (form.item.rate = ' '), 'item.rate', 'Rate is required'],
    ['a Rate of 0', (form) => (form.item.rate = '0'), 'item.rate', 'Rate must be greater than 0'],
    [
      'a Rate with 3 decimal places',
      (form) => (form.item.rate = '1.005'),
      'item.rate',
      'Rate must have at most 2 decimal places',
    ],
    [
      'a Tax Rate above 100',
      (form) => (form.taxRate = '100.5'),
      'taxRate',
      'Tax rate must be between 0 and 100',
    ],
    [
      'a negative Discount',
      (form) => (form.discount = '-1'),
      'discount',
      'Discount must not be negative',
    ],
    [
      'a Discount with 3 decimal places',
      (form) => (form.discount = '0.125'),
      'discount',
      'Discount must have at most 2 decimal places',
    ],
  ])('rejects %s', (_case, change, path, message) => {
    expect(errorsAfter(change)[path]).toBe(message)
  })

  it('checks the dates while other fields are still invalid', () => {
    expect(
      errorsAfter((form) => {
        form.customer.fullname = ''
        form.dueDate = '2026-10-01'
      }),
    ).toEqual({
      'customer.fullname': 'Customer name is required',
      dueDate: 'Due date must be on or after the invoice date',
    })
  })
})

describe('mapServerErrors', () => {
  it('puts each message on its field, labelled, in the form order', () => {
    expect(
      mapServerErrors([
        'discount must not exceed the sub-total plus tax',
        'items.0.rate must have at most 2 decimal places',
        'customer.email must be an email',
        'customer.email should not be empty',
        'property status should not exist',
      ]),
    ).toEqual({
      fieldErrors: [
        { name: 'customer.email', message: 'Email must be an email' },
        { name: 'item.rate', message: 'Rate must have at most 2 decimal places' },
        { name: 'discount', message: 'Discount must not exceed the sub-total plus tax' },
      ],
      formErrors: ['property status should not exist'],
    })
  })
})
```

- [ ] **Step 2: Run the schema test to verify it fails**

Run: `cd frontend && npx vitest run src/features/invoices/schema.test.ts`
Expected: FAIL with `Error: Failed to resolve import "./schema" from "src/features/invoices/schema.test.ts". Does the file exist?`

- [ ] **Step 3: Write the schema, the defaults and the server-error mapping**

`frontend/src/features/invoices/schema.ts`:

```ts
import type { FieldPath } from 'react-hook-form'
import { z } from 'zod'
import type { CreateInvoiceRequest } from '../../api/types'
import { CURRENCY_CODES } from '../../lib/currencies'
import { addDaysIso, isIsoDate } from '../../lib/dates'

/**
 * The create form's rules (spec §6.3). They mirror the API's (spec §5.3), so
 * most mistakes are caught before anything is sent. Two rules stay with the
 * API: the Invoice Number must be unique, and the Discount must not exceed the
 * Sub-total plus tax, because only the server computes totals. Their errors
 * come back as a 409 or a 400 and are shown on the field (`mapServerErrors`).
 */

const INVOICE_NUMBER = /^[A-Za-z0-9][A-Za-z0-9\-_/.#]*$/
const MOBILE_NUMBER = /^\+?[0-9\s\-()]+$/

const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-9

const blankToUndefined = (value: string) => value || undefined

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)

/** An optional text field: a blank one is left out of the request. */
const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .transform(blankToUndefined)

/** A number typed into a text field. The input is a string; the output is a number. */
const numberText = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .pipe(z.coerce.number<string>(`${label} must be a number`))

const isoDate = (label: string) =>
  z.string().min(1, `${label} is required`).refine(isIsoDate, `${label} must be a valid date`)

export const createInvoiceSchema = z
  .object({
    customer: z.object({
      fullname: requiredText('Customer name', 255),
      email: requiredText('Email', 255).pipe(z.email('Enter a valid email address')),
      mobileNumber: z
        .string()
        .trim()
        .refine(
          (value) => value === '' || MOBILE_NUMBER.test(value),
          'Use digits, spaces, "-", "(" and ")", with an optional leading "+"',
        )
        .refine(
          (value) => value === '' || (value.length >= 6 && value.length <= 20),
          'Mobile number must be 6 to 20 characters',
        )
        .transform(blankToUndefined),
      address: optionalText('Address', 500),
    }),
    invoiceNumber: requiredText('Invoice number', 50).regex(
      INVOICE_NUMBER,
      'Start with a letter or digit; then use letters, digits and - _ / . #',
    ),
    invoiceReference: optionalText('Reference', 100),
    invoiceDate: isoDate('Invoice date'),
    dueDate: isoDate('Due date'),
    currency: z.enum(CURRENCY_CODES, 'Choose a currency'),
    description: optionalText('Description', 1000),
    item: z.object({
      name: requiredText('Item name', 255),
      quantity: numberText('Quantity').pipe(
        z
          .number()
          .int('Quantity must be a whole number')
          .min(1, 'Quantity must be at least 1')
          .max(1_000_000, 'Quantity must be at most 1,000,000'),
      ),
      rate: numberText('Rate').pipe(
        z
          .number()
          .positive('Rate must be greater than 0')
          .max(1_000_000, 'Rate must be at most 1,000,000')
          .refine(hasAtMostTwoDecimals, 'Rate must have at most 2 decimal places'),
      ),
    }),
    taxRate: numberText('Tax rate').pipe(
      z
        .number()
        .min(0, 'Tax rate must be between 0 and 100')
        .max(100, 'Tax rate must be between 0 and 100')
        .refine(hasAtMostTwoDecimals, 'Tax rate must have at most 2 decimal places'),
    ),
    discount: numberText('Discount').pipe(
      z
        .number()
        .min(0, 'Discount must not be negative')
        .refine(hasAtMostTwoDecimals, 'Discount must have at most 2 decimal places'),
    ),
  })
  .refine((values) => values.dueDate >= values.invoiceDate, {
    message: 'Due date must be on or after the invoice date',
    path: ['dueDate'],
    // Check the dates even while other fields are still invalid, as long as both dates are real.
    when: ({ value }) => {
      const { invoiceDate, dueDate } = value as { invoiceDate?: unknown; dueDate?: unknown }
      return (
        typeof invoiceDate === 'string' &&
        isIsoDate(invoiceDate) &&
        typeof dueDate === 'string' &&
        isIsoDate(dueDate)
      )
    },
  })

/** What the inputs hold: text, as typed. */
export type CreateInvoiceFormInput = z.input<typeof createInvoiceSchema>
/** What a valid form produces: trimmed text, numbers, and no blank optional fields. */
export type CreateInvoiceFormOutput = z.output<typeof createInvoiceSchema>
export type CreateInvoiceField = FieldPath<CreateInvoiceFormInput>

/** A new form: dated `today`, due 30 days later, in AUD at a 10 % Tax Rate (spec §6.3). */
export function createInvoiceDefaults(today: string): CreateInvoiceFormInput {
  return {
    customer: { fullname: '', email: '', mobileNumber: '', address: '' },
    invoiceNumber: '',
    invoiceReference: '',
    invoiceDate: today,
    dueDate: addDaysIso(today, 30),
    currency: 'AUD',
    description: '',
    item: { name: '', quantity: '1', rate: '' },
    taxRate: '10',
    discount: '0',
  }
}

/** The request body. The form has one item; the API takes a list of exactly one. */
export function toCreateInvoiceRequest(values: CreateInvoiceFormOutput): CreateInvoiceRequest {
  const { item, ...invoice } = values
  return { ...invoice, items: [item] }
}

/** API field paths and the form field and label each maps to, in the form's order. */
const SERVER_FIELDS = new Map<string, [CreateInvoiceField, string]>([
  ['customer.fullname', ['customer.fullname', 'Customer name']],
  ['customer.email', ['customer.email', 'Email']],
  ['customer.mobileNumber', ['customer.mobileNumber', 'Mobile number']],
  ['customer.address', ['customer.address', 'Address']],
  ['invoiceNumber', ['invoiceNumber', 'Invoice number']],
  ['invoiceReference', ['invoiceReference', 'Reference']],
  ['invoiceDate', ['invoiceDate', 'Invoice date']],
  ['dueDate', ['dueDate', 'Due date']],
  ['currency', ['currency', 'Currency']],
  ['description', ['description', 'Description']],
  ['items.0.name', ['item.name', 'Item name']],
  ['items.0.quantity', ['item.quantity', 'Quantity']],
  ['items.0.rate', ['item.rate', 'Rate']],
  ['taxRate', ['taxRate', 'Tax rate']],
  ['discount', ['discount', 'Discount']],
])

export interface ServerErrors {
  /** One message per field, in the form's order, so the first one can take the focus. */
  fieldErrors: Array<{ name: CreateInvoiceField; message: string }>
  /** Messages that name no form field. */
  formErrors: string[]
}

/**
 * Attaches the API's validation messages to form fields. A message starts
 * with the field's path (`items.0.rate must have …`); the path is replaced by
 * the field's label, so the User reads "Rate must have …".
 */
export function mapServerErrors(messages: string[]): ServerErrors {
  const byPath = new Map<string, string>()
  const formErrors: string[] = []
  for (const message of messages) {
    const [path, ...words] = message.split(' ')
    if (SERVER_FIELDS.has(path) && words.length > 0) {
      if (!byPath.has(path)) byPath.set(path, words.join(' '))
    } else {
      formErrors.push(message)
    }
  }
  const fieldErrors = [...SERVER_FIELDS]
    .filter(([path]) => byPath.has(path))
    .map(([path, [name, label]]) => ({ name, message: `${label} ${byPath.get(path)}` }))
  return { fieldErrors, formErrors }
}
```

- [ ] **Step 4: Run the schema test to verify it passes**

Run: `cd frontend && npx vitest run src/features/invoices/schema.test.ts`
Expected: PASS (22 tests).

- [ ] **Step 5: Write the failing page test**

The tests fake only the clock's date and set it to 2 Oct 2026 (`vi.useFakeTimers({ toFake: ['Date'] })`). The defaults are therefore predictable, but timers and MSW still run in real time.

`frontend/src/features/invoices/create/CreateInvoicePage.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { Invoice } from '../../../api/types'
import { makeInvoice } from '../../../test/fixtures'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'

type TestUser = ReturnType<typeof userEvent.setup>

const textbox = (name: string) => screen.getByRole('textbox', { name })

/** Answers every `POST /api/invoices` with `status` and `body`. */
function answerCreate(status: number, body: Record<string, unknown>) {
  server.use(http.post('/api/invoices', () => HttpResponse.json(body, { status })))
}

/** Opens the form and fills in the required fields; the others keep their defaults. */
async function openFilledForm(user: TestUser) {
  renderApp('/invoices/new', { signedIn: true })
  await user.type(await screen.findByRole('textbox', { name: 'Customer name' }), 'Kanglee Trading')
  await user.type(textbox('Email'), 'billing@kanglee.example')
  await user.type(textbox('Invoice number'), 'INV-2026-0042')
  await user.type(textbox('Item name'), 'Consulting')
  await user.type(textbox('Rate'), '19.99')
}

describe('CreateInvoicePage', () => {
  beforeEach(() => {
    // Fake only the clock, so "today" is fixed and every timer still runs.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-02T09:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('starts dated today, due in 30 days, in AUD at a 10 % Tax Rate', async () => {
    renderApp('/invoices/new', { signedIn: true })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'New invoice' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Invoice date/)).toHaveValue('2026-10-02')
    expect(screen.getByLabelText(/^Due date/)).toHaveValue('2026-11-01')
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('AUD (AU$)')
    expect(textbox('Quantity')).toHaveValue('1')
    expect(textbox('Tax rate (%)')).toHaveValue('10')
    expect(textbox('Discount')).toHaveValue('0')
  })

  it('lists what is missing and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    renderApp('/invoices/new', { signedIn: true })

    await user.click(await screen.findByRole('button', { name: 'Create invoice' }))

    expect(await screen.findByText('Customer name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Invoice number is required')).toBeInTheDocument()
    expect(screen.getByText('Item name is required')).toBeInTheDocument()
    expect(screen.getByText('Rate is required')).toBeInTheDocument()
    expect(textbox('Customer name')).toHaveAttribute('aria-invalid', 'true')
    expect(textbox('Customer name')).toHaveFocus()
  })

  it('checks a format as soon as the field is left', async () => {
    const user = userEvent.setup()
    renderApp('/invoices/new', { signedIn: true })

    await user.type(await screen.findByRole('textbox', { name: 'Email' }), 'paul')
    await user.type(textbox('Rate'), '1.005')
    await user.tab()

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Rate must have at most 2 decimal places')).toBeInTheDocument()
  })

  it('rejects a Due Date before the Invoice Date', async () => {
    renderApp('/invoices/new', { signedIn: true })
    const dueDate = await screen.findByLabelText(/^Due date/)

    // user-event cannot type into a native date input; set its value directly.
    fireEvent.change(dueDate, { target: { value: '2026-10-01' } })
    fireEvent.blur(dueDate)

    expect(
      await screen.findByText('Due date must be on or after the invoice date'),
    ).toBeInTheDocument()
  })

  it('creates the Invoice, says so, and shows it at the top of the list', async () => {
    let created: Invoice | undefined
    const received: unknown[] = []
    server.use(
      http.post('/api/invoices', async ({ request }) => {
        received.push(await request.json())
        created = makeInvoice(42, { invoiceNumber: 'INV-2026-0042', status: 'Draft' })
        return HttpResponse.json(created, { status: 201 })
      }),
      http.get('/api/invoices', () =>
        HttpResponse.json({
          data: created ? [created] : [],
          paging: { page: 1, pageSize: 10, total: created ? 1 : 0 },
        }),
      ),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/invoices', { signedIn: true })
    await user.click(await screen.findByRole('link', { name: 'Create invoice' }))

    await user.type(
      await screen.findByRole('textbox', { name: 'Customer name' }),
      'Kanglee Trading',
    )
    await user.type(textbox('Email'), 'billing@kanglee.example')
    await user.type(textbox('Mobile number'), '+65 9477 1736')
    await user.type(textbox('Address'), '1 Raffles Place, Singapore')
    await user.type(textbox('Invoice number'), 'INV-2026-0042')
    await user.type(textbox('Reference'), 'PO-7781')
    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    await user.click(screen.getByRole('option', { name: 'USD (US$)' }))
    await user.type(textbox('Description'), 'Consulting for October')
    await user.type(textbox('Item name'), 'Consulting')
    await user.clear(textbox('Quantity'))
    await user.type(textbox('Quantity'), '3')
    await user.type(textbox('Rate'), '19.99')
    await user.clear(textbox('Discount'))
    await user.type(textbox('Discount'), '1.97')
    await user.click(screen.getByRole('button', { name: 'Create invoice' }))

    expect(await screen.findByText('Invoice INV-2026-0042 created')).toBeInTheDocument()
    // The list was cached before; it shows the new Invoice only because the cache was invalidated.
    expect(await screen.findByRole('link', { name: 'INV-2026-0042' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/invoices')
    expect(received).toEqual([
      {
        customer: {
          fullname: 'Kanglee Trading',
          email: 'billing@kanglee.example',
          mobileNumber: '+65 9477 1736',
          address: '1 Raffles Place, Singapore',
        },
        invoiceNumber: 'INV-2026-0042',
        invoiceReference: 'PO-7781',
        invoiceDate: '2026-10-02',
        dueDate: '2026-11-01',
        currency: 'USD',
        description: 'Consulting for October',
        items: [{ name: 'Consulting', quantity: 3, rate: 19.99 }],
        taxRate: 10,
        discount: 1.97,
      },
    ])
  })

  it('shows a duplicate Invoice Number on its field', async () => {
    answerCreate(409, {
      statusCode: 409,
      message: 'Invoice number INV-2026-0042 already exists',
      error: 'Conflict',
    })
    const user = userEvent.setup()
    await openFilledForm(user)

    await user.click(screen.getByRole('button', { name: 'Create invoice' }))

    expect(
      await screen.findByText('Invoice number INV-2026-0042 already exists'),
    ).toBeInTheDocument()
    expect(textbox('Invoice number')).toHaveAttribute('aria-invalid', 'true')
    expect(textbox('Invoice number')).toHaveFocus()
  })

  it('puts the server validation messages on their fields', async () => {
    answerCreate(400, {
      statusCode: 400,
      message: [
        'discount must not exceed the sub-total plus tax',
        'customer.email must be an email',
        'items must contain exactly 1 item',
      ],
      error: 'Bad Request',
    })
    const user = userEvent.setup()
    await openFilledForm(user)

    await user.click(screen.getByRole('button', { name: 'Create invoice' }))

    expect(
      await screen.findByText('Discount must not exceed the sub-total plus tax'),
    ).toBeInTheDocument()
    expect(screen.getByText('Email must be an email')).toBeInTheDocument()
    expect(screen.getByText('items must contain exactly 1 item')).toBeInTheDocument()
    expect(textbox('Email')).toHaveFocus()
  })

  it('reports an unexpected failure above the form', async () => {
    answerCreate(500, {
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    })
    const user = userEvent.setup()
    await openFilledForm(user)

    await user.click(screen.getByRole('button', { name: 'Create invoice' }))

    expect(
      await screen.findByText('Could not create the invoice. Please try again.'),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL with `Tests  8 failed | 106 passed (114)`. `/invoices/new` is not a route yet, so the page test fails, for example with `Unable to find role="heading" and name "New invoice"`.

- [ ] **Step 7: Write the form and the page**

`frontend/src/features/invoices/create/FormTextField.tsx`:

```tsx
import TextField, { type TextFieldProps } from '@mui/material/TextField'
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'

type FormTextFieldProps<TValues extends FieldValues, TTransformed> = Omit<
  TextFieldProps,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'error' | 'inputRef'
> & {
  name: FieldPath<TValues>
  control: Control<TValues, unknown, TTransformed>
}

/**
 * A MUI text field bound to a React Hook Form field. It shows the field's
 * error, and passes the input's ref so the form can focus an invalid field.
 */
export function FormTextField<TValues extends FieldValues, TTransformed = TValues>({
  name,
  control,
  helperText,
  ...props
}: FormTextFieldProps<TValues, TTransformed>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { ref, ...field }, fieldState }) => (
        <TextField
          fullWidth
          {...props}
          {...field}
          inputRef={ref}
          error={fieldState.invalid}
          helperText={fieldState.error?.message ?? helperText}
        />
      )}
    />
  )
}
```

`frontend/src/features/invoices/create/CreateInvoicePage.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link as RouterLink, useNavigate } from 'react-router'
import { errorMessages, errorStatus } from '../../../api/errors'
import { createInvoice, invoiceKeys } from '../../../api/invoices'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { CURRENCIES } from '../../../lib/currencies'
import { todayIsoDate } from '../../../lib/dates'
import {
  createInvoiceDefaults,
  createInvoiceSchema,
  mapServerErrors,
  toCreateInvoiceRequest,
  type CreateInvoiceFormInput,
  type CreateInvoiceFormOutput,
} from '../schema'
import { FormTextField } from './FormTextField'

const dateLabel = { inputLabel: { shrink: true } }

/**
 * Creates a Draft Invoice with one item (spec §6.3). The form checks what it
 * can; the server computes every total and has the last word. Its answers are
 * shown where the User can act on them: on a field, or above the form.
 */
export function CreateInvoicePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { enqueueSnackbar } = useSnackbar()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const { control, handleSubmit, setError } = useForm<
    CreateInvoiceFormInput,
    unknown,
    CreateInvoiceFormOutput
  >({
    resolver: zodResolver(createInvoiceSchema),
    mode: 'onTouched',
    defaultValues: createInvoiceDefaults(todayIsoDate()),
  })

  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (invoice) => {
      // Every cached list is now out of date; the new Invoice heads the default list.
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
      enqueueSnackbar(`Invoice ${invoice.invoiceNumber} created`, { variant: 'success' })
      navigate('/invoices')
    },
    onError: (error) => {
      const status = errorStatus(error)
      if (status === 409) {
        const [message = 'This invoice number is already in use'] = errorMessages(error)
        setError('invoiceNumber', { message }, { shouldFocus: true })
      } else if (status === 400) {
        const { fieldErrors, formErrors: other } = mapServerErrors(errorMessages(error))
        fieldErrors.forEach(({ name, message }, index) =>
          setError(name, { message }, { shouldFocus: index === 0 }),
        )
        setFormErrors(other)
      } else if (status !== 401) {
        // A 401 means the session expired; AuthProvider already sends the User to sign in.
        setFormErrors(['Could not create the invoice. Please try again.'])
      }
    },
  })

  const onSubmit = (values: CreateInvoiceFormOutput) => {
    setFormErrors([])
    mutation.mutate(toCreateInvoiceRequest(values))
  }

  return (
    <>
      <PageHeader title="New invoice" />
      <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          {formErrors.length > 0 && (
            <Alert severity="error">
              {formErrors.length === 1 ? (
                formErrors[0]
              ) : (
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {formErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </Box>
              )}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard title="Customer">
                <Stack spacing={2}>
                  <FormTextField
                    control={control}
                    name="customer.fullname"
                    label="Customer name"
                    required
                    autoComplete="off"
                  />
                  <FormTextField
                    control={control}
                    name="customer.email"
                    label="Email"
                    type="email"
                    required
                    autoComplete="off"
                  />
                  <FormTextField
                    control={control}
                    name="customer.mobileNumber"
                    label="Mobile number"
                    type="tel"
                    autoComplete="off"
                  />
                  <FormTextField
                    control={control}
                    name="customer.address"
                    label="Address"
                    multiline
                    minRows={2}
                  />
                </Stack>
              </SectionCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard title="Invoice details">
                <Stack spacing={2}>
                  <FormTextField
                    control={control}
                    name="invoiceNumber"
                    label="Invoice number"
                    required
                    autoComplete="off"
                  />
                  <FormTextField
                    control={control}
                    name="invoiceReference"
                    label="Reference"
                    autoComplete="off"
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <FormTextField
                      control={control}
                      name="invoiceDate"
                      label="Invoice date"
                      type="date"
                      required
                      slotProps={dateLabel}
                    />
                    <FormTextField
                      control={control}
                      name="dueDate"
                      label="Due date"
                      type="date"
                      required
                      slotProps={dateLabel}
                    />
                  </Stack>
                  <FormTextField control={control} name="currency" label="Currency" select required>
                    {CURRENCIES.map(({ code, symbol }) => (
                      <MenuItem key={code} value={code}>
                        {`${code} (${symbol})`}
                      </MenuItem>
                    ))}
                  </FormTextField>
                  <FormTextField
                    control={control}
                    name="description"
                    label="Description"
                    multiline
                    minRows={2}
                  />
                </Stack>
              </SectionCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard title="Item">
                <Stack spacing={2}>
                  <FormTextField
                    control={control}
                    name="item.name"
                    label="Item name"
                    required
                    autoComplete="off"
                  />
                  <Stack direction="row" spacing={2}>
                    <FormTextField
                      control={control}
                      name="item.quantity"
                      label="Quantity"
                      required
                      slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                    />
                    <FormTextField
                      control={control}
                      name="item.rate"
                      label="Rate"
                      required
                      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                    />
                  </Stack>
                </Stack>
              </SectionCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard title="Tax & discount">
                <Stack direction="row" spacing={2}>
                  <FormTextField
                    control={control}
                    name="taxRate"
                    label="Tax rate (%)"
                    required
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  />
                  <FormTextField
                    control={control}
                    name="discount"
                    label="Discount"
                    helperText="An amount, not a percentage"
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  />
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button component={RouterLink} to="/invoices">
              Cancel
            </Button>
            <Button type="submit" variant="contained" loading={mutation.isPending}>
              Create invoice
            </Button>
          </Stack>
        </Stack>
      </Box>
    </>
  )
}
```

Replace the whole of `frontend/src/routes.tsx` with:

```tsx
import { Navigate, type RouteObject } from 'react-router'
import { LoginPage } from './auth/LoginPage'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { NotFoundPage } from './components/NotFoundPage'
import { CreateInvoicePage } from './features/invoices/create/CreateInvoicePage'
import { InvoiceDetailPage } from './features/invoices/detail/InvoiceDetailPage'
import { InvoiceListPage } from './features/invoices/list/InvoiceListPage'

/** The route table (spec §6.1), shared by the app's browser router and the tests' memory router. */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/invoices" replace /> },
      { path: 'invoices', element: <InvoiceListPage /> },
      { path: 'invoices/new', element: <CreateInvoicePage /> },
      { path: 'invoices/:invoiceId', element: <InvoiceDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (15 test files, 114 tests).

- [ ] **Step 9: Run every check and the production build**

Run: `cd frontend && npm run format && npm test && npm run lint && npm run typecheck && npm run build`
Expected:
- 114 tests pass.
- `npm run lint` prints nothing. oxlint is silent when there is nothing to report.
- The type check passes.
- The build ends with `✓ built in …` and prints no warning about chunks larger than 500 kB.

- [ ] **Step 10: Commit**

```bash
git add frontend
git commit -m "feat(frontend): create Invoices with client and server validation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 15: Docker images, Compose and the smoke test

Spec §2.1 (the runtime topology), §5.7 (configuration), §5.8 (the container seeds itself), §6.5 (nginx) and §7.4 (the smoke test), for the assessment's single-command start (A§2.4.2) and its configuration rules (A§2.4.3). After this task, `docker compose up --build` on a fresh clone, with no `.env` file, does all of this:
1. starts PostgreSQL, the API and the SPA;
2. migrates and seeds the database;
3. serves the app at http://localhost:8080.

How the pieces fit:
- **db** (`postgres:17-alpine`) keeps its data in the named volume `pgdata`. It is healthy once `pg_isready` answers on TCP.
- **backend** waits for a healthy `db`. Its entrypoint runs the compiled seeder (pending migrations, then the idempotent seed) when `SEED_ON_START=true`. Then it `exec`s the API, so the API is PID 1 and `docker compose stop` reaches Node's SIGTERM handling (`enableShutdownHooks`, Task 5).
  - It runs as the unprivileged `node` user with production dependencies only.
  - The image deletes the `pre*` npm hooks: `dist/` is already built, and the runtime image has no Nest CLI. `docker compose exec backend npm run seed` then runs the compiled seeder directly.
- **frontend** waits for a healthy `backend`. An unprivileged nginx serves the built SPA on port 8080 and proxies `/api/*` to `backend:3000`, without the `/api` prefix.
- Every compose setting reads an environment variable and falls back to a labelled **local-only** default (`${VAR:-default}`), so a fresh clone needs no `.env`. The application code still has no default for any secret (Global Constraints). Host ports are bound to `127.0.0.1` only.

Two nginx details are easy to get wrong:
- A location inherits `add_header` only when it has no `add_header` of its own. Both `/assets/` and `/` set `Cache-Control`, so each of them includes `security-headers.conf`. `/api/` includes nothing: the API's own helmet headers pass through unchanged, and no header appears twice.
- nginx is the edge. So it sets `X-Forwarded-For` to the client address instead of appending to the header the client sent. Otherwise a client could choose the address that the login throttle counts (the API trusts private-network proxies, `TRUST_PROXY`).

**Files:**
- Create: `scripts/smoke-test.sh` (executable)
- Create: `backend/Dockerfile`, `backend/docker-entrypoint.sh`, `backend/.dockerignore`
- Create: `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/security-headers.conf`, `frontend/.dockerignore`
- Create: `docker-compose.yml`, `.env.example`, `.gitattributes`

**Interfaces:**
- Consumes:
  - From Tasks 1–8 (backend):
    - `npm run build` writes `dist/main.js` and `dist/database/seed/run-seed.js` (`--reset` truncates the Invoices first).
    - The npm hooks `preseed`, `preseed:reset`, `premigration:run` and `premigration:revert` (Task 1).
    - The env keys of §5.7.
    - `GET /health`: 200 when the database answers.
    - `/api/docs` and `/api/docs-json`.
    - `POST /auth/login` (200 and the cookie `access_token`), `GET /auth/me`, `POST /auth/logout` (204) and `GET /invoices?keyword=`. The API accepts the cookie only with `X-Requested-With: XMLHttpRequest`.
    - The seeder prints `Seed complete: default User <email>, <n> Invoice(s) inserted.`; with `--reset` it prints `Seed complete (reset): …`.
  - From Tasks 9–14 (frontend): `npm run build` writes `dist/`: `index.html` with `<div id="root">`, and hashed files under `dist/assets/`. The SPA calls `/api` unless `VITE_API_BASE_URL` is set.
- Produces:
  - `docker compose up --build`: the services `db`, `backend` and `frontend`, which become healthy in that order.
  - Host ports `127.0.0.1:8080` (SPA), `127.0.0.1:3000` (API and Swagger) and `127.0.0.1:5432` (PostgreSQL). `FRONTEND_PORT`, `BACKEND_PORT` and `DB_PORT` override them.
  - The compose local-only defaults that the README (Task 17) documents: database user `simple_invoice`, password `local-only-db-password`, database `simple_invoice`; the default User `admin@example.com` / `Password123!`.
  - `scripts/smoke-test.sh`, which exits 0 against a healthy stack. Task 16's CI runs it.
  - The root `.env.example`.

- [ ] **Step 1: Write the smoke test**

`scripts/smoke-test.sh`:

```bash
#!/usr/bin/env bash
# Smoke test of the running Docker stack (spec §7.4). It checks the SPA, the
# API through the SPA's /api proxy with the session cookie, and Swagger.
#
#   docker compose up -d --build --wait
#   ./scripts/smoke-test.sh
#
# It reads the compose defaults. If your .env changes a port or the seeded
# credentials, export the same variables before running it. It changes no data.
set -euo pipefail

FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT:-8080}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT:-3000}"
EMAIL="${SEED_USER_EMAIL:-admin@example.com}"
PASSWORD="${SEED_USER_PASSWORD:-Password123!}"
APPENDIX_A_NUMBER="IV1780488206995"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
jar="$work/cookies.txt"

ok() { printf 'ok   %s\n' "$1"; }
fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}
# Prints a value from the JSON on stdin, e.g. `json d.paging.total < file`.
json() { node -e "const d = JSON.parse(require('node:fs').readFileSync(0, 'utf8')); console.log($1)"; }
# The SPA's requests: the session cookie plus the header the API requires with it (ADR-0002).
api() { curl -sS -b "$jar" -c "$jar" -H 'X-Requested-With: XMLHttpRequest' "$@"; }

curl -fsS -D "$work/headers.txt" -o "$work/index.html" "$FRONTEND_URL/" || fail "GET $FRONTEND_URL/"
grep -q '<div id="root">' "$work/index.html" || fail "GET / did not return the SPA"
grep -qi '^content-security-policy:' "$work/headers.txt" || fail "GET / has no Content-Security-Policy"
ok "GET / serves the SPA with its security headers"

status=$(api -o /dev/null -w '%{http_code}' "$FRONTEND_URL/api/invoices")
[ "$status" = 401 ] || fail "GET /api/invoices without a session returned $status, not 401"
ok "GET /api/invoices without a session returns 401"

status=$(api -o "$work/login.json" -w '%{http_code}' -H 'Content-Type: application/json' \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$FRONTEND_URL/api/auth/login")
[ "$status" = 200 ] || fail "POST /api/auth/login returned $status, not 200"
grep -q 'access_token' "$jar" || fail "POST /api/auth/login set no access_token cookie"
ok "POST /api/auth/login signs in and sets the session cookie"

[ "$(api "$FRONTEND_URL/api/auth/me" | json d.email)" = "$EMAIL" ] || fail "GET /api/auth/me"
ok "GET /api/auth/me returns $EMAIL"

api -f -o "$work/list.json" "$FRONTEND_URL/api/invoices?keyword=$APPENDIX_A_NUMBER" || fail "GET /api/invoices"
[ "$(json 'd.data.map((i) => i.invoiceNumber).join()' < "$work/list.json")" = "$APPENDIX_A_NUMBER" ] ||
  fail "GET /api/invoices?keyword=$APPENDIX_A_NUMBER did not find the seeded Appendix A Invoice"
ok "GET /api/invoices finds the seeded Appendix A Invoice"

status=$(api -o /dev/null -w '%{http_code}' -X POST "$FRONTEND_URL/api/auth/logout")
[ "$status" = 204 ] || fail "POST /api/auth/logout returned $status, not 204"
status=$(api -o /dev/null -w '%{http_code}' "$FRONTEND_URL/api/auth/me")
[ "$status" = 401 ] || fail "GET /api/auth/me after logout returned $status, not 401"
ok "POST /api/auth/logout ends the session"

curl -fsS -o "$work/openapi.json" "$BACKEND_URL/api/docs-json" || fail "GET $BACKEND_URL/api/docs-json"
[ "$(json "'/invoices/{id}' in d.paths" < "$work/openapi.json")" = true ] ||
  fail "the OpenAPI document does not describe /invoices/{id}"
ok "Swagger documents the API at $BACKEND_URL/api/docs"

echo "Smoke test passed."
```

Make it executable:

```bash
chmod +x scripts/smoke-test.sh
```

The script reads JSON with `node -e`, because every machine that works on this repository has Node. It uses the compose defaults. When a `.env` changes the ports or the seeded credentials, export the same variables before you run it.

- [ ] **Step 2: Run the smoke test to verify it fails**

No stack is running yet.

Run: `./scripts/smoke-test.sh; echo "exit $?"`
Expected: curl reports `Failed to connect to 127.0.0.1 port 8080`, then the script prints `FAIL GET http://127.0.0.1:8080/` and `exit 1`.

If another program already uses port 8080, stop it now: the stack needs the port in Step 7.

- [ ] **Step 3: Write the backend container files**

`backend/Dockerfile`:

```dockerfile
# Builds the API, then runs the compiled code as the unprivileged `node` user
# with production dependencies only.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
# No npm update notices in the output of `docker compose exec backend npm run …`.
ENV NODE_ENV=production \
  NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
COPY package.json package-lock.json ./
# dist/ is already built, so the build hooks of the seed and migration scripts
# go. `docker compose exec backend npm run seed` then runs the compiled seeder.
RUN npm ci --omit=dev \
  && npm pkg delete scripts.preseed scripts.preseed:reset scripts.premigration:run scripts.premigration:revert \
  && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
USER node
EXPOSE 3000
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
```

`backend/docker-entrypoint.sh`:

```bash
#!/bin/sh
# Starts the API container. With SEED_ON_START=true it first runs the seeder,
# which applies pending migrations and inserts only the missing demo data, so
# every start is safe (spec §5.8). Then it runs the command (the API) as PID 1.
set -e
if [ "$SEED_ON_START" = "true" ]; then
  node dist/database/seed/run-seed.js
fi
exec "$@"
```

The Dockerfile starts the entrypoint with `sh`, so the file needs no executable bit.

`backend/.dockerignore`:

```gitignore
# Only the sources go into the build. A local .env must not change the image.
node_modules
dist
coverage
*.tsbuildinfo
*.log
.env
.env.*
Dockerfile
.dockerignore
```

- [ ] **Step 4: Write the frontend container files**

`frontend/Dockerfile`:

```dockerfile
# Builds the SPA, then serves it with an unprivileged nginx that also proxies
# /api to the backend (spec §6.5).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
```

`frontend/nginx.conf`:

```nginx
# The SPA and its API proxy (spec §6.5). The browser talks to one origin: the
# app's files, and /api/*, which goes to the backend without the /api prefix.
# The httpOnly session cookie therefore stays first-party (ADR-0002).
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    server_tokens off;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    location /api/ {
        # The trailing slash replaces /api/ with /, so /api/invoices → /invoices.
        proxy_pass http://backend:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        # nginx is the edge, so it sets the client address instead of appending
        # to it: a client cannot pick the address the login throttle counts.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Build output with hashed names: a changed file gets a new name.
    location /assets/ {
        include /etc/nginx/snippets/security-headers.conf;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }

    # Every other path is a client-side route: serve the app shell, never cached,
    # so a new release is picked up on the next visit.
    location / {
        include /etc/nginx/snippets/security-headers.conf;
        add_header Cache-Control "no-cache" always;
        try_files $uri /index.html;
    }
}
```

`frontend/security-headers.conf`:

```nginx
# Security headers of the SPA (spec §6.5). Each location that sets its own
# headers includes this file, because nginx then ignores add_header from the
# outer level. Emotion injects <style> tags, so only styles allow 'unsafe-inline'.
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "DENY" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
```

`frontend/.dockerignore`:

```gitignore
# Only the sources go into the build. A local .env must not change the image.
node_modules
dist
coverage
*.tsbuildinfo
*.log
.env
.env.*
Dockerfile
.dockerignore
```

- [ ] **Step 5: Write the compose file and the root `.env.example`**

`docker-compose.yml`:

```yaml
# SimpleInvoice: the whole stack with one command, `docker compose up --build`.
#
# Every setting below reads an environment variable (from .env or the shell)
# and falls back to a LOCAL-ONLY default, so a fresh clone runs without a .env
# file. These defaults are for one developer machine. For anything else, set
# every secret in .env (see .env.example). An empty value also uses the default.

name: simple-invoice

services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-simple_invoice}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-local-only-db-password}
      POSTGRES_DB: ${POSTGRES_DB:-simple_invoice}
    ports:
      - "127.0.0.1:${DB_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      # -h 127.0.0.1: on the first start the image runs a temporary server that
      # listens only on the Unix socket; only the final server answers on TCP.
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U \"$$POSTGRES_USER\" -d \"$$POSTGRES_DB\""]
      interval: 2s
      timeout: 5s
      retries: 30

  backend:
    build: ./backend
    environment:
      PORT: 3000
      DATABASE_URL: postgres://${POSTGRES_USER:-simple_invoice}:${POSTGRES_PASSWORD:-local-only-db-password}@db:5432/${POSTGRES_DB:-simple_invoice}
      JWT_SECRET: ${JWT_SECRET:-local-only-jwt-secret-do-not-use-in-production}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-3600}
      COOKIE_SECURE: ${COOKIE_SECURE:-auto}
      APP_TIMEZONE: ${APP_TIMEZONE:-UTC}
      LOGIN_THROTTLE_LIMIT: ${LOGIN_THROTTLE_LIMIT:-5}
      LOGIN_THROTTLE_TTL: ${LOGIN_THROTTLE_TTL:-60}
      TRUST_PROXY: ${TRUST_PROXY:-loopback, linklocal, uniquelocal}
      SEED_ON_START: ${SEED_ON_START:-true}
      SEED_USER_EMAIL: ${SEED_USER_EMAIL:-admin@example.com}
      SEED_USER_PASSWORD: ${SEED_USER_PASSWORD:-Password123!}
      SEED_USER_FULLNAME: ${SEED_USER_FULLNAME:-Admin User}
    ports:
      - "127.0.0.1:${BACKEND_PORT:-3000}:3000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:3000/health"]
      interval: 5s
      timeout: 5s
      retries: 30
      start_period: 30s

  frontend:
    build: ./frontend
    ports:
      - "127.0.0.1:${FRONTEND_PORT:-8080}:8080"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
```

`.env.example`:

```dotenv
# SimpleInvoice with Docker Compose. This file is optional: docker-compose.yml
# has a LOCAL-ONLY default for every key, so `docker compose up --build` works
# without it. For anything beyond a trial on your own machine, run
#   cp .env.example .env
# and set every secret below. An empty value falls back to the compose
# default. Never commit .env.

# Host ports. Each one is bound to 127.0.0.1 only.
FRONTEND_PORT=8080
BACKEND_PORT=3000
DB_PORT=5432

# PostgreSQL. The password is part of DATABASE_URL, so use URL-safe
# characters, for example: openssl rand -hex 24
POSTGRES_USER=simple_invoice
POSTGRES_PASSWORD=
POSTGRES_DB=simple_invoice

# HS256 signing secret of the API, at least 32 characters. Generate one with:
#   openssl rand -base64 48
JWT_SECRET=

# Access-token lifetime in seconds
JWT_EXPIRES_IN=3600

# Secure flag of the auth cookie: auto (on behind TLS) | true | false
COOKIE_SECURE=auto

# IANA time zone that defines "today" for the Overdue Status
APP_TIMEZONE=UTC

# Login throttle: attempts per TTL seconds, per client IP
LOGIN_THROTTLE_LIMIT=5
LOGIN_THROTTLE_TTL=60

# Express "trust proxy" value. The default trusts the bundled nginx on the
# private Docker network; a production deployment must name its real proxy.
TRUST_PROXY=loopback, linklocal, uniquelocal

# true: seed on every start of the backend container. The seed adds only
# missing data, so restarts are safe.
SEED_ON_START=true

# The default User. Choose a password of 8-128 characters.
SEED_USER_EMAIL=admin@example.com
SEED_USER_PASSWORD=
SEED_USER_FULLNAME=Admin User
```

The root `.gitignore` (Task 1) ignores `.env` and keeps `.env.example`.

`.gitattributes`:

```gitattributes
# Shell scripts run inside Linux containers and on CI, so they keep LF line
# endings on every platform. A CRLF checkout (Windows with core.autocrlf) would
# otherwise break docker-entrypoint.sh in the backend container.
*.sh text eol=lf
```

- [ ] **Step 6: Validate the compose file**

Run: `docker compose config --quiet && echo valid && docker compose config | grep -c 'host_ip: 127.0.0.1'`
Expected: `valid`, then `3` (every published port listens on 127.0.0.1 only).

- [ ] **Step 7: Build and start the stack**

Run: `docker compose up -d --build --wait --wait-timeout 300`
Expected: the images build, and the command exits 0. Its last lines report each container as `Healthy`, for example:

```
 Container simple-invoice-backend-1 Healthy
 Container simple-invoice-db-1 Healthy
 Container simple-invoice-frontend-1 Healthy
```

The first build downloads the base images and installs the dependencies, so it can take a few minutes. If a container does not become healthy, `docker compose logs backend` shows why (for example, a configuration error).

- [ ] **Step 8: Check that the container seeded the database**

Run: `docker compose logs --no-log-prefix backend | grep "Seed complete"`
Expected: `Seed complete: default User admin@example.com, 41 Invoice(s) inserted.`

- [ ] **Step 9: Run the smoke test to verify it passes**

Run: `./scripts/smoke-test.sh`
Expected:

```
ok   GET / serves the SPA with its security headers
ok   GET /api/invoices without a session returns 401
ok   POST /api/auth/login signs in and sets the session cookie
ok   GET /api/auth/me returns admin@example.com
ok   GET /api/invoices finds the seeded Appendix A Invoice
ok   POST /api/auth/logout ends the session
ok   Swagger documents the API at http://127.0.0.1:3000/api/docs
Smoke test passed.
```

- [ ] **Step 10: Check the nginx headers, the caching, the SPA fallback and the users**

Run:

```bash
curl -sI http://127.0.0.1:8080/ \
  | grep -iE '^(cache-control|content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy):' \
  | cut -c1-60
asset=$(curl -s http://127.0.0.1:8080/ | grep -o '/assets/index-[^"]*\.js' | head -1)
curl -sI -H 'Accept-Encoding: gzip' "http://127.0.0.1:8080$asset" | grep -iE '^(cache-control|content-encoding):'
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://127.0.0.1:8080/invoices/new
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/assets/missing.js
curl -s -D - -o /dev/null http://127.0.0.1:8080/api/health | grep -ci '^content-security-policy:'
docker compose exec backend id -u
docker compose exec frontend id -u
```

Expected, in order:
- Six header lines: `Content-Security-Policy: default-src 'self'; …`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), …` and `Cache-Control: no-cache`.
- `Cache-Control: public, max-age=31536000, immutable` and `Content-Encoding: gzip` for the hashed asset.
- `200 text/html`: a client-side route gets the app shell.
- `404`: a missing asset is not answered with the app shell.
- `1`: an API response has only the API's own (helmet) Content-Security-Policy; nginx adds no second one.
- `1000` (the `node` user) and `101` (the `nginx` user): neither container runs as root.

- [ ] **Step 11: Check that a restart and the seed scripts are safe**

Run:

```bash
docker compose restart backend
docker compose up -d --wait --wait-timeout 120
docker compose logs --no-log-prefix backend | grep "Seed complete"
docker compose exec backend npm run seed
docker compose exec backend npm run seed:reset
```

Expected:
- After the restart, the log has a second line: `Seed complete: default User admin@example.com, 0 Invoice(s) inserted.` The entrypoint seeded again and inserted nothing.
- `npm run seed` prints `Seed complete: default User admin@example.com, 0 Invoice(s) inserted.` No `nest build` runs first: the image has no `pre*` hooks.
- `npm run seed:reset` prints `Seed complete (reset): default User admin@example.com, 41 Invoice(s) inserted.`

- [ ] **Step 12: Stop the stack and delete its data**

Run: `docker compose down -v`
Expected: the three containers, the network `simple-invoice_default` and the volume `simple-invoice_pgdata` are removed.

- [ ] **Step 13: Commit**

Run `git status --short` first: it must list only the files of this task, and no `.env` file.

```bash
git add scripts/smoke-test.sh backend/Dockerfile backend/docker-entrypoint.sh backend/.dockerignore \
  frontend/Dockerfile frontend/nginx.conf frontend/security-headers.conf frontend/.dockerignore \
  docker-compose.yml .env.example .gitattributes
git commit -m "feat: run the whole stack with Docker Compose

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 16: Continuous integration

Spec §7.4. GitHub Actions runs on every push to `main` and on every pull request. It has three jobs, which run in parallel:
1. **backend:** `npm ci`, lint, the Prettier check, the type check, the build, the unit tests, then the e2e tests. Testcontainers uses the runner's Docker.
2. **frontend:** `npm ci`, lint, the Prettier check, the type check, the tests, then the build.
3. **compose-smoke:** builds and starts the whole stack with no `.env` file and waits until every service is healthy. Then it runs `scripts/smoke-test.sh`, prints the logs if something failed, and always removes the stack.

The workflow token can only read the repository (`permissions: contents: read`). A newer push cancels the older run of the same branch.

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes:
  - From Task 1 (backend npm scripts): `lint`, `typecheck`, `build`, `test` and `test:e2e`.
  - From Task 9 (frontend npm scripts): `lint`, `format:check`, `typecheck`, `test` and `build`.
  - From Task 15: `docker compose up --wait` and `scripts/smoke-test.sh`.
- Produces: `.github/workflows/ci.yml`, with the jobs `backend`, `frontend` and `compose-smoke`. The README (Task 17) describes it.

- [ ] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:

```yaml
# CI (spec §7.4): each app's lint, type check, tests and build, then the whole
# Docker stack with a smoke test through the SPA's /api proxy.
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npx prettier --check "src/**/*.ts" "test/**/*.ts"
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
      # Testcontainers starts postgres:17-alpine on the runner's Docker.
      - run: npm run test:e2e

  frontend:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run typecheck
      - run: npm test
      - run: npm run build

  compose-smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
      # No .env file: the stack runs on the compose file's local-only defaults.
      - run: docker compose up -d --build --wait --wait-timeout 300
      - run: ./scripts/smoke-test.sh
      - if: failure()
        run: docker compose logs
      - if: always()
        run: docker compose down -v
```

- [ ] **Step 2: Lint the workflow**

Run: `docker run --rm -v "$PWD/.github/workflows:/wf" --workdir /wf rhysd/actionlint:latest -color=false ci.yml && echo "actionlint: ok"`
Expected: `actionlint: ok`, and nothing else. actionlint checks the workflow syntax, the job and step keys, and the expressions.

- [ ] **Step 3: Run the backend job's commands**

`npm ci` installs exactly what the lock file lists. It fails when `package.json` and `package-lock.json` disagree, as it would in CI.

Run: `cd backend && npm ci && npm run lint && npx prettier --check "src/**/*.ts" "test/**/*.ts" && npm run typecheck && npm run build && npm test && npm run test:e2e`
Expected: every command succeeds. Prettier prints `All matched files use Prettier code style!`.

- [ ] **Step 4: Run the frontend job's commands**

Run: `cd frontend && npm ci && npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: every command succeeds.

- [ ] **Step 5: Run the compose-smoke job's commands**

Run: `docker compose up -d --build --wait --wait-timeout 300 && ./scripts/smoke-test.sh`
Expected: the stack becomes healthy, and the smoke test ends with `Smoke test passed.`

Then run: `docker compose down -v`

- [ ] **Step 6: Commit**

The workflow runs on GitHub once the repository is pushed. This plan does not push (Global Constraints).

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, test and build both apps, then smoke-test the Docker stack

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 17: README

Spec §8 (delivery) and §10 (known limitations), for the assessment's documentation requirement. The README is the reviewer's entry point:
- a quick start with one command;
- the default credentials;
- the configuration;
- running without Docker;
- the demo data;
- the API with curl examples;
- the business rules;
- the tests;
- the architecture;
- the project structure;
- the design decisions, security notes and known limitations.

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes:
  - From Task 15: the ports, the compose defaults, `scripts/smoke-test.sh` and the seed commands.
  - From Task 16: `.github/workflows/ci.yml`.
  - From Tasks 4 and 8: the Appendix A Invoice (`099ca7da-a290-40fa-93b9-1c43ae7bb887`, `IV1780488206995`), the generated Invoices and the create rules.
  - The documents `CONTEXT.md`, `docs/adr/0001-customer-snapshot-on-invoice.md`, `docs/adr/0002-jwt-in-httponly-cookie.md` and `docs/specs/2026-10-02-simple-invoice-design.md`.
- Produces: `README.md`.

- [ ] **Step 1: Write the README**

`README.md`:

````markdown
# SimpleInvoice

SimpleInvoice is a small invoicing app. A signed-in User can list, search, filter, sort and page through Invoices, open an Invoice to see every detail, and create a new one. The backend calculates every amount.

- **Frontend:** a React 19 + TypeScript single-page app (Vite, React Router, TanStack Query, React Hook Form + Zod, MUI).
- **Backend:** a NestJS 12 + TypeScript REST API (TypeORM, PostgreSQL 17, JWT, Swagger).
- **Delivery:** one Docker Compose command for the whole stack, seeded demo data, unit and e2e tests, and GitHub Actions CI.

**Features**
- Sign in with email and password, and sign out.
- Invoice list: search by Invoice Number or Customer name, filter by Status (Overdue included) and by Invoice Date, sort, and page through the results on the server. Phones get cards; wider screens get a table.
- Invoice detail: the Customer, the Invoice Item and the full breakdown of the amounts, down to the Balance.
- Create an Invoice: the form validates the input, and the server validates it again and calculates the totals.

## Contents

- [Quick start (Docker)](#quick-start-docker)
- [Configuration](#configuration)
- [Running without Docker](#running-without-docker)
- [Demo data](#demo-data)
- [API](#api)
- [Business rules](#business-rules)
- [Tests](#tests)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Design decisions](#design-decisions)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)

## Quick start (Docker)

You need Docker with Docker Compose v2. Nothing else.

```bash
docker compose up --build
```

When the three services are up, open **http://localhost:8080** and sign in:

| Email | Password |
|---|---|
| `admin@example.com` | `Password123!` |

The first build takes a few minutes. Each time the backend container starts, it applies the database migrations and seeds the demo data. The seed adds only what is missing, so a restart is safe.

| Service | Address | Notes |
|---|---|---|
| Frontend | http://localhost:8080 | the app; it reaches the API through `/api` on the same origin |
| Backend | http://localhost:3000 | the REST API |
| Swagger UI | http://localhost:3000/api/docs | interactive API documentation; the OpenAPI JSON is at `/api/docs-json` |
| PostgreSQL | `localhost:5432` | database `simple_invoice`, user `simple_invoice` |

Every port listens on `127.0.0.1` only. If a port is already in use, choose another one:

```bash
FRONTEND_PORT=8081 BACKEND_PORT=3001 DB_PORT=5433 docker compose up --build
```

You can also set these ports in a `.env` file (see [Configuration](#configuration)).

To stop the stack, run `docker compose down`. To stop it and delete the database, run `docker compose down -v`.

## Configuration

All configuration comes from environment variables.

- `docker-compose.yml` reads each setting from the environment or from a root `.env` file. When a setting is missing or empty, it uses a **local-only default**, so `docker compose up` works on a fresh clone. These defaults (the database password, the JWT secret and the demo password among them) are for one developer machine only.
- For any other use, create a `.env` file and set every secret:

  ```bash
  cp .env.example .env
  # Then set POSTGRES_PASSWORD, JWT_SECRET and SEED_USER_PASSWORD, for example:
  #   openssl rand -hex 24      a database password
  #   openssl rand -base64 48   a JWT secret
  ```

- `.env` files are ignored by git. Only the `.env.example` files are committed, and they contain no real secret.
- The API validates its configuration when it starts. It stops when a value is missing or invalid, for example a `JWT_SECRET` shorter than 32 characters. The code has no default for any secret.

| Variable | Compose default | Purpose |
|---|---|---|
| `FRONTEND_PORT`, `BACKEND_PORT`, `DB_PORT` | `8080`, `3000`, `5432` | host ports, on 127.0.0.1 |
| `POSTGRES_USER`, `POSTGRES_DB` | `simple_invoice` | database user and database name |
| `POSTGRES_PASSWORD` | `local-only-db-password` | database password; use URL-safe characters |
| `JWT_SECRET` | a local-only value | HS256 signing secret, at least 32 characters |
| `JWT_EXPIRES_IN` | `3600` | token lifetime in seconds |
| `COOKIE_SECURE` | `auto` | `Secure` flag of the session cookie: `auto` (on behind TLS), `true` or `false` |
| `APP_TIMEZONE` | `UTC` | IANA time zone that defines "today" for Overdue |
| `LOGIN_THROTTLE_LIMIT`, `LOGIN_THROTTLE_TTL` | `5`, `60` | login attempts allowed per TTL seconds, per client IP |
| `TRUST_PROXY` | `loopback, linklocal, uniquelocal` | Express `trust proxy` setting; trusts the bundled nginx |
| `SEED_ON_START` | `true` | seed the database each time the backend container starts |
| `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`, `SEED_USER_FULLNAME` | `admin@example.com`, `Password123!`, `Admin User` | the default User |

`backend/.env.example` and `frontend/.env.example` list the settings for running the apps without Docker.

## Running without Docker

You need Node.js 24.15 or later (22.22.2 or a later 22.x also works) and PostgreSQL 17. If the Docker stack is running, stop it first with `docker compose down`, because its backend uses port 3000.

1. Start PostgreSQL. The easiest way is to start only the compose database:

   ```bash
   docker compose up -d db
   ```

   Without a root `.env` file, its connection URL is `postgres://simple_invoice:local-only-db-password@localhost:5432/simple_invoice`. You can use your own PostgreSQL 17 server instead.

2. Start the API on http://localhost:3000 (Swagger UI at http://localhost:3000/api/docs):

   ```bash
   cd backend
   cp .env.example .env
   # Edit .env: put the database password into DATABASE_URL, and set
   # JWT_SECRET (openssl rand -base64 48) and SEED_USER_PASSWORD (8-128 characters).
   npm ci
   npm run seed        # compiles the code, applies the migrations, seeds the demo data
   npm run start:dev   # starts the API and restarts it when a file changes
   ```

3. In a second terminal, start the app on http://localhost:5173:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

   The Vite dev server sends `/api` requests to `http://localhost:3000`, as nginx does in Docker. For another backend address, copy `frontend/.env.example` to `frontend/.env` and change `API_PROXY_TARGET`.

Sign in as `admin@example.com` with the `SEED_USER_PASSWORD` that you chose.

## Demo data

The seed creates:
- the default User, `admin@example.com` (password `Password123!` with the compose defaults);
- the Invoice from Appendix A of the assessment, `IV1780488206995`, exactly as given. It is partly paid and past its Due Date, so its Status is **Overdue**;
- 40 generated Invoices, `INV-0001` to `INV-0040`. They are the same on every run, with dates relative to the day of seeding, so some are always Overdue. They mix every Status, five currencies, several tax rates and discounts, and similar Customer names for trying the search (for example "Nguyen Van An" and "Nguyen Thi Binh").

| Command | Effect |
|---|---|
| (automatic) | the backend container seeds on every start (`SEED_ON_START=true`) |
| `docker compose exec backend npm run seed` | applies pending migrations, then inserts only the missing demo data |
| `docker compose exec backend npm run seed:reset` | deletes every Invoice, then seeds again; Users are kept |
| `docker compose down -v` | deletes the whole database; the next `docker compose up` starts from zero |

Without Docker, run `npm run seed` or `npm run seed:reset` in `backend/`. Both compile the code first.

## API

Swagger UI is at **http://localhost:3000/api/docs**. To call protected endpoints there, sign in with `POST /auth/login`, click **Authorize** and paste the `accessToken`.

| Method | Path | Sign-in | Success | Errors |
|---|---|---|---|---|
| `POST` | `/auth/login` | no; 5 attempts per minute per IP | 200 `{ accessToken, tokenType, expiresIn, user }` and the session cookie | 400, 401, 429 |
| `GET` | `/auth/me` | yes | 200 the signed-in User | 401 |
| `POST` | `/auth/logout` | yes | 204; clears the session cookie | 401 |
| `GET` | `/invoices` | yes | 200 `{ data: Invoice[], paging: { page, pageSize, total } }` | 400, 401 |
| `GET` | `/invoices/{id}` | yes | 200 the Invoice | 400, 401, 404 |
| `POST` | `/invoices` | yes | 201 the new Invoice and a `Location` header | 400, 401, 409 |
| `GET` | `/health` | no | 200 when the database answers, otherwise 503 | |

The query parameters of `GET /invoices` are all optional:

| Parameter | Values | Default |
|---|---|---|
| `page` | an integer from 1 | `1` |
| `pageSize` | an integer from 1 to 100 | `10` |
| `keyword` | part of an Invoice Number or a Customer name, in any case | none |
| `status` | `Draft`, `Pending`, `Paid` or `Overdue` | all |
| `fromDate`, `toDate` | `YYYY-MM-DD`; an inclusive range of Invoice Dates | none |
| `sortBy` | `invoiceDate`, `dueDate` or `totalAmount` | the creation time |
| `ordering` | `ASC` or `DESC` | `DESC`, so the newest come first |

### Authentication

The API accepts the JWT in two ways ([ADR-0002](docs/adr/0002-jwt-in-httponly-cookie.md)):
- **API tools** (curl, Swagger UI, Postman) send `Authorization: Bearer <accessToken>`.
- **The browser app** never touches the token. `POST /auth/login` also puts it in an `HttpOnly`, `SameSite=Strict` cookie, which page scripts cannot read. The API accepts that cookie only together with the header `X-Requested-With: XMLHttpRequest`, which a form on another site cannot send.

A token is valid for `JWT_EXPIRES_IN` seconds (one hour by default). There are no refresh tokens.

### curl examples

```bash
# Sign in and keep the token. sed takes the "accessToken" value from the JSON.
TOKEN=$(curl -s http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Password123!"}' \
  | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')

# The five newest Overdue Invoices
curl -s "http://localhost:3000/invoices?status=Overdue&pageSize=5" \
  -H "Authorization: Bearer $TOKEN"

# Search Invoice Numbers and Customer names for "acme", earliest Due Date first
curl -s "http://localhost:3000/invoices?keyword=acme&sortBy=dueDate&ordering=ASC" \
  -H "Authorization: Bearer $TOKEN"

# One Invoice: the Appendix A Invoice
curl -s http://localhost:3000/invoices/099ca7da-a290-40fa-93b9-1c43ae7bb887 \
  -H "Authorization: Bearer $TOKEN"

# Create an Invoice. The API calculates every total.
curl -s http://localhost:3000/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "invoiceNumber": "INV-2026-0042",
    "invoiceReference": "PO-7781",
    "invoiceDate": "2026-10-01",
    "dueDate": "2026-12-31",
    "currency": "USD",
    "description": "Consulting for September",
    "customer": {
      "fullname": "Kanglee Trading",
      "email": "billing@kanglee.example",
      "mobileNumber": "+65 9477 1736",
      "address": "1 Raffles Place, Singapore"
    },
    "items": [{ "name": "Consulting", "quantity": 3, "rate": 19.99 }],
    "taxRate": 10,
    "discount": 1.97
  }'
```

The create call returns 201 with `"invoiceSubTotal":59.97`, `"totalTax":6`, `"totalDiscount":1.97` and `"totalAmount":64`. A new Invoice is a Draft; like any unpaid Invoice, it reads Overdue after its Due Date. The same call again returns 409, because an Invoice Number must be unique, regardless of case.

### Errors

Every error has the same JSON shape:

```json
{ "statusCode": 404, "message": "Invoice not found", "error": "Not Found" }
```

For a validation error (400), `message` is a list with one entry per problem:

```json
{ "statusCode": 400, "message": ["dueDate must be on or after invoiceDate"], "error": "Bad Request" }
```

| Status | When |
|---|---|
| 400 | the body or the query fails validation, has an unknown field, or the id is not a UUID |
| 401 | no token, or an invalid or expired one; a wrong email or password |
| 404 | the Invoice does not exist |
| 409 | the Invoice Number is already used, regardless of case |
| 429 | too many login attempts |
| 500 | an unexpected error; the details go to the server log, never to the client |

## Business rules

- **Totals** come only from the backend, which uses exact decimal maths:
  - Sub-total = quantity × Rate, summed over the Invoice Items.
  - Tax Amount = Sub-total × Tax Rate ÷ 100, rounded half-up to 2 decimal places. The Tax Rate is 10 % unless the Invoice gives another one.
  - Total Amount = Sub-total + Tax Amount − Discount. The Discount is an amount, not a percentage, and it cannot be more than Sub-total + Tax Amount.
  - Balance = Total Amount − Total Paid.
- **Status.** The database stores Draft, Pending or Paid. The API returns the Status: an Invoice that is not Paid and whose Due Date is before today is **Overdue**. "Today" is the current date in `APP_TIMEZONE`. The `status` filter applies the same rule in SQL, so the filtered list, the status badges and the page totals always agree.
- **A new Invoice** is a Draft with Total Paid 0 and exactly one Invoice Item, created by the signed-in User.
- **Invoice Numbers** are unique regardless of case: `INV-001` and `inv-001` conflict.

## Tests

| Command | Runs in | What it tests |
|---|---|---|
| `npm test` | `backend/` | unit tests: totals, Status rules, validation, mapping, services, authentication, configuration |
| `npm run test:e2e` | `backend/` | the HTTP API against a real PostgreSQL 17 that Testcontainers starts (Docker required): sign-in and cookies, create → search → detail, every filter, sort and page option, errors, the seed, Swagger |
| `npm run test:cov` | `backend/` | the unit tests, with a coverage report |
| `npm test` | `frontend/` | components and pages with Testing Library and a mocked API (MSW): sign-in, session expiry, list, detail, create |
| `npm run lint`, `npm run typecheck` | either | oxlint and the TypeScript compiler |

With the Docker stack running, `./scripts/smoke-test.sh` checks the app, sign-in through the `/api` proxy, the seeded data, sign-out and Swagger.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push to `main` and on every pull request. For each app it runs the linter, the format check, the type check, the tests and the build; the backend also runs its e2e tests. A third job starts the Docker stack and runs the smoke test.

## Architecture

```mermaid
flowchart LR
  browser["Browser: React app"] -->|"localhost:8080"| frontend["frontend: nginx"]
  frontend -->|"/api requests, prefix removed"| backend["backend: NestJS API"]
  tools["curl and Swagger UI"] -->|"localhost:3000, Bearer token"| backend
  backend -->|"TypeORM"| db[("db: PostgreSQL 17")]
```

- **frontend** (nginx) serves the built app and forwards `/api/*` to the backend without the `/api` prefix. The browser therefore talks to one origin: no CORS is needed, and the session cookie stays first-party.
- **backend** (NestJS) serves the REST API at the paths the assessment lists (`/auth/login`, `/invoices`, and so on). Thin controllers call services. The business rules (totals, Status and the status filter) are plain functions in `backend/src/invoices/domain/`, tested without a framework or a database.
- **db** (PostgreSQL 17) stores the Users, Invoices and Invoice Items. Hand-written SQL migrations create explicit constraints and indexes, including trigram indexes for the search.
- **Start-up order:** the database becomes healthy; then the backend migrates, seeds and becomes healthy; then the frontend starts.

## Project structure

```
simple-invoice/
├── backend/                     NestJS API
│   ├── src/
│   │   ├── auth/                sign-in, sign-out, JWT strategy and guard
│   │   ├── invoices/            controller, service, DTOs, entities
│   │   │   └── domain/          pure business rules: totals, Status, currencies
│   │   ├── users/               the User entity and its lookups
│   │   ├── health/              GET /health
│   │   ├── common/              error filter, validators, clock, decorators
│   │   ├── config/              environment validation
│   │   └── database/            data source, SQL migrations, seed
│   └── test/                    e2e tests (supertest + Testcontainers)
├── frontend/                    React app
│   ├── src/
│   │   ├── api/                 HTTP client and API calls
│   │   ├── auth/                session, sign-in page, route guard
│   │   ├── features/invoices/   list, detail and create pages
│   │   ├── components/          shared layout and UI
│   │   └── lib/                 money and date formatting
│   └── nginx.conf               serves the app and forwards /api to the backend
├── docs/                        design spec, decision records, implementation plan
├── scripts/smoke-test.sh        smoke test of the running stack
├── docker-compose.yml
└── CONTEXT.md                   glossary of the domain terms
```

**Why one repository?** The assessment suggests this layout, and one clone, one `docker compose up` and one CI workflow then cover the whole product. The two apps share no code: each has its own `package.json`, lock file and Dockerfile, so each one builds on its own. The only shared fact, the list of supported currencies, is short enough to keep in both apps.

## Design decisions

The full design is in [the design spec](docs/specs/2026-10-02-simple-invoice-design.md). Its section 9 lists each assumption with its reason. [CONTEXT.md](CONTEXT.md) defines the domain terms (Invoice, Customer, Status, Balance and the others). Two decisions have their own records:

- [ADR-0001](docs/adr/0001-customer-snapshot-on-invoice.md): the Customer's details are a snapshot on each Invoice, not a separate table. An Invoice is a financial record, and nothing in scope manages Customers.
- [ADR-0002](docs/adr/0002-jwt-in-httponly-cookie.md): the browser app keeps the JWT in an httpOnly cookie that scripts cannot read, protected against cross-site requests by `SameSite=Strict` and a required header. API tools use the Bearer header.

Other main choices:
- Overdue is literal: every Invoice that is not Paid and is past its Due Date, Drafts included.
- The Discount is an amount (Appendix A: 2000 + 200 − 20 = 2180).
- Each Invoice stores its Tax Rate, so the detail page shows the rate that was applied.
- The API paths have no global prefix, exactly as the assessment lists them. Swagger is at `/api/docs`.
- The list's search, filters, sort order and page live in the URL, so the back button and a shared link restore the same view.

## Security notes

- The code contains no secret. The API reads all configuration from the environment, validates it when it starts, and stops when a value is missing. The tests generate their own secrets. Only `docker-compose.yml` has defaults, and they are labelled local-only.
- Passwords are hashed with bcrypt (cost 12). A failed sign-in gives the same message and takes about the same time, whether or not the email exists. Each client IP gets 5 sign-in attempts per minute.
- JWTs are signed with HS256, with a secret of at least 32 characters, and verification accepts only that algorithm. They expire after one hour by default. Each protected request checks that the User still exists.
- The session cookie is `HttpOnly` and `SameSite=Strict`, and `Secure` behind TLS. The API accepts it only with the `X-Requested-With: XMLHttpRequest` header.
- Validation uses a whitelist, so unknown fields are rejected. The API parses only JSON bodies of up to 100 kB, and an error response never contains a stack trace or SQL.
- The API sets security headers with helmet. nginx sends a strict Content Security Policy and other security headers with the app.
- Both app containers run as non-root users, and the published ports listen on 127.0.0.1 only.

## Known limitations

- An Invoice has exactly one Invoice Item in the app and the API, although the data model supports more.
- Invoices cannot be edited, deleted or paid. Total Paid changes only through the seed data.
- There is no sign-up, password reset or role. Every signed-in User sees every Invoice.
- There are no refresh tokens: when the JWT expires (after one hour by default), the User signs in again. Sign-out clears the cookie, but it cannot revoke a token that was already issued, because JWTs are stateless.
- Only currencies with 2 decimal places are supported, from a fixed list.
- "Today", and so Overdue, follows one server time zone (`APP_TIMEZONE`).
- The default `TRUST_PROXY` trusts any proxy on a private network, which suits the bundled nginx. A production deployment must name its real proxy. Otherwise clients could fake `X-Forwarded-For` and get around the per-IP sign-in limit.
- The local-only defaults in the compose file (the database password, the JWT secret and the demo password) are for one machine only. A real deployment sets all of them in `.env`.
````

- [ ] **Step 2: Check the README's links**

Run:

```bash
grep -oE '\]\([^)#][^)]*\)' README.md | grep -v '(http' | tr -d '()]' | sort -u \
  | while read -r f; do [ -e "$f" ] && echo "ok $f" || echo "MISSING $f"; done
```

Expected: five `ok` lines (`.github/workflows/ci.yml`, `CONTEXT.md`, the two ADRs and the spec), and no `MISSING` line.

- [ ] **Step 3: Run the README's commands against the stack**

Start the stack the way the Quick start says, then run each block of "curl examples" as it is written:

```bash
docker compose up -d --build --wait --wait-timeout 300
```

Expected:
- `TOKEN` holds a JWT: `echo "$TOKEN" | cut -c1-3` prints `eyJ`.
- The Overdue query returns 5 Invoices, each with `"status":"Overdue"`, and `"paging":{"page":1,"pageSize":5,"total":21}`: the Appendix A Invoice plus 20 generated ones. The generator is deterministic, and its dates move with the seed day, so these counts are the same on any day.
- The `acme` search returns 3 Invoices, earliest Due Date first: `INV-0035` (Acme Pty Ltd), `INV-0027` (Acme Corp) and `INV-0005` (Acme Pty Ltd).
- The detail call returns the Appendix A Invoice: `"invoiceNumber":"IV1780488206995"`, `"status":"Overdue"` and `"balanceAmount":728.66`.
- The create call returns `"status":"Draft"`, `"invoiceSubTotal":59.97`, `"totalTax":6`, `"totalDiscount":1.97` and `"totalAmount":64`.
- The same create call again returns `{"statusCode":409,"message":"Invoice number INV-2026-0042 already exists","error":"Conflict"}`.

Then open http://localhost:3000/api/docs and http://localhost:8080 in a browser. Swagger UI lists every endpoint, and the app's sign-in page appears. Then stop the stack:

```bash
docker compose down -v
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add the README

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
