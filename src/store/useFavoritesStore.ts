import { create } from 'zustand';
import { fetchWithAuth } from '@/lib/api';

interface FavoritesState {
  favorites: Set<string>;
  isLoading: boolean;
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (productId: string) => Promise<boolean>; // Returns true if added, false if removed
  isFavorite: (productId: string) => boolean;
  syncFavorites: (products: any[]) => void;
  clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: new Set(),
  isLoading: false,

  syncFavorites: (products: any[]) => {
    const { favorites } = get();
    const newFavorites = new Set(favorites);
    let changed = false;

    products.forEach(p => {
      // The API returns is_favorite as boolean if authenticated
      if (typeof p.is_favorite === 'boolean') {
        if (p.is_favorite) {
          if (!newFavorites.has(p.id)) {
            newFavorites.add(p.id);
            changed = true;
          }
        } else {
          // If explicit false from API, remove from local state
          // This keeps local state in sync with server truth
          if (newFavorites.has(p.id)) {
            newFavorites.delete(p.id);
            changed = true;
          }
        }
      }
    });

    if (changed) {
      set({ favorites: newFavorites });
    }
  },

  fetchFavorites: async () => {
    set({ isLoading: true });
    try {
      // Fetch only IDs if possible, or fetch all and map
      // The API docs say GET /favorites/ returns full product objects.
      // We'll extract IDs from there.
      const response = await fetchWithAuth('/api/favorites/?limit=1000'); // Get enough
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
            const ids = new Set<string>(data.map((item: { id: string }) => String(item.id)));
            set({ favorites: ids });
        } else {
            console.error('fetchFavorites: Expected array but got', data);
        }
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  toggleFavorite: async (productId: string) => {
    const { favorites } = get();
    const isFav = favorites.has(productId);
    
    // Optimistic update
    const newFavorites = new Set(favorites);
    if (isFav) {
      newFavorites.delete(productId);
    } else {
      newFavorites.add(productId);
    }
    set({ favorites: newFavorites });

    try {
      if (isFav) {
        // Remove
        const res = await fetchWithAuth(`/api/favorites/${productId}`, { method: 'DELETE' });
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Failed to remove favorite (${res.status}):`, errorText);
          throw new Error(`Failed to remove favorite: ${res.status}`);
        }
        return false;
      } else {
        // Add
        const res = await fetchWithAuth(`/api/favorites/${productId}`, { 
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Failed to add favorite (${res.status}):`, errorText);
          throw new Error(`Failed to add favorite: ${res.status}`);
        }
        return true;
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // Revert on error
      set({ favorites }); // Reset to original state
      throw error;
    }
  },

  isFavorite: (productId: string) => {
    return get().favorites.has(productId);
  },

  clearFavorites: () => {
    set({ favorites: new Set() });
  }
}));
