import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useMutation } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { Navigate, useLocation, type Location } from 'react-router'
import { z } from 'zod'
import { errorStatus } from '../api/errors'
import { useAuth } from './useAuth'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required'),
})

type LoginInput = z.input<typeof loginSchema>
type LoginOutput = z.output<typeof loginSchema>

function loginErrorMessage(error: unknown): string {
  switch (errorStatus(error)) {
    // 400: credentials that cannot be valid, such as a password over 72 bytes.
    case 400:
    case 401:
      return 'Invalid email or password.'
    case 429:
      return 'Too many login attempts. Please try again later.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

/** After signing in: back to the page that asked for it, or the Invoice list. */
function redirectTarget(state: unknown): string {
  const from = (state as { from?: Location } | null)?.from
  if (!from) return '/invoices'
  // A path that starts with // would be an external URL to the router.
  const pathname = from.pathname.replace(/^\/+/, '/')
  return `${pathname}${from.search}${from.hash}`
}

/** The sign-in screen (spec §6.3). A signed-in User is sent on to the app. */
export function LoginPage() {
  const { status, login } = useAuth()
  const location = useLocation()
  const { control, handleSubmit } = useForm<LoginInput, unknown, LoginOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const mutation = useMutation({ mutationFn: login })

  if (status === 'authenticated') {
    return <Navigate to={redirectTarget(location.state)} replace />
  }

  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <title>Sign in · SimpleInvoice</title>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 420 }}>
        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700 }}>
          SimpleInvoice
        </Typography>
        <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
          Sign in
        </Typography>
        <Stack
          component="form"
          noValidate
          spacing={2}
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          {mutation.isError && <Alert severity="error">{loginErrorMessage(mutation.error)}</Alert>}
          <Controller
            name="email"
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <TextField
                {...field}
                inputRef={ref}
                label="Email"
                type="email"
                autoComplete="username"
                fullWidth
                error={fieldState.invalid}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="password"
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <TextField
                {...field}
                inputRef={ref}
                label="Password"
                type="password"
                autoComplete="current-password"
                fullWidth
                error={fieldState.invalid}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Button type="submit" variant="contained" size="large" loading={mutation.isPending}>
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
