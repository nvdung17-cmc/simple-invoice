import { act, renderHook } from '@testing-library/react'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('follows the value only after it stops changing', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'I' },
    })
    rerender({ value: 'IV' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: 'IV1' })
    act(() => vi.advanceTimersByTime(299))

    expect(result.current).toBe('I')

    act(() => vi.advanceTimersByTime(1))

    expect(result.current).toBe('IV1')
  })
})
