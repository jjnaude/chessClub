import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Current Round', to: '/current-round' },
  { label: 'Ladder', to: '/ladder' },
  { label: 'Admin Session', to: '/admin-session' },
  { label: 'Login', to: '/login' },
]

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Chess Club</h1>
        <p>Weekly rounds, ladder tracking, and session management.</p>
      </header>

      <nav className="mobile-nav" aria-label="Main navigation">
        {navItems.map((item) => (
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
