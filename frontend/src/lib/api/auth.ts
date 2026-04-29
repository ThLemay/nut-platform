import api from '../api'

export interface UserUpdatePayload {
  firstname?:    string
  surname?:      string
  phone_number?: string
  email?:        string
  password?:     string
}

export const updateMe = (data: UserUpdatePayload) =>
  api.patch('/auth/me', data).then(r => r.data)
