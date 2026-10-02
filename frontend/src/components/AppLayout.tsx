import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import AddIcon from '@mui/icons-material/Add'
import LogoutIcon from '@mui/icons-material/Logout'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import AppBar from '@mui/material/AppBar'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useState } from 'react'
import { Outlet, Link as RouterLink } from 'react-router'
import { useAuth } from '../auth/useAuth'

/**
 * The signed-in shell (spec §6.1): an app bar with the navigation and the
 * User menu, and the current page below it. On small screens the
 * navigation moves into the User menu.
 */
export function AppLayout() {
  const { user, logout } = useAuth()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const closeMenu = () => setMenuAnchor(null)

  function handleLogout() {
    closeMenu()
    // RequireAuth then sends the User to /login.
    void logout()
  }

  return (
    <>
      <AppBar position="sticky" elevation={0}>
        <Toolbar>
          <Link
            component={RouterLink}
            to="/invoices"
            variant="h6"
            color="inherit"
            underline="none"
            sx={{ fontWeight: 700, flexGrow: 1 }}
          >
            SimpleInvoice
          </Link>
          {!isMobile && (
            <Stack direction="row" spacing={1} sx={{ mr: 1 }}>
              <Button color="inherit" component={RouterLink} to="/invoices">
                Invoices
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/invoices/new"
                startIcon={<AddIcon />}
              >
                New invoice
              </Button>
            </Stack>
          )}
          <IconButton
            color="inherit"
            aria-label="User menu"
            aria-controls={menuAnchor ? 'user-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={menuAnchor ? 'true' : undefined}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
          >
            <AccountCircleIcon />
          </IconButton>
          <Menu
            id="user-menu"
            anchorEl={menuAnchor}
            open={menuAnchor !== null}
            onClose={closeMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <ListSubheader sx={{ lineHeight: 1.5, py: 1 }}>
              <Typography sx={{ color: 'text.primary', fontWeight: 500 }}>
                {user?.fullname}
              </Typography>
              <Typography variant="body2">{user?.email}</Typography>
            </ListSubheader>
            <Divider />
            {isMobile && [
              <MenuItem key="invoices" component={RouterLink} to="/invoices" onClick={closeMenu}>
                <ListItemIcon>
                  <ReceiptLongIcon fontSize="small" />
                </ListItemIcon>
                Invoices
              </MenuItem>,
              <MenuItem key="new" component={RouterLink} to="/invoices/new" onClick={closeMenu}>
                <ListItemIcon>
                  <AddIcon fontSize="small" />
                </ListItemIcon>
                New invoice
              </MenuItem>,
              <Divider key="divider" />,
            ]}
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Log out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
        <Outlet />
      </Container>
    </>
  )
}
