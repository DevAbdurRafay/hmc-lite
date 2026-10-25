const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('hcmlite_token');
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

  // Smart request timeout: 5 minutes for bulk imports & uploads, 45 seconds for regular API calls
  const isUpload = options.body instanceof FormData || cleanEndpoint.includes('csv') || cleanEndpoint.includes('import') || cleanEndpoint.includes('upload');
  const timeoutMs = isUpload ? 300000 : 45000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
  } catch (netErr: any) {
    clearTimeout(timeoutId);
    if (netErr.name === 'AbortError') {
      const timeoutError: any = new Error('Server request took longer than expected for large data processing. Please try again.');
      timeoutError.code = 'REQUEST_TIMEOUT';
      throw timeoutError;
    }
    const connectError: any = new Error('Unable to connect to backend server at http://localhost:8000. Please ensure it is running.');
    connectError.code = 'NETWORK_ERROR';
    throw connectError;
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401) {
    localStorage.removeItem('hcmlite_token');
    localStorage.removeItem('hcmlite_user');
    window.dispatchEvent(new Event('auth-unauthorized'));
  }

  if (!response.ok) {
    let errorMessage = 'Something went wrong. Please check your information and try again.';
    let errorCode = 'HTTP_ERROR';
    let details: any = null;

    try {
      const json = await response.json();
      if (json.message && typeof json.message === 'string') {
        errorMessage = json.message;
      } else if (json.detail) {
        if (typeof json.detail === 'string') {
          errorMessage = json.detail;
        } else if (Array.isArray(json.detail)) {
          errorMessage = json.detail
            .map((d: any) => (d.msg ? d.msg.replace(/^Value error,\s*/i, '') : String(d)))
            .join(' • ');
        } else if (typeof json.detail === 'object' && json.detail.message) {
          errorMessage = json.detail.message;
        }
      }
      if (json.code) {
        errorCode = json.code;
      } else if (json.detail && typeof json.detail === 'object' && json.detail.code) {
        errorCode = json.detail.code;
      }
      details = json.details || json.detail;
    } catch {
      // Non-JSON error fallback
      if (response.status === 401) {
        errorMessage = 'Invalid email or password. Please try again.';
      } else if (response.status === 403) {
        errorMessage = 'You do not have permission to perform this action.';
      } else if (response.status === 404) {
        errorMessage = 'Requested item not found.';
      } else if (response.status >= 500) {
        errorMessage = 'Server error occurred. Please try again.';
      }
    }

    // Special friendly overrides for common HTTP codes
    if (response.status === 401 && (!errorMessage || errorMessage.includes('Request failed'))) {
      errorMessage = 'Invalid email or password. Please try again.';
    }

    const errorObj: any = new Error(errorMessage);
    errorObj.code = errorCode;
    errorObj.message = errorMessage;
    errorObj.details = details;
    errorObj.status = response.status;
    errorObj.response = { data: { detail: errorMessage } };
    throw errorObj;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Attendance
  getDailyAttendance: (date: string) => apiFetch<any>(`/attendance/daily?date=${date}`),
  getMyAttendance: () => apiFetch<any[]>('/attendance/my-records'),
  getAttendanceCorrections: () => apiFetch<any[]>('/attendance/corrections'),
  checkIn: (data?: any) =>
    apiFetch<any>('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  checkOut: (data?: any) =>
    apiFetch<any>('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  requestCorrection: (data: any) =>
    apiFetch<any>('/attendance/corrections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reviewCorrection: (id: string, data: any) =>
    apiFetch<any>(`/attendance/corrections/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  adminManualCheckout: (employeeId: number | string) =>
    apiFetch<any>(`/attendance/admin-checkout/${employeeId}`, {
      method: 'POST',
    }),
  getAttendanceReport: (employeeId?: number | string, month?: number, year?: number) => {
    const params = new URLSearchParams();
    if (employeeId) params.append('employee_id', String(employeeId));
    if (month) params.append('month', String(month));
    if (year) params.append('year', String(year));
    return apiFetch<any>(`/attendance/report?${params.toString()}`);
  },

  // Leaves
  getLeaveTypes: () => apiFetch<any[]>('/leave/types'),
  createLeaveType: (data: any) =>
    apiFetch<any>('/leave/types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMyLeaveBalance: () => apiFetch<any[]>('/leave/my-balances'),
  getMyLeaveRequests: () => apiFetch<any[]>('/leave/my-requests'),
  getPendingLeaves: () => apiFetch<any[]>('/leave/pending'),
  applyLeave: (data: any) =>
    apiFetch<any>('/leave/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelLeave: (id: string) =>
    apiFetch<any>(`/leave/${id}/cancel`, {
      method: 'POST',
    }),
  reviewLeave: (id: string, data: any) =>
    apiFetch<any>(`/leave/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // AI
  parseSmartLeave: (text: string) =>
    apiFetch<any>('/ai/smart-leave', {
      method: 'POST',
      body: JSON.stringify({ prompt: text }),
    }),

  // Payroll
  getPayrollRuns: () => apiFetch<any[]>('/payroll/runs'),
  getPayrollRun: (id: string) => apiFetch<any>(`/payroll/runs/${id}`),
  getMyPayslips: () => apiFetch<any[]>('/payroll/my-payslips'),
  generatePayrollDraft: (data: { month: number; year: number }) =>
    apiFetch<any>('/payroll/runs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  finalizePayrollRun: (id: string) =>
    apiFetch<any>(`/payroll/runs/${id}/finalize`, {
      method: 'POST',
    }),
  downloadPayslipPdf: async (id: string): Promise<Blob> => {
    const token = localStorage.getItem('hcmlite_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const url = `${API_BASE_URL}/api/v1/payroll/payslips/${id}/pdf`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to download PDF');
    return res.blob();
  },

  // Organization Setup
  getCompanySettings: () => apiFetch<any>('/org/settings'),
  updateCompanySettings: (data: any) =>
    apiFetch<any>('/org/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getDepartments: () => apiFetch<any[]>('/org/departments'),
  createDepartment: (data: any) =>
    apiFetch<any>('/org/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getDesignations: () => apiFetch<any[]>('/org/designations'),
  createDesignation: (data: any) =>
    apiFetch<any>('/org/designations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getHolidays: () => apiFetch<any[]>('/org/holidays'),
  createHoliday: (data: any) =>
    apiFetch<any>('/org/holidays', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // User Accounts
  getUsers: () => apiFetch<any[]>('/auth/users'),
  createHR: (data: any) =>
    apiFetch<any>('/auth/create-hr', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deactivateUser: (id: string | number) =>
    apiFetch<any>(`/auth/users/${id}/deactivate`, {
      method: 'POST',
    }),
  activateUser: (id: string | number) =>
    apiFetch<any>(`/auth/users/${id}/activate`, {
      method: 'POST',
    }),
  resetUserPassword: (id: string | number) =>
    apiFetch<any>(`/auth/users/${id}/reset-password`, {
      method: 'POST',
    }),
  logout: () =>
    apiFetch<any>('/auth/logout', {
      method: 'POST',
    }),

  // Announcements
  getAnnouncements: () => apiFetch<any[]>('/comms/announcements'),
  createAnnouncement: (data: any) =>
    apiFetch<any>('/comms/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Audit Logs
  getAuditLogs: (params?: { action?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.action) q.append('action', params.action);
    if (params?.limit) q.append('limit', String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return apiFetch<any[]>(`/audit/logs${qs}`);
  },
};

export default api;
