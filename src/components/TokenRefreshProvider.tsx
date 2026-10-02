'use client';

import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { InboxSocketLifecycle } from '@/components/InboxSocketLifecycle';

export function TokenRefreshProvider({ children }: { children: React.ReactNode }) {
  useTokenRefresh();
  return <><InboxSocketLifecycle />{children}</>;
}
