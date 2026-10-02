import { createTheme, responsiveFontSizes } from '@mui/material/styles'

/** The app theme: the brand primary colour, a soft page background and responsive type sizes. */
export const theme = responsiveFontSizes(
  createTheme({
    palette: {
      primary: { main: '#1e5eff' },
      background: { default: '#f5f7fb' },
    },
    shape: { borderRadius: 8 },
  }),
)
