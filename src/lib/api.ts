import { useAuthStore } from "@/store/useAuthStore";

type FetchOptions = RequestInit & {
  headers?: Record<string, string>;
};

export const fetchWithAuth = async (url: string, options: FetchOptions = {}) => {
  const getAuthToken = () => useAuthStore.getState().token;
  const setAuthToken = (token: string) => useAuthStore.getState().setToken(token);

  let token = getAuthToken();
  
  const getHeaders = (t: string | null) => {
    const headers: Record<string, string> = { ...options.headers };
    if (t) {
      headers['Authorization'] = `Bearer ${t}`;
    }
    // Only set Content-Type to json if body is string and it's not set
    // If body is FormData, browser sets Content-Type with boundary automatically
    if (!headers['Content-Type'] && typeof options.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
  };

  let response = await fetch(url, { 
    ...options, 
    headers: getHeaders(token) 
  });

  if (response.status === 401) {
    // Try to refresh
    try {
      // Use the raw fetch here to avoid infinite recursion
      const refreshResponse = await fetch('/api/login/refresh-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`, // Try with old token
          'Content-Type': 'application/json'
        }
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newToken = refreshData.access_token;
        
        // Update store
        setAuthToken(newToken);
        
        // Retry original request
        response = await fetch(url, { 
          ...options, 
          headers: getHeaders(newToken) 
        });
      }
    } catch (e) {
      console.error("Token refresh failed", e);
    }
  }

  return response;
};
