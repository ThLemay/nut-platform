import api from '../api'

export interface NotificationItem {
  id:               number
  type:             string
  message:          string
  is_read:          boolean
  created_at:       string
  id_related_order?: number
}

export const getNotifications = () =>
  api.get<NotificationItem[]>('/notifications').then(r => r.data)

export const markRead = (id: number) =>
  api.patch<NotificationItem>(`/notifications/${id}/read`).then(r => r.data)

export const markAllRead = () =>
  api.patch('/notifications/read-all')
