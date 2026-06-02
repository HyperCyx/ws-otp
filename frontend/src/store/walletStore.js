import { create } from 'zustand';
import api from '../api/client';

export const useWalletStore = create((set) => ({
  balance: '0.0000',
  lockedBalance: '0.0000',
  totalEarned: '0.0000',
  totalWithdrawn: '0.0000',
  isLoading: false,

  fetchWallet: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/wallet');
      const w = data?.data;
      if (!w) return; // API returned unexpected shape — keep existing state
      set({
        balance: w.balance ?? '0.0000',
        lockedBalance: w.locked_balance ?? '0.0000',
        totalEarned: w.total_earned ?? '0.0000',
        totalWithdrawn: w.total_withdrawn ?? '0.0000',
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
