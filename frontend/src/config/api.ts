// Configuración de la API
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  ENDPOINTS: {
    ACCOUNTS: {
      BASE: "/accounts",
    },
    AUTH: {
      ME: "/api/auth/me",
      LOGIN: "/api/auth/login",
      LOGOUT: "/api/auth/logout",
      REGISTER: "/api/auth/register",
    },
    QUEUE: {
      ADD: "/queue/add",
      STATUS: "/queue/status",
      CANCEL: (id: string) => `/queue/scheduled/${id}`,
      DELETE: (id: string) => `/queue/${id}`,
      CLEAR_ALL: "/queue/all",
    },
    SCHEDULE: "/api/schedule",
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
