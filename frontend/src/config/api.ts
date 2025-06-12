// Configuración de la API
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  ENDPOINTS: {
    ACCOUNTS: "/api/accounts",
    QUEUE: {
      ADD: "/api/queue/add",
      STATUS: "/api/queue/status",
      CANCEL: (id: string) => `/api/queue/cancel/${id}`,
      DELETE: (id: string) => `/api/queue/${id}`,
    },
    METRICS: {
      REALTIME: "/api/metrics/realtime",
    },
    TWEETS: "/api/tweets",
    ACCOUNT_LIMITS: "/api/account-limits",
  },
};

// Función helper para construir URLs completas
export const buildApiUrl = (
  endpoint: string,
  params?: Record<string, string | number>
) => {
  let url = `${API_CONFIG.BASE_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, value.toString());
    });
    url += `?${searchParams.toString()}`;
  }

  return url;
};
