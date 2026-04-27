import api from '../api'

export interface StockItem { id: number; name: string }
export interface StockContenant { uid: string; id_cont_type: number; status: string; cont_type_name: string | null }

export const getStocks = () =>
  api.get<StockItem[]>('/stocks').then(r => r.data)

export const getStockContenants = (id: number) =>
  api.get<StockContenant[]>(`/stocks/${id}/containers`).then(r => r.data)
