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
