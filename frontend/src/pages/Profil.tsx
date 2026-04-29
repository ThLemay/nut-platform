import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { updateMe, type UserUpdatePayload } from '../lib/api/auth'
import { getOrganization } from '../lib/api/organisations'
import useAuthStore from '../store/authStore'
import './Profil.css'

/* ── Schema ──────────────────────────────────────────────────────────────── */
const schema = z.object({
  firstname:        z.string().min(1, 'Obligatoire'),
  surname:          z.string().min(1, 'Obligatoire'),
  phone_number:     z.string().optional(),
  email:            z.string().email('Email invalide'),
  new_password:     z.string().optional(),
  confirm_password: z.string().optional(),
}).refine(d => !d.new_password || d.new_password.length >= 8, {
  message: 'Minimum 8 caractères', path: ['new_password'],
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Les mots de passe ne correspondent pas', path: ['confirm_password'],
})

type FormValues = z.infer<typeof schema>

/* ── Role labels ─────────────────────────────────────────────────────────── */
const ROLE_LABELS: Record<string, string> = {
  admin_nut:                 'Administrateur NUT',
  gestionnaire_organisation: 'Gestionnaire',
  operateur:                 'Opérateur',
  consommateur:              'Consommateur',
  laveur:                    'Laveur',
  transporteur:              'Transporteur',
  stockeur:                  'Stockeur',
  recycleur:                 'Recycleur',
  destructeur:               'Destructeur',
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function Profil() {
  const { user, setUser }   = useAuthStore()
  const [saving,     setSaving]     = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)
  const [orgName,    setOrgName]    = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstname:        user?.firstname    ?? '',
      surname:          user?.surname      ?? '',
      phone_number:     '',
      email:            user?.email        ?? '',
      new_password:     '',
      confirm_password: '',
    },
  })

  useEffect(() => {
    if (user?.id_organization) {
      getOrganization(user.id_organization)
        .then(org => setOrgName(org.name))
        .catch(() => {})
    }
  }, [user?.id_organization])

  const onSubmit = async (data: FormValues) => {
    setSaving(true)
    setSuccessMsg(null)
    setErrorMsg(null)
    try {
      const payload: UserUpdatePayload = {
        firstname:    data.firstname,
        surname:      data.surname,
        email:        data.email,
        phone_number: data.phone_number || undefined,
      }
      if (data.new_password) payload.password = data.new_password
      await updateMe(payload)
      setUser({ ...user!, firstname: data.firstname, surname: data.surname, email: data.email })
      setSuccessMsg('Profil mis à jour.')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrorMsg(msg ?? 'Une erreur est survenue.')
    } finally {
      setSaving(false)
    }
  }

  const initials = user
    ? `${user.firstname?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  return (
    <div className="pf-page">
      <h1 className="pf-title">Mon profil</h1>

      <div className="pf-grid">

        {/* ── Card gauche — lecture seule ── */}
        <div className="pf-card pf-card--info">
          <div className="pf-avatar">{initials}</div>
          <div className="pf-fullname">{user?.firstname} {user?.surname}</div>
          <div className="pf-email">{user?.email}</div>
          <span className="pf-role-badge">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</span>
          {orgName && <div className="pf-org">{orgName}</div>}
        </div>

        {/* ── Card droite — formulaire ── */}
        <div className="pf-card pf-card--form">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>

            <h2 className="pf-section-title">Modifier le profil</h2>

            <div className="pf-form-grid">
              <div className="pf-field">
                <label className="pf-label">Prénom</label>
                <input
                  className={`pf-input${errors.firstname ? ' pf-input--error' : ''}`}
                  {...register('firstname')}
                />
                {errors.firstname && <span className="pf-error">{errors.firstname.message}</span>}
              </div>
              <div className="pf-field">
                <label className="pf-label">Nom</label>
                <input
                  className={`pf-input${errors.surname ? ' pf-input--error' : ''}`}
                  {...register('surname')}
                />
                {errors.surname && <span className="pf-error">{errors.surname.message}</span>}
              </div>
            </div>

            <div className="pf-field">
              <label className="pf-label">Téléphone</label>
              <input className="pf-input" type="tel" {...register('phone_number')} />
            </div>

            <div className="pf-field">
              <label className="pf-label">Email</label>
              <input
                className={`pf-input${errors.email ? ' pf-input--error' : ''}`}
                type="email"
                {...register('email')}
              />
              {errors.email && <span className="pf-error">{errors.email.message}</span>}
            </div>

            <div className="pf-separator" />

            <h2 className="pf-section-title">Changer le mot de passe</h2>

            <div className="pf-field">
              <label className="pf-label">Nouveau mot de passe</label>
              <input
                className={`pf-input${errors.new_password ? ' pf-input--error' : ''}`}
                type="password"
                placeholder="Laisser vide pour ne pas modifier"
                {...register('new_password')}
              />
              {errors.new_password && <span className="pf-error">{errors.new_password.message}</span>}
            </div>

            <div className="pf-field">
              <label className="pf-label">Confirmer le mot de passe</label>
              <input
                className={`pf-input${errors.confirm_password ? ' pf-input--error' : ''}`}
                type="password"
                {...register('confirm_password')}
              />
              {errors.confirm_password && <span className="pf-error">{errors.confirm_password.message}</span>}
            </div>

            {successMsg && (
              <div className="pf-toast pf-toast--success">
                <CheckCircle2 size={16} />
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="pf-toast pf-toast--error">
                <AlertCircle size={16} />
                {errorMsg}
              </div>
            )}

            <div className="pf-footer">
              <button type="submit" className="pf-btn-save" disabled={saving}>
                {saving && <Loader2 size={16} className="pf-spin" />}
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  )
}
