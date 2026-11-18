import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EXPIRY_WARNING_DAYS } from '@/features/inventory/expiry'
import { useAuth } from '@/features/auth/useAuth'
import { canReadSettings, settingsApi, type SettingsSnapshot } from './settingsApi'
import type { AuthUser } from '@/features/auth/authContext'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'

const settingsKeys = {
  live: (user: AuthUser | null) => ['live', 'settings', user?.email ?? user?.name ?? '', user?.role ?? ''] as const,
}

export function useSettings(enabled = true) {
  const { user } = useAuth()
  return useQuery<SettingsSnapshot>({
    queryKey: settingsKeys.live(user),
    queryFn: settingsApi.get,
    staleTime: 60_000,
    enabled: enabled && canReadSettings(user?.role),
  })
}

export const useExpiryWarningDays = () => useSettings().data?.expiryWarningDays ?? EXPIRY_WARNING_DAYS

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (draft: SettingsSnapshot) => settingsApi.update(draft),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKeys.live(user), settings)
      void invalidateLiveData(queryClient)
    },
  })
}
