import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, MapPin, Package, Box,
  ClipboardList, CreditCard, LogOut, Scan, Plus, Bell, ChevronRight,
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import api from '../lib/api'
import ScanRapide from '../components/ScanRapide'
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
  const [showScan, setShowScan] = useState(false)

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
    <>
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-header">
         <img src="/logo-nut-white.svg" alt="NUT" style={{ height: 38 }} />
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
            <button className="btn-secondary" onClick={() => setShowScan(true)}>
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

    {showScan && <ScanRapide onClose={() => setShowScan(false)} />}
    </>
  )
}
