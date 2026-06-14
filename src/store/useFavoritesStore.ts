import { create } from 'zustand';
import { fetchWithAuth } from '@/lib/api';
import { Product } from '@/lib/products';

interface FavoritesState {
  favorites: Set<string>;
  isLoading: boolean;
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (productId: string) => Promise<boolean>; // Returns true if added, false if removed
  isFavorite: (productId: string) => boolean;
  syncFavorites: (products: (Product & { is_favorite?: boolean })[]) => void;
  clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: new Set(),
  isLoading: false,

  syncFavorites: (products: (Product & { is_favorite?: boolean })[]) => {
    const { favorites } = get();
    const newFavorites = new Set(favorites);
    let changed = false;

    if (!Array.isArray(products)) {
        console.warn("syncFavorites: products is not an array", products);
        return;
    }

    products.forEach(p => {
      if (!p) return;
      // The API returns is_favorite as boolean if authenticated
      if (typeof p.is_favorite === 'boolean') {
        if (p.is_favorite) {
          if (!newFavorites.has(String(p.id))) {
            newFavorites.add(String(p.id));
            changed = true;
          }
        } else {
          // If explicit false from API, remove from local state
          // This keeps local state in sync with server truth
          if (newFavorites.has(String(p.id))) {
            newFavorites.delete(String(p.id));
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
      if (process.env.NODE_ENV === "development") console.log("fetchFavorites: calling API...");
      const response = await fetchWithAuth('/api/favorites/?limit=1000'); // Get enough
      if (process.env.NODE_ENV === "development") console.log(`fetchFavorites: status ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        let text = '';
        try {
            text = await response.text();
            // if (process.env.NODE_ENV === "development") console.log("fetchFavorites: raw response", text.substring(0, 100)); // Log first 100 chars
            if (!text) {
                console.warn("fetchFavorites: Empty response body");
                set({ favorites: new Set() });
                return;
            }
            const data = JSON.parse(text);
            
            if (Array.isArray(data)) {
                const ids = new Set<string>();
            data.forEach((item: any) => {
                if (item && item.id) {
                    ids.add(String(item.id));
                }
            });
            set({ favorites: ids });
        } else if (data && typeof data === 'object') {
             // Handle paginated responses just in case (e.g. { items: [...] })
             const items = (data as any).items || (data as any).results || (data as any).data;
             if (Array.isArray(items)) {
                const ids = new Set<string>();
                items.forEach((item: any) => {
                    if (item && item.id) {
                        ids.add(String(item.id));
                    }
                });
                set({ favorites: ids });
             } else {
                console.warn('fetchFavorites: Expected array or paginated list but got', data);
             }
        } else {
            console.error('fetchFavorites: Unexpected response format', data);
        }
        } catch (e) {
             console.error("fetchFavorites: Failed to parse response", e, text);
        }
      } else {
         console.warn(`fetchFavorites: Failed with status ${response.status}`);
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
