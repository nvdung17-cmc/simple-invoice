import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'

/** A failed load, with a Retry button. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      {message}
    </Alert>
  )
}
