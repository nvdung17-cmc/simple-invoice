import { AxiosError } from 'axios'
import { httpError } from '../test/httpError'
import { errorMessages, errorStatus } from './errors'

describe('errorStatus', () => {
  it('reads the HTTP status of a failed request', () => {
    expect(errorStatus(httpError(409))).toBe(409)
  })

  it('is undefined when there was no HTTP response', () => {
    expect(errorStatus(new AxiosError('Network Error', 'ERR_NETWORK'))).toBeUndefined()
    expect(errorStatus(new Error('boom'))).toBeUndefined()
  })
})

describe('errorMessages', () => {
  it('wraps a single message in a list', () => {
    const error = httpError(404, {
      statusCode: 404,
      message: 'Invoice not found',
      error: 'Not Found',
    })
    expect(errorMessages(error)).toEqual(['Invoice not found'])
  })

  it('keeps the list of validation messages', () => {
    const message = ['customer.email must be an email', 'dueDate must be on or after invoiceDate']
    expect(
      errorMessages(httpError(400, { statusCode: 400, message, error: 'Bad Request' })),
    ).toEqual(message)
  })

  it('returns an empty list when the body has no message', () => {
    expect(errorMessages(httpError(502, '<html>Bad gateway</html>'))).toEqual([])
    expect(errorMessages(new Error('boom'))).toEqual([])
  })
})
