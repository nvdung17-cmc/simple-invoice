import { QueryClient } from '@tanstack/react-query'
import { errorStatus } from './api/errors'

/**
 * Retry policy (spec §6.2). A 4xx answer will not change on a retry (bad input,
 * a missing Invoice, an expired session), so only other failures retry, once.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = errorStatus(error)
  if (status !== undefined && status >= 400 && status < 500) return false
  return failureCount < 1
}

/** The app's query client: cached data stays fresh for 30 s, and there is no refetch on focus. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000, refetchOnWindowFocus: false },
    },
  })
}
