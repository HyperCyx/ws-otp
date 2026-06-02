import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/client';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (initData) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post('/auth/telegram', { initData });
          set({
            token: data.data.token,
            user: data.data.user,
            isAuthenticated: true,
            isLoading: false,
          });
          return data.data;
        } catch (err) {
          const message = err.response?.data?.message || 'Authentication failed';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false, error: null });
      },

      updateUser: (updates) => {
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null }));
      },
    }),
    {
      name: 'auth-storage', // localStorage key
      // Only persist the fields needed to restore the session
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
