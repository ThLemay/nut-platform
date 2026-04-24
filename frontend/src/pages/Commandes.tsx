import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ClipboardList, Edit2, X, CheckCircle2, AlertCircle, Loader2, ChevronRight,
} from 'lucide-react'
import {
  getOrders, getOrder, updateOrderStatus,
  type Order, type OrderStatus, type OrderType,
} from '../lib/api/commandes'
import './Commandes.css'

/* ── Labels ──────────────────────────────────────────────── */
const STATUS_LABELS: Record<OrderStatus, string> = {
  brouillon:        'Brouillon',
  envoyee:          'Envoyée',
  acceptee:         'Acceptée',
  en_cours:         'En cours',
  controle_qualite: 'Contrôle qualité',
  prete:            'Prête',
  en_transit:       'En transit',
  livree:           'Livrée',
  annulee:          'Annulée',
}

const TYPE_LABELS: Record<OrderType, string> = {
  lavage:     'Lavage',
  transport:  'Transport',
  contenants: 'Contenants',
  machine:    'Machine',
}

const ALL_STATUSES: OrderStatus[] = [
  'brouillon','envoyee','acceptee','en_cours',
  'controle_qualite','prete','en_transit','livree','annulee',
]
const ALL_TYPES: OrderType[] = ['lavage','transport','contenants','machine']

const RESPONSIBLE_LABELS: Record<string, string> = {
  client:       'Client',
  laveur:       'Laveur',
  transporteur: 'Transporteur',
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  brouillon:        ['envoyee', 'annulee'],
  envoyee:          ['acceptee', 'annulee'],
  acceptee:         ['en_cours', 'annulee'],
  en_cours:         ['controle_qualite', 'prete'],
  controle_qualite: ['prete'],
  prete:            ['en_transit', 'livree'],
  en_transit:       ['livree'],
  livree:           [],
  annulee:          [],
}

/* ── Sub-components ──────────────────────────────────────── */
function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`cmd-badge cmd-status-${status}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function TypeBadge({ type }: { type: OrderType }) {
  return (
    <span className={`cmd-badge cmd-type-${type}`}>
      {TYPE_LABELS[type]}
    </span>
  )
}

/* ── Types ───────────────────────────────────────────────── */
type PanelMode = 'detail' | 'status' | null

/* ── Helpers ─────────────────────────────────────────────── */
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const fmtDateShort = (iso: string | null | undefined) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

/* ── Main component ──────────────────────────────────────── */
export default function Commandes() {
  const [orders, setOrders]         = useState<Order[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Order | null>(null)
  const [panelMode, setPanelMode]   = useState<PanelMode>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]           = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)
  const [filters, setFilters]       = useState({ search: '', order_type: '', status: '' })
  const [newStatus, setNewStatus]   = useState<OrderStatus | ''>('')
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
      const params: { order_type?: OrderType; status?: OrderStatus } = {}
      if (filters.order_type) params.order_type = filters.order_type as OrderType
      if (filters.status)     params.status     = filters.status as OrderStatus
      setOrders(await getOrders(params))
    } catch {
      showToast('Erreur lors du chargement des commandes.', 'error')
    } finally {
      setLoading(false)
    }
  }, [filters.order_type, filters.status, showToast])

  useEffect(() => { fetchList() }, [fetchList])

  /* ── Panel triggers ── */
  const openDetail = async (o: Order) => {
    const detail = await getOrder(o.id)
    setSelected(detail)
    setPanelMode('detail')
    setNewStatus('')
  }

  const openStatusForm = () => {
    setNewStatus('')
    setPanelMode('status')
  }

  const closePanel = () => {
    setPanelMode(null)
    setSelected(null)
  }

  /* ── Status change submit ── */
  const handleStatusChange = async () => {
    if (!selected || !newStatus) return
    setSubmitting(true)
    try {
      const updated = await updateOrderStatus(selected.id, newStatus)
      setSelected(updated)
      setPanelMode('detail')
      showToast('Statut mis à jour.', 'success')
      await fetchList()
    } catch (err) {
      showToast((err as any)?.response?.data?.detail ?? 'Erreur lors du changement de statut.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Filters ── */
  const filtersActive = filters.search !== '' || filters.order_type !== '' || filters.status !== ''

  const filteredData = orders.filter(o => {
    if (filters.search) {
      if (!String(o.id).includes(filters.search.trim())) return false
    }
    return true
  })

  const resetFilters = () => setFilters({ search: '', order_type: '', status: '' })

  /* ── Render helpers ── */
  const renderSkeletonRows = () =>
    Array.from({ length: 6 }).map((_, i) => (
      <tr key={i} className="skeleton-row">
        <td><div className="skeleton-cell" style={{ width: '30px' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '80px' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '90px' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '40px' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '40px' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '70px' }} /></td>
        <td style={{ width: '44px' }} />
      </tr>
    ))

  const renderTableBody = () => {
    if (loading) return renderSkeletonRows()
    if (orders.length === 0) {
      return (
        <tr>
          <td colSpan={7}>
            <div className="cmd-empty">
              <ClipboardList size={48} className="cmd-empty-icon" />
              <p>Aucune commande enregistrée.</p>
            </div>
          </td>
        </tr>
      )
    }
    if (filteredData.length === 0) {
      return (
        <tr>
          <td colSpan={7}>
            <div className="cmd-empty">
              <ClipboardList size={48} className="cmd-empty-icon" />
              <p>Aucun résultat pour ces filtres.</p>
              <button className="btn-secondary" onClick={resetFilters}>
                Réinitialiser les filtres
              </button>
            </div>
          </td>
        </tr>
      )
    }
    return filteredData.map(o => (
      <tr
        key={o.id}
        className={selected?.id === o.id && panelMode !== null ? 'row-active' : ''}
        onClick={() => openDetail(o)}
      >
        <td className="col-id">#{o.id}</td>
        <td><TypeBadge type={o.order_type} /></td>
        <td><StatusBadge status={o.status} /></td>
        <td className="col-muted">#{o.id_client}</td>
        <td className="col-muted">
          {o.id_provider != null ? `#${o.id_provider}` : <span style={{ color: 'var(--fg-disabled)', fontStyle: 'italic' }}>Non assigné</span>}
        </td>
        <td className="col-muted">{fmtDateShort(o.desired_date)}</td>
        <td>
          <div className="cmd-row-actions" onClick={e => e.stopPropagation()}>
            <button
              className="btn-row-action"
              aria-label="Voir détail"
              onClick={() => openDetail(o)}
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </td>
      </tr>
    ))
  }

  const renderDetailView = () => {
    if (!selected) return null
    const o = selected
    const transitions = TRANSITIONS[o.status]
    return (
      <>
        {/* Commande */}
        <div className="detail-section">
          <div className="detail-section-title">Commande</div>
          <div className="detail-grid">
            <div className="detail-field">
              <div className="detail-label">ID</div>
              <div className="detail-value">#{o.id}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Type</div>
              <div className="detail-value"><TypeBadge type={o.order_type} /></div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Statut</div>
              <div className="detail-value"><StatusBadge status={o.status} /></div>
            </div>
            <div className="detail-field">
              <div className="detail-label">QR Code</div>
              <div className={`detail-value${!o.qr_code ? ' empty' : ''}`}>
                {o.qr_code ?? '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Date commande</div>
              <div className={`detail-value${!o.order_date ? ' empty' : ''}`}>
                {fmtDate(o.order_date)}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Date souhaitée</div>
              <div className={`detail-value${!o.desired_date ? ' empty' : ''}`}>
                {fmtDate(o.desired_date)}
              </div>
            </div>
            {o.confirmed_date && (
              <div className="detail-field">
                <div className="detail-label">Date confirmée</div>
                <div className="detail-value">{fmtDate(o.confirmed_date)}</div>
              </div>
            )}
            {o.note && (
              <div className="detail-field detail-field-full">
                <div className="detail-label">Note</div>
                <div className="detail-value">{o.note}</div>
              </div>
            )}
          </div>
        </div>

        {/* Parties */}
        <div className="detail-section">
          <div className="detail-section-title">Parties</div>
          <div className="detail-grid">
            <div className="detail-field">
              <div className="detail-label">Client</div>
              <div className="detail-value">#{o.id_client}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Prestataire</div>
              <div className={`detail-value${o.id_provider == null ? ' empty' : ''}`}>
                {o.id_provider != null ? `#${o.id_provider}` : 'Non assigné'}
              </div>
            </div>
          </div>
        </div>

        {/* Lignes */}
        <div className="detail-section">
          <div className="detail-section-title">Lignes de commande</div>
          {o.lines.length === 0 ? (
            <div className="cmd-lines-empty">Aucune ligne.</div>
          ) : (
            <table className="cmd-lines-table">
              <thead>
                <tr>
                  <th>Type cont.</th>
                  <th className="col-right">Qté</th>
                  <th className="col-right">P.U.</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {o.lines.map(l => (
                  <tr key={l.id}>
                    <td>{l.id_cont_type != null ? `#${l.id_cont_type}` : '—'}</td>
                    <td className="col-right">{l.quantity ?? '—'}</td>
                    <td className="col-right">
                      {l.unit_price != null ? `${parseFloat(l.unit_price).toFixed(2)} €` : '—'}
                    </td>
                    <td style={{ color: 'var(--fg-muted)' }}>{l.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Transport */}
        {o.transport && (
          <div className="detail-section">
            <div className="detail-section-title">Transport</div>
            <div className="detail-grid">
              <div className="detail-field">
                <div className="detail-label">Responsable</div>
                <div className="detail-value">
                  {RESPONSIBLE_LABELS[o.transport.responsible] ?? o.transport.responsible}
                </div>
              </div>
              <div className="detail-field">
                <div className="detail-label">Signé</div>
                <div className="detail-value">
                  {o.transport.is_signed ? 'Oui' : 'Non'}
                </div>
              </div>
              <div className="detail-field">
                <div className="detail-label">Lieu de collecte</div>
                <div className={`detail-value${!o.transport.id_pickup_place ? ' empty' : ''}`}>
                  {o.transport.id_pickup_place != null ? `#${o.transport.id_pickup_place}` : '—'}
                </div>
              </div>
              <div className="detail-field">
                <div className="detail-label">Lieu de livraison</div>
                <div className={`detail-value${!o.transport.id_delivery_place ? ' empty' : ''}`}>
                  {o.transport.id_delivery_place != null ? `#${o.transport.id_delivery_place}` : '—'}
                </div>
              </div>
              {o.transport.slots.length > 0 && (
                <div className="detail-field detail-field-full">
                  <div className="detail-label">Créneaux proposés</div>
                  <div className="cmd-slots">
                    {o.transport.slots.map(s => (
                      <div key={s.id} className={`cmd-slot${s.is_accepted ? ' cmd-slot-accepted' : ''}`}>
                        <CheckCircle2 size={13} />
                        {fmtDate(s.slot_date)}
                        {s.is_accepted && <span style={{ marginLeft: 'auto', fontSize: '11px' }}>Accepté</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transitions */}
        {transitions.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-title">Transitions autorisées</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {transitions.map(s => <StatusBadge key={s} status={s} />)}
            </div>
          </div>
        )}
      </>
    )
  }

  const renderStatusForm = () => {
    if (!selected) return null
    const transitions = TRANSITIONS[selected.status]
    if (transitions.length === 0) {
      return (
        <div className="cmd-status-form">
          <p className="cmd-no-transitions">
            Cette commande est au statut <strong>{STATUS_LABELS[selected.status]}</strong> et
            n'autorise plus aucune transition.
          </p>
        </div>
      )
    }
    return (
      <div className="cmd-status-form">
        <div className="detail-section">
          <div className="detail-section-title">Statut actuel</div>
          <StatusBadge status={selected.status} />
        </div>
        <div className="detail-section">
          <div className="detail-section-title">Nouveau statut</div>
          <div className="form-field">
            <label htmlFor="cmd-new-status">
              Statut <span style={{ color: 'var(--nut-accent-red)' }}>*</span>
            </label>
            <select
              id="cmd-new-status"
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as OrderStatus)}
            >
              <option value="">— Sélectionner —</option>
              {transitions.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    )
  }

  const renderPanel = () => {
    if (!panelMode) return null
    const o = selected

    return (
      <aside className="cmd-panel">
        {/* Header */}
        <div className="cmd-panel-header">
          <div className="cmd-panel-header-left">
            <h2 className="cmd-panel-title">
              {o ? `Commande #${o.id}` : '—'}
            </h2>
            <span className="cmd-panel-subtitle">
              {o && <TypeBadge type={o.order_type} />}
              {o && <StatusBadge status={o.status} />}
              {panelMode === 'status' && <span className="mode-badge status">Changement statut</span>}
            </span>
          </div>
          <button className="cmd-panel-close" aria-label="Fermer" onClick={closePanel}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="cmd-panel-body">
          {panelMode === 'detail' && renderDetailView()}
          {panelMode === 'status' && renderStatusForm()}
        </div>

        {/* Footer */}
        <div className="cmd-panel-footer">
          <div className="cmd-panel-footer-right">
            {panelMode === 'detail' && o && TRANSITIONS[o.status].length > 0 && (
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
    <div className="cmd-page">
      {/* Toast */}
      {toast && (
        <div className={`cmd-toast ${toast.kind}`} role="alert">
          {toast.kind === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="cmd-header">
        <div className="cmd-header-left">
          <h1>Commandes</h1>
          {!loading && (
            <span className="cmd-count">
              {filtersActive
                ? `${filteredData.length} / ${orders.length} commande${orders.length !== 1 ? 's' : ''}`
                : `${orders.length} commande${orders.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
      </div>

      {/* Split view */}
      <div className="cmd-body">
        {/* Table card */}
        <div className="cmd-table-card">
          {/* Filters */}
          <div className="cmd-filters">
            <input
              type="search"
              placeholder="Rechercher par ID…"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
            <select
              value={filters.order_type}
              onChange={e => setFilters(f => ({ ...f, order_type: e.target.value }))}
              aria-label="Filtrer par type"
            >
              <option value="">Tous les types</option>
              {ALL_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
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
            {filtersActive && (
              <button className="btn-secondary" onClick={resetFilters}>
                Réinitialiser
              </button>
            )}
          </div>

          {/* Table */}
          <div className="cmd-table-scroll">
            <table className="cmd-table" aria-label="Commandes">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Client</th>
                  <th>Prestataire</th>
                  <th>Date souhaitée</th>
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
