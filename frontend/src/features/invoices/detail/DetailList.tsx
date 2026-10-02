import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Fragment, type ReactNode } from 'react'

export interface DetailItem {
  label: string
  /** `null` is shown as a dash: the API sends `null` for an empty optional field. */
  value: ReactNode
  emphasis?: boolean
}

/**
 * Label–value pairs as a description list. With `amounts`, values are
 * right-aligned in one column so the figures line up.
 */
export function DetailList({ items, amounts = false }: { items: DetailItem[]; amounts?: boolean }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: amounts ? '1fr auto' : { xs: '1fr', sm: '140px 1fr' },
        columnGap: 2,
        rowGap: 1,
      }}
    >
      {items.map(({ label, value, emphasis }) => {
        const emphasisSx = emphasis
          ? { fontWeight: 700, borderTop: 1, borderColor: 'divider', pt: 1 }
          : undefined
        return (
          <Fragment key={label}>
            <Typography
              component="dt"
              sx={{ color: emphasis ? 'text.primary' : 'text.secondary', ...emphasisSx }}
            >
              {label}
            </Typography>
            <Typography
              component="dd"
              sx={{
                m: 0,
                mb: amounts ? 0 : { xs: 1, sm: 0 },
                textAlign: amounts ? 'right' : 'left',
                overflowWrap: 'anywhere',
                ...emphasisSx,
              }}
            >
              {value ?? '—'}
            </Typography>
          </Fragment>
        )
      })}
    </Box>
  )
}
