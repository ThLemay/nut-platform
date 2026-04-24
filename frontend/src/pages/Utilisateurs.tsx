import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Users, Edit2, Trash2, X, Plus, CheckCircle2, AlertCircle, Loader2, Mail, Phone, Shield,
} from 'lucide-react'
import {
  getUsers, getUser, createUser, updateUser, deleteUser,
  type User, type UserRole, type UserStatus,
} from '../lib/api/utilisateurs'
import './Utilisateurs.css'

/* ── Constants ───────────────────────────────────────────── */
const ROLE_LABELS: Record<UserRole, string> = {
  admin_nut:                 'Admin NUT',
  gestionnaire_organisation: 'Gestionnaire',
  operateur:                 'Opérateur',
  consommateur:              'Consommateur',
}

const STATUS_LABELS: Record<UserStatus, string> = {
  active:   'Actif',
  inactive: 'Inactif',
  banned:   'Banni',
}

/* ── Sub-components ──────────────────────────────────────── */
function RoleBadge({ role }: { role: UserRole }) {
  const classMap: Record<UserRole, string> = {
    admin_nut:                 'role-badge-admin',
    gestionnaire_organisation: 'role-badge-gestionnaire',
    operateur:                 'role-badge-operateur',
    consommateur:              'role-badge-consommateur',
  }
  return <span className={classMap[role]}>{ROLE_LABELS[role]}</span>
}

function StatusBadge({ status }: { status: UserStatus }) {
  const classMap: Record<UserStatus, string> = {
    active:   'badge-active',
    inactive: 'badge-inactive',
    banned:   'badge-banned',
  }
  return <span className={classMap[status]}>{STATUS_LABELS[status]}</span>
}

/* ── Zod schema ─────────────────────────────────────────── */
const formSchema = z.object({
  firstname:       z.string().min(1, 'Obligatoire'),
  surname:         z.string().min(1, 'Obligatoire'),
  email:           z.string().email('Email invalide'),
  password:        z.string().min(8, '8 caractères minimum').or(z.literal('')).optional(),
  phone_number:    z.string().optional(),
  role:            z.enum(['admin_nut', 'gestionnaire_organisation', 'operateur', 'consommateur']),
  status:          z.enum(['active', 'inactive', 'banned']),
  id_organization: z.number().int().positive().optional().nullable(),
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

const fullName = (u: User) => `${u.firstname} ${u.surname}`

const toFormValues = (u: User | null): FormValues => ({
  firstname:       u?.firstname ?? '',
  surname:         u?.surname ?? '',
  email:           u?.email ?? '',
  password:        '',
  phone_number:    u?.phone_number ?? '',
  role:            u?.role ?? 'consommateur',
  status:          u?.status ?? 'active',
  id_organization: u?.id_organization ?? null,
})

const toCreatePayload = (data: FormValues) => ({
  firstname:       data.firstname,
  surname:         data.surname,
  email:           data.email,
  password:        data.password as string,
  phone_number:    data.phone_number || null,
  role:            data.role,
  status:          data.status,
  id_organization: data.id_organization ?? null,
})

const toUpdatePayload = (data: FormValues) => {
  const payload: Record<string, unknown> = {
    firstname:       data.firstname,
    surname:         data.surname,
    email:           data.email,
    phone_number:    data.phone_number || null,
    role:            data.role,
    status:          data.status,
    id_organization: data.id_organization ?? null,
  }
  if (data.password) payload.password = data.password
  return payload
}

/* ── Main component ──────────────────────────────────────── */
export default function Utilisateurs() {
  const [users, setUsers]           = useState<User[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<User | null>(null)
  const [panelMode, setPanelMode]   = useState<PanelMode>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [toast, setToast]           = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)
  const [filters, setFilters]       = useState({ search: '', role: '', status: '' })
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
      setUsers(await getUsers())
    } catch {
      showToast('Erreur lors du chargement de la liste.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchList() }, [fetchList])

  /* ── Panel triggers ── */
  const openDetail = async (u: User) => {
    setConfirmDel(false)
    const detail = await getUser(u.id)
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
        await createUser(toCreatePayload(data))
        showToast('Utilisateur créé.', 'success')
        closePanel()
      } else if (panelMode === 'edit' && selected) {
        const updated = await updateUser(selected.id, toUpdatePayload(data))
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
      await deleteUser(selected.id)
      showToast('Utilisateur supprimé.', 'success')
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
  const filtersActive = filters.search !== '' || filters.role !== '' || filters.status !== ''

  const filteredData = users.filter(u => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const matchName  = fullName(u).toLowerCase().includes(q)
      const matchEmail = u.email.toLowerCase().includes(q)
      if (!matchName && !matchEmail) return false
    }
    if (filters.role   && u.role   !== filters.role)   return false
    if (filters.status && u.status !== filters.status) return false
    return true
  })

  const resetFilters = () => setFilters({ search: '', role: '', status: '' })

  /* ── Render helpers ── */
  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="skeleton-row">
        <td><div className="skeleton-cell" style={{ width: '55%' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '70%' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '80px' }} /></td>
        <td className="col-center"><div className="skeleton-cell" style={{ width: '60px', margin: '0 auto' }} /></td>
        <td><div className="skeleton-cell" style={{ width: '30px' }} /></td>
        <td style={{ width: '44px' }} />
      </tr>
    ))

  const renderTableBody = () => {
    if (loading) return renderSkeletonRows()
    if (users.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            <div className="usr-empty">
              <Users size={48} className="usr-empty-icon" />
              <p>Aucun utilisateur enregistré.</p>
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={15} /> Créer un utilisateur
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
            <div className="usr-empty">
              <Users size={48} className="usr-empty-icon" />
              <p>Aucun résultat pour ces filtres.</p>
              <button className="btn-secondary" onClick={resetFilters}>
                Réinitialiser les filtres
              </button>
            </div>
          </td>
        </tr>
      )
    }
    return filteredData.map(u => (
      <tr
        key={u.id}
        className={selected?.id === u.id && panelMode !== null ? 'row-active' : ''}
        onClick={() => openDetail(u)}
      >
        <td className="col-name">{fullName(u)}</td>
        <td className="col-muted">{u.email}</td>
        <td><RoleBadge role={u.role} /></td>
        <td className="col-center"><StatusBadge status={u.status} /></td>
        <td className="col-muted">{u.id_organization ?? '—'}</td>
        <td>
          <div className="usr-row-actions" onClick={e => e.stopPropagation()}>
            <button
              className="btn-row-action"
              aria-label="Modifier"
              onClick={() => { openDetail(u).then(() => setPanelMode('edit')) }}
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
    const u = selected
    return (
      <>
        <div className="detail-section">
          <div className="detail-section-title">Identité</div>
          <div className="detail-grid">
            <div className="detail-field">
              <div className="detail-label">Prénom</div>
              <div className="detail-value">{u.firstname}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Nom</div>
              <div className="detail-value">{u.surname}</div>
            </div>
            <div className="detail-field detail-field-full">
              <div className="detail-label">Email</div>
              <div className="detail-value detail-icon-row">
                <Mail size={13} />
                {u.email}
              </div>
            </div>
            <div className="detail-field detail-field-full">
              <div className="detail-label">Téléphone</div>
              <div className={`detail-value${!u.phone_number ? ' empty' : ''} detail-icon-row`}>
                <Phone size={13} />
                {u.phone_number ?? '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Accès</div>
          <div className="detail-grid">
            <div className="detail-field">
              <div className="detail-label">Rôle</div>
              <div className="detail-value">
                <RoleBadge role={u.role} />
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Statut</div>
              <div className="detail-value">
                <StatusBadge status={u.status} />
              </div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Date de création</div>
              <div className={`detail-value${!u.creation_date ? ' empty' : ''}`}>
                {formatDate(u.creation_date)}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Organisation</div>
          <div className="detail-grid">
            <div className="detail-field detail-field-full">
              <div className="detail-label">ID Organisation</div>
              <div className={`detail-value${u.id_organization == null ? ' empty' : ''} detail-icon-row`}>
                <Shield size={13} />
                {u.id_organization != null ? `#${u.id_organization}` : 'Aucune'}
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  const renderForm = (mode: 'create' | 'edit') => (
    <form id="usr-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Identité */}
      <div className="form-section">
        <div className="form-section-title">Identité</div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="f-firstname">Prénom <span style={{ color: 'var(--nut-accent-red)' }}>*</span></label>
            <input
              id="f-firstname"
              type="text"
              {...register('firstname')}
              className={errors.firstname ? 'field-error' : ''}
            />
            {errors.firstname && <span className="form-error-msg">{errors.firstname.message}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="f-surname">Nom <span style={{ color: 'var(--nut-accent-red)' }}>*</span></label>
            <input
              id="f-surname"
              type="text"
              {...register('surname')}
              className={errors.surname ? 'field-error' : ''}
            />
            {errors.surname && <span className="form-error-msg">{errors.surname.message}</span>}
          </div>
          <div className="form-field full">
            <label htmlFor="f-email">Email <span style={{ color: 'var(--nut-accent-red)' }}>*</span></label>
            <input
              id="f-email"
              type="email"
              {...register('email')}
              className={errors.email ? 'field-error' : ''}
            />
            {errors.email && <span className="form-error-msg">{errors.email.message}</span>}
          </div>
          <div className="form-field full">
            <label htmlFor="f-phone">Téléphone</label>
            <input id="f-phone" type="text" {...register('phone_number')} />
          </div>
        </div>
      </div>

      {/* Accès */}
      <div className="form-section">
        <div className="form-section-title">Accès</div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="f-role">Rôle <span style={{ color: 'var(--nut-accent-red)' }}>*</span></label>
            <select id="f-role" {...register('role')} className={errors.role ? 'field-error' : ''}>
              <option value="consommateur">Consommateur</option>
              <option value="operateur">Opérateur</option>
              <option value="gestionnaire_organisation">Gestionnaire</option>
              <option value="admin_nut">Admin NUT</option>
            </select>
            {errors.role && <span className="form-error-msg">{errors.role.message}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="f-status">Statut <span style={{ color: 'var(--nut-accent-red)' }}>*</span></label>
            <select id="f-status" {...register('status')} className={errors.status ? 'field-error' : ''}>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="banned">Banni</option>
            </select>
            {errors.status && <span className="form-error-msg">{errors.status.message}</span>}
          </div>
          <div className="form-field full">
            <label htmlFor="f-password">
              Mot de passe
              {mode === 'create' && <span style={{ color: 'var(--nut-accent-red)' }}> *</span>}
              {mode === 'edit'   && <span style={{ color: 'var(--fg-muted)', fontWeight: 400 }}> (laisser vide pour ne pas modifier)</span>}
            </label>
            <input
              id="f-password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className={errors.password ? 'field-error' : ''}
            />
            {errors.password && <span className="form-error-msg">{errors.password.message}</span>}
          </div>
        </div>
      </div>

      {/* Organisation */}
      <div className="form-section">
        <div className="form-section-title">Organisation</div>
        <div className="form-grid">
          <div className="form-field full">
            <label htmlFor="f-org">ID Organisation</label>
            <input
              id="f-org"
              type="number"
              min="1"
              placeholder="Laisser vide si aucune"
              {...register('id_organization', { valueAsNumber: true })}
              className={errors.id_organization ? 'field-error' : ''}
            />
            {errors.id_organization && <span className="form-error-msg">{errors.id_organization.message}</span>}
          </div>
        </div>
      </div>
    </form>
  )

  const renderPanel = () => {
    if (!panelMode) return null

    const isForm = panelMode === 'edit' || panelMode === 'create'
    const title  = panelMode === 'create'
      ? 'Nouvel utilisateur'
      : selected ? fullName(selected) : '—'

    return (
      <aside className="usr-panel">
        {/* Header */}
        <div className="usr-panel-header">
          <div className="usr-panel-header-left">
            <h2 className="usr-panel-title">{title}</h2>
            {panelMode === 'detail' && selected && (
              <span className="usr-panel-subtitle">{selected.email}</span>
            )}
            {panelMode === 'edit'   && <span className="mode-badge edit">Modification</span>}
            {panelMode === 'create' && <span className="mode-badge create">Nouveau</span>}
          </div>
          <button className="usr-panel-close" aria-label="Fermer" onClick={closePanel}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="usr-panel-body">
          {panelMode === 'detail' && renderDetailView()}
          {panelMode === 'edit'   && renderForm('edit')}
          {panelMode === 'create' && renderForm('create')}
        </div>

        {/* Footer */}
        <div className="usr-panel-footer">
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

          <div className="usr-panel-footer-right">
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
                  form="usr-form"
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
    <div className="usr-page">
      {/* Toast */}
      {toast && (
        <div className={`usr-toast ${toast.kind}`} role="alert">
          {toast.kind === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="usr-header">
        <div className="usr-header-left">
          <h1>Utilisateurs</h1>
          {!loading && (
            <span className="usr-count">
              {filtersActive
                ? `${filteredData.length} / ${users.length} utilisateur${users.length !== 1 ? 's' : ''}`
                : `${users.length} utilisateur${users.length !== 1 ? 's' : ''} enregistré${users.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <button className="btn-primary usr-btn-new" onClick={openCreate}>
          <Plus size={15} /> Nouvel utilisateur
        </button>
      </div>

      {/* Split view */}
      <div className="usr-body">
        {/* Table card */}
        <div className="usr-table-card">
          {/* Filters */}
          <div className="usr-filters">
            <input
              type="search"
              placeholder="Rechercher par nom ou email..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
            <select
              value={filters.role}
              onChange={e => setFilters(f => ({ ...f, role: e.target.value }))}
              aria-label="Filtrer par rôle"
            >
              <option value="">Tous les rôles</option>
              <option value="admin_nut">Admin NUT</option>
              <option value="gestionnaire_organisation">Gestionnaire</option>
              <option value="operateur">Opérateur</option>
              <option value="consommateur">Consommateur</option>
            </select>
            <select
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              aria-label="Filtrer par statut"
            >
              <option value="">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="banned">Banni</option>
            </select>
            {filtersActive && (
              <button className="btn-secondary" onClick={resetFilters}>
                Réinitialiser
              </button>
            )}
          </div>

          {/* Table */}
          <div className="usr-table-scroll">
            <table className="usr-table" aria-label="Utilisateurs">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th className="col-center">Statut</th>
                  <th>Organisation</th>
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
