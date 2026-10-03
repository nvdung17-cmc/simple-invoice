---
status: accepted
---

# The SPA carries the JWT in an httpOnly cookie; API tools use Bearer

The spec asks us to "securely store the token on the client side" and scores "Secure JWT implementation" as its own criterion. It also requires stateless JWT access tokens (2.3.3), so a stolen token stays valid until it expires and cannot be revoked. Where the token lives therefore sets how much damage a leak can do.

We keep the token where page JavaScript cannot read it:
- `POST /auth/login` sets an `access_token` cookie with `HttpOnly`, `SameSite=Strict` and `Path=/`. Its `Max-Age` equals `JWT_EXPIRES_IN`, and `Secure` follows `COOKIE_SECURE` (`auto` = on when a trusted proxy reports HTTPS; the bundled nginx reports plain HTTP, so set `true` when TLS ends in front of it).
- The login response still returns the JWT in its body, as the spec's endpoint table requires.

There is one passport-jwt strategy and one global guard. The guard accepts the token in either of two ways:
- as an `Authorization: Bearer` header, which Swagger, curl and Postman use;
- as the cookie, but only when the request also carries the SPA's `X-Requested-With` header.

The SPA ignores the token in the login body. It restores the session on load with `GET /auth/me` and logs out with `POST /auth/logout`, which clears the cookie.

## Considered Options

- **Bearer token in localStorage**, the textbook recipe. It has the fewest moving parts and one auth path everywhere. Rejected because any script running in the page — an XSS payload or a compromised npm dependency in the bundle — can read the token and replay it from another machine until it expires. A CSP and React escaping make this less likely but do not limit the damage. Reviewers checking "securely store" commonly flag localStorage, and OWASP advises against it.
- **Access token in memory plus a rotating refresh-token cookie** (`/auth/refresh`). Rejected because rotation with reuse detection needs a server-side refresh-token table, which conflicts with the stateless requirement. It also gives no real gain against XSS: injected script can call `/auth/refresh` itself. And it races under React StrictMode's double mount, which logs the User out in development.

## Consequences

- CSRF is closed in three ways:
  - `SameSite=Strict` stops the browser from sending the cookie with cross-site requests.
  - The `X-Requested-With` gate rejects HTML-form and simple cross-origin requests, because they cannot set custom headers without a CORS preflight, which the API refuses.
  - The API parses only JSON bodies.
- Cookies are not isolated by port, so the SPA's cookie also reaches Swagger on the backend port. Because of the header gate, Swagger and curl ignore that cookie and still need a Bearer token. A request with no Bearer token therefore gets 401.
- The SPA calls the API same-origin through `/api` (an nginx proxy in Docker, the Vite proxy in development), so no CORS credentials setup is needed.
- An XSS can still act as the User inside an open tab while the session lasts. The CSP and React's output escaping are the defences against that.
- Logout cannot revoke a token that was already issued. Each token is limited by `JWT_EXPIRES_IN` (default 3600 s), which the stateless requirement accepts.
- The cookie path and the Bearer path each have their own e2e tests, because a bug in one would not show in tests of the other.
