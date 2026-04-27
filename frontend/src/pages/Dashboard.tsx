import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, ShoppingBag, Truck, Sparkles, Leaf,
  ClipboardList, Building2, Users, RefreshCw,
  AlertCircle, Loader2,
} from 'lucide-react'
import { getDashboardStats, type DashboardStats, type CommandeResume } from '../lib/api/dashboard'
import useAuthStore from '../store/authStore'
import './Dashboard.css'

/* ── Container KPI cards ─────────────────────────────────────────────────── */
const CONTAINER_CARDS = [
  { key: 'contenants_propres'     as keyof DashboardStats, label: 'Propres',     Icon: Box,        color: '#22C55E' },
  { key: 'contenants_en_consigne' as keyof DashboardStats, label: 'En consigne', Icon: ShoppingBag, color: '#3B82F6' },
  { key: 'contenants_en_transit'  as keyof DashboardStats, label: 'En transit',  Icon: Truck,      color: '#F97316' },
  { key: 'contenants_en_lavage'   as keyof DashboardStats, label: 'En lavage',   Icon: Sparkles,   color: '#A855F7' },
]

/* ── Order status config ─────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  brouillon:        { bg: '#FEF3C7', color: '#D97706' },
  envoyee:          { bg: '#DBEAFE', color: '#1D4ED8' },
  acceptee:         { bg: '#EDE9FE', color: '#6D28D9' },
  en_cours:         { bg: '#DBEAFE', color: '#2563EB' },
  controle_qualite: { bg: '#F3E8FF', color: '#7C3AED' },
  prete:            { bg: '#D1FAE5', color: '#059669' },
  en_transit:       { bg: '#FFEDD5', color: '#F97316' },
  livree:           { bg: '#DCFCE7', color: '#16A34A' },
  annulee:          { bg: '#F3F4F6', color: '#6B7280' },
}

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', envoyee: 'Envoyée', acceptee: 'Acceptée',
  en_cours: 'En cours', controle_qualite: 'Contrôle qualité', prete: 'Prête',
  en_transit: 'En transit', livree: 'Livrée', annulee: 'Annulée',
}

const TYPE_LABELS: Record<string, string> = {
  lavage: 'Lavage', transport: 'Transport', contenants: 'Contenants', machine: 'Machine',
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmt    = (n: number) => n.toLocaleString('fr-FR')
const fmtCO2 = (g: number) => {
  if (g >= 1_000_000) return `${(g / 1_000_000).toFixed(1)} t`
  if (g >= 1_000)     return `${(g / 1_000).toFixed(1)} kg`
  return `${g} g`
}
const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}
const isToday = (iso: string | null): boolean => {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate()
  )
}

/* ── Sub-components ──────────────────────────────────────────────────────── */
function SkRow() {
  return <div className="db-sk db-sk-stat-row" />
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#F3F4F6', color: '#6B7280' }
  return (
    <span className="db-badge" style={{ background: c.bg, color: c.color }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user }  = useAuthStore()
  const navigate  = useNavigate()
  const [stats,   setStats]   = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const role           = user?.role ?? ''
  const isAdmin        = role === 'admin_nut'
  const isGest         = role === 'gestionnaire_organisation'
  const isPrest        = ['laveur', 'transporteur', 'stockeur', 'recycleur', 'destructeur'].includes(role)
  const showContenants = isAdmin || isGest
  const showCO2        = isAdmin || isGest

  void isPrest // défini pour usage futur (filtrage côté serveur déjà appliqué)

  const load = useCallback(() => {
    setLoading(true)
    getDashboardStats()
      .then(setStats)
      .catch(() => setError('Impossible de charger les statistiques du tableau de bord.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  if (error) {
    return (
      <div className="db-page">
        <div className="db-error">
          <AlertCircle size={36} className="db-error-icon" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const todayOrders = stats?.dernieres_commandes.filter(
    c => isToday(c.desired_date ?? c.order_date)
  ) ?? []

  return (
    <div className="db-page">

      {/* ── CO2 row ── */}
      {showCO2 && (
        <div className="db-co2-row">
          <div className="db-kpi-card db-kpi-card--co2">
            {loading ? (
              <div className="db-kpi-skel">
                <div>
                  <div className="db-sk db-sk-val" />
                  <div className="db-sk db-sk-lbl" />
                </div>
                <div className="db-sk db-sk-icon" />
              </div>
            ) : (
              <>
                <div className="db-kpi-left">
                  <div className="db-kpi-value">{fmtCO2(stats!.co2_economise_grammes)}</div>
                  <div className="db-kpi-label">CO₂ économisé</div>
                </div>
                <div className="db-kpi-icon" style={{ background: '#BBF7D0', color: '#16A34A' }}>
                  <Leaf size={22} strokeWidth={1.75} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Section 1 : KPI grid ── */}
      <div className="db-kpi-grid">
        {showContenants && CONTAINER_CARDS.map(({ key, label, Icon, color }) => (
          <div key={key} className="db-kpi-card">
            {loading ? (
              <div className="db-kpi-skel">
                <div>
                  <div className="db-sk db-sk-val" />
                  <div className="db-sk db-sk-lbl" />
                </div>
                <div className="db-sk db-sk-icon" />
              </div>
            ) : (
              <>
                <div className="db-kpi-left">
                  <div className="db-kpi-value">{fmt(stats![key] as number)}</div>
                  <div className="db-kpi-label">{label}</div>
                </div>
                <div className="db-kpi-icon" style={{ background: `${color}1A`, color }}>
                  <Icon size={22} strokeWidth={1.75} />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Section 2 : Mid grid ── */}
      <div className="db-mid-grid">

        {/* Commandes du jour */}
        <div className="db-card db-mid-card">
          <div className="db-card-header">
            <h2 className="db-card-title">Commandes du jour</h2>
            {!loading && (
              <span className="db-count-badge">{fmt(stats?.commandes_du_jour ?? 0)}</span>
            )}
          </div>
          {loading ? (
            <div className="db-stat-skel"><SkRow /><SkRow /><SkRow /></div>
          ) : todayOrders.length === 0 ? (
            <p className="db-empty">Aucune commande aujourd'hui.</p>
          ) : (
            <div className="db-order-list">
              {todayOrders.map(c => (
                <div
                  key={c.id}
                  className="db-order-row"
                  onClick={() => navigate('/commandes')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate('/commandes')}
                >
                  <span className="db-recent-id">#{c.id}</span>
                  <span className="db-recent-type">{TYPE_LABELS[c.order_type] ?? c.order_type}</span>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chiffres clés (admin) or Commandes actives (others) */}
        <div className="db-card db-mid-card">
          <div className="db-card-header">
            <h2 className="db-card-title">{isAdmin ? 'Chiffres clés' : 'Commandes actives'}</h2>
          </div>
          {loading ? (
            <div className="db-stat-skel">
              <SkRow /><SkRow /><SkRow />{isAdmin && <SkRow />}
            </div>
          ) : isAdmin ? (
            <div className="db-stat-rows">
              <div className="db-stat-row">
                <span className="db-stat-value" style={{ color: '#3B82F6' }}>
                  {fmt(stats!.commandes_en_cours)}
                </span>
                <span className="db-stat-label">
                  <ClipboardList size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Commandes en cours
                </span>
              </div>
              <div className="db-stat-row">
                <span className="db-stat-value" style={{ color: '#16A34A' }}>
                  {fmt(stats!.commandes_livrees_ce_mois)}
                </span>
                <span className="db-stat-label">
                  <ClipboardList size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Livrées ce mois
                </span>
              </div>
              <div className="db-stat-row">
                <span className="db-stat-value" style={{ color: '#6D28D9' }}>
                  {fmt(stats!.utilisateurs_total)}
                </span>
                <span className="db-stat-label">
                  <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Utilisateurs
                </span>
              </div>
              <div className="db-stat-row">
                <span className="db-stat-value" style={{ color: '#D97706' }}>
                  {fmt(stats!.organisations_total)}
                </span>
                <span className="db-stat-label">
                  <Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Organisations
                </span>
              </div>
            </div>
          ) : (
            <div className="db-stat-rows">
              <div className="db-stat-row">
                <span className="db-stat-value" style={{ color: '#3B82F6' }}>
                  {fmt(stats!.commandes_en_cours)}
                </span>
                <span className="db-stat-label">En cours</span>
              </div>
              <div className="db-stat-row">
                <span className="db-stat-value" style={{ color: '#D97706' }}>
                  {fmt(stats!.commandes_brouillon)}
                </span>
                <span className="db-stat-label">Brouillons</span>
              </div>
              <div className="db-stat-row">
                <span className="db-stat-value" style={{ color: '#16A34A' }}>
                  {fmt(stats!.commandes_livrees_ce_mois)}
                </span>
                <span className="db-stat-label">Livrées ce mois</span>
              </div>
              {stats!.membres_organisation > 0 && (
                <div className="db-stat-row">
                  <span className="db-stat-value" style={{ color: '#6D28D9' }}>
                    {fmt(stats!.membres_organisation)}
                  </span>
                  <span className="db-stat-label">
                    <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Membres
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Section 3 : Dernières commandes (table) ── */}
      <div className="db-card db-recent-card">
        <div className="db-card-header">
          <h2 className="db-card-title">Dernières commandes</h2>
          <button
            className="db-refresh-btn"
            onClick={load}
            disabled={loading}
            aria-label="Actualiser"
          >
            {loading
              ? <Loader2 size={14} className="db-spin" />
              : <RefreshCw size={14} />
            }
            Actualiser
          </button>
        </div>

        {loading ? (
          <div className="db-stat-skel"><SkRow /><SkRow /><SkRow /></div>
        ) : !stats || stats.dernieres_commandes.length === 0 ? (
          <p className="db-empty">Aucune commande.</p>
        ) : (
          <div className="db-table">
            <div className="db-table-head">
              <span>#</span>
              <span>Type</span>
              <span>Statut</span>
              <span>Client</span>
              <span>Date souhaitée</span>
            </div>
            {stats.dernieres_commandes.map((c: CommandeResume) => (
              <div
                key={c.id}
                className="db-table-row"
                onClick={() => navigate('/commandes')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate('/commandes')}
              >
                <span className="db-recent-id">#{c.id}</span>
                <span className="db-recent-type">{TYPE_LABELS[c.order_type] ?? c.order_type}</span>
                <StatusBadge status={c.status} />
                <span className="db-recent-id">{c.id_client}</span>
                <span className="db-recent-date">{fmtDate(c.desired_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
