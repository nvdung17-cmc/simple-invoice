import { useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import { onUnauthorized } from '../api/http'
import type { LoginRequest, User } from '../api/types'
import { FullPageSpinner } from '../components/FullPageSpinner'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

/**
 * Owns the session (spec §6.2, ADR-0002). JavaScript cannot see the httpOnly
 * cookie, so on start-up it asks the API who is signed in. A 401 on any other
 * request means the session expired: the User is signed out, cached data is
 * dropped, and one toast explains why, even when several requests fail at once.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { enqueueSnackbar } = useSnackbar()
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    authApi.getCurrentUser(controller.signal).then(
      (current) => {
        setUser(current)
        setStatus('authenticated')
      },
      () => {
        if (controller.signal.aborted) return
        setUser(null)
        setStatus('anonymous')
      },
    )
    return () => controller.abort()
  }, [])

  useEffect(
    () =>
      onUnauthorized(() => {
        setUser(null)
        setStatus('anonymous')
        queryClient.clear()
        enqueueSnackbar('Your session has expired. Please sign in again.', {
          key: 'session-expired',
          preventDuplicate: true,
          variant: 'warning',
        })
      }),
    [queryClient, enqueueSnackbar],
  )

  const login = useCallback(async (credentials: LoginRequest) => {
    const signedIn = await authApi.login(credentials)
    setUser(signedIn)
    setStatus('authenticated')
    return signedIn
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Sign out locally even when the API is unreachable; the cookie expires by itself.
    }
    queryClient.clear()
    setUser(null)
    setStatus('signedOut')
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout }),
    [status, user, login, logout],
  )

  if (status === 'checking') return <FullPageSpinner />
  return <AuthContext value={value}>{children}</AuthContext>
}
