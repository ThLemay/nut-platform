import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box, Edit2, X, CheckCircle2, AlertCircle, Loader2, Clock, Copy,
} from 'lucide-react'
import {
  getContenants, getContenant, getContainerHistory, updateContenantStatus,
  type Container, type ContainerStatus, type ContainerEvent,
} from '../lib/api/contenants'
import './Contenants.css'

/* ── Status labels ───────────────────────────────────────── */
const STATUS_LABELS: Record<ContainerStatus, string> = {
  propre:      'Propre',
  en_consigne: 'En consigne',
  sale:        'Sale',
  en_lavage:   'En lavage',
  en_transit:  'En transit',
  perdu:       'Perdu',
  a_detruire:  'À détruire',
  detruit:     'Détruit',
}

const ALL_STATUSES: ContainerStatus[] = [
  'propre', 'en_consigne', 'sale', 'en_lavage',
  'en_transit', 'perdu', 'a_detruire', 'detruit',
]

/* Mirrors backend TRANSITIONS_AUTORISEES */
const TRANSITIONS: Record<ContainerStatus, ContainerStatus[]> = {
  propre:      ['en_consigne', 'en_transit'],
  en_consigne: ['sale'],
  sale:        ['en_lavage', 'en_transit', 'a_detruire'],
  en_lavage:   ['propre', 'a_detruire'],
  en_transit:  ['propre', 'sale', 'en_consigne'],
  perdu:       ['propre', 'a_detruire'],
  a_detruire:  ['detruit'],
  detruit:     [],
}

/* ── Sub-components ──────────────────────────────────────── */
function StatusBadge({ status }: { status: ContainerStatus }) {
  return (
    <span className={`cnt-badge cnt-badge-${status}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

/* ── Types ───────────────────────────────────────────────── */
type PanelMode = 'detail' | 'status' | null

/* ── Helpers ─────────────────────────────────────────────── */
const shortUid = (uid: string) => uid.slice(0, 8).toUpperCase()

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const fmtDateShort = (iso: string | null | undefined) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const eventLabel = (e: ContainerEvent): string => {
  if (e.event_type === 'container_status_change') {
    const from = e.old_value?.status as string | undefined
    const to   = e.new_value?.status as string | undefined
    if (from && to) {
      return `${STATUS_LABELS[from as ContainerStatus] ?? from} → ${STATUS_LABELS[to as ContainerStatus] ?? to}`
    }
  }
  return e.event_type.replace(/_/g, ' ')
}

/* ── Main component ──────────────────────────────────────── */
export default function Contenants() {
  const [containers, setContainers]   = useState<Container[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<Container | null>(null)
  const [panelMode, setPanelMode]     = useState<PanelMode>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [toast, setToast]             = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)
  const [filters, setFilters]         = useState({ search: '', status: '', is_active: 'true' })

  /* history */
  const [history, setHistory]             = useState<ContainerEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  /* status change form */
  const [newStatus, setNewStatus] = useState<ContainerStatus | ''>('')
  const [statusNote, setStatusNote] = useState('')

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Toast ── */
  const showToast = useCallback((msg: string, kind: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, kind })
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  /* ── Data fetching ── */
  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: { is_active?: boolean; status?: ContainerStatus } = {
        is_active: filters.is_active === 'true',
      }
      if (filters.status) params.status = filters.status as ContainerStatus
      setContainers(await getContenants(params))
    } catch {
      showToast('Erreur lors du chargement de la liste.', 'error')
    } finally {
      setLoading(false)
    }
  }, [filters.is_active, filters.status, showToast])

  useEffect(() => { fetchList() }, [fetchList])

  const fetchHistory = useCallback(async (containerId: number) => {
    setHistoryLoading(true)
    setHistory([])
    try {
      setHistory(await getContainerHistory(containerId))
    } catch {
      /* silently ignore */
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  /* ── Panel triggers ── */
  const openDetail = async (c: Container) => {
    const detail = await getContenant(c.uid)
    setSelected(detail)
    setPanelMode('detail')
    setNewStatus('')
    setStatusNote('')
    fetchHistory(detail.id)
  }

  const openStatusForm = () => {
    setNewStatus('')
    setStatusNote('')
    setPanelMode('status')
  }

  const closePanel = () => {
    setPanelMode(null)
    setSelected(null)
    setHistory([])
  }

  /* ── Copy UID ── */
  const copyUid = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(uid).then(() => showToast('UID copié.', 'success'))
  }

  /* ── Status change submit ── */
  const handleStatusChange = async () => {
    if (!selected || !newStatus) return
    setSubmitting(true)
    try {
      await updateContenantStatus(selected.uid, { status: newStatus, note: statusNote || null })
      showToast('Statut mis à jour.', 'success')
      const refreshed = await getContenant(selected.uid)
      setSelected(refreshed)
      setPanelMode('detail')
      fetchHistory(refreshed.id)
      await fetchList()
    } catch (err) {
      showToast((err as any)?.response?.data?.detail ?? 'Erreur lors du changement de statut.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Filters ── */
  const filtersActive = filters.search !== '' || filters.status !== '' || filters.is_active !== 'true'

  const filteredData = containers.filter(c => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const matchUid  = c.uid.toLowerCase().includes(q)
      const matchType = (c.cont_type_name ?? '').toLowerCase().includes(q)
      if (!matchUid && !matchType) return false
    }
    return true
  })

  const resetFilters = () => setFilters({ search: '', status: '', is_active: 'true' })

  /* ── Render helpers ── */
  const renderSkeletonRows = () =>
    Array.from({ length: 6 }).map((_, i) => (
      <tr key={i} className="skeleton-row">
        <td><div className="skeleton-cell" style={{ width: '90px' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '70%' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '80px' }} /></td>
        <td className="col-right"><div className="skeleton-cell" style={{ width: '30px', marginLeft: 'auto' }} /></td>
        <td className="col-center"><div className="skeleton-cell" style={{ width: '40px', margin: '0 auto' }} /></td>
        <td style={{ width: '44px' }} />
      </tr>
    ))

  const renderTableBody = () => {
    if (loading) return renderSkeletonRows()
    if (containers.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            <div className="cnt-empty">
              <Box size={48} className="cnt-empty-icon" />
              <p>Aucun contenant enregistré.</p>
            </div>
          </td>
        </tr>
      )
    }
    if (filteredData.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            <div className="cnt-empty">
              <Box size={48} className="cnt-empty-icon" />
              <p>Aucun résultat pour ces filtres.</p>
              <button className="btn-secondary" onClick={resetFilters}>
                Réinitialiser les filtres
              </button>
            </div>
          </td>
        </tr>
      )
    }
    return filteredData.map(c => (
      <tr
        key={c.id}
        className={selected?.id === c.id && panelMode !== null ? 'row-active' : ''}
        onClick={() => openDetail(c)}
      >
        <td className="col-uid">
          <span title={c.uid}>{shortUid(c.uid)}</span>
        </td>
        <td className="col-muted">{c.cont_type_name ?? `#${c.id_cont_type}`}</td>
        <td><StatusBadge status={c.status} /></td>
        <td className="col-right">{c.total_wash_count}</td>
        <td className="col-center">
          <span className={c.is_active ? 'cnt-actif' : 'cnt-inactif'}>
            {c.is_active ? 'Oui' : 'Non'}
          </span>
        </td>
        <td>
          <div className="cnt-row-actions" onClick={e => e.stopPropagation()}>
            <button
              className="btn-row-action"
              aria-label="Voir détail"
              onClick={() => openDetail(c)}
            >
              <Edit2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        </td>
      </tr>
    ))
  }

  const renderDetailView = () => {
    if (!selected) return null
    const c = selected
    const transitions = TRANSITIONS[c.status]
    return (
      <>
        {/* Identité */}
        <div className="detail-section">
          <div className="detail-section-title">Identité</div>
          <div className="detail-grid">
            <div className="detail-field detail-field-full">
              <div className="detail-label">UID</div>
              <div className="detail-value mono">
                {c.uid}
                <button
                  className="btn-copy-uid"
                  aria-label="Copier l'UID"
                  onClick={e => copyUid(c.uid, e)}
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Type de contenant</div>
              <div className="detail-value">{c.cont_type_name ?? `#${c.id_cont_type}`}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Statut</div>
              <div className="detail-value"><StatusBadge status={c.status} /></div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Actif</div>
              <div className="detail-value">
                <span className={c.is_active ? 'cnt-actif' : 'cnt-inactif'}>
                  {c.is_active ? 'Oui' : 'Non'}
                </span>
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Numéro de lot</div>
              <div className={`detail-value${!c.batch_number ? ' empty' : ''}`}>
                {c.batch_number ?? '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Traçabilité */}
        <div className="detail-section">
          <div className="detail-section-title">Traçabilité</div>
          <div className="detail-grid">
            <div className="detail-field">
              <div className="detail-label">Lavages effectués</div>
              <div className="detail-value">{c.total_wash_count}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Contrôles qualité</div>
              <div className="detail-value">{c.quality_check_count}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Dernier contrôle</div>
              <div className={`detail-value${!c.last_quality_check ? ' empty' : ''}`}>
                {fmtDateShort(c.last_quality_check)}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Lieu actuel</div>
              <div className={`detail-value${!c.id_current_place ? ' empty' : ''}`}>
                {c.id_current_place != null ? `#${c.id_current_place}` : '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Stock actuel</div>
              <div className={`detail-value${!c.id_current_stock ? ' empty' : ''}`}>
                {c.id_current_stock != null ? `#${c.id_current_stock}` : '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Première utilisation</div>
              <div className={`detail-value${!c.first_use_date ? ' empty' : ''}`}>
                {fmtDateShort(c.first_use_date)}
              </div>
            </div>
          </div>
        </div>

        {/* Propriété */}
        <div className="detail-section">
          <div className="detail-section-title">Propriété</div>
          <div className="detail-grid">
            <div className="detail-field">
              <div className="detail-label">Organisation propriétaire</div>
              <div className={`detail-value${!c.id_owner_organization ? ' empty' : ''}`}>
                {c.id_owner_organization != null ? `#${c.id_owner_organization}` : '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Type de propriété</div>
              <div className={`detail-value${!c.ownership_type ? ' empty' : ''}`}>
                {c.ownership_type ?? '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Prix d'achat</div>
              <div className={`detail-value${!c.purchase_price ? ' empty' : ''}`}>
                {c.purchase_price != null ? `${parseFloat(c.purchase_price).toFixed(2)} €` : '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Créé le</div>
              <div className={`detail-value${!c.creation_date ? ' empty' : ''}`}>
                {fmtDateShort(c.creation_date)}
              </div>
            </div>
          </div>
        </div>

        {/* Transitions autorisées (hint) */}
        {transitions.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-title">Transitions autorisées</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {transitions.map(s => <StatusBadge key={s} status={s} />)}
            </div>
          </div>
        )}

        {/* Historique */}
        <div className="detail-section">
          <div className="detail-section-title">Historique</div>
          <div className="cnt-history">
            {historyLoading ? (
              <div className="cnt-history-loading">
                <Loader2 size={14} className="spin" /> Chargement…
              </div>
            ) : history.length === 0 ? (
              <div className="cnt-history-empty">Aucun événement enregistré.</div>
            ) : (
              history.map(e => (
                <div key={e.id} className="cnt-event">
                  <div className="cnt-event-dot">
                    <Clock size={12} />
                  </div>
                  <div className="cnt-event-content">
                    <div className="cnt-event-title">
                      {eventLabel(e)}
                    </div>
                    <div className="cnt-event-time">{fmtDate(e.created_at)}</div>
                    {e.note && <div className="cnt-event-note">"{e.note}"</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    )
  }

  const renderStatusForm = () => {
    if (!selected) return null
    const transitions = TRANSITIONS[selected.status]
    if (transitions.length === 0) {
      return (
        <div className="cnt-status-form">
          <p className="cnt-no-transitions">
            Ce contenant est au statut <strong>{STATUS_LABELS[selected.status]}</strong> et
            n'autorise plus aucune transition.
          </p>
        </div>
      )
    }
    return (
      <div className="cnt-status-form">
        <div className="detail-section">
          <div className="detail-section-title">Statut actuel</div>
          <StatusBadge status={selected.status} />
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Nouveau statut</div>
          <div className="form-field">
            <label htmlFor="cnt-new-status">Statut <span style={{ color: 'var(--nut-accent-red)' }}>*</span></label>
            <select
              id="cnt-new-status"
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as ContainerStatus)}
            >
              <option value="">— Sélectionner —</option>
              {transitions.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ marginTop: 12 }}>
            <label htmlFor="cnt-note">Note (optionnelle)</label>
            <textarea
              id="cnt-note"
              rows={3}
              placeholder="Ajouter une note…"
              value={statusNote}
              onChange={e => setStatusNote(e.target.value)}
            />
          </div>
        </div>
      </div>
    )
  }

  const renderPanel = () => {
    if (!panelMode) return null
    const title = selected ? shortUid(selected.uid) : '—'

    return (
      <aside className="cnt-panel">
        {/* Header */}
        <div className="cnt-panel-header">
          <div className="cnt-panel-header-left">
            <h2 className="cnt-panel-title">{title}</h2>
            <span className="cnt-panel-subtitle">
              {selected && <StatusBadge status={selected.status} />}
              {panelMode === 'status' && <span className="mode-badge status">Changement statut</span>}
            </span>
          </div>
          <button className="cnt-panel-close" aria-label="Fermer" onClick={closePanel}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="cnt-panel-body">
          {panelMode === 'detail' && renderDetailView()}
          {panelMode === 'status' && renderStatusForm()}
        </div>

        {/* Footer */}
        <div className="cnt-panel-footer">
          <div className="cnt-panel-footer-right">
            {panelMode === 'detail' && selected && TRANSITIONS[selected.status].length > 0 && (
              <button className="btn-primary" onClick={openStatusForm}>
                <Edit2 size={14} /> Changer statut
              </button>
            )}

            {panelMode === 'status' && (
              <>
                <button
                  className="btn-secondary"
                  onClick={() => setPanelMode('detail')}
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  className="btn-primary"
                  onClick={handleStatusChange}
                  disabled={submitting || !newStatus}
                >
                  {submitting ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                  Confirmer
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    )
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="cnt-page">
      {/* Toast */}
      {toast && (
        <div className={`cnt-toast ${toast.kind}`} role="alert">
          {toast.kind === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="cnt-header">
        <div className="cnt-header-left">
          <h1>Contenants</h1>
          {!loading && (
            <span className="cnt-count">
              {filtersActive
                ? `${filteredData.length} / ${containers.length} contenant${containers.length !== 1 ? 's' : ''}`
                : `${containers.length} contenant${containers.length !== 1 ? 's' : ''} actif${containers.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
      </div>

      {/* Split view */}
      <div className="cnt-body">
        {/* Table card */}
        <div className="cnt-table-card">
          {/* Filters */}
          <div className="cnt-filters">
            <input
              type="search"
              placeholder="Rechercher par UID ou type…"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
            <select
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              aria-label="Filtrer par statut"
            >
              <option value="">Tous les statuts</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={filters.is_active}
              onChange={e => setFilters(f => ({ ...f, is_active: e.target.value }))}
              aria-label="Filtrer par actif"
            >
              <option value="true">Actifs seulement</option>
              <option value="false">Inactifs seulement</option>
            </select>
            {filtersActive && (
              <button className="btn-secondary" onClick={resetFilters}>
                Réinitialiser
              </button>
            )}
          </div>

          {/* Table */}
          <div className="cnt-table-scroll">
            <table className="cnt-table" aria-label="Contenants">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th className="col-right">Lavages</th>
                  <th className="col-center">Actif</th>
                  <th style={{ width: '44px' }} />
                </tr>
              </thead>
              <tbody>
                {renderTableBody()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel */}
        {renderPanel()}
      </div>
    </div>
  )
}
