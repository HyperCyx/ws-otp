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
      const w = data.data;
      set({
        balance: w.balance,
        lockedBalance: w.locked_balance,
        totalEarned: w.total_earned,
        totalWithdrawn: w.total_withdrawn,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
