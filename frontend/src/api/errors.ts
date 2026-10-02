import { isAxiosError } from 'axios'
import type { ApiErrorBody } from './types'

/** The HTTP status of a failed request; undefined for network failures and non-HTTP errors. */
export function errorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

/**
 * The API's error messages as a list. `message` is one string, or one string
 * per problem for a validation error (spec §5.5).
 */
export function errorMessages(error: unknown): string[] {
  if (!isAxiosError<Partial<ApiErrorBody>>(error)) return []
  const message = error.response?.data?.message
  if (Array.isArray(message)) return message.filter((item) => typeof item === 'string')
  return typeof message === 'string' ? [message] : []
}
