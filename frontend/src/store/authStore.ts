import { create } from 'zustand'

interface AuthUser {
  id: number
  email: string
  role: string
  firstname: string
  surname: string
  id_organization: number | null
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  setUser: (user: AuthUser) => void
  setToken: (token: string) => void
  logout: () => void
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('nut_token'),
  isAuthenticated: !!localStorage.getItem('nut_token'),

  setUser: (user) => set({ user, isAuthenticated: true }),

  setToken: (token) => {
    localStorage.setItem('nut_token', token)
    set({ token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('nut_token')
    set({ user: null, token: null, isAuthenticated: false })
  },
}))

export default useAuthStore
