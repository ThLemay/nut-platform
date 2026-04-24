import api from '../api'

export interface DashboardStats {
  contenants_total: number
  contenants_propres: number
  contenants_en_consigne: number
  contenants_sales: number
  contenants_en_lavage: number
  contenants_en_transit: number
  contenants_perdus: number
  contenants_a_detruire: number
  commandes_brouillon: number
  commandes_en_cours: number
  commandes_livrees_ce_mois: number
  organisations_total: number
  utilisateurs_total: number
  membres_organisation: number
}

export const getDashboardStats = () =>
  api.get<DashboardStats>('/dashboard/stats').then(r => r.data)
