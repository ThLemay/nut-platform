import api from '../api'

export type UserRole   = 'admin_nut' | 'gestionnaire_organisation' | 'operateur' | 'consommateur'
export type UserStatus = 'active' | 'inactive' | 'banned'

export interface User {
  id: number
  firstname: string
  surname: string
  email: string
  phone_number: string | null
  role: UserRole
  status: UserStatus
  id_organization: number | null
  creation_date: string | null
}

export interface UserCreatePayload {
  firstname: string
  surname: string
  email: string
  password: string
  phone_number?: string | null
  role?: UserRole
  status?: UserStatus
  id_organization?: number | null
}

export interface UserUpdatePayload {
  firstname?: string
  surname?: string
  email?: string
  password?: string
  phone_number?: string | null
  role?: UserRole
  status?: UserStatus
  id_organization?: number | null
}

export const getUsers = () =>
  api.get<User[]>('/users').then(r => r.data)

export const getUser = (id: number) =>
  api.get<User>(`/users/${id}`).then(r => r.data)

export const createUser = (data: UserCreatePayload) =>
  api.post<User>('/users', data).then(r => r.data)

export const updateUser = (id: number, data: UserUpdatePayload) =>
  api.patch<User>(`/users/${id}`, data).then(r => r.data)

export const deleteUser = (id: number) =>
  api.delete(`/users/${id}`)
