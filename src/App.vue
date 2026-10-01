<script setup lang="ts">
import { ChartNoAxesCombined, CirclePlus, House, UserRound } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import ExpenseSheet from "./components/ExpenseSheet.vue";
import ToastViewport from "./components/ToastViewport.vue";
import { useAuthStore } from "./stores/auth";
import { useThemeStore } from "./stores/theme";
import type { Expense } from "./types";

const auth = useAuthStore();
const theme = useThemeStore();
const route = useRoute();
const router = useRouter();
const sheetOpen = ref(false);
const editingExpense = ref<Expense | null>(null);
const isAuthPage = computed(
  () => route.name === "login" || route.name === "register",
);

function addExpense() {
  editingExpense.value = null;
  sheetOpen.value = true;
}

function editExpense(expense: Expense) {
  editingExpense.value = expense;
  sheetOpen.value = true;
}

function closeSheet() {
  sheetOpen.value = false;
  editingExpense.value = null;
}

function onSaved() {
  closeSheet();
}

async function signOut() {
  await auth.logout();
  await router.push("/login");
}
</script>

<template>
  <ToastViewport />
  <div v-if="!auth.isAuthenticated || isAuthPage" class="auth-app">
    <RouterView />
  </div>

  <div v-else class="app-shell">
    <header class="topbar">
      <RouterLink class="brand-mark" to="/" aria-label="Daybook home">
        <span>daybook</span>
      </RouterLink>
      <div class="topbar-actions">
        <span v-if="auth.previewMode" class="preview-badge"
          ><span></span> Sample data</span
        >
        <button
          class="avatar-button"
          type="button"
          aria-label="Open account"
          @click="router.push('/profile')"
        >
          {{ auth.user?.email?.slice(0, 1).toUpperCase() ?? "D" }}
        </button>
      </div>
    </header>

    <main class="main-content">
      <RouterView v-slot="{ Component }">
        <component
          :is="Component"
          @edit="editExpense"
          @sign-out="signOut"
          @toggle-theme="theme.toggle"
        />
      </RouterView>
    </main>

    <button
      class="fab"
      type="button"
      aria-label="Add expense"
      @click="addExpense"
    >
      <CirclePlus :size="22" :stroke-width="2" />
      <span>Add expense</span>
    </button>

    <nav class="bottom-nav" aria-label="Main navigation">
      <RouterLink
        to="/"
        class="nav-item"
        :class="{ active: route.name === 'home' }"
      >
        <House :size="19" />
        <span>Home</span>
      </RouterLink>
      <RouterLink
        to="/insights"
        class="nav-item"
        :class="{ active: route.name === 'insights' }"
      >
        <ChartNoAxesCombined :size="19" />
        <span>Insights</span>
      </RouterLink>
      <RouterLink
        to="/profile"
        class="nav-item"
        :class="{ active: route.name === 'profile' }"
      >
        <UserRound :size="19" />
        <span>Profile</span>
      </RouterLink>
    </nav>

    <ExpenseSheet
      :open="sheetOpen"
      :expense="editingExpense"
      @close="closeSheet"
      @saved="onSaved"
    />
  </div>
</template>
