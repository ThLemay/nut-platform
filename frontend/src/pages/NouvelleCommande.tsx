import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { getContainerTypes, type ContainerType } from '../lib/api/containerTypes'
import { getPlaces, type Place } from '../lib/api/lieux'
import { getOrganizations, getOrganization, type Organization } from '../lib/api/organisations'
import { createOrder } from '../lib/api/commandes'
import useAuthStore from '../store/authStore'
import './NouvelleCommande.css'

/* ── Helpers ──────────────────────────────────────────────── */
const toNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return isNaN(n) ? undefined : n
}

/* ── Schema ───────────────────────────────────────────────── */
const schema = z.object({
  order_type: z.enum(['lavage', 'transport', 'contenants']),
  id_client: z.preprocess(
    toNum,
    z.number({ required_error: 'Obligatoire' }).int().positive('Obligatoire'),
  ),
  desired_date: z.preprocess(
    v => (v === '' ? undefined : v),
    z.string().optional(),
  ),
  note: z.string().optional(),
  id_pickup_place: z.preprocess(
    toNum,
    z.number().int().positive().optional().nullable(),
  ),
  id_delivery_place: z.preprocess(
    toNum,
    z.number().int().positive().optional().nullable(),
  ),
  responsible: z.preprocess(
    v => (v === '' || v == null ? null : v),
    z.enum(['client', 'laveur', 'transporteur']).optional().nullable(),
  ),
  lines: z
    .array(
      z.object({
        id_cont_type: z.preprocess(
          toNum,
          z.number({ required_error: 'Obligatoire' }).int().positive('Obligatoire'),
        ),
        quantity: z.preprocess(
          toNum,
          z.number({ required_error: 'Obligatoire' }).int().min(1, 'Min 1'),
        ),
        unit_price: z.preprocess(
          v => { const n = toNum(v); return n != null && n > 0 ? n : null },
          z.number().positive().optional().nullable(),
        ),
      }),
    )
    .min(1, 'Au moins une ligne requise'),
})

type FormValues = z.infer<typeof schema>

/* ── Static config ────────────────────────────────────────── */
const ORDER_TYPES = [
  { value: 'lavage',     label: 'Lavage' },
  { value: 'transport',  label: 'Transport' },
  { value: 'contenants', label: 'Contenants' },
] as const

const RESPONSIBLE_OPTIONS = [
  { value: 'client',       label: 'Client' },
  { value: 'laveur',       label: 'Laveur' },
  { value: 'transporteur', label: 'Transporteur' },
] as const

function placeLabel(p: Place): string {
  const detail = p.organization_name || p.address?.city || ''
  return detail ? `${p.name} — ${detail}` : p.name
}

function typeLabel(ct: ContainerType): string {
  return ct.literage ? `${ct.name} — ${Number(ct.literage)}L` : ct.name
}

const EMPTY_LINE = () => ({
  id_cont_type: undefined as unknown as number,
  quantity:     undefined as unknown as number,
  unit_price:   null as null,
})

/* ── Component ────────────────────────────────────────────── */
export default function NouvelleCommande() {
  const navigate = useNavigate()
  const user     = useAuthStore(s => s.user)
  const isAdmin  = user?.role === 'admin_nut'

  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([])
  const [places,         setPlaces]         = useState<Place[]>([])
  const [organizations,  setOrganizations]  = useState<Organization[]>([])
  const [orgName,        setOrgName]        = useState('')
  const [loading,        setLoading]        = useState(true)
  const [submitError,    setSubmitError]    = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      order_type:       'lavage',
      id_client:        undefined as unknown as number,
      desired_date:     '',
      note:             '',
      id_pickup_place:  null,
      id_delivery_place: null,
      responsible:      null,
      lines:            [EMPTY_LINE()],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const orderType   = watch('order_type')
  const colTemplate = orderType === 'contenants' ? '2fr 1fr 1fr 36px' : '3fr 1fr 36px'

  /* ── Load reference data ── */
  useEffect(() => {
    const orgPromise = isAdmin
      ? getOrganizations()
      : user?.id_organization
        ? getOrganization(user.id_organization)
        : Promise.resolve(null)

    Promise.all([getContainerTypes(), getPlaces(), orgPromise])
      .then(([cts, ps, orgData]) => {
        setContainerTypes(cts)
        setPlaces(ps)
        if (isAdmin) {
          setOrganizations(orgData as Organization[])
        } else if (orgData) {
          const org = orgData as Organization
          setOrgName(org.name)
          setValue('id_client', org.id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Submit ── */
  const onSubmit = async (data: FormValues) => {
    setSubmitError(null)
    try {
      await createOrder({
        order_type: data.order_type,
        id_client:  data.id_client,
        ...(data.desired_date ? { desired_date: data.desired_date } : {}),
        ...(data.note?.trim()  ? { note: data.note.trim() }         : {}),
        lines: data.lines.map(l => ({
          id_cont_type: l.id_cont_type,
          quantity:     l.quantity,
          ...(l.unit_price != null ? { unit_price: l.unit_price } : {}),
        })),
      })
      navigate('/commandes', { state: { toast: 'Commande créée en brouillon' } })
    } catch {
      setSubmitError('Impossible de créer la commande. Veuillez réessayer.')
    }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="nc-loading">
        <Loader2 size={32} className="nc-spin" />
      </div>
    )
  }

  /* ── Render ── */
  return (
    <div className="nc-page">
      <div className="nc-card">

        {/* Header */}
        <div className="nc-card-header">
          <h1 className="nc-card-title">Nouvelle commande</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="nc-form-body">

            {/* ── Section : Commande ── */}
            <div className="form-section">
              <div className="form-section-title">Commande</div>
              <div className="form-grid">

                <div className="form-field full">
                  <label>Type de commande</label>
                  <select {...register('order_type')}>
                    {ORDER_TYPES.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field full">
                  <label>Organisation cliente</label>
                  {isAdmin ? (
                    <>
                      <select
                        {...register('id_client')}
                        className={errors.id_client ? 'field-error' : ''}
                      >
                        <option value="">— Sélectionner une organisation —</option>
                        {organizations.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                      {errors.id_client && (
                        <span className="form-error-msg">
                          {errors.id_client.message as string}
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="nc-readonly-field">{orgName || '—'}</div>
                  )}
                </div>

              </div>
            </div>

            {/* ── Section : Détails (lavage / transport) ── */}
            {orderType !== 'contenants' && (
              <div className="form-section">
                <div className="form-section-title">Détails</div>
                <div className="form-grid">

                  {orderType === 'transport' && (
                    <>
                      <div className="form-field full">
                        <label>Lieu de collecte</label>
                        <select {...register('id_pickup_place')}>
                          <option value="">— Sélectionner —</option>
                          {places.map(p => (
                            <option key={p.id} value={p.id}>{placeLabel(p)}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-field full">
                        <label>Lieu de livraison</label>
                        <select {...register('id_delivery_place')}>
                          <option value="">— Sélectionner —</option>
                          {places.map(p => (
                            <option key={p.id} value={p.id}>{placeLabel(p)}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>Responsable transport</label>
                        <select {...register('responsible')}>
                          <option value="">— Sélectionner —</option>
                          {RESPONSIBLE_OPTIONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className={`form-field${orderType === 'transport' ? '' : ' full'}`}>
                    <label>
                      {orderType === 'lavage' ? 'Date souhaitée de retour' : 'Date souhaitée'}
                    </label>
                    <input type="datetime-local" {...register('desired_date')} />
                  </div>

                </div>
              </div>
            )}

            {/* ── Section : Lignes contenants ── */}
            <div className="form-section">
              <div className="form-section-title">Lignes contenants</div>

              <div className="nc-lines">
                <div className="nc-lines-header" style={{ gridTemplateColumns: colTemplate }}>
                  <span>Type contenant</span>
                  <span>Quantité</span>
                  {orderType === 'contenants' && <span>Prix unit. (€)</span>}
                  <span />
                </div>

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="nc-line"
                    style={{ gridTemplateColumns: colTemplate }}
                  >
                    <div className="nc-line-col">
                      <select
                        {...register(`lines.${index}.id_cont_type`)}
                        className={errors.lines?.[index]?.id_cont_type ? 'field-error' : ''}
                      >
                        <option value="">— Type —</option>
                        {containerTypes.map(ct => (
                          <option key={ct.id} value={ct.id}>{typeLabel(ct)}</option>
                        ))}
                      </select>
                      {errors.lines?.[index]?.id_cont_type && (
                        <span className="nc-line-err">
                          {errors.lines[index]!.id_cont_type!.message as string}
                        </span>
                      )}
                    </div>

                    <div className="nc-line-col">
                      <input
                        type="number"
                        min={1}
                        placeholder="Qté"
                        {...register(`lines.${index}.quantity`)}
                        className={errors.lines?.[index]?.quantity ? 'field-error' : ''}
                      />
                      {errors.lines?.[index]?.quantity && (
                        <span className="nc-line-err">
                          {errors.lines[index]!.quantity!.message as string}
                        </span>
                      )}
                    </div>

                    {orderType === 'contenants' && (
                      <div className="nc-line-col">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          {...register(`lines.${index}.unit_price`)}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      className="nc-del-btn"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      title="Supprimer la ligne"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {(errors.lines as { message?: string } | undefined)?.message && (
                <p className="form-error-msg nc-lines-err">
                  {(errors.lines as { message: string }).message}
                </p>
              )}

              <button
                type="button"
                className="nc-add-btn"
                onClick={() => append(EMPTY_LINE())}
              >
                <Plus size={14} />
                Ajouter un type de contenant
              </button>
            </div>

            {/* ── Section : Note ── */}
            <div className="form-section" style={{ marginBottom: 0 }}>
              <div className="form-section-title">Note</div>
              <div className="form-field">
                <textarea
                  {...register('note')}
                  placeholder="Note optionnelle…"
                  rows={3}
                />
              </div>
            </div>

          </div>

          {/* ── Submit error ── */}
          {submitError && (
            <div className="nc-submit-error">{submitError}</div>
          )}

          {/* ── Footer ── */}
          <div className="nc-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting && <Loader2 size={14} className="nc-spin" />}
              Créer en brouillon
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
