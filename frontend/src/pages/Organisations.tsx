import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Building2, Edit2, Trash2, X, Plus, CheckCircle2, AlertCircle, Loader2, Minus,
} from 'lucide-react'
import {
  getOrganizations, getOrganization,
  createOrganization, updateOrganization, deleteOrganization,
  type Organization,
} from '../lib/api/organisations'
import './Organisations.css'

/* ── Role flags ─────────────────────────────────────────── */
type RoleKey = Extract<keyof Organization, `is_${string}`>

const ROLE_FLAGS: { key: RoleKey; label: string }[] = [
  { key: 'is_food_provider',    label: 'Restaurateur' },
  { key: 'is_cont_washer',      label: 'Laveur' },
  { key: 'is_cont_transporter', label: 'Transporteur' },
  { key: 'is_cont_stockeur',    label: 'Stockeur' },
  { key: 'is_cont_recycleur',   label: 'Recycleur' },
  { key: 'is_cont_destructeur', label: 'Destructeur' },
  { key: 'is_cont_provider',    label: 'Fournisseur' },
]

const STATUS_LABELS: Record<number, string> = {
  0: 'Inactif',
  1: 'Actif',
  2: 'Suspendu',
}

/* ── Zod schema ─────────────────────────────────────────── */
const formSchema = z.object({
  name:                z.string().min(1, 'Le nom est obligatoire'),
  siren:               z.string().optional().refine(v => !v || v.length === 9,  'Le SIREN doit contenir 9 chiffres'),
  siret:               z.string().optional().refine(v => !v || v.length === 14, 'Le SIRET doit contenir 14 chiffres'),
  description:         z.string().optional(),
  is_food_provider:    z.boolean().default(false),
  is_cont_washer:      z.boolean().default(false),
  is_cont_transporter: z.boolean().default(false),
  is_cont_stockeur:    z.boolean().default(false),
  is_cont_recycleur:   z.boolean().default(false),
  is_cont_destructeur: z.boolean().default(false),
  is_cont_provider:    z.boolean().default(false),
  address_line:        z.string().optional(),
  city:                z.string().optional(),
  zipcode:             z.string().optional(),
  country:             z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>
type PanelMode = 'detail' | 'edit' | 'create' | null

/* ── Helpers ─────────────────────────────────────────────── */
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const toFormValues = (o: Organization | null): FormValues => ({
  name:                o?.name ?? '',
  siren:               o?.siren ?? '',
  siret:               o?.siret ?? '',
  description:         o?.description ?? '',
  is_food_provider:    o?.is_food_provider ?? false,
  is_cont_washer:      o?.is_cont_washer ?? false,
  is_cont_transporter: o?.is_cont_transporter ?? false,
  is_cont_stockeur:    o?.is_cont_stockeur ?? false,
  is_cont_recycleur:   o?.is_cont_recycleur ?? false,
  is_cont_destructeur: o?.is_cont_destructeur ?? false,
  is_cont_provider:    o?.is_cont_provider ?? false,
  address_line:        o?.address?.address ?? '',
  city:                o?.address?.city ?? '',
  zipcode:             o?.address?.zipcode ?? '',
  country:             o?.address?.country ?? '',
})

const toCreatePayload = (data: FormValues) => ({
  name:                data.name,
  siren:               data.siren || null,
  siret:               data.siret || null,
  description:         data.description || null,
  is_food_provider:    data.is_food_provider,
  is_cont_washer:      data.is_cont_washer,
  is_cont_transporter: data.is_cont_transporter,
  is_cont_stockeur:    data.is_cont_stockeur,
  is_cont_recycleur:   data.is_cont_recycleur,
  is_cont_destructeur: data.is_cont_destructeur,
  is_cont_provider:    data.is_cont_provider,
  address: {
    address: data.address_line || null,
    city:    data.city    || null,
    zipcode: data.zipcode || null,
    country: data.country || null,
  },
})

const toUpdatePayload = (data: FormValues) => ({
  name:                data.name,
  siren:               data.siren || null,
  siret:               data.siret || null,
  description:         data.description || null,
  is_food_provider:    data.is_food_provider,
  is_cont_washer:      data.is_cont_washer,
  is_cont_transporter: data.is_cont_transporter,
  is_cont_stockeur:    data.is_cont_stockeur,
  is_cont_recycleur:   data.is_cont_recycleur,
  is_cont_destructeur: data.is_cont_destructeur,
  is_cont_provider:    data.is_cont_provider,
})

/* ── RoleBadges ──────────────────────────────────────────── */
function RoleBadges({ org }: { org: Organization }) {
  const active = ROLE_FLAGS.filter(f => org[f.key])
  if (active.length === 0) {
    return <span style={{ color: 'var(--fg-disabled)', fontSize: '13px' }}>—</span>
  }
  const visible  = active.slice(0, 3)
  const overflow = active.length - 3
  return (
    <div className="roles-cell">
      {visible.map(f => <span key={f.key} className="role-badge">{f.label}</span>)}
      {overflow > 0 && <span className="role-badge">+{overflow}</span>}
    </div>
  )
}

/* ── Main component ──────────────────────────────────────── */
export default function Organisations() {
  const [orgs, setOrgs]             = useState<Organization[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Organization | null>(null)
  const [panelMode, setPanelMode]   = useState<PanelMode>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [toast, setToast]           = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)
  const [filters, setFilters]       = useState({ search: '', status: '', role: '' })
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
      setOrgs(await getOrganizations())
    } catch {
      showToast('Erreur lors du chargement de la liste.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchList() }, [fetchList])

  /* ── Panel triggers ── */
  const openDetail = async (o: Organization) => {
    setConfirmDel(false)
    const detail = await getOrganization(o.id)
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
        await createOrganization(toCreatePayload(data))
        showToast('Organisation créée.', 'success')
        closePanel()
      } else if (panelMode === 'edit' && selected) {
        const updated = await updateOrganization(selected.id, toUpdatePayload(data))
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
      await deleteOrganization(selected.id)
      showToast('Organisation supprimée.', 'success')
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
  const filtersActive = filters.search !== '' || filters.status !== '' || filters.role !== ''

  const filteredData = orgs.filter(o => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const matchName = o.name.toLowerCase().includes(q)
      const matchCity = o.address?.city?.toLowerCase().includes(q) ?? false
      if (!matchName && !matchCity) return false
    }
    if (filters.status !== '' && o.status !== parseInt(filters.status)) return false
    if (filters.role !== '' && !o[filters.role as RoleKey]) return false
    return true
  })

  const resetFilters = () => setFilters({ search: '', status: '', role: '' })

  /* ── Render helpers ── */
  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="skeleton-row">
        <td><div className="skeleton-cell" style={{ width: '55%' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '40%' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '70%' }} /></td>
        <td className="col-center"><div className="skeleton-cell" style={{ width: '50px', margin: '0 auto' }} /></td>
        <td style={{ width: '44px' }} />
      </tr>
    ))

  const renderTableBody = () => {
    if (loading) return renderSkeletonRows()
    if (orgs.length === 0) {
      return (
        <tr>
          <td colSpan={5}>
            <div className="org-empty">
              <Building2 size={48} className="org-empty-icon" />
              <p>Aucune organisation enregistrée.</p>
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={15} /> Créer une organisation
              </button>
            </div>
          </td>
        </tr>
      )
    }
    if (filteredData.length === 0) {
      return (
        <tr>
          <td colSpan={5}>
            <div className="org-empty">
              <Building2 size={48} className="org-empty-icon" />
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
        <td className="col-name">{o.name}</td>
        <td className="col-muted">{o.address?.city ?? '—'}</td>
        <td><RoleBadges org={o} /></td>
        <td className="col-center">
          {o.status === 1
            ? <span className="badge-yes">{STATUS_LABELS[o.status] ?? o.status}</span>
            : <span className="badge-no">{STATUS_LABELS[o.status] ?? String(o.status)}</span>}
        </td>
        <td>
          <div className="org-row-actions" onClick={e => e.stopPropagation()}>
            <button
              className="btn-row-action"
              aria-label="Modifier"
              onClick={() => { openDetail(o).then(() => setPanelMode('edit')) }}
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
    const o = selected
    return (
      <>
        <div className="detail-section">
          <div className="detail-section-title">Informations générales</div>
          <div className="detail-grid">
            <div className="detail-field detail-field-full">
              <div className="detail-label">Nom</div>
              <div className="detail-value">{o.name}</div>
            </div>
            {o.description && (
              <div className="detail-field detail-field-full">
                <div className="detail-label">Description</div>
                <div className="detail-value">{o.description}</div>
              </div>
            )}
            <div className="detail-field">
              <div className="detail-label">SIREN</div>
              <div className={`detail-value${!o.siren ? ' empty' : ''}`}>{o.siren ?? '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">SIRET</div>
              <div className={`detail-value${!o.siret ? ' empty' : ''}`}>{o.siret ?? '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Statut</div>
              <div className="detail-value">
                {o.status === 1
                  ? <span className="badge-yes">{STATUS_LABELS[o.status] ?? o.status}</span>
                  : <span className="badge-no">{STATUS_LABELS[o.status] ?? String(o.status)}</span>}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Date de création</div>
              <div className={`detail-value${!o.creation_date ? ' empty' : ''}`}>
                {formatDate(o.creation_date)}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Adresse</div>
          <div className="detail-grid">
            <div className="detail-field detail-field-full">
              <div className="detail-label">Adresse</div>
              <div className={`detail-value${!o.address?.address ? ' empty' : ''}`}>
                {o.address?.address ?? '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Ville</div>
              <div className={`detail-value${!o.address?.city ? ' empty' : ''}`}>
                {o.address?.city ?? '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Code postal</div>
              <div className={`detail-value${!o.address?.zipcode ? ' empty' : ''}`}>
                {o.address?.zipcode ?? '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Pays</div>
              <div className={`detail-value${!o.address?.country ? ' empty' : ''}`}>
                {o.address?.country ?? '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Rôles</div>
          <div className="roles-detail-grid">
            {ROLE_FLAGS.map(f => (
              <div key={f.key} className={`role-detail-item ${o[f.key] ? 'active' : 'inactive'}`}>
                {o[f.key]
                  ? <CheckCircle2 size={15} strokeWidth={2} />
                  : <Minus size={15} strokeWidth={1.5} />}
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  const renderForm = (mode: 'create' | 'edit') => (
    <form id="org-form" onSubmit={handleSubmit(onSubmit)} noValidate>
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
          <div className="form-field full">
            <label htmlFor="f-desc">Description</label>
            <textarea id="f-desc" {...register('description')} />
          </div>
          <div className="form-field">
            <label htmlFor="f-siren">SIREN</label>
            <input
              id="f-siren"
              type="text"
              maxLength={9}
              placeholder="9 chiffres"
              {...register('siren')}
              className={errors.siren ? 'field-error' : ''}
            />
            {errors.siren && <span className="form-error-msg">{errors.siren.message}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="f-siret">SIRET</label>
            <input
              id="f-siret"
              type="text"
              maxLength={14}
              placeholder="14 chiffres"
              {...register('siret')}
              className={errors.siret ? 'field-error' : ''}
            />
            {errors.siret && <span className="form-error-msg">{errors.siret.message}</span>}
          </div>
        </div>
      </div>

      {/* Adresse — create only (PATCH endpoint does not update address) */}
      {mode === 'create' && (
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
      )}

      {/* Rôles */}
      <div className="form-section">
        <div className="form-section-title">Rôles</div>
        <div className="roles-toggles-grid">
          {ROLE_FLAGS.map(f => (
            <label key={f.key} className="form-toggle">
              <span className="form-toggle-track">
                <input type="checkbox" {...register(f.key)} />
                <span className="form-toggle-slider" />
              </span>
              <span className="form-toggle-label">{f.label}</span>
            </label>
          ))}
        </div>
      </div>
    </form>
  )

  const renderPanel = () => {
    if (!panelMode) return null

    const isForm = panelMode === 'edit' || panelMode === 'create'
    const title  = panelMode === 'create' ? 'Nouvelle organisation' : selected?.name ?? '—'

    return (
      <aside className="org-panel">
        {/* Header */}
        <div className="org-panel-header">
          <div className="org-panel-header-left">
            <h2 className="org-panel-title">{title}</h2>
            {panelMode === 'edit'   && <span className="mode-badge edit">Modification</span>}
            {panelMode === 'create' && <span className="mode-badge create">Nouveau</span>}
          </div>
          <button className="org-panel-close" aria-label="Fermer" onClick={closePanel}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="org-panel-body">
          {panelMode === 'detail' && renderDetailView()}
          {panelMode === 'edit'   && renderForm('edit')}
          {panelMode === 'create' && renderForm('create')}
        </div>

        {/* Footer */}
        <div className="org-panel-footer">
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

          <div className="org-panel-footer-right">
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
                  form="org-form"
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
    <div className="org-page">
      {/* Toast */}
      {toast && (
        <div className={`org-toast ${toast.kind}`} role="alert">
          {toast.kind === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="org-header">
        <div className="org-header-left">
          <h1>Organisations</h1>
          {!loading && (
            <span className="org-count">
              {filtersActive
                ? `${filteredData.length} / ${orgs.length} organisation${orgs.length !== 1 ? 's' : ''}`
                : `${orgs.length} organisation${orgs.length !== 1 ? 's' : ''} enregistrée${orgs.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <button className="btn-primary org-btn-new" onClick={openCreate}>
          <Plus size={15} /> Nouvelle organisation
        </button>
      </div>

      {/* Split view */}
      <div className="org-body">
        {/* Table card */}
        <div className="org-table-card">
          {/* Filters */}
          <div className="org-filters">
            <input
              type="search"
              placeholder="Rechercher par nom ou ville..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
            <select
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              aria-label="Filtrer par statut"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            <select
              value={filters.role}
              onChange={e => setFilters(f => ({ ...f, role: e.target.value }))}
              aria-label="Filtrer par rôle"
            >
              <option value="">Tous les rôles</option>
              {ROLE_FLAGS.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            {filtersActive && (
              <button className="btn-secondary" onClick={resetFilters}>
                Réinitialiser
              </button>
            )}
          </div>

          {/* Table */}
          <div className="org-table-scroll">
            <table className="org-table" aria-label="Organisations">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Ville</th>
                  <th>Rôles</th>
                  <th className="col-center">Statut</th>
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
