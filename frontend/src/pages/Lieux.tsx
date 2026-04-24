import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  MapPin, Edit2, Trash2, X, Plus, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'
import {
  getPlaces, getPlace, createPlace, updatePlace, deletePlace,
  type Place, type PlaceType,
} from '../lib/api/lieux'
import './Lieux.css'

/* ── Place type labels ───────────────────────────────────── */
const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  restaurant:        'Restaurant',
  cuisine_collective:'Cuisine coll.',
  laveur:            'Laveur',
  entrepot:          'Entrepôt',
  point_collecte:    'Point collecte',
  centre_commercial: 'C. commercial',
  camion:            'Camion',
  recycleur:         'Recycleur',
  destructeur:       'Destructeur',
  autre:             'Autre',
}

const PLACE_TYPES: PlaceType[] = [
  'restaurant','cuisine_collective','laveur','entrepot','point_collecte',
  'centre_commercial','camion','recycleur','destructeur','autre',
]

/* ── Zod helpers ─────────────────────────────────────────── */
const optNum = z.preprocess(
  v => (typeof v === 'number' && !isNaN(v) ? v : undefined),
  z.number().optional().nullable(),
)
const optNumPos = z.preprocess(
  v => (typeof v === 'number' && !isNaN(v) ? v : undefined),
  z.number().positive().optional().nullable(),
)
const optIntPos = z.preprocess(
  v => (typeof v === 'number' && !isNaN(v) ? v : undefined),
  z.number().int().positive().optional().nullable(),
)

const formSchema = z.object({
  name:            z.string().min(1, 'Obligatoire'),
  place_type:      z.enum(['restaurant','cuisine_collective','laveur','entrepot',
                           'point_collecte','centre_commercial','camion',
                           'recycleur','destructeur','autre']),
  id_organization: optIntPos,
  id_parent:       optIntPos,
  latitude:        optNum,
  longitude:       optNum,
  volume_capacity: optNumPos,
  address_line:    z.string().optional(),
  city:            z.string().optional(),
  zipcode:         z.string().optional(),
  country:         z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>
type PanelMode = 'detail' | 'edit' | 'create' | null

/* ── Helpers ─────────────────────────────────────────────── */
const parseDecimal = (v: string | null | undefined): number | undefined =>
  v != null ? (isNaN(parseFloat(v)) ? undefined : parseFloat(v)) : undefined

const fmt = (v: string | null | undefined, suffix = '') => {
  if (v == null) return '—'
  const n = parseFloat(String(v))
  return isNaN(n) ? '—' : `${n}${suffix}`
}

const toFormValues = (p: Place | null): FormValues => ({
  name:            p?.name ?? '',
  place_type:      p?.place_type ?? 'restaurant',
  id_organization: p?.id_organization ?? null,
  id_parent:       p?.id_parent ?? null,
  latitude:        parseDecimal(p?.latitude) ?? null,
  longitude:       parseDecimal(p?.longitude) ?? null,
  volume_capacity: parseDecimal(p?.volume_capacity) ?? null,
  address_line:    p?.address?.address ?? '',
  city:            p?.address?.city ?? '',
  zipcode:         p?.address?.zipcode ?? '',
  country:         p?.address?.country ?? '',
})

const toCreatePayload = (data: FormValues) => ({
  name:            data.name,
  place_type:      data.place_type,
  id_organization: data.id_organization ?? null,
  id_parent:       data.id_parent ?? null,
  latitude:        data.latitude ?? null,
  longitude:       data.longitude ?? null,
  volume_capacity: data.volume_capacity ?? null,
  address: {
    address: data.address_line || null,
    city:    data.city    || null,
    zipcode: data.zipcode || null,
    country: data.country || null,
  },
})

const toUpdatePayload = (data: FormValues) => ({
  name:            data.name,
  place_type:      data.place_type,
  id_organization: data.id_organization ?? null,
  id_parent:       data.id_parent ?? null,
  latitude:        data.latitude ?? null,
  longitude:       data.longitude ?? null,
  volume_capacity: data.volume_capacity ?? null,
  address: {
    address: data.address_line || null,
    city:    data.city    || null,
    zipcode: data.zipcode || null,
    country: data.country || null,
  },
})

/* ── Main component ──────────────────────────────────────── */
export default function Lieux() {
  const [places, setPlaces]         = useState<Place[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Place | null>(null)
  const [panelMode, setPanelMode]   = useState<PanelMode>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [toast, setToast]           = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)
  const [filters, setFilters]       = useState({ search: '', place_type: '' })
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
      setPlaces(await getPlaces())
    } catch {
      showToast('Erreur lors du chargement de la liste.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchList() }, [fetchList])

  /* ── Panel triggers ── */
  const openDetail = async (p: Place) => {
    setConfirmDel(false)
    const detail = await getPlace(p.id)
    setSelected(detail)
    setPanelMode('detail')
  }

  const openCreate = () => {
    setSelected(null)
    setPanelMode('create')
    reset(toFormValues(null))
  }

  const openEdit = () => {
    setPanelMode('edit')
    reset(toFormValues(selected))
  }

  const closePanel = () => {
    setPanelMode(null)
    setSelected(null)
    setConfirmDel(false)
  }

  /* ── Form submit ── */
  const onSubmit = async (data: FormValues) => {
    setSubmitting(true)
    try {
      if (panelMode === 'create') {
        await createPlace(toCreatePayload(data))
        showToast('Lieu créé.', 'success')
        closePanel()
      } else if (panelMode === 'edit' && selected) {
        const updated = await updatePlace(selected.id, toUpdatePayload(data))
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
      await deletePlace(selected.id)
      showToast('Lieu supprimé.', 'success')
      closePanel()
      await fetchList()
    } catch (err) {
      showToast((err as any)?.response?.data?.detail ?? 'Erreur lors de la suppression.', 'error')
      setConfirmDel(false)
    } finally {
      setDeleting(false)
    }
  }

  /* ── Filters ── */
  const filtersActive = filters.search !== '' || filters.place_type !== ''

  const filteredData = places.filter(p => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const matchName = p.name.toLowerCase().includes(q)
      const matchCity = p.address?.city?.toLowerCase().includes(q) ?? false
      if (!matchName && !matchCity) return false
    }
    if (filters.place_type && p.place_type !== filters.place_type) return false
    return true
  })

  const resetFilters = () => setFilters({ search: '', place_type: '' })

  /* ── Render helpers ── */
  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="skeleton-row">
        <td><div className="skeleton-cell" style={{ width: '55%' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '80px' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '45%' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '40%' }} /></td>
        <td className="col-right"><div className="skeleton-cell" style={{ width: '40px', marginLeft: 'auto' }} /></td>
        <td style={{ width: '44px' }} />
      </tr>
    ))

  const renderTableBody = () => {
    if (loading) return renderSkeletonRows()
    if (places.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            <div className="lieu-empty">
              <MapPin size={48} className="lieu-empty-icon" />
              <p>Aucun lieu enregistré.</p>
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={15} /> Créer un lieu
              </button>
            </div>
          </td>
        </tr>
      )
    }
    if (filteredData.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            <div className="lieu-empty">
              <MapPin size={48} className="lieu-empty-icon" />
              <p>Aucun résultat pour ces filtres.</p>
              <button className="btn-secondary" onClick={resetFilters}>
                Réinitialiser les filtres
              </button>
            </div>
          </td>
        </tr>
      )
    }
    return filteredData.map(p => (
      <tr
        key={p.id}
        className={selected?.id === p.id && panelMode !== null ? 'row-active' : ''}
        onClick={() => openDetail(p)}
      >
        <td className="col-name">{p.name}</td>
        <td><span className="place-type-badge">{PLACE_TYPE_LABELS[p.place_type]}</span></td>
        <td className="col-muted">{p.organization_name ?? (p.id_organization ? `#${p.id_organization}` : '—')}</td>
        <td className="col-muted">{p.address?.city ?? '—'}</td>
        <td className="col-right">{fmt(p.volume_capacity)}</td>
        <td>
          <div className="lieu-row-actions" onClick={e => e.stopPropagation()}>
            <button
              className="btn-row-action"
              aria-label="Modifier"
              onClick={() => { openDetail(p).then(() => setPanelMode('edit')) }}
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
    const p = selected
    return (
      <>
        <div className="detail-section">
          <div className="detail-section-title">Localisation</div>
          <div className="detail-grid">
            <div className="detail-field detail-field-full">
              <div className="detail-label">Nom</div>
              <div className="detail-value">{p.name}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Type</div>
              <div className="detail-value">
                <span className="place-type-badge">{PLACE_TYPE_LABELS[p.place_type]}</span>
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Capacité (L)</div>
              <div className={`detail-value${!p.volume_capacity ? ' empty' : ''}`}>
                {fmt(p.volume_capacity)}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Adresse</div>
          <div className="detail-grid">
            <div className="detail-field detail-field-full">
              <div className="detail-label">Adresse</div>
              <div className={`detail-value${!p.address?.address ? ' empty' : ''}`}>
                {p.address?.address ?? '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Ville</div>
              <div className={`detail-value${!p.address?.city ? ' empty' : ''}`}>
                {p.address?.city ?? '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Code postal</div>
              <div className={`detail-value${!p.address?.zipcode ? ' empty' : ''}`}>
                {p.address?.zipcode ?? '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Pays</div>
              <div className={`detail-value${!p.address?.country ? ' empty' : ''}`}>
                {p.address?.country ?? '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Liens</div>
          <div className="detail-grid">
            <div className="detail-field">
              <div className="detail-label">Organisation</div>
              <div className={`detail-value${p.id_organization == null ? ' empty' : ''}`}>
                {p.organization_name ?? (p.id_organization != null ? `#${p.id_organization}` : '—')}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Lieu parent</div>
              <div className={`detail-value${p.id_parent == null ? ' empty' : ''}`}>
                {p.id_parent != null ? `#${p.id_parent}` : '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Latitude</div>
              <div className={`detail-value${!p.latitude ? ' empty' : ''}`}>
                {fmt(p.latitude)}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Longitude</div>
              <div className={`detail-value${!p.longitude ? ' empty' : ''}`}>
                {fmt(p.longitude)}
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  const renderForm = (mode: 'create' | 'edit') => (
    <form id="lieu-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Informations */}
      <div className="form-section">
        <div className="form-section-title">Informations</div>
        <div className="form-grid">
          <div className="form-field full">
            <label htmlFor="f-name">Nom <span style={{ color: 'var(--nut-accent-red)' }}>*</span></label>
            <input
              id="f-name"
              type="text"
              {...register('name')}
              className={errors.name ? 'field-error' : ''}
            />
            {errors.name && <span className="form-error-msg">{errors.name.message}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="f-type">Type <span style={{ color: 'var(--nut-accent-red)' }}>*</span></label>
            <select id="f-type" {...register('place_type')} className={errors.place_type ? 'field-error' : ''}>
              {PLACE_TYPES.map(t => (
                <option key={t} value={t}>{PLACE_TYPE_LABELS[t]}</option>
              ))}
            </select>
            {errors.place_type && <span className="form-error-msg">{errors.place_type.message}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="f-capacity">Capacité (L)</label>
            <input
              id="f-capacity"
              type="number"
              step="0.01"
              min="0"
              {...register('volume_capacity', { valueAsNumber: true })}
            />
          </div>
        </div>
      </div>

      {/* Adresse */}
      <div className="form-section">
          <div className="form-section-title">Adresse</div>
          <div className="form-grid">
            <div className="form-field full">
              <label htmlFor="f-address">Adresse</label>
              <input id="f-address" type="text" {...register('address_line')} />
            </div>
            <div className="form-field">
              <label htmlFor="f-city">Ville</label>
              <input id="f-city" type="text" {...register('city')} />
            </div>
            <div className="form-field">
              <label htmlFor="f-zipcode">Code postal</label>
              <input id="f-zipcode" type="text" {...register('zipcode')} />
            </div>
            <div className="form-field full">
              <label htmlFor="f-country">Pays</label>
              <input id="f-country" type="text" {...register('country')} />
            </div>
          </div>
        </div>

      {/* Liens */}
      <div className="form-section">
        <div className="form-section-title">Liens</div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="f-org">ID Organisation</label>
            <input
              id="f-org"
              type="number"
              min="1"
              placeholder="Optionnel"
              {...register('id_organization', { valueAsNumber: true })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="f-parent">ID Lieu parent</label>
            <input
              id="f-parent"
              type="number"
              min="1"
              placeholder="Optionnel"
              {...register('id_parent', { valueAsNumber: true })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="f-lat">Latitude</label>
            <input
              id="f-lat"
              type="number"
              step="any"
              placeholder="ex : 48.8566"
              {...register('latitude', { valueAsNumber: true })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="f-lng">Longitude</label>
            <input
              id="f-lng"
              type="number"
              step="any"
              placeholder="ex : 2.3522"
              {...register('longitude', { valueAsNumber: true })}
            />
          </div>
        </div>
      </div>
    </form>
  )

  const renderPanel = () => {
    if (!panelMode) return null

    const isForm = panelMode === 'edit' || panelMode === 'create'
    const title  = panelMode === 'create' ? 'Nouveau lieu' : selected?.name ?? '—'

    return (
      <aside className="lieu-panel">
        {/* Header */}
        <div className="lieu-panel-header">
          <div className="lieu-panel-header-left">
            <h2 className="lieu-panel-title">{title}</h2>
            {panelMode === 'detail' && selected && (
              <span className="lieu-panel-subtitle">
                <span className="place-type-badge" style={{ fontSize: '11px' }}>
                  {PLACE_TYPE_LABELS[selected.place_type]}
                </span>
              </span>
            )}
            {panelMode === 'edit'   && <span className="mode-badge edit">Modification</span>}
            {panelMode === 'create' && <span className="mode-badge create">Nouveau</span>}
          </div>
          <button className="lieu-panel-close" aria-label="Fermer" onClick={closePanel}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="lieu-panel-body">
          {panelMode === 'detail' && renderDetailView()}
          {panelMode === 'edit'   && renderForm('edit')}
          {panelMode === 'create' && renderForm('create')}
        </div>

        {/* Footer */}
        <div className="lieu-panel-footer">
          {panelMode === 'edit' && (
            confirmDel ? (
              <button className="btn-confirm-delete" disabled={deleting} onClick={handleDelete}>
                {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                Confirmer la suppression
              </button>
            ) : (
              <button className="btn-danger" onClick={() => setConfirmDel(true)}>
                <Trash2 size={14} /> Supprimer
              </button>
            )
          )}

          {panelMode === 'detail' && confirmDel && (
            <button className="btn-confirm-delete" disabled={deleting} onClick={handleDelete}>
              {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              Confirmer la suppression
            </button>
          )}

          <div className="lieu-panel-footer-right">
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
                  onClick={panelMode === 'edit' ? () => setPanelMode('detail') : closePanel}
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  form="lieu-form"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? <Loader2 size={14} className="spin" /> : null}
                  Enregistrer
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
    <div className="lieu-page">
      {/* Toast */}
      {toast && (
        <div className={`lieu-toast ${toast.kind}`} role="alert">
          {toast.kind === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="lieu-header">
        <div className="lieu-header-left">
          <h1>Lieux</h1>
          {!loading && (
            <span className="lieu-count">
              {filtersActive
                ? `${filteredData.length} / ${places.length} lieu${places.length !== 1 ? 'x' : ''}`
                : `${places.length} lieu${places.length !== 1 ? 'x' : ''} enregistré${places.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <button className="btn-primary lieu-btn-new" onClick={openCreate}>
          <Plus size={15} /> Nouveau lieu
        </button>
      </div>

      {/* Split view */}
      <div className="lieu-body">
        {/* Table card */}
        <div className="lieu-table-card">
          {/* Filters */}
          <div className="lieu-filters">
            <input
              type="search"
              placeholder="Rechercher par nom ou ville..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
            <select
              value={filters.place_type}
              onChange={e => setFilters(f => ({ ...f, place_type: e.target.value }))}
              aria-label="Filtrer par type"
            >
              <option value="">Tous les types</option>
              {PLACE_TYPES.map(t => (
                <option key={t} value={t}>{PLACE_TYPE_LABELS[t]}</option>
              ))}
            </select>
            {filtersActive && (
              <button className="btn-secondary" onClick={resetFilters}>
                Réinitialiser
              </button>
            )}
          </div>

          {/* Table */}
          <div className="lieu-table-scroll">
            <table className="lieu-table" aria-label="Lieux">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Organisation</th>
                  <th>Ville</th>
                  <th className="col-right">Capacité (L)</th>
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
