export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  sub_categories: SubCategory[];
}

export type CategoryMutation = Omit<Category, "sub_categories">;

export interface CategoryInput {
  name: string;
}

export interface SubCategory {
  id: number;
  name: string;
  category_id: number;
}

export interface SubCategoryInput {
  name: string;
  category_id: number;
}

export interface Expense {
  id: number;
  amount: number;
  category_id: number | null;
  category_name?: string;
  sub_category_id: number | null;
  sub_category_name?: string;
  description: string;
  date: string;
}

export interface CreateExpenseInput {
  amount: number;
  category_id: number;
  sub_category_id?: number;
  description?: string;
  date: string;
}

export interface UpdateExpenseInput {
  amount?: number;
  category_id?: number;
  sub_category_id?: number | null;
  description?: string;
}

export interface ExpensePage {
  expenses: Expense[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface Dashboard {
  expenses: Expense[];
  by_category: SummaryItem[];
  by_month: SummaryItem[];
  by_day: SummaryItem[];
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface SummaryItem {
  category?: string;
  month?: string;
  day?: string;
  total: number;
  expenses?: Expense[];
}

export interface ExpenseFilters {
  category_id: string;
  search: string;
  from: string;
  to: string;
}
