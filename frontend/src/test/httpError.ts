import { AxiosError, AxiosHeaders } from 'axios'

/** An axios error carrying an HTTP response, as the API client rejects with. */
export function httpError(status: number, data: unknown = {}): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  })
}
