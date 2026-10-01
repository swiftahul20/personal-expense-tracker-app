import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { demoExpenses } from "../data/demo-data";
import { api } from "../lib/api";
import { expensesToCsv, filterExpenses } from "../lib/expense-utils";
import type {
  CreateExpenseInput,
  Expense,
  ExpenseFilters,
  SummaryItem,
  UpdateExpenseInput,
} from "../types";
import { useAuthStore } from "./auth";

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
  const page = ref(1);
  const totalPages = ref(1);
  const limit = 20;
  const exportLoading = ref(false);
  const visibleExpenses = computed(() => expenses.value);

  function reset() {
    expenses.value = [];
    categories.value = [];
    months.value = [];
    days.value = [];
    filters.value = emptyFilters();
    totalCount.value = 0;
    page.value = 1;
    totalPages.value = 1;
    error.value = "";
    summaryError.value = "";
  }

  watch(
    () => auth.user?.id,
    () => reset(),
  );

  async function loadExpenses(requestedPage = page.value) {
    loading.value = true;
    error.value = "";
    page.value = Math.max(1, requestedPage);
    try {
      if (auth.previewMode) {
        const filtered = filterExpenses(demoExpenses, filters.value);
        totalCount.value = filtered.length;
        totalPages.value = Math.max(1, Math.ceil(totalCount.value / limit));
        const start = (page.value - 1) * limit;
        expenses.value = filtered.slice(start, start + limit);
      } else {
        const query = new URLSearchParams({
          page: String(page.value),
          limit: String(limit),
        });
        for (const [key, value] of Object.entries(filters.value)) {
          if (value) query.set(key, value);
        }
        const result = await api.listExpenses(query);
        expenses.value = result.expenses;
        page.value = result.page;
        totalPages.value = result.total_pages;
        totalCount.value = result.total;
      }
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : "Could not load expenses.";
    } finally {
      loading.value = false;
    }
  }

  async function exportExpenses() {
    exportLoading.value = true;
    try {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters.value)) {
        if (value) query.set(key, value);
      }
      let blob: Blob;
      if (auth.previewMode) {
        blob = new Blob(
          [expensesToCsv(filterExpenses(demoExpenses, filters.value))],
          { type: "text/csv" },
        );
      } else {
        blob = await api.exportExpenses(query);
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "expenses.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } finally {
      exportLoading.value = false;
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
    if (id) {
      const index = expenses.value.findIndex((expense) => expense.id === id);
      const previous = index === -1 ? undefined : { ...expenses.value[index] };
      if (index !== -1) Object.assign(expenses.value[index], input);
      try {
        await api.updateExpense(id, input);
        await loadExpenses(page.value);
        await loadSummaries();
      } catch (cause) {
        if (index !== -1 && previous) expenses.value[index] = previous;
        throw cause;
      }
      return;
    }

    const createInput = input as CreateExpenseInput;
    const optimisticId = -Date.now();
    const optimisticExpense: Expense = {
      id: optimisticId,
      amount: createInput.amount,
      category_id: createInput.category_id,
      sub_category_id: createInput.sub_category_id ?? null,
      description: createInput.description ?? "",
      date: createInput.date,
    };
    expenses.value.unshift(optimisticExpense);
    totalCount.value += 1;
    try {
      await api.createExpense(createInput);
      await loadExpenses(page.value);
      await loadSummaries();
    } catch (cause) {
      expenses.value = expenses.value.filter(
        (expense) => expense.id !== optimisticId,
      );
      totalCount.value = Math.max(0, totalCount.value - 1);
      throw cause;
    }
  }

  async function deleteExpense(id: number) {
    if (auth.previewMode) {
      const index = demoExpenses.findIndex((expense) => expense.id === id);
      if (index !== -1) demoExpenses.splice(index, 1);
    } else {
      const index = expenses.value.findIndex((expense) => expense.id === id);
      const deleted = index === -1 ? undefined : expenses.value[index];
      if (index !== -1) {
        expenses.value.splice(index, 1);
        totalCount.value = Math.max(0, totalCount.value - 1);
      }
      try {
        await api.deleteExpense(id);
        await loadExpenses(page.value);
        await loadSummaries();
      } catch (cause) {
        if (deleted && index !== -1) expenses.value.splice(index, 0, deleted);
        totalCount.value += deleted ? 1 : 0;
        throw cause;
      }
      return;
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
    page,
    totalPages,
    limit,
    exportLoading,
    visibleExpenses,
    loadExpenses,
    exportExpenses,
    loadSummaries,
    saveExpense,
    deleteExpense,
    resetFilters,
    reset,
  };
});
