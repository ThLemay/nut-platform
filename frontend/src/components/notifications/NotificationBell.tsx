import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getNotifications, markRead, markAllRead } from '../../lib/api/notifications'
import useNotificationStore from '../../store/notificationStore'
import useAuthStore from '../../store/authStore'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.floor(h / 24)} j`
}

export default function NotificationBell() {
  const { isAuthenticated } = useAuthStore()
  const { notifications, unreadCount, setNotifications, markRead: storeMarkRead, markAllRead: storeMarkAllRead } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const fetchNotifs = async () => {
    if (!isAuthenticated) return
    try {
      const data = await getNotifications()
      setNotifications(data)
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    fetchNotifs()
    const timer = setInterval(fetchNotifs, 30000)
    return () => clearInterval(timer)
  }, [isAuthenticated])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleNotifClick = async (id: number, id_related_order?: number) => {
    try {
      await markRead(id)
      storeMarkRead(id)
    } catch { /* ignore */ }
    setOpen(false)
    if (id_related_order) navigate('/commandes')
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllRead()
      storeMarkAllRead()
    } catch { /* ignore */ }
  }

  const displayed = notifications.slice(0, 10)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn-icon"
        aria-label="Notifications"
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative' }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 2, right: 2,
            minWidth: 16, height: 16,
            background: 'var(--nut-accent-red)',
            color: '#fff',
            borderRadius: '50%',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 320,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,.12)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  fontSize: 12,
                  color: 'var(--nut-green)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontWeight: 500,
                }}
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {displayed.length === 0 ? (
              <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
                Aucune notification
              </div>
            ) : (
              displayed.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n.id, n.id_related_order)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: n.is_read ? 'transparent' : 'rgba(51,90,55,.06)',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-app)')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(51,90,55,.06)')}
                >
                  <div style={{ fontSize: 13, color: 'var(--fg)', marginBottom: 3, lineHeight: 1.4 }}>
                    {!n.is_read && (
                      <span style={{
                        display: 'inline-block',
                        width: 7, height: 7,
                        borderRadius: '50%',
                        background: 'var(--nut-green)',
                        marginRight: 6,
                        verticalAlign: 'middle',
                      }} />
                    )}
                    {n.message}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
