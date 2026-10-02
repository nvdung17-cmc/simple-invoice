import type { RouteObject } from 'react-router'
import { NotFoundPage } from './components/NotFoundPage'

/** The route table, shared by the app's browser router and the tests' memory router. */
export const routes: RouteObject[] = [{ path: '*', element: <NotFoundPage /> }]
