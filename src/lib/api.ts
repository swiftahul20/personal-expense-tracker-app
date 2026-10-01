import type {
  AuthResponse,
  Category,
  CategoryInput,
  CategoryMutation,
  CreateExpenseInput,
  Dashboard,
  Expense,
  ExpensePage,
  SubCategory,
  SubCategoryInput,
  SummaryItem,
  UpdateExpenseInput,
  User,
} from "../types";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.replace(/\/$/, "");
const ACCESS_TOKEN_KEY = "ledger_access_token";
const REFRESH_TOKEN_KEY = "ledger_refresh_token";

let refreshRequest: Promise<boolean> | null = null;
let authFailureHandler: (() => void) | null = null;

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function throwApiError(response: Response): Promise<never> {
  let message = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // Keep the status-based message when the response is not JSON.
  }
  throw new ApiError(message, response.status);
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasTokens() {
  return Boolean(
    localStorage.getItem(ACCESS_TOKEN_KEY) &&
    localStorage.getItem(REFRESH_TOKEN_KEY),
  );
}

export function setAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler;
}

async function refreshTokens() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!API_BASE_URL || !refreshToken) return false;

  if (!refreshRequest) {
    refreshRequest = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const tokens = (await response.json()) as Pick<
          AuthResponse,
          "access_token" | "refresh_token"
        >;
        saveTokens(tokens.access_token, tokens.refresh_token);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  canRefresh = true,
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "Add VITE_API_BASE_URL to .env.local to connect your expense API.",
    );
  }

  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");

  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status === 401 && canRefresh && path !== "/auth/refresh") {
    if (await refreshTokens()) return request<T>(path, init, false);
    authFailureHandler?.();
  }

  if (!response.ok) {
    await throwApiError(response);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function requestBlob(
  path: string,
  init: RequestInit = {},
  canRefresh = true,
): Promise<Blob> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "VITE_API_BASE_URL to .env.local to connect your expense API.",
    );
  }

  const headers = new Headers(init.headers);
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status === 401 && canRefresh && path !== "/auth/refresh") {
    if (await refreshTokens()) return requestBlob(path, init, false);
    authFailureHandler?.();
  }

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.blob();
}

export const api = {
  request,
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/auth/me"),
  logout: (refreshToken: string) =>
    request<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
  listExpenses: (query: URLSearchParams) =>
    request<ExpensePage>(`/expenses?${query.toString()}`),
  exportExpenses: (query: URLSearchParams) =>
    requestBlob(`/expenses/export?${query.toString()}`),
  getExpense: (id: number) => request<Expense>(`/expenses/${id}`),
  createExpense: (expense: CreateExpenseInput) =>
    request<Expense>("/expenses", {
      method: "POST",
      body: JSON.stringify(expense),
    }),
  updateExpense: (id: number, expense: UpdateExpenseInput) =>
    request<Expense>(`/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(expense),
    }),
  deleteExpense: (id: number) =>
    request<void>(`/expenses/${id}`, { method: "DELETE" }),
  listCategories: () => request<Category[]>("/categories"),
  createCategory: (input: CategoryInput) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCategory: (id: number, input: CategoryInput) =>
    request<CategoryMutation>(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteCategory: (id: number) =>
    request<void>(`/categories/${id}`, { method: "DELETE" }),
  createSubCategory: (categoryId: number, input: SubCategoryInput) =>
    request<SubCategory>(`/categories/${categoryId}/sub-categories`, {
      method: "POST",
      body: JSON.stringify({ name: input.name }),
    }),
  updateSubCategory: (
    _categoryId: number,
    id: number,
    input: SubCategoryInput,
  ) =>
    request<SubCategory>(`/sub-categories/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name: input.name }),
    }),
  deleteSubCategory: (_categoryId: number, id: number) =>
    request<void>(`/sub-categories/${id}`, {
      method: "DELETE",
    }),
  categorySummary: () => request<SummaryItem[]>("/summary/category"),
  monthSummary: () => request<SummaryItem[]>("/summary/month"),
  daySummary: () => request<SummaryItem[]>("/summary/day"),
  dashboard: () => request<Dashboard>("/dashboard"),
};
