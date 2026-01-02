import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  user: { name: string; email: string } | null;
  token: string | null;
  login: (token: string, email: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      login: (token, email) => 
        set({ 
          isAuthenticated: true, 
          token,
          // Since we don't have a profile endpoint yet, we'll use the email/username as the name or extract it later
          user: { name: email.split('@')[0], email } 
        }),
      logout: () => set({ isAuthenticated: false, user: null, token: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
