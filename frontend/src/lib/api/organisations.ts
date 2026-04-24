import api from '../api'

export interface Address {
  id: number
  address: string | null
  city: string | null
  zipcode: string | null
  country: string | null
}

export interface Organization {
  id: number
  name: string
  siren: string | null
  siret: string | null
  description: string | null
  status: number
  creation_date: string | null
  id_parent: number | null
  is_food_provider: boolean
  is_cont_washer: boolean
  is_cont_transporter: boolean
  is_cont_stockeur: boolean
  is_cont_recycleur: boolean
  is_cont_destructeur: boolean
  is_cont_provider: boolean
  address: Address | null
}

interface CreatePayload {
  name: string
  siren?: string | null
  siret?: string | null
  description?: string | null
  is_food_provider?: boolean
  is_cont_washer?: boolean
  is_cont_transporter?: boolean
  is_cont_stockeur?: boolean
  is_cont_recycleur?: boolean
  is_cont_destructeur?: boolean
  is_cont_provider?: boolean
  address?: { address?: string | null; city?: string | null; zipcode?: string | null; country?: string | null } | null
}

interface UpdatePayload extends Omit<CreatePayload, 'address'> {}

export const getOrganizations = () =>
  api.get<Organization[]>('/organizations').then(r => r.data)

export const getOrganization = (id: number) =>
  api.get<Organization>(`/organizations/${id}`).then(r => r.data)

export const createOrganization = (data: CreatePayload) =>
  api.post<Organization>('/organizations', data).then(r => r.data)

export const updateOrganization = (id: number, data: UpdatePayload) =>
  api.patch<Organization>(`/organizations/${id}`, data).then(r => r.data)

export const deleteOrganization = (id: number) =>
  api.delete(`/organizations/${id}`)
