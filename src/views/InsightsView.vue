<script setup lang="ts">
import { ChartNoAxesCombined, CircleDollarSign } from "@lucide/vue";
import { computed, onMounted } from "vue";
import { useExpensesStore } from "../stores/expenses";

const store = useExpensesStore();
const idr = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
const categoryTotal = computed(() =>
  store.categories.reduce((sum, item) => sum + item.total, 0),
);
const monthTotal = computed(() => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  return store.months.find((item) => item.month?.startsWith(currentMonth))
    ?.total;
});
const colors = ["green", "coral"];
const monthName = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
        new Date(`${value}-02T12:00:00`),
      )
    : "This month";
const dayName = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "Recent day";

onMounted(() => store.loadSummaries());
</script>

<template>
  <section class="insights-screen">
    <div class="welcome-line">
      <div>
        <p class="eyebrow">Expense summaries</p>
        <h1>Where it goes.</h1>
      </div>
      <div class="insight-icon"><ChartNoAxesCombined :size="20" /></div>
    </div>
    <section class="insight-overview">
      <div class="overview-top">
        <span><CircleDollarSign :size="17" /> Total by month</span
        ><span class="overview-period">{{
          monthName(store.months[0]?.month)
        }}</span>
      </div>
      <strong v-if="monthTotal !== undefined">{{ idr(monthTotal) }}</strong>
      <p v-if="monthTotal !== undefined">
        {{ monthName(new Date().toISOString().slice(0, 7)) }}
      </p>
      <p v-else>No recorded spending for this month.</p>
    </section>

    <p v-if="store.summaryLoading" class="loading-line">Loading summaries…</p>
    <div v-else-if="store.summaryError" class="inline-error" role="alert">
      <span>{{ store.summaryError }}</span>
      <button class="text-button" type="button" @click="store.loadSummaries">
        Try again
      </button>
    </div>
    <div v-else class="insights-grid">
      <section class="insight-section category-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Spending by category</p>
            <h2>By category</h2>
          </div>
          <span class="section-total">{{ idr(categoryTotal) }}</span>
        </div>
        <div v-if="store.categories.length" class="category-breakdown">
          <div
            v-for="(item, index) in [...store.categories].sort(
              (a, b) => b.total - a.total,
            )"
            :key="item.category"
            class="breakdown-row"
          >
            <div class="breakdown-top">
              <span
                ><i
                  class="breakdown-dot"
                  :class="colors[index % colors.length]"
                ></i
                >{{ item.category }}</span
              ><strong>{{ idr(item.total) }}</strong>
            </div>
            <div class="progress-track">
              <span
                :class="colors[index % colors.length]"
                :style="{
                  width: `${categoryTotal ? (item.total / categoryTotal) * 100 : 0}%`,
                }"
              ></span>
            </div>
            <small
              >{{
                categoryTotal
                  ? Math.round((item.total / categoryTotal) * 100)
                  : 0
              }}% of the total</small
            >
          </div>
        </div>
        <p v-else class="muted-empty">Add expenses to compare categories.</p>
      </section>

      <section class="insight-section month-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Monthly history</p>
            <h2>Month by month</h2>
          </div>
        </div>
        <div v-if="store.months.length" class="month-breakdown">
          <div
            v-for="(item, index) in store.months.slice(0, 6)"
            :key="item.month"
            class="month-row"
          >
            <span
              class="month-marker"
              :class="colors[index % colors.length]"
            ></span
            ><span class="month-name">{{ monthName(item.month) }}</span
            ><strong>{{ idr(item.total) }}</strong>
          </div>
        </div>
        <p v-else class="muted-empty">
          Monthly totals will appear after expenses are recorded.
        </p>
      </section>
    </div>

    <section
      v-if="!store.summaryLoading && !store.summaryError"
      class="insight-section daily-section"
    >
      <div class="section-heading">
        <div>
          <p class="eyebrow">Daily history</p>
          <h2>By day</h2>
        </div>
        <span class="quiet-caption">One day at a time</span>
      </div>
      <div v-if="store.days.length" class="daily-list">
        <div
          v-for="(item, index) in store.days.slice(0, 7)"
          :key="item.day"
          class="daily-row"
        >
          <span class="daily-day"
            ><small>{{ dayName(item.day).split(",")[0] }}</small
            ><strong>{{
              new Date(`${item.day}T12:00:00`).getDate()
            }}</strong></span
          ><span class="daily-bar"
            ><i
              :style="{
                width: `${Math.max(12, (item.total / Math.max(...store.days.map((day) => day.total))) * 100)}%`,
              }"
              :class="colors[index % colors.length]"
            ></i></span
          ><strong class="daily-total">{{ idr(item.total) }}</strong>
        </div>
      </div>
      <p v-else class="muted-empty">Add expenses to see daily totals.</p>
    </section>
    <div class="home-footer">
      <span>Daily totals</span
      ><span>{{ monthName(new Date().toISOString().slice(0, 7)) }}</span>
    </div>
  </section>
</template>
