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
