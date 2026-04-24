import { useEffect } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, MapPin, Package, Box,
  ClipboardList, CreditCard, LogOut, Scan, Plus, Bell, ChevronRight,
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import api from '../lib/api'
import './DashboardLayout.css'

type Role = 'admin_nut' | 'gestionnaire_organisation' | 'operateur' | 'consommateur'

interface NavItem {
  icon: React.ElementType
  path: string
  label: string
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  admin_nut: [
    { icon: LayoutDashboard, path: '/dashboard',        label: 'Dashboard' },
    { icon: Building2,       path: '/organisations',    label: 'Organisations' },
    { icon: Users,           path: '/utilisateurs',     label: 'Utilisateurs' },
    { icon: MapPin,          path: '/lieux',            label: 'Lieux' },
    { icon: Box,             path: '/contenants',       label: 'Contenants' },
    { icon: ClipboardList,   path: '/commandes',        label: 'Commandes' },
    { icon: Box,             path: '/types-contenants', label: 'Types de contenants' },
  ],
  gestionnaire_organisation: [
    { icon: LayoutDashboard, path: '/dashboard', label: 'Dashboard' },
    { icon: ClipboardList,   path: '/commandes', label: 'Commandes' },
    { icon: MapPin,          path: '/lieux',     label: 'Lieux' },
    { icon: Package,         path: '/stocks',    label: 'Stocks' },
  ],
  operateur: [
    { icon: LayoutDashboard, path: '/dashboard', label: 'Dashboard' },
  ],
  consommateur: [
    { icon: LayoutDashboard, path: '/dashboard',   label: 'Dashboard' },
    { icon: CreditCard,      path: '/mes-credits', label: 'Mes crédits' },
  ],
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':        'Dashboard',
  '/organisations':    'Organisations',
  '/utilisateurs':     'Utilisateurs',
  '/lieux':            'Lieux',
  '/contenants':       'Contenants',
  '/types-contenants': 'Types de contenants',
  '/commandes':          'Commandes',
  '/commandes/nouvelle': 'Nouvelle commande',
  '/mes-credits':        'Mes crédits',
}

export default function DashboardLayout() {
  const { user, isAuthenticated, setUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  // Rehydrate user on page refresh (token in localStorage but user not in store)
  useEffect(() => {
    if (isAuthenticated && !user) {
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => { logout(); navigate('/login') })
    }
  }, [isAuthenticated, user, setUser, logout, navigate])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const role = (user?.role ?? 'operateur') as Role
  const navItems = NAV_ITEMS[role] ?? NAV_ITEMS.operateur

  const initials = user
    ? `${user.firstname?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'
  const fullName = user ? `${user.firstname} ${user.surname}` : '—'

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'NUT Platform'

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-header">
          <svg viewBox="0 3 100 148" xmlns="http://www.w3.org/2000/svg" aria-label="NUT">
            <path
              fill="#FFFFFF"
              d="M50.14,76.6c2.45,0,4.79,0.49,6.93,1.36L29.74,42.38c-4.98-6.49-14.17-7.81-20.79-3.12c-3.29,2.08-5.71,5.41-6.57,9.33c-0.27,1.35-0.35,2.74-0.25,4.11v83.31c0,8.16,6.62,14.78,14.78,14.78c8.16,0,14.78-6.62,14.78-14.78v-41.4C31.61,84.91,39.92,76.6,50.14,76.6 M97.43,140.5c0.51-1.5,0.8-3.11,0.8-4.78V50.95c0-8.17-6.62-14.78-14.78-14.78c-8.17,0-14.78,6.62-14.78,14.78v43.37c0,10.21-8.31,18.53-18.53,18.53c-1.88,0-3.7-0.29-5.41-0.81l25.69,33.44c5.1,6.64,14.63,7.89,21.27,2.79l0.55-0.43c2.2-1.69,3.8-3.88,4.78-6.28c0.07-0.16,0.12-0.32,0.19-0.48C97.28,140.89,97.36,140.7,97.43,140.5"
            />
          </svg>
        </div>

        <div className="sidebar-divider" />

        {/* Navigation */}
        <div className="sidebar-section-label">Navigation</div>

        <nav className="sidebar-nav" aria-label="Navigation principale">
          {navItems.map(({ icon: Icon, path, label }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/dashboard'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav-item-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer user */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar" aria-hidden="true">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{fullName}</div>
              <div className="sidebar-user-email">{user?.email ?? '—'}</div>
            </div>
            <button
              className="sidebar-logout"
              aria-label="Se déconnecter"
              onClick={handleLogout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">{pageTitle}</h1>
          </div>
          <div className="topbar-right">
            <button className="btn-secondary">
              <Scan size={16} aria-hidden="true" />
              Scanner
            </button>
            <button className="btn-primary" onClick={() => navigate('/commandes/nouvelle')}>
              <Plus size={16} aria-hidden="true" />
              Nouvelle commande
            </button>
            <div className="topbar-divider" aria-hidden="true" />
            <button className="btn-icon" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <div className="topbar-avatar" aria-hidden="true">{initials}</div>
          </div>
        </header>

        {/* Content */}
        <main className="content">
          <div className="breadcrumb" aria-label="Fil d'Ariane">
            <span className="breadcrumb-root">NUT Platform</span>
            <ChevronRight size={14} className="breadcrumb-sep" aria-hidden="true" />
            <span className="breadcrumb-current">{pageTitle}</span>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  )
}
