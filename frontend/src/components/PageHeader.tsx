import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

/**
 * The top of every page: an optional back link, the page's only h1 (also the
 * browser tab title), an optional chip beside it, and optional actions.
 */
export function PageHeader({
  title,
  back,
  chip,
  actions,
}: {
  title: string
  back?: ReactNode
  chip?: ReactNode
  actions?: ReactNode
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <title>{`${title} · SimpleInvoice`}</title>
      {back}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          {chip}
        </Stack>
        {actions && (
          <Stack direction="row" spacing={1}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
