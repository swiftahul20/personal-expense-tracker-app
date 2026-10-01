import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  api,
  clearTokens,
  hasTokens,
  saveTokens,
  setAuthFailureHandler,
} from "../lib/api";
import type { User } from "../types";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const previewMode = ref(false);
  const ready = ref(false);
  const isAuthenticated = computed(() => Boolean(user.value));

  setAuthFailureHandler(() => {
    clearTokens();
    user.value = null;
    previewMode.value = false;
  });

  async function bootstrap() {
    if (ready.value) return;
    if (hasTokens()) {
      try {
        user.value = await api.me();
      } catch {
        clearTokens();
      }
    }
    ready.value = true;
  }

  async function authenticate(
    action: "login" | "register",
    email: string,
    password: string,
  ) {
    const result = await api[action](email, password);
    saveTokens(result.access_token, result.refresh_token);
    user.value = result.user;
    previewMode.value = false;
  }

  function enterPreview() {
    user.value = {
      id: 0,
      email: "Sample account",
      created_at: new Date().toISOString(),
    };
    previewMode.value = true;
    ready.value = true;
  }

  async function logout() {
    const refreshToken = localStorage.getItem("ledger_refresh_token");
    if (!previewMode.value && refreshToken) {
      try {
        await api.logout(refreshToken);
      } catch {
        // Local credentials are cleared even if the server is unavailable.
      }
    }
    clearTokens();
    user.value = null;
    previewMode.value = false;
  }

  return {
    user,
    previewMode,
    ready,
    isAuthenticated,
    bootstrap,
    authenticate,
    enterPreview,
    logout,
  };
});
