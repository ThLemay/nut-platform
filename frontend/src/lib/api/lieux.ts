import api from '../api'

export type PlaceType =
  | 'restaurant'
  | 'cuisine_collective'
  | 'laveur'
  | 'entrepot'
  | 'point_collecte'
  | 'centre_commercial'
  | 'camion'
  | 'recycleur'
  | 'destructeur'
  | 'autre'

export interface PlaceAddress {
  id: number
  address: string | null
  city: string | null
  zipcode: string | null
  country: string | null
}

export interface Place {
  id: number
  name: string
  place_type: PlaceType
  id_organization: number | null
  id_parent: number | null
  latitude: string | null
  longitude: string | null
  volume_capacity: string | null
  id_address: number | null
  address: PlaceAddress | null
  organization_name: string | null
}

export interface PlaceCreatePayload {
  name: string
  place_type: PlaceType
  id_organization?: number | null
  id_parent?: number | null
  latitude?: number | null
  longitude?: number | null
  volume_capacity?: number | null
  address?: {
    address?: string | null
    city?: string | null
    zipcode?: string | null
    country?: string | null
  } | null
}

export interface PlaceUpdatePayload {
  name?: string
  place_type?: PlaceType
  id_organization?: number | null
  id_parent?: number | null
  latitude?: number | null
  longitude?: number | null
  volume_capacity?: number | null
}

export const getPlaces = (params?: { place_type?: PlaceType; id_organization?: number }) =>
  api.get<Place[]>('/places', { params }).then(r => r.data)

export const getPlace = (id: number) =>
  api.get<Place>(`/places/${id}`).then(r => r.data)

export const createPlace = (data: PlaceCreatePayload) =>
  api.post<Place>('/places', data).then(r => r.data)

export const updatePlace = (id: number, data: PlaceUpdatePayload) =>
  api.patch<Place>(`/places/${id}`, data).then(r => r.data)

export const deletePlace = (id: number) =>
  api.delete(`/places/${id}`)
