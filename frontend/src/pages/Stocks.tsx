import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Package, Edit2, Trash2, X, Plus, CheckCircle2, AlertCircle, Loader2, RefreshCw,
} from 'lucide-react'
import {
  getStocks, getStock, createStock, updateStock, deleteStock,
  addContainer, removeContainer, bulkStatus,
  type Stock,
} from '../lib/api/stocks'
import './Stocks.css'

/* ── Status configs ──────────────────────────────────────────── */
const STATUS_LABELS: Record<string, string> = {
  en_cours:   'En cours',
  ferme:      'Fermé',
  en_transit: 'En transit',
  archive:    'Archivé',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  en_cours:   { bg: '#DBEAFE', color: '#1D4ED8' },
  ferme:      { bg: '#F3F4F6', color: '#6B7280' },
  en_transit: { bg: '#FFEDD5', color: '#F97316' },
  archive:    { bg: '#F3F4F6', color: '#9CA3AF' },
}

const CONT_STATUS_LABELS: Record<string, string> = {
  propre:      'Propre',
  en_consigne: 'En consigne',
  sale:        'Sale',
  en_lavage:   'En lavage',
  en_transit:  'En transit',
  a_detruire:  'À détruire',
  detruit:     'Détruit',
  perdu:       'Perdu',
}

const CONT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  propre:      { bg: '#DCFCE7', color: '#16A34A' },
  en_consigne: { bg: '#DBEAFE', color: '#1D4ED8' },
  sale:        { bg: '#FEF3C7', color: '#D97706' },
  en_lavage:   { bg: '#F3E8FF', color: '#7C3AED' },
  en_transit:  { bg: '#FFEDD5', color: '#F97316' },
  a_detruire:  { bg: '#FEE2E2', color: '#DC2626' },
  detruit:     { bg: '#F3F4F6', color: '#9CA3AF' },
  perdu:       { bg: '#F3F4F6', color: '#9CA3AF' },
}

/* ── Zod schema ──────────────────────────────────────────────── */
const formSchema = z.object({
  name:   z.string().min(1, 'Le nom est obligatoire'),
  status: z.string().optional(),
  note:   z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>
type PanelMode  = 'detail' | 'edit' | 'create' | null

/* ── Helpers ─────────────────────────────────────────────────── */
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function StatusBadge({
  status, colors, labels,
}: {
  status: string
  colors: Record<string, { bg: string; color: string }>
  labels: Record<string, string>
}) {
  const c = colors[status] ?? { bg: '#F3F4F6', color: '#6B7280' }
  return (
    <span className="sk-status-badge" style={{ background: c.bg, color: c.color }}>
      {labels[status] ?? status}
    </span>
  )
}

/* ── Main component ──────────────────────────────────────────── */
export default function Stocks() {
  const [stocks, setStocks]           = useState<Stock[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<Stock | null>(null)
  const [panelMode, setPanelMode]     = useState<PanelMode>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [confirmDel, setConfirmDel]   = useState(false)
  const [toast, setToast]             = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const [addUid, setAddUid]           = useState('')
  const [addError, setAddError]       = useState<string | null>(null)
  const [addLoading, setAddLoading]   = useState(false)

  const [showBulk, setShowBulk]         = useState(false)
  const [bulkStatusVal, setBulkStatusVal] = useState('')
  const [bulkNote, setBulkNote]         = useState('')
  const [bulkLoading, setBulkLoading]   = useState(false)
  const [bulkResult, setBulkResult]     = useState<{ updated: number; skipped: number } | null>(null)

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  })

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
      const params = statusFilter ? { status: statusFilter } : undefined
      setStocks(await getStocks(params))
    } catch {
      showToast('Erreur lors du chargement de la liste.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, statusFilter])

  useEffect(() => { fetchList() }, [fetchList])

  /* ── Panel triggers ── */
  const openDetail = async (s: Stock) => {
    setConfirmDel(false)
    setShowBulk(false)
    setBulkResult(null)
    setAddUid('')
    setAddError(null)
    const detail = await getStock(s.id)
    setSelected(detail)
    setPanelMode('detail')
  }

  const openCreate = () => {
    setSelected(null)
    setPanelMode('create')
    reset({ name: '', status: '', note: '' })
  }

  const openEdit = () => {
    setPanelMode('edit')
    reset({
      name:   selected?.name   ?? '',
      status: selected?.status ?? '',
      note:   selected?.note   ?? '',
    })
  }

  const closePanel = () => {
    setPanelMode(null)
    setSelected(null)
    setConfirmDel(false)
    setShowBulk(false)
    setBulkResult(null)
    setAddUid('')
    setAddError(null)
  }

  /* ── Form submit ── */
  const onSubmit = async (data: FormValues) => {
    setSubmitting(true)
    try {
      if (panelMode === 'create') {
        await createStock({ name: data.name, note: data.note || undefined })
        showToast('Stock créé.', 'success')
        closePanel()
      } else if (panelMode === 'edit' && selected) {
        const updated = await updateStock(selected.id, {
          name:   data.name,
          status: data.status || undefined,
          note:   data.note   || undefined,
        })
        setSelected(updated)
        setPanelMode('detail')
        showToast('Modifications enregistrées.', 'success')
      }
      await fetchList()
    } catch (err) {
      showToast((err as any)?.response?.data?.detail ?? 'Erreur lors de l\'enregistrement.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!selected) return
    if (!confirmDel) { setConfirmDel(true); return }
    setDeleting(true)
    try {
      await deleteStock(selected.id)
      showToast('Stock supprimé.', 'success')
      closePanel()
      await fetchList()
    } catch (err) {
      showToast((err as any)?.response?.data?.detail ?? 'Erreur lors de la suppression.', 'error')
      setConfirmDel(false)
    } finally {
      setDeleting(false)
    }
  }

  /* ── Add container ── */
  const handleAddContainer = async () => {
    if (!selected || !addUid.trim()) return
    setAddLoading(true)
    setAddError(null)
    try {
      const updated = await addContainer(selected.id, addUid.trim())
      setSelected(updated)
      setAddUid('')
      setStocks(prev => prev.map(s => s.id === updated.id ? { ...s, container_count: updated.container_count } : s))
    } catch (err) {
      setAddError((err as any)?.response?.data?.detail ?? 'Erreur lors de l\'ajout.')
    } finally {
      setAddLoading(false)
    }
  }

  /* ── Remove container ── */
  const handleRemoveContainer = async (uid: string) => {
    if (!selected) return
    try {
      const updated = await removeContainer(selected.id, uid)
      setSelected(updated)
      setStocks(prev => prev.map(s => s.id === updated.id ? { ...s, container_count: updated.container_count } : s))
    } catch (err) {
      showToast((err as any)?.response?.data?.detail ?? 'Erreur lors du retrait.', 'error')
    }
  }

  /* ── Bulk status ── */
  const handleBulkStatus = async () => {
    if (!selected || !bulkStatusVal) return
    setBulkLoading(true)
    setBulkResult(null)
    try {
      const result  = await bulkStatus(selected.id, bulkStatusVal, bulkNote || undefined)
      const updated = await getStock(selected.id)
      setSelected(updated)
      setBulkResult(result)
      setBulkStatusVal('')
      setBulkNote('')
    } catch (err) {
      showToast((err as any)?.response?.data?.detail ?? 'Erreur lors du changement de statut.', 'error')
    } finally {
      setBulkLoading(false)
    }
  }

  /* ── Render helpers ── */
  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="sk-skeleton-row">
        <td><div className="sk-skeleton-cell" style={{ width: '60%' }} /></td>
        <td><div className="sk-skeleton-cell" style={{ width: '80px' }} /></td>
        <td><div className="sk-skeleton-cell" style={{ width: '36px', margin: '0 auto' }} /></td>
        <td><div className="sk-skeleton-cell" style={{ width: '50%' }} /></td>
        <td><div className="sk-skeleton-cell" style={{ width: '64px' }} /></td>
        <td style={{ width: '44px' }} />
      </tr>
    ))

  const renderTableBody = () => {
    if (loading) return renderSkeletonRows()
    if (stocks.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            <div className="sk-empty">
              <Package size={48} className="sk-empty-icon" />
              <p>Aucun stock enregistré.</p>
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={15} /> Créer un stock
              </button>
            </div>
          </td>
        </tr>
      )
    }
    return stocks.map(s => (
      <tr
        key={s.id}
        className={selected?.id === s.id && panelMode !== null ? 'sk-row-active' : ''}
        onClick={() => openDetail(s)}
      >
        <td className="sk-col-name">{s.name ?? '—'}</td>
        <td>
          <StatusBadge status={s.status} colors={STATUS_COLORS} labels={STATUS_LABELS} />
        </td>
        <td className="sk-col-center">{s.container_count}</td>
        <td className="sk-col-muted">{s.id_place ?? '—'}</td>
        <td className="sk-col-muted">{formatDate(s.created_at)}</td>
        <td>
          <div className="sk-row-actions" onClick={e => e.stopPropagation()}>
            <button
              className="sk-btn-row-action"
              aria-label="Modifier"
              onClick={() => { openDetail(s).then(() => setPanelMode('edit')) }}
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
    const s = selected
    return (
      <>
        <div className="sk-detail-section">
          <div className="sk-detail-section-title">Informations</div>
          <div className="sk-detail-grid">
            <div className="sk-detail-field sk-detail-field-full">
              <div className="sk-detail-label">Nom</div>
              <div className="sk-detail-value">{s.name ?? '—'}</div>
            </div>
            <div className="sk-detail-field">
              <div className="sk-detail-label">Statut</div>
              <div className="sk-detail-value">
                <StatusBadge status={s.status} colors={STATUS_COLORS} labels={STATUS_LABELS} />
              </div>
            </div>
            <div className="sk-detail-field">
              <div className="sk-detail-label">Créé le</div>
              <div className="sk-detail-value">{formatDate(s.created_at)}</div>
            </div>
            {s.note && (
              <div className="sk-detail-field sk-detail-field-full">
                <div className="sk-detail-label">Note</div>
                <div className="sk-detail-value">{s.note}</div>
              </div>
            )}
          </div>
        </div>

        <div className="sk-detail-section">
          <div className="sk-detail-section-title">
            Contenants ({s.container_count})
          </div>

          <div className="sk-add-row">
            <input
              type="text"
              placeholder="UID du contenant..."
              value={addUid}
              onChange={e => { setAddUid(e.target.value); setAddError(null) }}
              onKeyDown={e => e.key === 'Enter' && handleAddContainer()}
              className={addError ? 'sk-field-error' : ''}
            />
            <button
              className="btn-secondary sk-btn-sm"
              onClick={handleAddContainer}
              disabled={addLoading || !addUid.trim()}
            >
              {addLoading ? <Loader2 size={13} className="sk-spin" /> : <Plus size={13} />}
              Ajouter
            </button>
          </div>
          {addError && <p className="sk-add-error">{addError}</p>}

          {s.containers.length === 0 ? (
            <p className="sk-cont-empty">Aucun contenant dans ce stock.</p>
          ) : (
            <div className="sk-cont-list">
              {s.containers.map(c => (
                <div key={c.id} className="sk-cont-item">
                  <span className="sk-cont-uid">{c.uid}</span>
                  <StatusBadge status={c.status} colors={CONT_STATUS_COLORS} labels={CONT_STATUS_LABELS} />
                  <button
                    className="sk-btn-row-action"
                    aria-label="Retirer"
                    onClick={() => handleRemoveContainer(c.uid)}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sk-detail-section">
          <div className="sk-detail-section-title">Changement de statut en masse</div>
          {!showBulk ? (
            <button
              className="btn-secondary sk-btn-sm"
              onClick={() => { setShowBulk(true); setBulkResult(null) }}
              disabled={s.container_count === 0}
            >
              <RefreshCw size={13} /> Changer le statut
            </button>
          ) : (
            <div className="sk-bulk-section">
              {bulkResult && (
                <p className="sk-bulk-result">
                  {bulkResult.updated} mis à jour, {bulkResult.skipped} ignoré{bulkResult.skipped !== 1 ? 's' : ''}
                </p>
              )}
              <div className="sk-bulk-row">
                <select
                  value={bulkStatusVal}
                  onChange={e => setBulkStatusVal(e.target.value)}
                  aria-label="Nouveau statut des contenants"
                >
                  <option value="">— Choisir un statut —</option>
                  {Object.entries(CONT_STATUS_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
                <button
                  className="btn-secondary sk-btn-sm"
                  onClick={handleBulkStatus}
                  disabled={bulkLoading || !bulkStatusVal}
                >
                  {bulkLoading ? <Loader2 size={13} className="sk-spin" /> : null}
                  Appliquer
                </button>
                <button
                  className="btn-secondary sk-btn-sm"
                  onClick={() => { setShowBulk(false); setBulkResult(null) }}
                >
                  Annuler
                </button>
              </div>
              <input
                type="text"
                placeholder="Note (optionnelle)..."
                value={bulkNote}
                onChange={e => setBulkNote(e.target.value)}
                className="sk-bulk-note"
              />
            </div>
          )}
        </div>
      </>
    )
  }

  const renderForm = (mode: 'create' | 'edit') => (
    <form id="sk-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="sk-form-section">
        <div className="sk-form-section-title">Informations</div>
        <div className="sk-form-grid">
          <div className="sk-form-field sk-form-field-full">
            <label htmlFor="sk-name">
              Nom <span style={{ color: 'var(--nut-accent-red)' }}>*</span>
            </label>
            <input
              id="sk-name"
              type="text"
              {...register('name')}
              className={errors.name ? 'sk-field-error' : ''}
            />
            {errors.name && <span className="sk-form-error-msg">{errors.name.message}</span>}
          </div>

          {mode === 'edit' && (
            <div className="sk-form-field sk-form-field-full">
              <label htmlFor="sk-status">Statut</label>
              <select id="sk-status" {...register('status')}>
                {Object.entries(STATUS_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="sk-form-field sk-form-field-full">
            <label htmlFor="sk-note">Note</label>
            <textarea id="sk-note" {...register('note')} />
          </div>
        </div>
      </div>
    </form>
  )

  const renderPanel = () => {
    if (!panelMode) return null
    const isForm = panelMode === 'edit' || panelMode === 'create'
    const title  = panelMode === 'create' ? 'Nouveau stock' : selected?.name ?? '—'

    return (
      <aside className="sk-panel">
        <div className="sk-panel-header">
          <div className="sk-panel-header-left">
            <h2 className="sk-panel-title">{title}</h2>
            {panelMode === 'edit'   && <span className="sk-mode-badge sk-mode-badge--edit">Modification</span>}
            {panelMode === 'create' && <span className="sk-mode-badge sk-mode-badge--create">Nouveau</span>}
          </div>
          <button className="sk-panel-close" aria-label="Fermer" onClick={closePanel}>
            <X size={18} />
          </button>
        </div>

        <div className="sk-panel-body">
          {panelMode === 'detail' && renderDetailView()}
          {panelMode === 'edit'   && renderForm('edit')}
          {panelMode === 'create' && renderForm('create')}
        </div>

        <div className="sk-panel-footer">
          {(panelMode === 'edit' || panelMode === 'detail') && confirmDel && (
            <button className="btn-confirm-delete" disabled={deleting} onClick={handleDelete}>
              {deleting ? <Loader2 size={14} className="sk-spin" /> : <Trash2 size={14} />}
              Confirmer la suppression
            </button>
          )}
          {panelMode === 'edit' && !confirmDel && (
            <button className="btn-danger" onClick={() => setConfirmDel(true)}>
              <Trash2 size={14} /> Supprimer
            </button>
          )}

          <div className="sk-panel-footer-right">
            {panelMode === 'detail' && (
              <>
                {confirmDel && (
                  <button className="btn-secondary" onClick={() => setConfirmDel(false)}>
                    Annuler
                  </button>
                )}
                {!confirmDel && (
                  <button className="btn-primary" onClick={openEdit}>
                    <Edit2 size={14} /> Modifier
                  </button>
                )}
              </>
            )}

            {isForm && (
              <>
                <button
                  className="btn-secondary"
                  onClick={panelMode === 'edit' ? () => { setPanelMode('detail'); setConfirmDel(false) } : closePanel}
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  form="sk-form"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? <Loader2 size={14} className="sk-spin" /> : null}
                  Enregistrer
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    )
  }

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="sk-page">
      {toast && (
        <div className={`sk-toast sk-toast--${toast.kind}`} role="alert">
          {toast.kind === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="sk-header">
        <div className="sk-header-left">
          <h1>Stocks</h1>
          {!loading && (
            <span className="sk-count">
              {stocks.length} stock{stocks.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={15} /> Nouveau stock
        </button>
      </div>

      <div className="sk-body">
        <div className="sk-table-card">
          <div className="sk-filters">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label="Filtrer par statut"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            {statusFilter && (
              <button className="btn-secondary" onClick={() => setStatusFilter('')}>
                Réinitialiser
              </button>
            )}
          </div>

          <div className="sk-table-scroll">
            <table className="sk-table" aria-label="Stocks">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Statut</th>
                  <th className="sk-col-center">Contenants</th>
                  <th>Lieu</th>
                  <th>Date</th>
                  <th style={{ width: '44px' }} />
                </tr>
              </thead>
              <tbody>
                {renderTableBody()}
              </tbody>
            </table>
          </div>
        </div>

        {renderPanel()}
      </div>
    </div>
  )
}
