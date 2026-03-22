const BASE = '/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Stats
  getStats: () => request<any>('/stats'),

  // Deliveries
  getDeliveries: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<any>(`/deliveries${q ? '?' + q : ''}`);
  },

  // Subscriptions
  getSubscriptions: () => request<any>('/subscriptions'),
  createSubscription: (data: any) => request<any>('/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  updateSubscription: (id: string, data: any) => request<any>(`/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubscription: (id: string) => request<any>(`/subscriptions/${id}`, { method: 'DELETE' }),

  // DLQ
  getDLQ: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<any>(`/dlq${q ? '?' + q : ''}`);
  },
  retryDLQ: (id: string) => request<any>(`/dlq/${id}/retry`, { method: 'POST' }),
  purgeDLQ: (id: string) => request<any>(`/dlq/${id}`, { method: 'DELETE' }),
};