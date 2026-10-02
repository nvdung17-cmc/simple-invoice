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
    expect(await screen.findByRole('button', { name: 'User menu' })).toBeInTheDocument()
  })

  it('returns to the page that asked for a sign-in', async () => {
    const { router } = renderApp('/invoices/new?from=link')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))

    await signInWith(userFixture.email, USER_PASSWORD)

    await waitFor(() => expect(router.state.location.pathname).toBe('/invoices/new'))
    expect(router.state.location.search).toBe('?from=link')
  })

  it('keeps a saved path that starts with // inside the app', async () => {
    // The router would read `//evil.example/x` as an address on another host.
    const { router } = renderApp({
      pathname: '/login',
      state: { from: { pathname: '//evil.example/x', search: '', hash: '' } },
    })

    await signInWith(userFixture.email, USER_PASSWORD)

    await waitFor(() => expect(router.state.location.pathname).toBe('/evil.example/x'))
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
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
