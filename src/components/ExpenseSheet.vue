<script setup lang="ts">
import { AlertCircle, Check, Trash2, X } from "@lucide/vue";
import Multiselect from "@vueform/multiselect";
import "@vueform/multiselect/themes/default.css";
import { computed, nextTick, reactive, ref, watch } from "vue";
import { z } from "zod";
import { useCategoriesStore } from "../stores/categories";
import { useExpensesStore } from "../stores/expenses";
import { useToastStore } from "../stores/toast";
import type { CreateExpenseInput, Expense, UpdateExpenseInput } from "../types";

const expenseSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .refine((value) => String(value).trim().length > 0, {
      message: "Enter how much you spent.",
    })
    .refine((value) => Number.isFinite(Number(value)), {
      message: "Amount must be a valid number.",
    })
    .refine((value) => Number(value) > 0, {
      message: "Amount must be greater than zero.",
    }),
  category_id: z.string().min(1, "Pick a category before saving."),
  sub_category_id: z
    .string()
    .max(60, "Sub-category can't be longer than 60 characters."),
  description: z
    .string()
    .max(140, "Description can't be longer than 140 characters."),
  date: z.string().min(1, "Pick a date for this expense."),
});

const props = defineProps<{ open: boolean; expense: Expense | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const store = useExpensesStore();
const categoriesStore = useCategoriesStore();
const toast = useToastStore();
const busy = ref(false);
const error = ref("");
const dialogRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
let previouslyFocused: HTMLElement | null = null;
const form = reactive({
  amount: "",
  category_id: "",
  sub_category_id: "",
  description: "",
  date: new Date().toISOString().slice(0, 10),
});
const editing = () => Boolean(props.expense);
const categoryOptions = computed(() =>
  categoriesStore.categories.map((category) => ({
    label: category.name,
    value: String(category.id),
  })),
);
const subcategoryOptions = computed(() =>
  categoriesStore.subcategories
    .filter(
      (subcategory) => String(subcategory.category_id) === form.category_id,
    )
    .map((subcategory) => ({
      label: subcategory.name,
      value: String(subcategory.id),
    })),
);

function resetForm() {
  error.value = "";
  if (props.expense) {
    form.amount = String(props.expense.amount);
    form.category_id = String(props.expense.category_id ?? "");
    form.sub_category_id = String(props.expense.sub_category_id ?? "");
    form.description = props.expense.description ?? "";
    form.date = props.expense.date.slice(0, 10);
  } else {
    form.amount = "";
    form.category_id = "";
    form.sub_category_id = "";
    form.description = "";
    form.date = new Date().toISOString().slice(0, 10);
  }
}

watch(
  () => [props.open, props.expense],
  () => {
    if (props.open) {
      resetForm();
      void categoriesStore.loadCategories().then(() => {
        if (!form.category_id) {
          form.category_id = String(categoriesStore.categories[0]?.id ?? "");
        }
        void categoriesStore.loadSubcategories(Number(form.category_id));
      });
    }
  },
  { immediate: true },
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      void nextTick(() => closeButtonRef.value?.focus());
    } else {
      previouslyFocused?.focus();
      previouslyFocused = null;
    }
  },
);

function trapFocus(event: KeyboardEvent) {
  if (event.key !== "Tab" || !dialogRef.value) return;
  const focusable = Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])",
    ),
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => form.category_id,
  (categoryId) => {
    form.sub_category_id = "";
    if (props.open && categoryId)
      void categoriesStore.loadSubcategories(Number(categoryId));
  },
);

async function save() {
  error.value = "";
  const result = expenseSchema.safeParse(form);
  if (!result.success) {
    error.value =
      result.error.issues[0]?.message ?? "Please check this expense.";
    return;
  }
  busy.value = true;
  let createdSubcategoryId: number | null = null;
  try {
    const categoryId = Number(result.data.category_id);
    let subCategoryId: number | null = null;
    if (result.data.sub_category_id.trim()) {
      if (subcategoryOptions.value.length) {
        subCategoryId = Number(result.data.sub_category_id);
      } else {
        const subcategory = await categoriesStore.saveSubcategory({
          name: result.data.sub_category_id.trim(),
          category_id: categoryId,
        });
        subCategoryId = subcategory.id;
        createdSubcategoryId = subcategory.id;
      }
    }
    const input: CreateExpenseInput | UpdateExpenseInput = editing()
      ? {
          amount: Number(result.data.amount),
          category_id: categoryId,
          sub_category_id: subCategoryId,
          description: result.data.description.trim(),
        }
      : {
          amount: Number(result.data.amount),
          category_id: categoryId,
          ...(subCategoryId ? { sub_category_id: subCategoryId } : {}),
          description: result.data.description.trim(),
          date: new Date(`${result.data.date}T12:00:00`).toISOString(),
        };
    await store.saveExpense(input, props.expense?.id);
    toast.success(editing() ? "Expense updated." : "Expense added.");
    emit("saved");
  } catch (cause) {
    if (createdSubcategoryId !== null) {
      try {
        await categoriesStore.removeSubcategory(createdSubcategoryId);
      } catch {
        // Preserve the expense error if compensating cleanup also fails.
      }
    }
    error.value =
      cause instanceof Error ? cause.message : "Could not save this expense.";
    toast.error(error.value);
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (!props.expense) return;
  busy.value = true;
  error.value = "";
  try {
    await store.deleteExpense(props.expense.id);
    toast.success("Expense deleted.");
    emit("saved");
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Could not delete this expense.";
    toast.error(error.value);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div
    v-if="open"
    class="sheet-backdrop"
    @click.self="emit('close')"
    @keydown.esc.window="emit('close')"
  >
    <section
      ref="dialogRef"
      class="bottom-sheet expense-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-sheet-title"
      @keydown="trapFocus"
    >
      <div class="sheet-handle"></div>
      <div class="sheet-title-row">
        <div>
          <p class="eyebrow">
            {{ editing() ? "Expense details" : "New expense" }}
          </p>
          <h2 id="expense-sheet-title">
            {{ editing() ? "Edit expense" : "Add an expense" }}
          </h2>
        </div>
        <button
          ref="closeButtonRef"
          class="icon-button"
          type="button"
          aria-label="Close"
          @click="emit('close')"
        >
          <X :size="19" />
        </button>
      </div>
      <form class="expense-form" novalidate @submit.prevent="save">
        <label class="amount-field"
          ><span>Amount</span>
          <div>
            <small>Rp</small
            ><input
              v-model="form.amount"
              type="number"
              inputmode="decimal"
              placeholder="0"
            /></div
        ></label>
        <div class="form-grid">
          <label class="form-field"
            ><span>Category</span
            ><Multiselect
              id="expense-category"
              v-model="form.category_id"
              :options="categoryOptions"
              :disabled="categoriesStore.loading || busy"
              :aria-busy="categoriesStore.loading"
              :searchable="true"
              :can-clear="false"
              :can-deselect="false"
              :placeholder="
                categoriesStore.loading ? 'Loading categories...' : 'Select category'
              "
              class="taxonomy-multiselect" /></label
          ><label class="form-field"
            ><span>Sub-category</span
            ><Multiselect
              id="expense-subcategory"
              v-if="subcategoryOptions.length"
              v-model="form.sub_category_id"
              :options="subcategoryOptions"
              :disabled="categoriesStore.subcategoriesLoading || busy"
              :aria-busy="categoriesStore.subcategoriesLoading"
              :searchable="true"
              :can-clear="true"
              :placeholder="
                categoriesStore.subcategoriesLoading
                  ? 'Loading sub-categories...'
                  : 'Optional'
              "
              class="taxonomy-multiselect" /><input
              v-else
              v-model="form.sub_category_id"
              type="text"
              placeholder="Optional"
              maxlength="60"
              :disabled="categoriesStore.subcategoriesLoading || busy"
          /></label>
        </div>
        <label class="form-field"
          ><span>Description</span
          ><input
            v-model="form.description"
            type="text"
            placeholder="What was it for?"
            maxlength="140"
        /></label>
        <label class="form-field"
          ><span>Date</span><input v-model="form.date" type="date"
        /></label>
        <p v-if="error" class="form-error sheet-error" role="alert">
          <AlertCircle :size="15" /> {{ error }}
        </p>
        <div class="sheet-actions">
          <button
            v-if="editing()"
            class="delete-button"
            type="button"
            :disabled="busy"
            aria-label="Delete expense"
            @click="remove"
          >
            <Trash2 :size="17" /></button
          ><button
            v-else
            class="text-button"
            type="button"
            @click="emit('close')"
          >
            Cancel</button
          ><button class="primary-button" type="submit" :disabled="busy">
            <Check v-if="!busy" :size="16" />{{
              busy ? "Saving…" : editing() ? "Save changes" : "Save expense"
            }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
