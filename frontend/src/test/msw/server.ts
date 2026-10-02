import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** The mock API for all tests (Node interceptors; no service worker). */
export const server = setupServer(...handlers)
