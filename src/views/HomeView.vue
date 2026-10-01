<script setup lang="ts">
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Search,
  SlidersHorizontal,
  X,
} from "@lucide/vue";
import { computed, onMounted, ref, watch } from "vue";
import { useCategoriesStore } from "../stores/categories";
import { useExpensesStore } from "../stores/expenses";
import type { Expense } from "../types";

const emit = defineEmits<{ edit: [expense: Expense] }>();
const store = useExpensesStore();
const categoriesStore = useCategoriesStore();
const filterOpen = ref(false);
const draftCategory = ref("");
const draftFrom = ref("");
const draftTo = ref("");
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const today = new Date();
const monthLabel = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
}).format(today);
const dateLabel = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(today);
const monthTotal = computed(() => {
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return store.months.find((item) => item.month?.startsWith(key))?.total;
});
const activeFilters = computed(
  () =>
    Number(Boolean(store.filters.category_id)) +
    Number(Boolean(store.filters.from || store.filters.to)),
);

const idr = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
const dateHeading = (date: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
const categoryClass = (category: string) =>
  category.toLowerCase().replace(/[^a-z]+/g, "-");
const expenseMeta = (expense: Expense) =>
  [expense.category_name, expense.sub_category_name]
    .filter(Boolean)
    .join(" · ");
const groupedExpenses = computed(() => {
  const groups = new Map<string, Expense[]>();
  const sortedExpenses = [...store.visibleExpenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  for (const expense of sortedExpenses) {
    const day = expense.date.slice(0, 10);
    const group = groups.get(day);
    if (group) group.push(expense);
    else groups.set(day, [expense]);
  }

  return [...groups].map(([day, expenses]) => ({
    day,
    label: dateHeading(`${day}T12:00:00`),
    expenses,
  }));
});

watch(
  () => store.filters.search,
  () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => store.loadExpenses(1), 250);
  },
);

function openFilters() {
  draftCategory.value = store.filters.category_id;
  draftFrom.value = store.filters.from;
  draftTo.value = store.filters.to;
  filterOpen.value = true;
}

function applyFilters() {
  store.filters.category_id = draftCategory.value;
  store.filters.from = draftFrom.value;
  store.filters.to = draftTo.value;
  filterOpen.value = false;
  store.loadExpenses(1);
}

function clearFilters() {
  draftCategory.value = "";
  draftFrom.value = "";
  draftTo.value = "";
  store.filters.category_id = "";
  store.filters.from = "";
  store.filters.to = "";
  store.resetFilters();
  filterOpen.value = false;
  store.loadExpenses(1);
}

function retry() {
  void Promise.all([store.loadExpenses(), store.loadSummaries()]);
}

function previousPage() {
  if (store.page > 1) void store.loadExpenses(store.page - 1);
}

function nextPage() {
  if (store.page < store.totalPages) void store.loadExpenses(store.page + 1);
}

onMounted(async () => {
  await Promise.all([
    store.loadExpenses(),
    store.loadSummaries(),
    categoriesStore.loadCategories(),
  ]);
});
</script>

<template>
  <section class="home-screen" @keydown.esc.window="filterOpen = false">
    <div class="welcome-line">
      <div>
        <p class="eyebrow">{{ dateLabel }}</p>
        <h1>Expenses <em>this month.</em></h1>
      </div>
      <div class="month-chip"><CalendarDays :size="15" /> {{ monthLabel }}</div>
    </div>

    <section class="summary-card" aria-label="Monthly spending summary">
      <div class="summary-top">
        <span class="summary-label">Spent this month</span>
      </div>
      <div v-if="monthTotal !== undefined" class="summary-value">
        {{ idr(monthTotal) }}
      </div>
      <p v-else class="summary-unavailable">Monthly total unavailable</p>
    </section>

    <div class="section-heading expense-heading">
      <div>
        <p class="eyebrow">Expense history</p>
        <h2>
          Recent expenses <span>{{ store.totalCount }}</span>
        </h2>
      </div>
      <button
        class="icon-text-button"
        type="button"
        :disabled="store.exportLoading"
        @click="store.exportExpenses"
      >
        <Download :size="15" />
        <span>{{ store.exportLoading ? "Exporting" : "Export CSV" }}</span>
      </button>
    </div>
    <div class="search-row">
      <label class="search-box"
        ><Search :size="17" /><input
          v-model="store.filters.search"
          type="search"
          placeholder="Find an expense"
          aria-label="Search expenses" /><button
          v-if="store.filters.search"
          class="clear-search"
          type="button"
          aria-label="Clear search"
          @click="store.filters.search = ''"
        >
          <X :size="15" /></button
      ></label>
      <button
        class="filter-button"
        :class="{ 'has-filter': activeFilters }"
        type="button"
        aria-label="Open filters"
        @click="openFilters"
      >
        <SlidersHorizontal :size="17" /><span>Filter</span
        ><b v-if="activeFilters">{{ activeFilters }}</b>
      </button>
    </div>

    <div v-if="store.error" class="inline-error" role="alert">
      {{ store.error }}
      <button class="text-button" type="button" @click="retry">
        Try again
      </button>
    </div>
    <div v-if="store.loading" class="loading-line">Loading expenses…</div>
    <div v-else-if="groupedExpenses.length" class="expense-list">
      <section
        v-for="group in groupedExpenses"
        :key="group.day"
        class="expense-day-group"
        :aria-labelledby="`expense-day-${group.day}`"
      >
        <h3 :id="`expense-day-${group.day}`" class="list-date-label">
          {{ group.label }}
        </h3>
        <button
          v-for="expense in group.expenses"
          :key="expense.id"
          class="expense-row"
          type="button"
          :aria-label="`Edit expense: ${expense.description || expense.category_name}`"
          @click="emit('edit', expense)"
        >
          <span
            class="category-mark"
            :class="categoryClass(expense.category_name ?? 'uncategorized')"
            ><span>{{ (expense.category_name ?? "U").slice(0, 1) }}</span></span
          >
          <span class="expense-main"
            ><strong>{{
              expense.description || expense.category_name || "Uncategorized"
            }}</strong
            ><small>{{ expenseMeta(expense) }}</small></span
          >
          <span class="expense-amount"
            >{{ idr(expense.amount) }}<Pencil class="row-chevron" :size="14"
          /></span>
        </button>
      </section>
    </div>
    <div v-else-if="!store.loading && !store.error" class="empty-state">
      <div class="empty-illustration"><CalendarDays :size="25" /></div>
      <h3>
        {{
          activeFilters || store.filters.search
            ? "No matching expenses"
            : "No expenses yet"
        }}
      </h3>
      <p>
        {{
          activeFilters || store.filters.search
            ? "Change your search or clear the filters."
            : "Add an expense to start your history."
        }}
      </p>
      <button
        v-if="activeFilters || store.filters.search"
        class="text-button"
        type="button"
        @click="clearFilters"
      >
        Clear filters
      </button>
    </div>

    <div v-if="store.totalPages > 1" class="expense-pagination">
      <button
        class="pagination-button"
        type="button"
        aria-label="Previous page"
        :disabled="store.page === 1 || store.loading"
        @click="previousPage"
      >
        <ChevronLeft :size="16" />
      </button>
      <span>Page {{ store.page }} of {{ store.totalPages }}</span>
      <button
        class="pagination-button"
        type="button"
        aria-label="Next page"
        :disabled="store.page === store.totalPages || store.loading"
        @click="nextPage"
      >
        <ChevronRight :size="16" />
      </button>
    </div>

    <div
      v-if="filterOpen"
      class="sheet-backdrop"
      @click.self="filterOpen = false"
    >
      <section
        class="bottom-sheet filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-title"
      >
        <div class="sheet-handle"></div>
        <div class="sheet-title-row">
          <div>
            <p class="eyebrow">Expense history</p>
            <h2 id="filter-title">Filter expenses</h2>
          </div>
          <button
            class="icon-button"
            type="button"
            aria-label="Close filters"
            @click="filterOpen = false"
          >
            <X :size="19" />
          </button>
        </div>
        <label class="field-label" for="filter-category">Category</label
        ><select
          id="filter-category"
          v-model="draftCategory"
          class="form-control"
        >
          <option value="">All categories</option>
          <option
            v-for="category in categoriesStore.categories"
            :key="category.id"
            :value="String(category.id)"
          >
            {{ category.name }}
          </option>
        </select>
        <p class="field-label date-filter-label">Date range</p>
        <div class="date-range">
          <label
            ><span>From</span><input v-model="draftFrom" type="date" /></label
          ><label><span>To</span><input v-model="draftTo" type="date" /></label>
        </div>
        <div class="sheet-actions">
          <button class="text-button" type="button" @click="clearFilters">
            Clear all</button
          ><button class="primary-button" type="button" @click="applyFilters">
            Apply filters
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
