import api from '../api'

export interface ContainerStatusRef {
  status:              string
  label:               string
  allowed_transitions: string[]
}

export const getContainerStatuses = () =>
  api.get<ContainerStatusRef[]>('/ref/container-statuses').then(r => r.data)
