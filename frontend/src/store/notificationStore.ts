import { create } from 'zustand'
import type { NotificationItem } from '../lib/api/notifications'

interface NotificationState {
  notifications: NotificationItem[]
  unreadCount:   number
  setNotifications: (items: NotificationItem[]) => void
  markRead:         (id: number) => void
  markAllRead:      () => void
}

const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount:   0,

  setNotifications: (items) =>
    set({ notifications: items, unreadCount: items.filter(n => !n.is_read).length }),

  markRead: (id) =>
    set(state => {
      const notifications = state.notifications.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      )
      return { notifications, unreadCount: notifications.filter(n => !n.is_read).length }
    }),

  markAllRead: () =>
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),
}))

export default useNotificationStore
