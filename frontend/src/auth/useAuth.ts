import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './auth-context'

/** The current session. Outside AuthProvider this throws, because that is a wiring mistake. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
