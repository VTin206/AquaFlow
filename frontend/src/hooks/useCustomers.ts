import { useQuery } from '@tanstack/react-query'
import { customerService } from '../services/customers'

export const customerKeys = { all: ['customers'] as const }

export const useCustomers = () => useQuery({ queryKey: customerKeys.all, queryFn: customerService.list })
