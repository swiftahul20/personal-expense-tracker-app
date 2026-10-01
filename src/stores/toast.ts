import { defineStore } from "pinia";
import { ref } from "vue";

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}

let nextToastId = 0;

export const useToastStore = defineStore("toast", () => {
  const messages = ref<ToastMessage[]>([]);

  function show(message: string, kind: ToastKind = "info", duration = 3600) {
    const id = ++nextToastId;
    messages.value.push({ id, kind, message });
    window.setTimeout(() => dismiss(id), duration);
  }

  function dismiss(id: number) {
    messages.value = messages.value.filter((toast) => toast.id !== id);
  }

  function success(message: string) {
    show(message, "success");
  }

  function error(message: string) {
    show(message, "error", 5000);
  }

  function info(message: string) {
    show(message, "info");
  }

  return { messages, show, dismiss, success, error, info };
});
