export interface Product {
  id: number;
  name: string;
  description: string;
  unit_price: number;
  unit_weight: number;
  category_id: number;
  category_name?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Status {
  id: number;
  name: string;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  vat?: number | null;
  discount?: number | null;
}

export interface OrderHeader {
  id: number;
  approved_at: string | null;
  status_id: number;
  status_name?: string;
  user_name: string;
  email: string;
  phone: string;
  created_at?: string;
}

export interface Opinion {
  id: number;
  rating: number;
  content: string;
  created_at: string;
}

export type OrderDetails = OrderHeader & { items: OrderItem[]; opinions?: Opinion[] };

export interface OrderResponse {
  id: number;
  status_id: number;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface RequestOptions {
  method?: string;
  data?: unknown;
  token?: string;
}

interface ApiErrorPayload {
  error?: string;
  message?: string;
  details?: unknown;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', data, token } = options;
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (data !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body,
  });

  const text = await response.text();
  let payload: ApiErrorPayload | null = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message = payload?.error || payload?.message || 'Wystąpił błąd serwera';
    const err = new Error(message) as Error & { status?: number; details?: unknown };
    err.status = response.status;
    err.details = payload?.details;
    throw err;
  }

  return (payload as T) ?? (null as T);
}

export const api = {
  fetchProducts: () => request<Product[]>('/products'),
  fetchCategories: () => request<Category[]>('/categories'),
  fetchStatuses: () => request<Status[]>('/status'),
  fetchOrders: (token: string) => request<OrderHeader[]>('/orders', { token }),
  fetchOrderDetails: (token: string, id: number) => request<OrderDetails>(`/orders/${id}`, { token }),
  fetchOrdersByStatus: (token: string, statusId: number) =>
    request<OrderHeader[]>(`/orders/status/${statusId}`, { token }),
  fetchUserOrders: (token: string, username: string) => request<OrderHeader[]>(`/orders/user/${username}`, { token }),

  addOpinion: (token: string, orderId: number, rating: number, content: string) =>
    request<{ success: boolean; order_id: number }>(`/orders/${orderId}/opinions`, { method: 'POST', data: { rating, content }, token }),
  login: (credentials: { username: string; password: string }) =>
    request<Tokens>('/login', { method: 'POST', data: credentials }),
  register: (payload: { username: string; password: string }) =>
    request('/register', { method: 'POST', data: payload }),
  createOrder: (payload: unknown) => request<OrderResponse>('/orders', { method: 'POST', data: payload }),
  updateProduct: (token: string, id: number, payload: unknown) =>
    request(`/products/${id}`, { method: 'PUT', data: payload, token }),
  changeOrderStatus: (token: string, id: number, status_id: number) =>
    request(`/orders/${id}`, { method: 'PATCH', data: { status_id }, token }),
  getSeoDescription: (token: string, id: number) => request<{ description?: string; message?: string }>(`/products/${id}/seo-description`, { token }),
  initializeDb: (token: string, data: unknown) => request<{ success: boolean; count: number }>('/init', { method: 'POST', data, token }),
};

export { API_URL };
