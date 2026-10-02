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

The first build takes a few minutes. Each time the backend container starts, it applies the database migrations and seeds the demo data. The seed adds only the Invoices that are missing, and it creates or updates the default User from the `SEED_USER_*` settings, so a restart is safe.

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
| `COOKIE_SECURE` | `auto` | `Secure` flag of the session cookie: `auto` (on when a trusted proxy reports HTTPS), `true` or `false`. The bundled nginx reports plain HTTP, so set `true` when TLS ends in front of it |
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
| `docker compose exec backend npm run seed` | applies pending migrations, inserts only the missing Invoices, and updates the default User from `SEED_USER_*` |
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

Errors from `/auth` and `/invoices` have this JSON shape:

```json
{ "statusCode": 404, "message": "Invoice not found", "error": "Not Found" }
```

When the body or the query fails validation (400), `message` is a list with one entry per problem; for every other error it is a string:

```json
{ "statusCode": 400, "message": ["dueDate must be on or after invoiceDate"], "error": "Bad Request" }
```

| Status | When |
|---|---|
| 400 | the body or the query fails validation (for example `toDate` before `fromDate`, or a `keyword` over 100 characters), the body is not valid JSON or has an unknown field, or the id is not a UUID |
| 401 | no token, or an invalid or expired one; a wrong email or password |
| 404 | the Invoice does not exist |
| 409 | the Invoice Number is already used, regardless of case |
| 413 | the JSON body is larger than 100 kB |
| 429 | too many login attempts |
| 500 | an unexpected error; the details go to the server log, never to the client |

`GET /health` is the exception: when the database does not answer, its 503 body is the health check's report.

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

With the Docker stack running, `./scripts/smoke-test.sh` checks the app, sign-in through the `/api` proxy, the seeded data, sign-out and Swagger. It needs `curl` and `node` on the host. It reads the ports and the demo login from the environment, not from `.env`, so export the same values if your `.env` changes them.

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
├── .github/workflows/ci.yml     CI: lint, type check, tests, build, Docker smoke test
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
│   ├── test/                    e2e tests (supertest + Testcontainers)
│   ├── Dockerfile               two-stage build of the API image
│   └── docker-entrypoint.sh     seeds when SEED_ON_START=true, then starts the API
├── frontend/                    React app
│   ├── src/
│   │   ├── api/                 HTTP client and API calls
│   │   ├── auth/                session, sign-in page, route guard
│   │   ├── features/invoices/   list, detail and create pages
│   │   ├── components/          shared layout and UI
│   │   └── lib/                 money and date formatting
│   ├── Dockerfile               builds the app, then serves it with nginx
│   ├── nginx.conf               serves the app and forwards /api to the backend
│   └── security-headers.conf    CSP and the other security headers
├── docs/                        design spec, decision records, implementation plan
├── scripts/smoke-test.sh        smoke test of the running stack
├── docker-compose.yml
├── .env.example                 every Compose setting, with no real secret
└── CONTEXT.md                   glossary of the domain terms
```

**Why one repository?** The assessment suggests this layout, and one clone, one `docker compose up` and one CI workflow then cover the whole product. The two apps share no code: each has its own `package.json`, lock file and Dockerfile, so each one builds on its own. What both need, such as the currencies, the Status values and the validation limits, is short enough to keep in both; the frontend's form rules mirror the API's DTOs.

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

- The code holds no real secret. The API reads all configuration from the environment, validates it when it starts, and stops when a value is missing; the JWT secret and the database URL have no value in code, and the e2e tests generate their own JWT secret. The one literal credential is the demo login (`admin@example.com` / `Password123!`): a local-only default in `docker-compose.yml` and `scripts/smoke-test.sh`, and an example in Swagger and in tests.
- Passwords are hashed with bcrypt (cost 12). A failed sign-in gives the same message and takes about the same time, whether or not the email exists. Each client IP gets 5 sign-in attempts per minute.
- JWTs are signed with HS256, with a secret of at least 32 characters, and verification accepts only that algorithm. They expire after one hour by default. Each protected request checks that the User still exists.
- The session cookie is `HttpOnly` and `SameSite=Strict`. It is `Secure` when `COOKIE_SECURE=true`, or in `auto` mode when a trusted proxy reports HTTPS. The bundled nginx serves plain HTTP, so a deployment that adds TLS in front of it sets `COOKIE_SECURE=true`. The API accepts the cookie only with the `X-Requested-With: XMLHttpRequest` header.
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
- Requests sent straight to the API on port 3000 reach it through Docker's network, which the default `TRUST_PROXY` also trusts. A program on the same machine can therefore fake `X-Forwarded-For` on that port and get around the per-IP sign-in limit. Through the app on port 8080 the limit holds. Port 3000 listens on 127.0.0.1 only, and a web page on another site cannot send that header to the API.
- The local-only defaults in the compose file (the database password, the JWT secret and the demo password) are for one machine only. A real deployment sets all of them in `.env`.
- nginx looks up the backend's address once, when the frontend container starts. A re-created backend container (for example after `docker compose up -d --build backend`) can get a new address, so run `docker compose restart frontend` afterwards; otherwise requests to `/api` can fail with 502.
