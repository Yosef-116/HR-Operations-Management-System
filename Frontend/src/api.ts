import type { ApiResponse, User } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const tokenKey = 'hr_token';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const tokenStore = {
  get: () => sessionStorage.getItem(tokenKey),
  set: (token: string) => sessionStorage.setItem(tokenKey, token),
  clear: () => sessionStorage.removeItem(tokenKey)
};

export async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = tokenStore.get();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({ message: `Request failed: ${response.status}` }));
  if (!response.ok) throw new ApiError(body.message ?? 'Request failed', response.status);
  return body;
}

export const authApi = {
  login: (email: string, password: string) => request<{ token: string; user: User }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password })
  }),
  me: () => request<User>('/auth/me')
};
