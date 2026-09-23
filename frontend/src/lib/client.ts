type ApiResponse<T = unknown> = { data: T; status: number };

type ApiError = Error & {
  response?: { status: number; data: { error?: string; message?: string } };
  code?: string;
};

// v84-friendly-api-errors
function friendlyHttpError(status: number, rawText = '') {
  const text = rawText.trim();
  const looksHtml = /<!doctype html|<html|<body|<pre/i.test(text);
  if (!looksHtml && text && text.length <= 300) return text;
  if (status === 401) return 'Sesi login Anda sudah berakhir. Silakan login kembali lalu ulangi proses.';
  if (status === 403) return 'Anda tidak memiliki akses untuk melakukan proses ini.';
  if (status === 404) return 'Layanan yang diminta belum tersedia. Silakan muat ulang halaman dan coba lagi.';
  if (status === 409) return 'Data belum dapat diproses karena ada kondisi yang perlu diperiksa terlebih dahulu.';
  if (status >= 500) return 'Server sedang mengalami gangguan. Perubahan terakhir mungkin belum tersimpan. Silakan coba lagi beberapa saat.';
  return 'Permintaan belum berhasil diproses. Perubahan terakhir mungkin belum tersimpan. Silakan coba lagi.';
}

async function request<T = unknown>(method: string, url: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const serverMessage = data && typeof data === 'object' && ('error' in data || 'message' in data)
      ? String((data as { error?: string; message?: string }).error || (data as { error?: string; message?: string }).message || '')
      : '';
    const message = serverMessage || friendlyHttpError(response.status, typeof data === 'string' ? data : '');
    const err = new Error(message) as ApiError;
    err.response = { status: response.status, data: { error: message } };
    throw err;
  }
  return { data: data as T, status: response.status };
}

export const api = {
  get: <T = unknown>(url: string) => request<T>('GET', url),
  post: <T = unknown>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T = unknown>(url: string, body?: unknown) => request<T>('PUT', url, body),
  delete: <T = unknown>(url: string) => request<T>('DELETE', url),
};

export const auth = {
  async getUser() {
    try {
      const response = await request<{ user: unknown }>('GET', '/api/auth/me');
      return response.data.user;
    } catch (err) {
      const status = (err as ApiError).response?.status;
      if (status === 401) return null;
      throw err;
    }
  },
  async signIn(credentials: { email: string; password: string }) {
    const response = await request<{ user: unknown }>('POST', '/api/auth/login', credentials);
    return response.data;
  },
  async signOut() {
    await request('POST', '/api/auth/logout', {});
  },
};
