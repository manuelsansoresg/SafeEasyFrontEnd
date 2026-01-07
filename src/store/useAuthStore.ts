import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  user: { id: number; name: string; email: string } | null;
  token: string | null;
  refreshToken: string | null;
  login: (token: string, refreshToken: string | null, user: { id: number; name: string; email: string }) => void;
  setToken: (token: string) => void;
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
      setToken: (token) => set({ token }),
      logout: () => set({ isAuthenticated: false, user: null, token: null, refreshToken: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
