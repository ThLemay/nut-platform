import api from '../api'

export type ContainerStatus =
  | 'propre'
  | 'en_consigne'
  | 'sale'
  | 'en_lavage'
  | 'en_transit'
  | 'perdu'
  | 'a_detruire'
  | 'detruit'

export type OwnershipType = 'achat' | 'location'

export interface Container {
  id: number
  uid: string
  id_cont_type: number
  cont_type_name: string | null
  status: ContainerStatus
  id_owner_organization: number | null
  ownership_type: OwnershipType | null
  purchase_price: string | null
  first_use_date: string | null
  batch_number: string | null
  creation_date: string | null
  total_wash_count: number
  is_active: boolean
  id_current_place: number | null
  id_current_stock: number | null
  last_quality_check: string | null
  quality_check_count: number
}

export interface ContainerEvent {
  id: number
  created_at: string
  entity_type: string
  entity_id: number
  event_type: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  note: string | null
  meta: Record<string, unknown> | null
  id_user: number | null
  id_org: number | null
  id_place: number | null
}

export interface ContainerStatusUpdatePayload {
  status: ContainerStatus
  id_place?: number | null
  scan_method?: string | null
  note?: string | null
}

export const getContenants = (params?: {
  status?: ContainerStatus
  id_cont_type?: number
  is_active?: boolean
}) => api.get<Container[]>('/containers', { params }).then(r => r.data)

export const getContenant = (uid: string) =>
  api.get<Container>(`/containers/${uid}`).then(r => r.data)

export const getContainerHistory = (containerId: number) =>
  api.get<ContainerEvent[]>('/events', {
    params: { entity_type: 'container', entity_id: containerId, limit: 50 },
  }).then(r => r.data)

export const updateContenantStatus = (uid: string, payload: ContainerStatusUpdatePayload) =>
  api.patch<{ id: number; uid: string; status: ContainerStatus; id_current_place: number | null }>(
    `/containers/${uid}/status`,
    payload,
  ).then(r => r.data)
