import { defineStore } from "pinia";
import { ref } from "vue";

const STORAGE_KEY = "daybook_theme";

export const useThemeStore = defineStore("theme", () => {
  const isDark = ref(localStorage.getItem(STORAGE_KEY) === "dark");

  function apply() {
    document.documentElement.dataset.theme = isDark.value ? "dark" : "light";
  }

  function toggle() {
    isDark.value = !isDark.value;
    localStorage.setItem(STORAGE_KEY, isDark.value ? "dark" : "light");
    apply();
  }

  apply();

  return { isDark, toggle };
});
