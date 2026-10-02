import { z } from 'zod'

// Zod probes for `new Function` support when an object schema is built. Under the SPA's CSP
// (no 'unsafe-eval'), Chromium reports that probe as a violation even though Zod catches it.
// Jitless mode skips the probe. Import this module before any module that builds a schema
// (main.tsx does so first): a module's imports evaluate before its own body.
z.config({ jitless: true })
