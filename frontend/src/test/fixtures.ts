import type { User } from '../api/types'

/** The seeded default User (backend seed, spec §5.8). */
export const userFixture: User = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: 'admin@example.com',
  fullname: 'Admin User',
  createdAt: '2026-06-01T09:00:00.000Z',
}

export const USER_PASSWORD = 'Password123!'
