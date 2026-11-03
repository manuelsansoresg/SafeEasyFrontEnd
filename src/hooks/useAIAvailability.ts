'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAIAvailability } from '@/services/aiQuotaService';
import { useAuthStore } from '@/store/useAuthStore';

export function useAIAvailability(supplierId?: number) {
  const userId = useAuthStore(s => s.user?.id);
  const query = useQuery({
    queryKey: ['ai-availability', userId, supplierId],
    queryFn: ({ signal }) => getAIAvailability(supplierId!, signal),
    enabled: !!userId && !!supplierId,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: 'always',
  });
  const { refetch } = query;
  useEffect(() => {
    if (!supplierId || !userId) return;
    const refresh = () => { if (document.visibilityState === 'visible') void refetch(); };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [supplierId, userId, refetch]);
  return query;
}
