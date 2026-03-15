import { NavLink } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useAuth } from '../lib/auth'

export function AppLayout() {
  const { user, profile, signOut } = useAuth()

  const navItems = [
    { label: 'Dashboard', to: '/dashboard', hidden: !user },
    { label: 'Current Round', to: '/current-round', hidden: !user },
    { label: 'Ladder', to: '/ladder', hidden: !user },
    { label: 'Admin Session', to: '/admin-session', hidden: profile?.role !== 'admin' },
    {
      label: 'User Mapping',
      to: '/admin-player-accounts',
      hidden: profile?.role !== 'admin',
    },
    { label: 'Login', to: '/login', hidden: Boolean(user) },
  ]

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Chess Club</h1>
        <p>Weekly rounds, ladder tracking, and session management.</p>
        {user && (
          <div className="session-meta">
            <span>
              Signed in as <strong>{profile?.display_name ?? user.email ?? user.id}</strong> ({profile?.role ?? '...'
              })
            </span>
            <Button variant="secondary" onClick={() => void signOut()}>
              Logout
            </Button>
          </div>
        )}
      </header>

      <nav className="mobile-nav" aria-label="Main navigation">
        {navItems
          .filter((item) => !item.hidden)
          .map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
