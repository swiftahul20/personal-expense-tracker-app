import { defineStore } from "pinia";
import { ref } from "vue";

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}

const MAX_VISIBLE_TOASTS = 4;

let nextToastId = 0;

export const useToastStore = defineStore("toast", () => {
  const messages = ref<ToastMessage[]>([]);
  const timers = new Map<
    number,
    { timeout: number; startedAt: number; remaining: number }
  >();

  function show(message: string, kind: ToastKind = "info", duration = 3600) {
    if (
      messages.value.some(
        (toast) => toast.message === message && toast.kind === kind,
      )
    )
      return;

    if (messages.value.length >= MAX_VISIBLE_TOASTS) {
      const oldest = messages.value[0];
      if (oldest) dismiss(oldest.id);
    }

    const id = ++nextToastId;
    messages.value.push({ id, kind, message });
    schedule(id, duration);
  }

  function schedule(id: number, duration: number) {
    const startedAt = Date.now();
    const timeout = window.setTimeout(() => dismiss(id), duration);
    timers.set(id, { timeout, startedAt, remaining: duration });
  }

  function dismiss(id: number) {
    const timer = timers.get(id);
    if (timer) window.clearTimeout(timer.timeout);
    timers.delete(id);
    messages.value = messages.value.filter((toast) => toast.id !== id);
  }

  function pause(id: number) {
    const timer = timers.get(id);
    if (!timer) return;
    window.clearTimeout(timer.timeout);
    timer.remaining = Math.max(
      0,
      timer.remaining - (Date.now() - timer.startedAt),
    );
  }

  function resume(id: number) {
    const timer = timers.get(id);
    if (!timer || timer.remaining <= 0) return dismiss(id);
    schedule(id, timer.remaining);
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

  return { messages, show, dismiss, pause, resume, success, error, info };
});
