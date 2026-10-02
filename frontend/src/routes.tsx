import { Navigate, type RouteObject } from 'react-router'
import { LoginPage } from './auth/LoginPage'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { NotFoundPage } from './components/NotFoundPage'
import { CreateInvoicePage } from './features/invoices/create/CreateInvoicePage'
import { InvoiceDetailPage } from './features/invoices/detail/InvoiceDetailPage'
import { InvoiceListPage } from './features/invoices/list/InvoiceListPage'

/** The route table (spec §6.1), shared by the app's browser router and the tests' memory router. */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/invoices" replace /> },
      { path: 'invoices', element: <InvoiceListPage /> },
      { path: 'invoices/new', element: <CreateInvoicePage /> },
      { path: 'invoices/:invoiceId', element: <InvoiceDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
