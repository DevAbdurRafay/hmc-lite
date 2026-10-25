import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000'; // 10.0.2.2 for Android emulator, localhost for iOS simulator

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync('hcmlite_token');
  } catch {
    // secure store not available or errored
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}/api/v1${cleanEndpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    try {
      await SecureStore.deleteItemAsync('hcmlite_token');
    } catch {}
  }

  if (!response.ok) {
    let errorDetail = `Request failed (${response.status})`;
    try {
      const json = await response.json();
      if (json.detail) {
        errorDetail = typeof json.detail === 'string' ? json.detail : JSON.stringify(json.detail);
      }
    } catch {}
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
