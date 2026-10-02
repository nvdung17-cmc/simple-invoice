import { http } from './http'
import type { LoginRequest, LoginResponse, User } from './types'

/**
 * Session endpoints (spec §5.3). The login response also carries the token for
 * API tools; the SPA ignores it, because the httpOnly cookie carries the session.
 */
export async function login(credentials: LoginRequest): Promise<User> {
  const { data } = await http.post<LoginResponse>('/auth/login', credentials)
  return data.user
}

export async function getCurrentUser(signal?: AbortSignal): Promise<User> {
  const { data } = await http.get<User>('/auth/me', { signal })
  return data
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}
