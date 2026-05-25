import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  user: { id: number; name: string; email: string; role?: string } | null;
  token: string | null;
  refreshToken: string | null;
  login: (token: string, refreshToken: string | null, user: { id: number; name: string; email: string; role?: string }) => void;
  setToken: (token: string, refreshToken?: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      login: (token, refreshToken, user) => 
        set({ 
          isAuthenticated: true, 
          token,
          refreshToken,
          user
        }),
      setToken: (token, refreshToken) => set((state) => ({ 
        token, 
        refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken 
      })),
      logout: () => set({ isAuthenticated: false, user: null, token: null, refreshToken: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
