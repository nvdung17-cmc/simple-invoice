import { AxiosError } from 'axios'
import { shouldRetry } from './queryClient'
import { httpError } from './test/httpError'

describe('shouldRetry', () => {
  it.each([400, 401, 404, 409, 429])('never retries a %i answer', (status) => {
    expect(shouldRetry(0, httpError(status))).toBe(false)
  })

  it('retries a server or network failure once', () => {
    expect(shouldRetry(0, httpError(500))).toBe(true)
    expect(shouldRetry(1, httpError(500))).toBe(false)
    expect(shouldRetry(0, new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(true)
  })
})
