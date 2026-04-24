import api from '../api'

export interface Packaging {
  id: number
  id_cont_type: number
  name?: string | null
  pieces_per_bag?: number | null
  bag_per_box?: number | null
  box_per_pallet?: number | null
  width_box?: string | null
  length_box?: string | null
  height_box?: string | null
  weight_box?: string | null
}

// Decimal fields from Python come back as strings
export interface ContainerType {
  id: number
  name: string
  description?: string | null
  literage?: string | null
  weight?: string | null
  width?: string | null
  length?: string | null
  height?: string | null
  stacking_height?: string | null
  material?: string | null
  sealable: boolean
  max_wash_cycles?: number | null
  color?: string | null
  temp_min?: number | null
  temp_max?: number | null
  wash_recommendations?: string | null
  quality_check_interval?: number | null
  id_supplier?: number | null
  packagings: Packaging[]
}

type CTPayload = Omit<ContainerType, 'id' | 'packagings'>
type PkgPayload = Omit<Packaging, 'id' | 'id_cont_type'>

const normalize = (t: ContainerType): ContainerType => ({
  ...t,
  packagings: t.packagings ?? [],
})

export const getContainerTypes = () =>
  api.get<ContainerType[]>('/container-types').then(r => r.data.map(normalize))

export const getContainerType = (id: number) =>
  api.get<ContainerType>(`/container-types/${id}`).then(r => normalize(r.data))

export const createContainerType = (data: Partial<CTPayload>) =>
  api.post<ContainerType>('/container-types', data).then(r => normalize(r.data))

export const updateContainerType = (id: number, data: Partial<CTPayload>) =>
  api.patch<ContainerType>(`/container-types/${id}`, data).then(r => normalize(r.data))

export const deleteContainerType = (id: number) =>
  api.delete(`/container-types/${id}`)

export const createPackaging = (typeId: number, data: Partial<PkgPayload>) =>
  api.post<Packaging>(`/container-types/${typeId}/packagings`, data).then(r => r.data)

export const updatePackaging = (typeId: number, pkgId: number, data: Partial<PkgPayload>) =>
  api.patch<Packaging>(`/container-types/${typeId}/packagings/${pkgId}`, data).then(r => r.data)

export const deletePackaging = (typeId: number, pkgId: number) =>
  api.delete(`/container-types/${typeId}/packagings/${pkgId}`)
