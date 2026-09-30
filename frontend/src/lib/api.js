const API_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const TOKEN_KEY = "queueflow_access_token";
const USER_KEY = "queueflow_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiRequest(
  path,
  { method = "GET", body, token = getToken(), signal } = {}
) {
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Backend இணைக்க முடியவில்லை. Server மற்றும் CORS சரிபாருங்கள்."
    );
  }

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const error = new Error(
        `Backend response error (${response.status})`
      );
      error.status = response.status;
      throw error;
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    if (typeof data?.detail === "string") {
      message = data.detail;
    } else if (Array.isArray(data?.detail)) {
      message = data.detail
        .map((item) => {
          const field = Array.isArray(item.loc)
            ? item.loc.join(".")
            : "";

          return field ? `${field}: ${item.msg}` : item.msg;
        })
        .join("\n");
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

function query(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const result = params.toString();
  return result ? `?${result}` : "";
}

// Authentication
export function loginUser(email, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    token: null,
    body: {
      email: email.trim().toLowerCase(),
      password,
    },
  });
}

export function getCurrentUser(token = getToken()) {
  return apiRequest("/auth/me", { token });
}

export async function signIn(email, password) {
  const data = await loginUser(email, password);

  if (!data?.access_token) {
    throw new Error("Login token கிடைக்கவில்லை.");
  }

  const user = await getCurrentUser(data.access_token);
  const role = String(user?.role || "").toUpperCase();

  if (!["ADMIN", "STAFF", "CUSTOMER"].includes(role)) {
    throw new Error("User role சரியாக இல்லை.");
  }

  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  return user;
}

export function registerUser(data) {
  return apiRequest("/auth/register", {
    method: "POST",
    token: null,
    body: {
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
    },
  });
}

// Branches
export const branchesApi = {
  list: () => apiRequest("/branches/"),

  get: (id) => apiRequest(`/branches/${id}`),

  create: (data) =>
    apiRequest("/branches/", {
      method: "POST",
      body: data,
    }),

  update: (id, data) =>
    apiRequest(`/branches/${id}`, {
      method: "PUT",
      body: data,
    }),

  remove: (id) =>
    apiRequest(`/branches/${id}`, {
      method: "DELETE",
    }),
};

// Services
export const servicesApi = {
  list: (branchId) =>
    apiRequest(`/services/${query({ branch_id: branchId })}`),

  get: (id) => apiRequest(`/services/${id}`),

  create: (data) =>
    apiRequest("/services/", {
      method: "POST",
      body: data,
    }),

  update: (id, data) =>
    apiRequest(`/services/${id}`, {
      method: "PUT",
      body: data,
    }),

  remove: (id) =>
    apiRequest(`/services/${id}`, {
      method: "DELETE",
    }),
};

// Counters
export const countersApi = {
  list: (filters = {}) =>
    apiRequest(`/counters/${query(filters)}`),

  get: (id) => apiRequest(`/counters/${id}`),

  create: (data) =>
    apiRequest("/counters/", {
      method: "POST",
      body: data,
    }),

  update: (id, data) =>
    apiRequest(`/counters/${id}`, {
      method: "PUT",
      body: data,
    }),

  remove: (id) =>
    apiRequest(`/counters/${id}`, {
      method: "DELETE",
    }),
};

// Customer tickets and Staff operations
export const ticketsApi = {
  create: (branchId, serviceId) =>
    apiRequest("/queue-tickets/", {
      method: "POST",
      body: {
        branch_id: Number(branchId),
        service_id: Number(serviceId),
      },
    }),

  my: () => apiRequest("/queue-tickets/my"),

  get: (id) => apiRequest(`/queue-tickets/${id}`),

  // Protected Staff list, including customer names.
  staff: (branchId) =>
    apiRequest(
      `/queue-tickets/staff${query({ branch_id: branchId })}`
    ),

  // Customer can cancel their own WAITING ticket.
  cancel: (id) =>
    apiRequest(`/queue-tickets/${id}/cancel`, {
      method: "PUT",
    }),

  callNext: (counterId) =>
    apiRequest(`/queue-tickets/call-next/${counterId}`, {
      method: "POST",
    }),

  updateStatus: (id, status) =>
    apiRequest(`/queue-tickets/${id}/status`, {
      method: "PUT",
      body: { status },
    }),

  startServing: (id) =>
    ticketsApi.updateStatus(id, "SERVING"),

  complete: (id) =>
    ticketsApi.updateStatus(id, "COMPLETED"),

  markMissed: (id) =>
    ticketsApi.updateStatus(id, "MISSED"),
};

// Admin user and Staff management
export const usersApi = {
  list: () => apiRequest("/users/"),

  get: (id) => apiRequest(`/users/${id}`),

  createStaff: (data) =>
    apiRequest("/users/staff", {
      method: "POST",
      body: {
        full_name: data.full_name.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
      },
    }),

  updateRole: (id, role) =>
    apiRequest(`/users/${id}/role`, {
      method: "PUT",
      body: { role },
    }),
};

// Public Live Board
export function getBoardTickets(branchId) {
  return apiRequest(
    `/queue-tickets/board${query({ branch_id: branchId })}`,
    { token: null }
  );
}