import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './useAuth'

/**
 * Guards the signed-in part of the app. A visitor without a session goes to
 * /login, which brings them back here after they sign in. After a logout there
 * is nothing to come back to, so the next sign-in opens the Invoice list.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status !== 'authenticated') {
    const state = status === 'signedOut' ? undefined : { from: location }
    return <Navigate to="/login" replace state={state} />
  }
  return children
}
