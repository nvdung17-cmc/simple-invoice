import axios from 'axios'

/**
 * The one HTTP client. It calls the same-origin `/api` proxy (nginx in Docker,
 * Vite in development), so the browser attaches the httpOnly session cookie by
 * itself. `X-Requested-With` is the header the API requires before it accepts
 * that cookie (ADR-0002). The SPA never reads, stores or sends the token.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
})

/** For these requests a 401 is a normal answer, not an expired session. */
const SESSION_PATHS = ['/auth/login', '/auth/me', '/auth/logout']

/**
 * Calls `handler` whenever another request fails with 401, which means the
 * session has expired. Returns the function that removes the hook.
 */
export function onUnauthorized(handler: () => void): () => void {
  const id = http.interceptors.response.use(undefined, (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !SESSION_PATHS.includes(error.config?.url ?? '')
    ) {
      handler()
    }
    return Promise.reject(error)
  })
  return () => http.interceptors.response.eject(id)
}
