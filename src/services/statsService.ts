import { fetchWithAuth } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Supplier } from "@/lib/products";

export interface StatsSummary {
  total_revenue: number;
  total_orders: number;
  completed_count: number;
  pending_count: number;
  cancelled_count: number;
  revenue_by_status: {
    completed: number;
    pending: number;
    cancelled: number;
  };
}

export interface StatsTimelineItem {
  date: string;
  amount: number;
  count: number;
}

export interface StatsResponse {
  summary: StatsSummary;
  timeline: StatsTimelineItem[];
}

export interface StatsParams {
  start_date?: string;
  end_date?: string;
  interval?: 'day' | 'week' | 'month' | 'year';
}

export const statsService = {
  getSupplierStats: async (supplierId: number, params: StatsParams = {}): Promise<StatsResponse> => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.interval) queryParams.append('interval', params.interval);

    const queryString = queryParams.toString();
    
    // Try multiple URL patterns because of potential proxy/backend path mismatches
    // 1. Try targeting /api/v1/suppliers/... (Backend: .../api/v1/...)
    // We need /api/api/v1 because proxy strips the first /api/
    let url = `/api/api/v1/suppliers/${supplierId}/stats${queryString ? `?${queryString}` : ''}`;
    
    if (process.env.NODE_ENV === "development") console.log(`[StatsService] Fetching stats from: ${url}`);
    let response = await fetchWithAuth(url);

    if (response.status === 404) {
        console.warn(`[StatsService] 404 on ${url}, trying fallback without /api prefix...`);
        // 2. Try targeting /v1/suppliers/... (Backend: .../v1/...)
        url = `/api/v1/suppliers/${supplierId}/stats${queryString ? `?${queryString}` : ''}`;
        response = await fetchWithAuth(url);
    }

    if (response.status === 404) {
        console.warn(`[StatsService] 404 on ${url}, trying fallback without v1...`);
        // 3. Try targeting /suppliers/... (Backend: .../suppliers/...)
        url = `/api/suppliers/${supplierId}/stats${queryString ? `?${queryString}` : ''}`;
        response = await fetchWithAuth(url);
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error(`[StatsService] Failed to fetch statistics. Status: ${response.status}. URL: ${url}. Response: ${errorText}`);
      throw new Error(`Failed to fetch statistics: ${response.status} ${response.statusText}`);
    }
    return response.json();
  },

  // Helper to get current supplier ID
  getCurrentSupplier: async (): Promise<Supplier | null> => {
    const user = useAuthStore.getState().user;
    if (!user) return null;

    try {
      const response = await fetchWithAuth('/api/suppliers');
      if (response.ok) {
        const data = await response.json();
        const items: Supplier[] = Array.isArray(data) ? data : data.items || [];
        return items.find((s: Supplier) => s.user_id === user.id) || null;
      }
    } catch (error) {
      console.error("Error fetching current supplier:", error);
    }
    return null;
  }
};
