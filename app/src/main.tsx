import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { AppLayout } from './layouts/AppLayout'
import { AdminSessionPage } from './pages/AdminSessionPage'
import { CurrentRoundPage } from './pages/CurrentRoundPage'
import { DashboardPage } from './pages/DashboardPage'
import { LadderPage } from './pages/LadderPage'
import { LoginPage } from './pages/LoginPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'current-round', element: <CurrentRoundPage /> },
      { path: 'ladder', element: <LadderPage /> },
      { path: 'admin-session', element: <AdminSessionPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

registerSW({ immediate: true })
