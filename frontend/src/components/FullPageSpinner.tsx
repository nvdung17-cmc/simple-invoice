import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

/** Fills the screen while the session check runs, so the sign-in page never flashes. */
export function FullPageSpinner() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress aria-label="Loading" />
    </Box>
  )
}
