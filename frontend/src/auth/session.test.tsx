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
