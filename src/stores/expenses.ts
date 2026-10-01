import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { api } from "../lib/api";
import type {
  CreateExpenseInput,
  Expense,
  ExpenseFilters,
  SummaryItem,
  UpdateExpenseInput,
} from "../types";
import { useAuthStore } from "./auth";

export const demoExpenses: Expense[] = [
  {
    id: 1,
    amount: 128000,
    category_id: 1,
    category_name: "Food",
    sub_category_id: 1,
    sub_category_name: "Coffee & lunch",
    description: "Slow morning at Kurasu",
    date: "2026-09-27T09:30:00.000Z",
  },
  {
    id: 2,
    amount: 45000,
    category_id: 2,
    category_name: "Transport",
    sub_category_id: 2,
    sub_category_name: "Ride share",
    description: "Ride to the studio",
    date: "2026-09-26T08:10:00.000Z",
  },
  {
    id: 3,
    amount: 342000,
    category_id: 3,
    category_name: "Home",
    sub_category_id: 3,
    sub_category_name: "Groceries",
    description: "Sunday market run",
    date: "2026-09-25T11:45:00.000Z",
  },
  {
    id: 4,
    amount: 89000,
    category_id: 1,
    category_name: "Food",
    sub_category_id: 4,
    sub_category_name: "Dinner",
    description: "Noodles for dinner",
    date: "2026-09-24T18:15:00.000Z",
  },
  {
    id: 5,
    amount: 215000,
    category_id: 4,
    category_name: "Wellbeing",
    sub_category_id: 5,
    sub_category_name: "Fitness",
    description: "Monthly climbing pass",
    date: "2026-09-22T14:00:00.000Z",
  },
  {
    id: 6,
    amount: 76000,
    category_id: 2,
    category_name: "Transport",
    sub_category_id: 6,
    sub_category_name: "Transit",
    description: "Weekly metro top-up",
    date: "2026-09-20T07:20:00.000Z",
  },
  {
    id: 7,
    amount: 156000,
    category_id: 5,
    category_name: "Shopping",
    sub_category_id: 7,
    sub_category_name: "Books",
    description: "A little night reading",
    date: "2026-09-18T15:40:00.000Z",
  },
];

const emptyFilters = (): ExpenseFilters => ({
  category_id: "",
  search: "",
  from: "",
  to: "",
});

export const useExpensesStore = defineStore("expenses", () => {
  const auth = useAuthStore();
  const expenses = ref<Expense[]>([]);
  const categories = ref<SummaryItem[]>([]);
  const months = ref<SummaryItem[]>([]);
  const days = ref<SummaryItem[]>([]);
  const filters = ref<ExpenseFilters>(emptyFilters());
  const loading = ref(false);
  const error = ref("");
  const summaryLoading = ref(false);
  const summaryError = ref("");
  const totalCount = ref(0);
  const visibleExpenses = computed(() => expenses.value);

  function reset() {
    expenses.value = [];
    categories.value = [];
    months.value = [];
    days.value = [];
    filters.value = emptyFilters();
    totalCount.value = 0;
    error.value = "";
    summaryError.value = "";
  }

  watch(
    () => auth.user?.id,
    () => reset(),
  );

  async function loadExpenses() {
    loading.value = true;
    error.value = "";
    try {
      if (auth.previewMode) {
        const query = filters.value;
        expenses.value = demoExpenses
          .filter(
            (expense) =>
              !query.category_id ||
              String(expense.category_id) === query.category_id,
          )
          .filter(
            (expense) =>
              !query.search ||
              `${expense.description} ${expense.category_name ?? ""}`
                .toLowerCase()
                .includes(query.search.toLowerCase()),
          )
          .filter(
            (expense) => !query.from || expense.date.slice(0, 10) >= query.from,
          )
          .filter(
            (expense) => !query.to || expense.date.slice(0, 10) <= query.to,
          );
        totalCount.value = expenses.value.length;
      } else {
        const query = new URLSearchParams({ page: "1", limit: "100" });
        for (const [key, value] of Object.entries(filters.value)) {
          if (value) query.set(key, value);
        }
        const result = await api.listExpenses(query);
        expenses.value = result.expenses;
        totalCount.value = result.total;
      }
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : "Could not load expenses.";
    } finally {
      loading.value = false;
    }
  }

  async function loadSummaries() {
    summaryLoading.value = true;
    summaryError.value = "";
    try {
      if (auth.previewMode) {
        categories.value = demoExpenses.reduce<SummaryItem[]>(
          (items, expense) => {
            const found = items.find(
              (item) => item.category === expense.category_name,
            );
            if (found) found.total += expense.amount;
            else
              items.push({
                category: expense.category_name,
                total: expense.amount,
              });
            return items;
          },
          [],
        );
        months.value = [
          {
            month: "2026-09",
            total: demoExpenses.reduce((sum, item) => sum + item.amount, 0),
          },
        ];
        days.value = demoExpenses.slice(0, 5).map((expense) => ({
          day: expense.date.slice(0, 10),
          total: expense.amount,
        }));
      } else {
        [categories.value, months.value, days.value] = await Promise.all([
          api.categorySummary(),
          api.monthSummary(),
          api.daySummary(),
        ]);
      }
    } catch (cause) {
      summaryError.value =
        cause instanceof Error ? cause.message : "Could not load summaries.";
    } finally {
      summaryLoading.value = false;
    }
  }

  async function saveExpense(
    input: CreateExpenseInput | UpdateExpenseInput,
    id?: number,
  ) {
    if (auth.previewMode) {
      const current = id
        ? demoExpenses.find((expense) => expense.id === id)
        : undefined;
      if (current) Object.assign(current, input);
      else {
        const createInput = input as CreateExpenseInput;
        demoExpenses.unshift({
          amount: createInput.amount,
          id: Date.now(),
          category_id: createInput.category_id,
          sub_category_id: createInput.sub_category_id ?? null,
          description: createInput.description ?? "",
          date: createInput.date,
        });
      }
      await loadExpenses();
      await loadSummaries();
      return;
    }
    if (id) await api.updateExpense(id, input);
    else await api.createExpense(input as CreateExpenseInput);
    await loadExpenses();
    await loadSummaries();
  }

  async function deleteExpense(id: number) {
    if (auth.previewMode) {
      const index = demoExpenses.findIndex((expense) => expense.id === id);
      if (index !== -1) demoExpenses.splice(index, 1);
    } else {
      await api.deleteExpense(id);
    }
    await loadExpenses();
    await loadSummaries();
  }

  function resetFilters() {
    filters.value = emptyFilters();
  }

  return {
    expenses,
    categories,
    months,
    days,
    filters,
    loading,
    error,
    summaryLoading,
    summaryError,
    totalCount,
    visibleExpenses,
    loadExpenses,
    loadSummaries,
    saveExpense,
    deleteExpense,
    resetFilters,
    reset,
  };
});
