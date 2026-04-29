import api from '../api'

export interface StockContainer {
  id:           number
  uid:          string
  id_cont_type: number
  status:       string
  added_at:     string
}

export interface Stock {
  id:                    number
  name:                  string | null
  status:                string
  note:                  string | null
  id_place:              number | null
  id_order:              number | null
  id_owner_organization: number | null
  created_at:            string | null
  container_count:       number
  containers:            StockContainer[]
}

export const getStocks       = (params?: { status?: string }) =>
  api.get<Stock[]>('/stocks', { params }).then(r => r.data)

export const getStock        = (id: number) =>
  api.get<Stock>(`/stocks/${id}`).then(r => r.data)

export const createStock     = (data: { name: string; note?: string }) =>
  api.post<Stock>('/stocks', data).then(r => r.data)

export const updateStock     = (id: number, data: Partial<{ name: string; status: string; note: string }>) =>
  api.patch<Stock>(`/stocks/${id}`, data).then(r => r.data)

export const deleteStock     = (id: number) =>
  api.delete(`/stocks/${id}`)

export const addContainer    = (id: number, uid: string) =>
  api.post<Stock>(`/stocks/${id}/containers`, { uid }).then(r => r.data)

export const removeContainer = (id: number, uid: string) =>
  api.delete<Stock>(`/stocks/${id}/containers/${uid}`).then(r => r.data)

export const bulkStatus      = (id: number, status: string, note?: string) =>
  api.patch<{ updated: number; skipped: number }>(`/stocks/${id}/containers/status`, { status, note }).then(r => r.data)

export const getStockContenants = (id: number) =>
  api.get<Stock>(`/stocks/${id}`).then(r => r.data.containers)
