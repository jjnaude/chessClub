import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { RequireAuth, RequireRole } from './components/auth/RequireAuth'
import { AppLayout } from './layouts/AppLayout'
import { AuthProvider } from './lib/auth'
import { AdminPlayerAccountsPage } from './pages/AdminPlayerAccountsPage'
import { AdminSessionPage } from './pages/AdminSessionPage'
import { CurrentRoundPage } from './pages/CurrentRoundPage'
import { DashboardPage } from './pages/DashboardPage'
import { LadderPage } from './pages/LadderPage'
import { LoginPage } from './pages/LoginPage'
import { SessionLifecycleSandboxPage } from './pages/SessionLifecycleSandboxPage'

const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: (
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        ),
      },
      { path: 'login', element: <LoginPage /> },
      { path: 'session-lifecycle-sandbox', element: <SessionLifecycleSandboxPage /> },
      {
        path: 'dashboard',
        element: (
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        ),
      },
      {
        path: 'current-round',
        element: (
          <RequireAuth>
            <CurrentRoundPage />
          </RequireAuth>
        ),
      },
      {
        path: 'ladder',
        element: (
          <RequireAuth>
            <LadderPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin-session',
        element: (
          <RequireAuth>
            <RequireRole roles={['admin']}>
              <AdminSessionPage />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: 'admin-player-accounts',
        element: (
          <RequireAuth>
            <RequireRole roles={['admin']}>
              <AdminPlayerAccountsPage />
            </RequireRole>
          </RequireAuth>
        ),
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)

registerSW({ immediate: true })
