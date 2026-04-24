import { useEffect, useState } from 'react'
import {
  Box, ClipboardList, CheckCircle2, Building2, Users, AlertCircle,
} from 'lucide-react'
import { getDashboardStats, type DashboardStats } from '../lib/api/dashboard'
import './Dashboard.css'

/* ── Container status config (colors from Contenants.tsx badges) ─────────── */
const STATUS_CONF = [
  { key: 'contenants_propres'     as keyof DashboardStats, label: 'Propres',     color: '#22C55E', dotBg: '#DCFCE7' },
  { key: 'contenants_en_consigne' as keyof DashboardStats, label: 'En consigne', color: '#3B82F6', dotBg: '#DBEAFE' },
  { key: 'contenants_sales'       as keyof DashboardStats, label: 'Sales',       color: '#EAB308', dotBg: '#FEF9C3' },
  { key: 'contenants_en_lavage'   as keyof DashboardStats, label: 'En lavage',   color: '#A855F7', dotBg: '#F3E8FF' },
  { key: 'contenants_en_transit'  as keyof DashboardStats, label: 'En transit',  color: '#F97316', dotBg: '#FEF3C7' },
  { key: 'contenants_perdus'      as keyof DashboardStats, label: 'Perdus',      color: '#EF4444', dotBg: '#FEE2E2' },
  { key: 'contenants_a_detruire'  as keyof DashboardStats, label: 'À détruire',  color: '#F43F5E', dotBg: '#FFE4E6' },
]

/* ── KPI config ──────────────────────────────────────────────────────────── */
const KPI_CONF = [
  {
    key:   'contenants_total'          as keyof DashboardStats,
    label: 'Contenants actifs',
    Icon:  Box,
    color: '#335A37',
  },
  {
    key:   'commandes_en_cours'        as keyof DashboardStats,
    label: 'Commandes en cours',
    Icon:  ClipboardList,
    color: '#3B82F6',
  },
  {
    key:   'commandes_livrees_ce_mois' as keyof DashboardStats,
    label: 'Livrées ce mois',
    Icon:  CheckCircle2,
    color: '#16A34A',
  },
  {
    key:   'organisations_total'       as keyof DashboardStats,
    label: 'Organisations',
    Icon:  Building2,
    color: '#D97706',
  },
]

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmt   = (n: number) => n.toLocaleString('fr-FR')
const pct   = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : 0

/* ── Sub-components ──────────────────────────────────────────────────────── */
function SkRow() {
  return <div className="db-sk db-sk-stat-row" />
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [stats, setStats]   = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setError('Impossible de charger les statistiques du tableau de bord.'))
      .finally(() => setLoading(false))
  }, [])

  /* ── Error ── */
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

  const total = stats?.contenants_total ?? 0

  /* ── Render ── */
  return (
    <div className="db-page">

      {/* ── Row 1 : KPI cards ── */}
      <div className="db-kpi-grid">
        {KPI_CONF.map(({ key, label, Icon, color }) => (
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
                <div
                  className="db-kpi-icon"
                  style={{ background: `${color}1A`, color }}
                >
                  <Icon size={22} strokeWidth={1.75} />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Row 2 : Container park bar ── */}
      <div className="db-card db-park-card">
        <div className="db-card-header">
          <h2 className="db-card-title">État du parc contenants</h2>
          {!loading && total > 0 && (
            <span className="db-park-total">{fmt(total)} contenants actifs</span>
          )}
        </div>

        {loading ? (
          <div className="db-park-skel">
            <div className="db-sk db-sk-bar" />
            <div className="db-sk-legend-row">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="db-sk db-sk-legend" />
              ))}
            </div>
          </div>
        ) : total === 0 ? (
          <p className="db-park-empty">Aucun contenant actif.</p>
        ) : (
          <>
            <div className="db-bar">
              {STATUS_CONF.map(s => {
                const n = stats![s.key] as number
                if (n === 0) return null
                return (
                  <div
                    key={s.key}
                    className="db-bar-segment"
                    style={{ flex: n, background: s.color }}
                    title={`${s.label} : ${fmt(n)} (${pct(n, total)}%)`}
                  />
                )
              })}
            </div>

            <div className="db-legend">
              {STATUS_CONF.map(s => {
                const n = stats![s.key] as number
                return (
                  <div key={s.key} className="db-legend-item">
                    <span className="db-legend-dot" style={{ background: s.color }} />
                    <span className="db-legend-label">{s.label}</span>
                    <span className="db-legend-count">{fmt(n)}</span>
                    <span className="db-legend-pct">{pct(n, total)} %</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Row 3 : Commandes + Utilisateurs ── */}
      <div className="db-bottom-grid">

        {/* Commandes */}
        <div className="db-card db-stat-card">
          <h2 className="db-card-title">Commandes</h2>
          {loading ? (
            <div className="db-stat-skel">
              <SkRow /><SkRow /><SkRow />
            </div>
          ) : (
            <div className="db-stat-rows">
              <div className="db-stat-row">
                <span className="db-stat-value" style={{ color: '#D97706' }}>
                  {fmt(stats!.commandes_brouillon)}
                </span>
                <span className="db-stat-label">Brouillons</span>
              </div>
              <div className="db-stat-row">
                <span className="db-stat-value" style={{ color: '#3B82F6' }}>
                  {fmt(stats!.commandes_en_cours)}
                </span>
                <span className="db-stat-label">En cours</span>
              </div>
              <div className="db-stat-row">
                <span className="db-stat-value" style={{ color: '#16A34A' }}>
                  {fmt(stats!.commandes_livrees_ce_mois)}
                </span>
                <span className="db-stat-label">Livrées ce mois</span>
              </div>
            </div>
          )}
        </div>

        {/* Utilisateurs & Orgas */}
        <div className="db-card db-stat-card">
          <h2 className="db-card-title">Utilisateurs & Organisations</h2>
          {loading ? (
            <div className="db-stat-skel">
              <SkRow /><SkRow />
            </div>
          ) : (
            <div className="db-stat-rows">
              {stats!.membres_organisation > 0 ? (
                <div className="db-stat-row">
                  <span className="db-stat-value" style={{ color: '#6D28D9' }}>
                    {fmt(stats!.membres_organisation)}
                  </span>
                  <span className="db-stat-label">
                    <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Membres de l'organisation
                  </span>
                </div>
              ) : (
                <div className="db-stat-row">
                  <span className="db-stat-value" style={{ color: '#6D28D9' }}>
                    {fmt(stats!.utilisateurs_total)}
                  </span>
                  <span className="db-stat-label">
                    <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Utilisateurs
                  </span>
                </div>
              )}
              {stats!.organisations_total > 0 && (
                <div className="db-stat-row">
                  <span className="db-stat-value" style={{ color: '#D97706' }}>
                    {fmt(stats!.organisations_total)}
                  </span>
                  <span className="db-stat-label">
                    <Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Organisations
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
