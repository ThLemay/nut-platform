import api from '../api'

export type OrderType   = 'lavage' | 'transport' | 'contenants' | 'machine'
export type OrderStatus =
  | 'brouillon'
  | 'envoyee'
  | 'acceptee'
  | 'en_cours'
  | 'controle_qualite'
  | 'prete'
  | 'en_transit'
  | 'livree'
  | 'annulee'

export type TransportResponsible = 'client' | 'laveur' | 'transporteur'

export interface OrderLine {
  id: number
  id_cont_type: number | null
  id_cont_packaging: number | null
  quantity: number | null
  unit_price: string | null
  description: string | null
}

export interface TransportSlot {
  id: number
  slot_date: string
  is_accepted: boolean
}

export interface Transport {
  id: number
  responsible: TransportResponsible
  id_pickup_place: number | null
  id_delivery_place: number | null
  is_signed: boolean
  slots: TransportSlot[]
}

export interface Order {
  id: number
  order_type: OrderType
  status: OrderStatus
  id_client: number
  id_provider: number | null
  qr_code: string | null
  order_date: string | null
  desired_date: string | null
  confirmed_date: string | null
  note: string | null
  lines: OrderLine[]
  transport: Transport | null
}

export interface CreateOrderLine {
  id_cont_type: number
  id_cont_packaging?: number | null
  quantity: number
  unit_price?: number | null
  description?: string | null
}

export interface CreateOrderPayload {
  order_type: OrderType
  id_client: number
  desired_date?: string
  id_pickup_place?: number | null
  note?: string | null
  lines: CreateOrderLine[]
}

export const getOrders = (params?: { order_type?: OrderType; status?: OrderStatus; id_client?: number }) =>
  api.get<Order[]>('/orders', { params }).then(r => r.data)

export const getOrder = (id: number) =>
  api.get<Order>(`/orders/${id}`).then(r => r.data)

export const createOrder = (payload: CreateOrderPayload) =>
  api.post<Order>('/orders', payload).then(r => r.data)

export const updateOrderStatus = (id: number, newStatus: OrderStatus) =>
  api.patch<Order>(`/orders/${id}/status`, null, { params: { new_status: newStatus } }).then(r => r.data)
