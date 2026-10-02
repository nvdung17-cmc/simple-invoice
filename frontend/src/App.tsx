import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { SnackbarProvider } from 'notistack'
import type { DataRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { theme } from './theme'

/**
 * The provider stack. The app (main.tsx) and the tests (renderApp) both render
 * it, so tests run the production tree with only the router swapped.
 */
export function App({ router, queryClient }: { router: DataRouter; queryClient: QueryClient }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={3}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </SnackbarProvider>
    </ThemeProvider>
  )
}
