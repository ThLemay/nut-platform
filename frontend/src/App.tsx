import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import DashboardLayout from './layouts/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import ContainerTypes from './pages/ContainerTypes'
import Organisations from './pages/Organisations'
import Utilisateurs from './pages/Utilisateurs'
import Lieux from './pages/Lieux'
import Contenants from './pages/Contenants'
import Commandes from './pages/Commandes'
import Dashboard from './pages/Dashboard'

function PagePlaceholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="t-page-title">{title}</h1>
      <p className="t-body-muted" style={{ marginTop: '8px' }}>Page en cours de développement.</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard"          element={<Dashboard />} />
            <Route path="/organisations"    element={<Organisations />} />
            <Route path="/utilisateurs"     element={<Utilisateurs />} />
            <Route path="/lieux"            element={<Lieux />} />
            <Route path="/contenants"       element={<Contenants />} />
            <Route path="/types-contenants" element={<ContainerTypes />} />
            <Route path="/commandes"          element={<Commandes />} />
            <Route path="/mes-credits"      element={<PagePlaceholder title="Mes crédits" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
