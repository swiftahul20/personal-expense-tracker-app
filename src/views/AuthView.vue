<script setup lang="ts">
import { LockKeyhole, Mail } from "@lucide/vue";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { getApiBaseUrl } from "../lib/api";
import { useAuthStore } from "../stores/auth";

const props = defineProps<{ mode: "login" | "register" }>();
const auth = useAuthStore();
const router = useRouter();
const email = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);
const connected = Boolean(getApiBaseUrl());
const registering = computed(() => props.mode === "register");

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    await auth.authenticate(props.mode, email.value.trim(), password.value);
    await router.push("/");
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "We could not sign you in. Try again.";
  } finally {
    busy.value = false;
  }
}

function preview() {
  auth.enterPreview();
  router.push("/");
}
</script>

<template>
  <main class="auth-screen">
    <section class="auth-panel">
      <div class="auth-form-wrap">
        <RouterLink class="brand-mark auth-brand" to="/login"
          >daybook</RouterLink
        >
        <p class="eyebrow auth-eyebrow">Account access</p>
        <h1>{{ registering ? "Create account" : "Sign in" }}</h1>
        <p class="auth-intro">
          {{
            registering
              ? "Create an account to record and review expenses."
              : "Use your Daybook account to see your expenses."
          }}
        </p>

        <form class="auth-form" @submit.prevent="submit">
          <label class="field-label" for="email">Email address</label>
          <div class="input-wrap">
            <Mail :size="17" /><input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div class="label-row">
            <label class="field-label" for="password">Password</label>
          </div>
          <div class="input-wrap">
            <LockKeyhole :size="17" /><input
              id="password"
              v-model="password"
              type="password"
              :autocomplete="registering ? 'new-password' : 'current-password'"
              placeholder="Enter your password"
              required
            />
          </div>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <button
            class="primary-button auth-submit"
            type="submit"
            :disabled="busy"
          >
            {{
              busy ? "One moment…" : registering ? "Create account" : "Sign in"
            }}
          </button>
        </form>

        <div class="auth-divider"><span>or</span></div>
        <button class="preview-button" type="button" @click="preview">
          Use sample expenses
        </button>
        <p class="auth-switch">
          {{ registering ? "Already have an account?" : "New around here?" }}
          <RouterLink :to="registering ? '/login' : '/register'">{{
            registering ? "Sign in" : "Create an account"
          }}</RouterLink>
        </p>
        <p v-if="!connected" class="api-note" role="status">
          Live sign-in is unavailable until the API URL is configured.
        </p>
      </div>
    </section>
  </main>
</template>
