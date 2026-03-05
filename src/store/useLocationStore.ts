import { create } from 'zustand';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  error: string | null;
  setLocation: (lat: number, lng: number) => void;
  setAddress: (city: string, state: string) => void;
  setError: (error: string) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  latitude: null,
  longitude: null,
  city: null,
  state: null,
  error: null,
  setLocation: (latitude, longitude) => set({ latitude, longitude, error: null }),
  setAddress: (city, state) => set({ city, state }),
  setError: (error) => set({ error }),
}));
