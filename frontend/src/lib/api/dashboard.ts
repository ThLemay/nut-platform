import api from '../api'

export interface CommandeResume {
  id: number
  order_type: string
  status: string
  id_client: number
  id_provider: number | null
  desired_date: string | null
  order_date: string | null
}

export interface DashboardStats {
  // Contenants
  contenants_total: number
  contenants_propres: number
  contenants_en_consigne: number
  contenants_sales: number
  contenants_en_lavage: number
  contenants_en_transit: number
  contenants_perdus: number
  contenants_a_detruire: number
  contenants_sortis_parc: number
  // Commandes
  commandes_brouillon: number
  commandes_en_cours: number
  commandes_livrees_ce_mois: number
  commandes_du_jour: number
  dernieres_commandes: CommandeResume[]
  // CO2
  co2_economise_grammes: number
  // Orgs & users
  organisations_total: number
  utilisateurs_total: number
  membres_organisation: number
}

export const getDashboardStats = () =>
  api.get<DashboardStats>('/dashboard/stats').then(r => r.data)
