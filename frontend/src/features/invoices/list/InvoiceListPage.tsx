import AddIcon from '@mui/icons-material/Add'
import FilterListIcon from '@mui/icons-material/FilterList'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useState, type ReactNode } from 'react'
import { Link as RouterLink, useLocation } from 'react-router'
import type { SortField } from '../../../api/types'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader } from '../../../components/PageHeader'
import { useInvoiceList } from '../hooks/useInvoiceList'
import { useInvoiceListParams } from '../hooks/useInvoiceListParams'
import { hasActiveFilters } from '../listParams'
import { InvoiceCards } from './InvoiceCards'
import { InvoiceFilters } from './InvoiceFilters'
import { SearchField } from './SearchField'
import { InvoiceTable } from './InvoiceTable'
import type { InvoiceLinkState } from './linkState'

/**
 * The home page (spec §6.3): search, filter, sort and page through the
 * Invoices. The URL holds the list's state; this page only reads it and
 * writes changes back. Phones get cards and a collapsible filter panel.
 */
export function InvoiceListPage() {
  const { params, update, clearFilters } = useInvoiceListParams()
  const { data, isPending, isError, isFetching, refetch } = useInvoiceList(params)
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Clear filters changes it, which restarts the filter boxes: a date box would otherwise keep
  // text that the URL never held (a partial date, a "to" before "from").
  const [clearCount, setClearCount] = useState(0)
  const linkState: InvoiceLinkState = { listSearch: location.search }

  function handleSort(field: SortField) {
    if (params.sortBy === field) {
      update({ ordering: params.ordering === 'ASC' ? 'DESC' : 'ASC' })
    } else {
      update({ sortBy: field, ordering: 'ASC' })
    }
  }

  const changePage = (page: number) => update({ page })
  const changePageSize = (pageSize: number) => update({ pageSize })

  function handleClear() {
    setClearCount((count) => count + 1)
    clearFilters()
  }

  const filters = (
    <InvoiceFilters key={clearCount} params={params} onChange={update} onClear={handleClear} />
  )
  // The search box stays visible on phones; count only the filters the panel hides.
  const hiddenFilterCount = [params.status, params.fromDate, params.toDate].filter(Boolean).length

  let content: ReactNode
  if (isPending) {
    content = (
      <Stack spacing={1} role="status" aria-label="Loading invoices">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={52} />
        ))}
      </Stack>
    )
  } else if (isError) {
    content = <ErrorState message="Could not load invoices." onRetry={() => void refetch()} />
  } else if (data.data.length === 0) {
    content = (
      <Paper variant="outlined">
        {data.paging.total > 0 ? (
          <EmptyState
            title="This page is empty"
            description="The list has fewer pages than this one."
            action={<Button onClick={() => changePage(1)}>Back to page 1</Button>}
          />
        ) : hasActiveFilters(params) ? (
          <EmptyState
            title="No invoices match your filters"
            description="Try another search or Status, or clear the filters."
            action={<Button onClick={handleClear}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            title="No invoices yet"
            description="Invoices you create appear here."
            action={
              <Button variant="contained" component={RouterLink} to="/invoices/new">
                Create invoice
              </Button>
            }
          />
        )}
      </Paper>
    )
  } else if (isMobile) {
    content = (
      <InvoiceCards
        invoices={data.data}
        paging={data.paging}
        linkState={linkState}
        onPageChange={changePage}
        onPageSizeChange={changePageSize}
      />
    )
  } else {
    content = (
      <Paper variant="outlined">
        <InvoiceTable
          invoices={data.data}
          paging={data.paging}
          sortBy={params.sortBy}
          ordering={params.ordering}
          linkState={linkState}
          onSort={handleSort}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
        />
      </Paper>
    )
  }

  return (
    <>
      <PageHeader
        title="Invoices"
        actions={
          <Button
            variant="contained"
            component={RouterLink}
            to="/invoices/new"
            startIcon={<AddIcon />}
          >
            New invoice
          </Button>
        }
      />
      <Paper variant="outlined" sx={{ p: 2, mb: 1 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <SearchField
              keyword={params.keyword ?? ''}
              onSearch={(keyword) => update({ keyword: keyword || undefined }, { replace: true })}
            />
            {isMobile && (
              <Button
                variant="outlined"
                startIcon={<FilterListIcon />}
                aria-expanded={filtersOpen}
                aria-controls={filtersOpen ? 'invoice-filters' : undefined}
                onClick={() => setFiltersOpen((open) => !open)}
                sx={{ flexShrink: 0 }}
              >
                {hiddenFilterCount > 0 ? `Filters (${hiddenFilterCount})` : 'Filters'}
              </Button>
            )}
          </Stack>
          {isMobile ? (
            <Collapse in={filtersOpen} unmountOnExit>
              <Box id="invoice-filters">{filters}</Box>
            </Collapse>
          ) : (
            filters
          )}
        </Stack>
      </Paper>
      <Box sx={{ height: 4, mb: 1 }}>
        {isFetching && !isPending && <LinearProgress aria-label="Refreshing invoices" />}
      </Box>
      {content}
    </>
  )
}
