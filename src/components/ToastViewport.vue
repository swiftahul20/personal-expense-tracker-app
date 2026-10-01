<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, X } from "@lucide/vue";
import { useToastStore } from "../stores/toast";

const toast = useToastStore();
const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};
</script>

<template>
  <div class="toast-viewport" aria-live="polite" aria-atomic="true">
    <TransitionGroup name="toast" tag="div" class="toast-list">
      <article
        v-for="message in toast.messages"
        :key="message.id"
        class="toast-message"
        :class="`toast-${message.kind}`"
        role="status"
        @mouseenter="toast.pause(message.id)"
        @mouseleave="toast.resume(message.id)"
      >
        <component :is="icons[message.kind]" :size="18" aria-hidden="true" />
        <p>{{ message.message }}</p>
        <button
          type="button"
          class="toast-dismiss"
          aria-label="Dismiss notification"
          @click="toast.dismiss(message.id)"
        >
          <X :size="16" />
        </button>
      </article>
    </TransitionGroup>
  </div>
</template>
