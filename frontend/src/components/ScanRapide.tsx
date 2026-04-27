import { useEffect, useRef, useState } from 'react'
import { X, Scan, Plus, Trash2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { getContenant, updateContenantStatus, type Container } from '../lib/api/contenants'
import { getStocks, getStockContenants, type StockItem } from '../lib/api/stocks'
import './ScanRapide.css'

/* ── Constants ──────────────────────────────────────────────── */
const TRANSITIONS: Record<string, string[]> = {
  propre:      ['en_consigne', 'en_transit'],
  en_consigne: ['sale'],
  sale:        ['en_lavage', 'en_transit', 'a_detruire'],
  en_lavage:   ['propre', 'a_detruire'],
  en_transit:  ['propre', 'sale', 'en_consigne'],
  perdu:       ['propre', 'a_detruire'],
  a_detruire:  ['detruit'],
  detruit:     [],
}

const STATUS_LABELS: Record<string, string> = {
  propre:      'Propre',
  en_consigne: 'En consigne',
  sale:        'Sale',
  en_lavage:   'En lavage',
  en_transit:  'En transit',
  perdu:       'Perdu',
  a_detruire:  'À détruire',
  detruit:     'Détruit',
}

const QR_READER_ID = 'sr-qr-reader'

/* ── Component ──────────────────────────────────────────────── */
interface Props { onClose: () => void }

export default function ScanRapide({ onClose }: Props) {
  /* State (per spec) */
  const [contenants, _setContenants] = useState<Container[]>([])
  const [stocks,     setStocks]      = useState<StockItem[]>([])
  const [uidInput,   setUidInput]    = useState('')
  const [scanning,   setScanning]    = useState(false)
  const [actionStatus, setActionStatus] = useState('')
  const [note,       setNote]        = useState('')
  const [applying,   setApplying]    = useState(false)
  const [progress,   setProgress]    = useState(0)
  const [toast,      setToast]       = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)

  /* Refs */
  const contenantsRef  = useRef<Container[]>([])
  const toastTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Keep ref in sync — setContenants is used everywhere instead of _setContenants */
  const setContenants = (v: Container[]) => {
    contenantsRef.current = v
    _setContenants(v)
  }

  /* ── Derived ── */
  const uniqueStatuses = [...new Set(contenants.map(c => c.status))]
  const mixedStatuses  = uniqueStatuses.length > 1
  const commonStatus   = !mixedStatuses && uniqueStatuses.length === 1 ? uniqueStatuses[0] : null
  const transitions    = commonStatus ? (TRANSITIONS[commonStatus] ?? []) : []

  /* ── Helpers ── */
  const showToast = (msg: string, kind: 'success' | 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, kind })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  /* addUid reads from contenantsRef so it's safe to call from a stale closure (scanner callback) */
  const addUid = async (rawUid: string) => {
    const uid = rawUid.trim()
    if (!uid) return
    if (contenantsRef.current.some(c => c.uid === uid)) {
      showToast('Déjà dans la liste', 'error')
      return
    }
    try {
      const c = await getContenant(uid)
      if (!contenantsRef.current.some(x => x.uid === c.uid)) {
        setContenants([...contenantsRef.current, c])
      }
    } catch {
      showToast(`Introuvable : ${uid.slice(0, 8)}…`, 'error')
    }
  }

  const handleManualAdd = () => {
    if (!uidInput.trim()) return
    addUid(uidInput)
    setUidInput('')
  }

  /* ── Scanner effect ── */
  useEffect(() => {
    if (!scanning) return

    let stopped = false
    const scanner = new Html5Qrcode(QR_READER_ID)

    const doStop = () => {
      if (stopped) return
      stopped = true
      scanner.stop()
        .then(() => { try { scanner.clear() } catch { /* ignore */ } })
        .catch(() => {})
    }

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      (decodedText) => {
        doStop()
        setScanning(false)
        addUid(decodedText)
      },
      () => {},
    ).catch(() => { if (!stopped) setScanning(false) })

    return doStop
  }, [scanning]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load stocks (silent fail if endpoint missing) ── */
  useEffect(() => {
    getStocks().then(setStocks).catch(() => {})
  }, [])

  /* ── Reset action when common status changes ── */
  useEffect(() => {
    setActionStatus(transitions[0] ?? '')
  }, [commonStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cleanup timer on unmount ── */
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  /* ── Escape to close ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  /* ── Stock import ── */
  const handleStockSelect = async (stockId: number) => {
    try {
      const stockContenants = await getStockContenants(stockId)
      const fetched = await Promise.all(
        stockContenants.map(sc => getContenant(sc.uid).catch(() => null)),
      )
      const valid   = fetched.filter(Boolean) as Container[]
      const current = contenantsRef.current
      const newOnes = valid.filter(c => !current.some(x => x.uid === c.uid))
      if (newOnes.length > 0) setContenants([...current, ...newOnes])
      showToast(`${newOnes.length} contenant(s) ajouté(s) depuis le stock`, 'success')
    } catch {
      showToast('Erreur lors du chargement du stock', 'error')
    }
  }

  /* ── Apply transitions ── */
  const handleApply = async () => {
    if (!actionStatus || contenants.length === 0) return
    setApplying(true)
    let success = 0
    for (let i = 0; i < contenants.length; i++) {
      try {
        await updateContenantStatus(contenants[i].uid, {
          status: actionStatus as Container['status'],
          ...(note.trim() ? { note: note.trim() } : {}),
        })
        success++
      } catch { /* count as failure */ }
      setProgress(Math.round(((i + 1) / contenants.length) * 100))
    }
    setApplying(false)
    setProgress(0)
    if (success === contenants.length) {
      showToast(`${success} contenant(s) mis à jour`, 'success')
    } else {
      showToast(`${success}/${contenants.length} mis à jour — ${contenants.length - success} erreur(s)`, 'error')
    }
    setContenants([])
    setActionStatus('')
    setNote('')
  }

  /* ── Render ── */
  return (
    <div className="sr-overlay" onClick={onClose}>
      <div className="sr-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sr-header">
          <h2 className="sr-title">
            <Scan size={18} />
            Scan Rapide
          </h2>
          <button className="sr-close" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="sr-body">

          {/* ── Section 1 : Ajouter ── */}
          <div className="sr-section">
            <div className="sr-section-title">Ajouter des contenants</div>

            {/* QR Scanner */}
            <button
              type="button"
              className={`sr-btn-scan${scanning ? ' active' : ''}`}
              onClick={() => setScanning(s => !s)}
            >
              <Scan size={16} />
              {scanning ? 'Arrêter le scan' : 'Scanner un QR code'}
            </button>

            {scanning && (
              <div className="sr-camera-area">
                <div id={QR_READER_ID} />
              </div>
            )}

            <div className="sr-separator">ou</div>

            {/* Saisie manuelle */}
            <div className="sr-add-row">
              <input
                type="text"
                className="sr-uid-input"
                value={uidInput}
                onChange={e => setUidInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleManualAdd() } }}
                placeholder="UID contenant…"
              />
              <button
                type="button"
                className="sr-btn"
                onClick={handleManualAdd}
                disabled={!uidInput.trim()}
              >
                <Plus size={14} />
                Ajouter
              </button>
            </div>

            {/* Stock select — hidden if endpoint absent */}
            {stocks.length > 0 && (
              <>
                <div className="sr-separator">ou</div>
                <div className="sr-add-row">
                  <select
                    className="sr-stock-select"
                    defaultValue=""
                    onChange={e => {
                      const id = Number(e.target.value)
                      if (id) handleStockSelect(id)
                      e.target.value = ''
                    }}
                  >
                    <option value="">Importer depuis un stock…</option>
                    {stocks.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* ── Section 2 : Liste ── */}
          <div className="sr-section">
            <div className="sr-section-title">Contenants sélectionnés</div>
            <div className="sr-list-header">
              <span className="sr-list-count">{contenants.length} contenant(s)</span>
              {contenants.length > 0 && (
                <button
                  type="button"
                  className="sr-btn-clear"
                  onClick={() => setContenants([])}
                >
                  Tout vider
                </button>
              )}
            </div>

            {contenants.length === 0 ? (
              <div className="sr-list-empty">Aucun contenant sélectionné</div>
            ) : (
              <div className="sr-list">
                {contenants.map(c => (
                  <div key={c.uid} className="sr-list-item">
                    <span className="sr-uid">{c.uid.slice(0, 8)}</span>
                    <span className="sr-type-name">{c.cont_type_name ?? '—'}</span>
                    <span className={`sr-badge sr-badge-${c.status}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                    <button
                      type="button"
                      className="sr-del-btn"
                      onClick={() => setContenants(contenants.filter(x => x.uid !== c.uid))}
                      title="Retirer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Section 3 : Action ── */}
          {contenants.length > 0 && (
            <div className="sr-section">
              <div className="sr-section-title">Action</div>

              {mixedStatuses ? (
                <div className="sr-warning">
                  <AlertCircle size={16} />
                  Statuts mixtes — sélectionnez des contenants avec le même statut.
                </div>
              ) : (
                <>
                  <p className="sr-status-text">
                    Statut actuel : <strong>{STATUS_LABELS[commonStatus!] ?? commonStatus}</strong>
                    {' '}({contenants.length} contenant(s))
                  </p>

                  {transitions.length === 0 ? (
                    <p className="sr-status-text">Aucune transition disponible.</p>
                  ) : (
                    <>
                      <div className="sr-action-row">
                        <label>Nouveau statut</label>
                        <select
                          className="sr-action-select"
                          value={actionStatus}
                          onChange={e => setActionStatus(e.target.value)}
                          disabled={applying}
                        >
                          {transitions.map(t => (
                            <option key={t} value={t}>{STATUS_LABELS[t] ?? t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sr-action-row">
                        <label>Note (optionnelle)</label>
                        <textarea
                          className="sr-action-textarea"
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          placeholder="Note optionnelle…"
                          disabled={applying}
                          rows={2}
                        />
                      </div>

                      {applying && (
                        <div className="sr-progress">
                          <div className="sr-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                      )}

                      <button
                        type="button"
                        className="sr-btn-apply"
                        onClick={handleApply}
                        disabled={applying || !actionStatus}
                      >
                        {applying ? (
                          <><Loader2 size={14} className="sr-spin" /> Application…</>
                        ) : (
                          <><CheckCircle2 size={14} /> Appliquer ({contenants.length} contenant(s))</>
                        )}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

        </div>

        {/* Toast */}
        {toast && (
          <div className={`sr-toast ${toast.kind}`}>
            {toast.kind === 'success'
              ? <CheckCircle2 size={14} />
              : <AlertCircle size={14} />}
            {toast.msg}
          </div>
        )}

      </div>
    </div>
  )
}
