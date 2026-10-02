import { createContext } from 'react'
import type { LoginRequest, User } from '../api/types'

/**
 * `anonymous`: nobody is signed in, or the session expired.
 * `signedOut`: the User logged out, so the next sign-in starts at the Invoice list.
 */
export type AuthStatus = 'checking' | 'authenticated' | 'anonymous' | 'signedOut'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  login: (credentials: LoginRequest) => Promise<User>
  logout: () => Promise<void>
}

/** The session state. AuthProvider provides it; components read it with useAuth(). */
export const AuthContext = createContext<AuthContextValue | null>(null)
