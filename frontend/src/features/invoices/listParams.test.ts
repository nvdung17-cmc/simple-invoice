import {
  hasActiveFilters,
  parseListParams,
  toSearchParams,
  type InvoiceListParams,
} from './listParams'

const DEFAULTS: InvoiceListParams = { page: 1, pageSize: 10, ordering: 'DESC' }

const parse = (query: string) => parseListParams(new URLSearchParams(query))

describe('parseListParams', () => {
  it('uses the defaults for an empty query', () => {
    expect(parse('')).toEqual(DEFAULTS)
  })

  it('reads every parameter', () => {
    expect(
      parse(
        'page=3&pageSize=50&sortBy=totalAmount&ordering=ASC&status=Overdue' +
          '&keyword=%20Kanglee%20&fromDate=2026-01-01&toDate=2026-12-31',
      ),
    ).toEqual({
      page: 3,
      pageSize: 50,
      sortBy: 'totalAmount',
      ordering: 'ASC',
      status: 'Overdue',
      keyword: 'Kanglee',
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    })
  })

  it('falls back to the default for each invalid value', () => {
    expect(
      parse(
        'page=0&pageSize=7&sortBy=customer&ordering=sideways&status=Lost' +
          '&keyword=%20%20&fromDate=2026-02-30&toDate=yesterday',
      ),
    ).toEqual(DEFAULTS)
    expect(parse('page=1.5&pageSize=abc')).toEqual(DEFAULTS)
    expect(parse(`keyword=${'a'.repeat(101)}`)).toEqual(DEFAULTS)
  })

  it('drops an end date before the start date', () => {
    expect(parse('fromDate=2026-06-01&toDate=2026-05-31')).toEqual({
      ...DEFAULTS,
      fromDate: '2026-06-01',
    })
  })
})

describe('toSearchParams', () => {
  it('leaves the defaults out', () => {
    expect(toSearchParams(DEFAULTS).toString()).toBe('')
  })

  it('writes the other values in a fixed order', () => {
    const params: InvoiceListParams = {
      toDate: '2026-12-31',
      fromDate: '2026-01-01',
      keyword: 'Kanglee Trading',
      status: 'Paid',
      ordering: 'ASC',
      sortBy: 'dueDate',
      pageSize: 20,
      page: 2,
    }

    const search = toSearchParams(params)

    expect(search.toString()).toBe(
      'page=2&pageSize=20&sortBy=dueDate&ordering=ASC&status=Paid' +
        '&keyword=Kanglee+Trading&fromDate=2026-01-01&toDate=2026-12-31',
    )
    expect(parseListParams(search)).toEqual(params)
  })
})

describe('hasActiveFilters', () => {
  it('ignores sorting and paging', () => {
    expect(hasActiveFilters({ ...DEFAULTS, page: 4, sortBy: 'dueDate', ordering: 'ASC' })).toBe(
      false,
    )
  })

  it.each([
    { status: 'Draft' as const },
    { keyword: 'IV' },
    { fromDate: '2026-01-01' },
    { toDate: '2026-01-31' },
  ])('is true for %j', (filter) => {
    expect(hasActiveFilters({ ...DEFAULTS, ...filter })).toBe(true)
  })
})
