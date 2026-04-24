import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Box, Edit2, Trash2, X, Plus, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'
import {
  getContainerTypes, getContainerType,
  createContainerType, updateContainerType, deleteContainerType,
  createPackaging, deletePackaging,
  type ContainerType, type Packaging,
} from '../lib/api/containerTypes'
import './ContainerTypes.css'

/* ── Zod schema ─────────────────────────────────────────── */
const optNum = z.preprocess(
  (v) => (typeof v === 'number' && !isNaN(v) ? v : undefined),
  z.number().positive().optional(),
)
const optInt = z.preprocess(
  (v) => (typeof v === 'number' && !isNaN(v) ? v : undefined),
  z.number().int().positive().optional(),
)
const optIntAny = z.preprocess(
  (v) => (typeof v === 'number' && !isNaN(v) ? v : undefined),
  z.number().int().optional(),
)

const formSchema = z.object({
  name:                   z.string().min(1, 'Le nom est obligatoire'),
  description:            z.string().optional(),
  material:               z.string().optional(),
  color:                  z.string().optional(),
  sealable:               z.boolean().default(false),
  literage:               optNum,
  weight:                 optNum,
  width:                  optNum,
  length:                 optNum,
  height:                 optNum,
  stacking_height:        optNum,
  max_wash_cycles:        optInt,
  quality_check_interval: optInt,
  temp_min:               optIntAny,
  temp_max:               optIntAny,
  wash_recommendations:   z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>
type PanelMode = 'detail' | 'edit' | 'create' | null

/* ── Helpers ─────────────────────────────────────────────── */
const parseDecimal = (v: string | null | undefined): number | undefined =>
  v != null ? (isNaN(parseFloat(v)) ? undefined : parseFloat(v)) : undefined

const fmt = (v: string | number | null | undefined, suffix = '') => {
  if (v == null) return '—'
  const n = parseFloat(String(v))
  return isNaN(n) ? '—' : `${n}${suffix}`
}

const toFormValues = (t: ContainerType | null): FormValues => ({
  name:                   t?.name ?? '',
  description:            t?.description ?? '',
  material:               t?.material ?? '',
  color:                  t?.color ?? '',
  sealable:               t?.sealable ?? false,
  literage:               parseDecimal(t?.literage),
  weight:                 parseDecimal(t?.weight),
  width:                  parseDecimal(t?.width),
  length:                 parseDecimal(t?.length),
  height:                 parseDecimal(t?.height),
  stacking_height:        parseDecimal(t?.stacking_height),
  max_wash_cycles:        t?.max_wash_cycles ?? undefined,
  quality_check_interval: t?.quality_check_interval ?? undefined,
  temp_min:               t?.temp_min ?? undefined,
  temp_max:               t?.temp_max ?? undefined,
  wash_recommendations:   t?.wash_recommendations ?? '',
})

const toPayload = (data: FormValues) => ({
  name:                   data.name,
  description:            data.description || null,
  material:               data.material || null,
  color:                  data.color || null,
  sealable:               data.sealable,
  literage:               data.literage ?? null,
  weight:                 data.weight ?? null,
  width:                  data.width ?? null,
  length:                 data.length ?? null,
  height:                 data.height ?? null,
  stacking_height:        data.stacking_height ?? null,
  max_wash_cycles:        data.max_wash_cycles ?? null,
  quality_check_interval: data.quality_check_interval ?? null,
  temp_min:               data.temp_min ?? null,
  temp_max:               data.temp_max ?? null,
  wash_recommendations:   data.wash_recommendations || null,
})

/* ── PackagingAddForm ────────────────────────────────────── */
function PackagingAddForm({
  typeId,
  onSaved,
  onCancel,
}: {
  typeId: number
  onSaved: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [piecesPerBag, setPiecesPerBag] = useState('')
  const [bagPerBox, setBagPerBox] = useState('')
  const [boxPerPallet, setBoxPerPallet] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await createPackaging(typeId, {
        name:            name.trim() || null,
        pieces_per_bag:  piecesPerBag ? parseInt(piecesPerBag) : null,
        bag_per_box:     bagPerBox    ? parseInt(bagPerBox)    : null,
        box_per_pallet:  boxPerPallet ? parseInt(boxPerPallet) : null,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pkg-add-form">
      <div className="pkg-add-grid">
        <div className="pkg-add-field" style={{ gridColumn: '1 / -1' }}>
          <label>Nom</label>
          <input
            type="text"
            placeholder="Ex : Sac de 10"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="pkg-add-field">
          <label>Pièces / sac</label>
          <input type="number" min="1" value={piecesPerBag} onChange={e => setPiecesPerBag(e.target.value)} />
        </div>
        <div className="pkg-add-field">
          <label>Sacs / carton</label>
          <input type="number" min="1" value={bagPerBox} onChange={e => setBagPerBox(e.target.value)} />
        </div>
        <div className="pkg-add-field">
          <label>Cartons / palette</label>
          <input type="number" min="1" value={boxPerPallet} onChange={e => setBoxPerPallet(e.target.value)} />
        </div>
      </div>
      <div className="pkg-add-actions">
        <button className="btn-secondary btn-sm" onClick={onCancel} disabled={saving}>
          Annuler
        </button>
        <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={13} className="spin" /> : null}
          Ajouter
        </button>
      </div>
    </div>
  )
}

/* ── PackagingItem ───────────────────────────────────────── */
function PackagingItem({
  pkg,
  onDelete,
}: {
  pkg: Packaging
  onDelete: () => void
}) {
  const parts: string[] = []
  if (pkg.pieces_per_bag) parts.push(`${pkg.pieces_per_bag} pcs/sac`)
  if (pkg.bag_per_box)    parts.push(`${pkg.bag_per_box} sacs/carton`)
  if (pkg.box_per_pallet) parts.push(`${pkg.box_per_pallet} cartons/palette`)

  return (
    <div className="pkg-item">
      <div className="pkg-info">
        <div className="pkg-name">{pkg.name || <em style={{ color: 'var(--fg-muted)' }}>Sans nom</em>}</div>
        {parts.length > 0 && (
          <div className="pkg-detail">{parts.join(' · ')}</div>
        )}
      </div>
      <button className="pkg-delete" aria-label="Supprimer" onClick={onDelete}>
        <Trash2 size={14} />
      </button>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────── */
export default function ContainerTypes() {
  const [types, setTypes]             = useState<ContainerType[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<ContainerType | null>(null)
  const [panelMode, setPanelMode]     = useState<PanelMode>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [confirmDel, setConfirmDel]   = useState(false)
  const [showAddPkg, setShowAddPkg]   = useState(false)
  const [toast, setToast]             = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)
  const [filters, setFilters]         = useState({ search: '', material: '', sealable: '' })
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
      setTypes(await getContainerTypes())
    } catch {
      showToast('Erreur lors du chargement de la liste.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const refreshDetail = useCallback(async (id: number) => {
    try {
      setSelected(await getContainerType(id))
    } catch {
      showToast('Erreur lors du chargement du détail.', 'error')
    }
  }, [showToast])

  useEffect(() => { fetchList() }, [fetchList])

  /* ── Panel triggers ── */
  const openDetail = async (t: ContainerType) => {
    setConfirmDel(false)
    setShowAddPkg(false)
    const detail = await getContainerType(t.id)
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
    setShowAddPkg(false)
  }

  /* ── Form submit ── */
  const onSubmit = async (data: FormValues) => {
    setSubmitting(true)
    try {
      if (panelMode === 'create') {
        await createContainerType(toPayload(data))
        showToast('Type de contenant créé.', 'success')
        closePanel()
      } else if (panelMode === 'edit' && selected) {
        const updated = await updateContainerType(selected.id, toPayload(data))
        setSelected(updated)
        setPanelMode('detail')
        showToast('Modifications enregistrées.', 'success')
      }
      await fetchList()
    } catch {
      showToast('Erreur lors de l\'enregistrement.', 'error')
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
      await deleteContainerType(selected.id)
      showToast('Type supprimé.', 'success')
      closePanel()
      await fetchList()
    } catch {
      showToast('Erreur lors de la suppression.', 'error')
      setConfirmDel(false)
    } finally {
      setDeleting(false)
    }
  }

  /* ── Packaging ── */
  const handlePkgAdded = async () => {
    setShowAddPkg(false)
    if (selected) await refreshDetail(selected.id)
    showToast('Conditionnement ajouté.', 'success')
  }

  const handlePkgDelete = async (pkg: Packaging) => {
    if (!selected) return
    try {
      await deletePackaging(selected.id, pkg.id)
      await refreshDetail(selected.id)
      showToast('Conditionnement supprimé.', 'success')
    } catch {
      showToast('Erreur lors de la suppression du conditionnement.', 'error')
    }
  }

  /* ── Filters ── */
  const materials = Array.from(
    new Set(types.map(t => t.material).filter(Boolean) as string[])
  ).sort()

  const filtersActive = filters.search !== '' || filters.material !== '' || filters.sealable !== ''

  const filteredData = types.filter(t => {
    if (filters.search && !t.name.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.material && t.material !== filters.material) return false
    if (filters.sealable === 'true'  && !t.sealable) return false
    if (filters.sealable === 'false' &&  t.sealable) return false
    return true
  })

  const resetFilters = () => setFilters({ search: '', material: '', sealable: '' })

  /* ── Render helpers ── */
  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="skeleton-row">
        <td><div className="skeleton-cell" style={{ width: '60%' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '50%' }} /></td>
        <td className="col-right"><div className="skeleton-cell" style={{ width: '40%', marginLeft: 'auto' }} /></td>
        <td className="col-center"><div className="skeleton-cell" style={{ width: '40px', margin: '0 auto' }} /></td>
        <td className="col-right"><div className="skeleton-cell" style={{ width: '50%', marginLeft: 'auto' }} /></td>
        <td />
      </tr>
    ))

  const renderTableBody = () => {
    if (loading) return renderSkeletonRows()
    if (types.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            <div className="ct-empty">
              <Box size={48} className="ct-empty-icon" />
              <p>Aucun type de contenant enregistré.</p>
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={15} /> Créer un type
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
            <div className="ct-empty">
              <Box size={48} className="ct-empty-icon" />
              <p>Aucun résultat pour ces filtres.</p>
              <button className="btn-secondary" onClick={resetFilters}>
                Réinitialiser les filtres
              </button>
            </div>
          </td>
        </tr>
      )
    }
    return filteredData.map(t => (
      <tr
        key={t.id}
        className={selected?.id === t.id && panelMode !== null ? 'row-active' : ''}
        onClick={() => openDetail(t)}
      >
        <td className="col-name">{t.name}</td>
        <td className="col-muted">{t.material ?? '—'}</td>
        <td className="col-right">{fmt(t.literage)}</td>
        <td className="col-center">
          {t.sealable
            ? <span className="badge-yes">Oui</span>
            : <span className="badge-no">Non</span>}
        </td>
        <td className="col-right">{t.max_wash_cycles ?? '—'}</td>
        <td>
          <div className="row-actions" onClick={e => e.stopPropagation()}>
            <button
              className="btn-row-action"
              aria-label="Modifier"
              onClick={() => { openDetail(t).then(() => setPanelMode('edit')) }}
            >
              <Edit2 size={16} strokeWidth={1.5} />
            </button>
            <button
              className="btn-row-action danger"
              aria-label="Supprimer"
              onClick={async () => {
                const detail = await getContainerType(t.id)
                setSelected(detail)
                setPanelMode('detail')
                setConfirmDel(true)
              }}
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        </td>
      </tr>
    ))
  }

  const renderDetailView = () => {
    if (!selected) return null
    const t = selected
    return (
      <>
        <div className="detail-section">
          <div className="detail-section-title">Informations générales</div>
          <div className="detail-grid">
            <div className="detail-field detail-field-full">
              <div className="detail-label">Nom</div>
              <div className="detail-value">{t.name}</div>
            </div>
            {t.description && (
              <div className="detail-field detail-field-full">
                <div className="detail-label">Description</div>
                <div className="detail-value">{t.description}</div>
              </div>
            )}
            <div className="detail-field">
              <div className="detail-label">Matériau</div>
              <div className={`detail-value${!t.material ? ' empty' : ''}`}>{t.material ?? '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Couleur</div>
              <div className={`detail-value${!t.color ? ' empty' : ''}`}>{t.color ?? '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Operculable</div>
              <div className="detail-value">
                {t.sealable
                  ? <span className="badge-yes">Oui</span>
                  : <span className="badge-no">Non</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Dimensions &amp; capacité</div>
          <div className="detail-grid">
            <div className="detail-field">
              <div className="detail-label">Volume (L)</div>
              <div className={`detail-value${!t.literage ? ' empty' : ''}`}>{fmt(t.literage)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Poids à vide (kg)</div>
              <div className={`detail-value${!t.weight ? ' empty' : ''}`}>{fmt(t.weight)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Largeur (mm)</div>
              <div className={`detail-value${!t.width ? ' empty' : ''}`}>{fmt(t.width)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Longueur (mm)</div>
              <div className={`detail-value${!t.length ? ' empty' : ''}`}>{fmt(t.length)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Hauteur (mm)</div>
              <div className={`detail-value${!t.height ? ' empty' : ''}`}>{fmt(t.height)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Hauteur empilé (mm)</div>
              <div className={`detail-value${!t.stacking_height ? ' empty' : ''}`}>{fmt(t.stacking_height)}</div>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Maintenance &amp; qualité</div>
          <div className="detail-grid">
            <div className="detail-field">
              <div className="detail-label">Durée de vie (lavages)</div>
              <div className={`detail-value${t.max_wash_cycles == null ? ' empty' : ''}`}>
                {t.max_wash_cycles ?? '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Contrôle qualité (tous les X lavages)</div>
              <div className={`detail-value${t.quality_check_interval == null ? ' empty' : ''}`}>
                {t.quality_check_interval ?? '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Température min (°C)</div>
              <div className={`detail-value${t.temp_min == null ? ' empty' : ''}`}>
                {t.temp_min ?? '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Température max (°C)</div>
              <div className={`detail-value${t.temp_max == null ? ' empty' : ''}`}>
                {t.temp_max ?? '—'}
              </div>
            </div>
            {t.wash_recommendations && (
              <div className="detail-field detail-field-full">
                <div className="detail-label">Recommandations de lavage</div>
                <div className="detail-value">{t.wash_recommendations}</div>
              </div>
            )}
          </div>
        </div>

        {/* Packagings */}
        <div className="detail-section">
          <div className="pkg-section-header">
            <h3>Conditionnements</h3>
            {!showAddPkg && (
              <button className="btn-secondary btn-sm" onClick={() => setShowAddPkg(true)}>
                <Plus size={13} /> Ajouter
              </button>
            )}
          </div>

          {t.packagings.length > 0 ? (
            <div className="pkg-list">
              {t.packagings.map(pkg => (
                <PackagingItem
                  key={pkg.id}
                  pkg={pkg}
                  onDelete={() => handlePkgDelete(pkg)}
                />
              ))}
            </div>
          ) : (
            !showAddPkg && <p className="pkg-empty">Aucun conditionnement défini.</p>
          )}

          {showAddPkg && (
            <PackagingAddForm
              typeId={t.id}
              onSaved={handlePkgAdded}
              onCancel={() => setShowAddPkg(false)}
            />
          )}
        </div>
      </>
    )
  }

  const renderForm = () => (
    <form id="ct-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Informations générales */}
      <div className="form-section">
        <div className="form-section-title">Informations générales</div>
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
            <label htmlFor="f-material">Matériau</label>
            <input id="f-material" type="text" {...register('material')} />
          </div>
          <div className="form-field">
            <label htmlFor="f-color">Couleur</label>
            <input id="f-color" type="text" {...register('color')} />
          </div>
          <div className="form-field full">
            <label>Operculable</label>
            <label className="form-toggle">
              <span className="form-toggle-track">
                <input type="checkbox" {...register('sealable')} />
                <span className="form-toggle-slider" />
              </span>
              <span className="form-toggle-label">Le contenant peut être operculé</span>
            </label>
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div className="form-section">
        <div className="form-section-title">Dimensions &amp; capacité</div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="f-literage">Volume (L)</label>
            <input id="f-literage" type="number" step="0.01" min="0" {...register('literage', { valueAsNumber: true })} />
          </div>
          <div className="form-field">
            <label htmlFor="f-weight">Poids à vide (kg)</label>
            <input id="f-weight" type="number" step="0.01" min="0" {...register('weight', { valueAsNumber: true })} />
          </div>
          <div className="form-field">
            <label htmlFor="f-width">Largeur (mm)</label>
            <input id="f-width" type="number" step="1" min="0" {...register('width', { valueAsNumber: true })} />
          </div>
          <div className="form-field">
            <label htmlFor="f-length">Longueur (mm)</label>
            <input id="f-length" type="number" step="1" min="0" {...register('length', { valueAsNumber: true })} />
          </div>
          <div className="form-field">
            <label htmlFor="f-height">Hauteur (mm)</label>
            <input id="f-height" type="number" step="1" min="0" {...register('height', { valueAsNumber: true })} />
          </div>
          <div className="form-field">
            <label htmlFor="f-stacking">Hauteur empilé (mm)</label>
            <input id="f-stacking" type="number" step="1" min="0" {...register('stacking_height', { valueAsNumber: true })} />
          </div>
        </div>
      </div>

      {/* Maintenance */}
      <div className="form-section">
        <div className="form-section-title">Maintenance &amp; qualité</div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="f-maxwash">Durée de vie (lavages)</label>
            <input id="f-maxwash" type="number" step="1" min="1" {...register('max_wash_cycles', { valueAsNumber: true })} />
          </div>
          <div className="form-field">
            <label htmlFor="f-qci">Contrôle qualité (tous les X lavages)</label>
            <input id="f-qci" type="number" step="1" min="1" {...register('quality_check_interval', { valueAsNumber: true })} />
          </div>
          <div className="form-field">
            <label htmlFor="f-tmin">Température min (°C)</label>
            <input id="f-tmin" type="number" step="1" {...register('temp_min', { valueAsNumber: true })} />
          </div>
          <div className="form-field">
            <label htmlFor="f-tmax">Température max (°C)</label>
            <input id="f-tmax" type="number" step="1" {...register('temp_max', { valueAsNumber: true })} />
          </div>
          <div className="form-field full">
            <label htmlFor="f-wash-rec">Recommandations de lavage</label>
            <textarea id="f-wash-rec" {...register('wash_recommendations')} />
          </div>
        </div>
      </div>
    </form>
  )

  const renderPanel = () => {
    if (!panelMode) return null

    const isForm = panelMode === 'edit' || panelMode === 'create'
    const title = panelMode === 'create'
      ? 'Nouveau type'
      : selected?.name ?? '—'

    return (
      <aside className="ct-panel">
        {/* Header */}
        <div className="ct-panel-header">
          <div className="ct-panel-header-left">
            <h2 className="ct-panel-title">{title}</h2>
            {panelMode === 'edit' && <span className="mode-badge edit">Modification</span>}
            {panelMode === 'create' && <span className="mode-badge create">Nouveau</span>}
          </div>
          <button className="ct-panel-close" aria-label="Fermer" onClick={closePanel}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="ct-panel-body">
          {panelMode === 'detail' && renderDetailView()}
          {isForm && renderForm()}
        </div>

        {/* Footer */}
        <div className="ct-panel-footer">
          {/* Delete button — only in edit mode */}
          {panelMode === 'edit' && (
            confirmDel ? (
              <button
                className="btn-confirm-delete"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                Confirmer la suppression
              </button>
            ) : (
              <button className="btn-danger" onClick={() => setConfirmDel(true)}>
                <Trash2 size={14} /> Supprimer
              </button>
            )
          )}

          {/* Delete button — in detail mode when confirmDel is set */}
          {panelMode === 'detail' && confirmDel && (
            <button
              className="btn-confirm-delete"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              Confirmer la suppression
            </button>
          )}

          <div className="ct-panel-footer-right">
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
                  form="ct-form"
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
    <div className="ct-page">
      {/* Toast */}
      {toast && (
        <div className={`ct-toast ${toast.kind}`} role="alert">
          {toast.kind === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="ct-header">
        <div className="ct-header-left">
          <h1>Types de contenants</h1>
          {!loading && (
            <span className="ct-count">
              {filtersActive
                ? `${filteredData.length} / ${types.length} type${types.length !== 1 ? 's' : ''}`
                : `${types.length} type${types.length !== 1 ? 's' : ''} enregistré${types.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <button className="btn-primary ct-btn-new" onClick={openCreate}>
          <Plus size={15} /> Nouveau type
        </button>
      </div>

      {/* Split view */}
      <div className="ct-body">
        {/* Table card */}
        <div className="ct-table-card">
          {/* Filters */}
          <div className="ct-filters">
            <input
              type="search"
              placeholder="Rechercher un type..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
            <select
              value={filters.material}
              onChange={e => setFilters(f => ({ ...f, material: e.target.value }))}
              aria-label="Filtrer par matériau"
            >
              <option value="">Tous les matériaux</option>
              {materials.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={filters.sealable}
              onChange={e => setFilters(f => ({ ...f, sealable: e.target.value }))}
              aria-label="Filtrer par operculabilité"
            >
              <option value="">Operculable : Tous</option>
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
            {filtersActive && (
              <button className="btn-secondary" onClick={resetFilters}>
                Réinitialiser
              </button>
            )}
          </div>

          {/* Table */}
          <div className="ct-table-scroll">
            <table className="ct-table" aria-label="Types de contenants">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Matériau</th>
                  <th className="col-right">Volume (L)</th>
                  <th className="col-center">Operculable</th>
                  <th className="col-right">Lavages max</th>
                  <th style={{ width: '80px' }} />
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
