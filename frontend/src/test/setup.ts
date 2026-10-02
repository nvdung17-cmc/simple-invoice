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
