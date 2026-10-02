import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router'
import { PageHeader } from './PageHeader'

/** Any path the app does not know. */
export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Typography sx={{ mb: 2 }}>The page you are looking for does not exist.</Typography>
      <Button variant="contained" component={RouterLink} to="/invoices">
        Go to invoices
      </Button>
    </>
  )
}
