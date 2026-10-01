<script setup lang="ts">
import {
  AtSign,
  Check,
  KeyRound,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Sun,
  Trash2,
  X,
} from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { getApiBaseUrl } from "../lib/api";
import { useAuthStore } from "../stores/auth";
import { useCategoriesStore } from "../stores/categories";
import { useThemeStore } from "../stores/theme";
import { useToastStore } from "../stores/toast";

const emit = defineEmits<{ "sign-out": [] }>();
const auth = useAuthStore();
const theme = useThemeStore();
const categoriesStore = useCategoriesStore();
const toast = useToastStore();
const connected = computed(() => Boolean(getApiBaseUrl()));
const selectedCategoryId = ref<number | null>(null);
const subcategoryToggles = ref<Record<number, boolean>>({});
const categoryName = ref("");
const subcategoryNames = ref<Record<number, string>>({});
const editingCategoryId = ref<number | null>(null);
const editingSubcategoryId = ref<number | null>(null);
const busy = ref(false);
const taxonomyError = ref("");

const subcategoriesFor = (categoryId: number) =>
  categoriesStore.subcategories.filter(
    (subcategory) => subcategory.category_id === categoryId,
  );

function subcategoriesEnabled(categoryId: number) {
  return Boolean(subcategoryToggles.value[categoryId]);
}

function toggleSubcategories(categoryId: number) {
  selectedCategoryId.value = categoryId;
  subcategoryToggles.value[categoryId] = !subcategoriesEnabled(categoryId);
}

async function loadTaxonomy() {
  await categoriesStore.loadCategories();
  if (selectedCategoryId.value === null) {
    selectedCategoryId.value = categoriesStore.categories[0]?.id ?? null;
  }
  await categoriesStore.loadSubcategories();
}

function startCategoryEdit(id: number, name: string) {
  editingCategoryId.value = id;
  categoryName.value = name;
}

function startSubcategoryEdit(categoryId: number, id: number, name: string) {
  editingSubcategoryId.value = id;
  subcategoryNames.value[categoryId] = name;
}

function cancelEditing() {
  editingCategoryId.value = null;
  editingSubcategoryId.value = null;
  categoryName.value = "";
  if (selectedCategoryId.value !== null) {
    subcategoryNames.value[selectedCategoryId.value] = "";
  }
}

async function saveCategory() {
  const name = categoryName.value.trim();
  if (!name) return;
  busy.value = true;
  taxonomyError.value = "";
  try {
    const wasEditing = editingCategoryId.value !== null;
    await categoriesStore.saveCategory(
      { name },
      editingCategoryId.value ?? undefined,
    );
    if (selectedCategoryId.value === null) {
      selectedCategoryId.value = categoriesStore.categories.at(-1)?.id ?? null;
    }
    cancelEditing();
    toast.success(wasEditing ? "Category updated." : "Category added.");
  } catch (cause) {
    taxonomyError.value =
      cause instanceof Error ? cause.message : "Could not save category.";
  } finally {
    busy.value = false;
  }
}

async function removeCategory(id: number) {
  if (!window.confirm("Delete this category and its sub-categories?")) return;
  busy.value = true;
  taxonomyError.value = "";
  try {
    await categoriesStore.removeCategory(id);
    if (selectedCategoryId.value === id) {
      selectedCategoryId.value = categoriesStore.categories[0]?.id ?? null;
    }
    toast.success("Category deleted.");
  } catch (cause) {
    taxonomyError.value =
      cause instanceof Error ? cause.message : "Could not delete category.";
  } finally {
    busy.value = false;
  }
}

async function saveSubcategory() {
  if (selectedCategoryId.value === null) return;
  const name = (subcategoryNames.value[selectedCategoryId.value] ?? "").trim();
  if (!name) return;
  busy.value = true;
  taxonomyError.value = "";
  try {
    const wasEditing = editingSubcategoryId.value !== null;
    await categoriesStore.saveSubcategory(
      { name, category_id: selectedCategoryId.value },
      editingSubcategoryId.value ?? undefined,
    );
    cancelEditing();
    toast.success(wasEditing ? "Sub-category updated." : "Sub-category added.");
  } catch (cause) {
    taxonomyError.value =
      cause instanceof Error ? cause.message : "Could not save sub-category.";
  } finally {
    busy.value = false;
  }
}

async function removeSubcategory(id: number) {
  if (!window.confirm("Delete this sub-category?")) return;
  busy.value = true;
  taxonomyError.value = "";
  try {
    await categoriesStore.removeSubcategory(id);
    toast.success("Sub-category deleted.");
  } catch (cause) {
    taxonomyError.value =
      cause instanceof Error ? cause.message : "Could not delete sub-category.";
  } finally {
    busy.value = false;
  }
}

onMounted(loadTaxonomy);
</script>

<template>
  <section class="profile-screen">
    <div class="welcome-line">
      <div>
        <p class="eyebrow">Account</p>
        <h1>Your account.</h1>
      </div>
    </div>
    <section class="profile-card">
      <div class="profile-avatar">
        {{ auth.user?.email.slice(0, 1).toUpperCase() }}
      </div>
      <div class="profile-copy">
        <strong>{{ auth.user?.email }}</strong
        ><span>{{
          auth.previewMode ? "Trying out the daybook" : "Daybook member"
        }}</span>
      </div>
    </section>

    <p class="eyebrow profile-group-label">Account details</p>
    <section class="settings-group">
      <div class="setting-row">
        <span class="setting-icon coral"><AtSign :size="17" /></span
        ><span
          ><strong>Email address</strong
          ><small>{{ auth.user?.email }}</small></span
        ><span class="setting-detail">Current</span>
      </div>
      <button
        class="setting-row appearance-setting"
        type="button"
        :aria-pressed="theme.isDark"
        @click="theme.toggle"
      >
        <span class="setting-icon green"
          ><component :is="theme.isDark ? Sun : Moon" :size="17"
        /></span>
        <span
          ><strong>Appearance</strong
          ><small>{{
            theme.isDark ? "Dark theme" : "Light theme"
          }}</small></span
        >
        <span class="theme-action">Switch</span>
      </button>
      <div class="setting-row">
        <span class="setting-icon green"><KeyRound :size="17" /></span
        ><span
          ><strong>Data connection</strong
          ><small>{{
            auth.previewMode
              ? "Sample data on this device"
              : connected
                ? "Connected to your expense API"
                : "API URL has not been set"
          }}</small></span
        ><span
          class="connection-dot"
          :class="{ online: connected && !auth.previewMode }"
        ></span>
      </div>
    </section>

    <p class="eyebrow profile-group-label">Categories &amp; sub-categories</p>
    <section class="taxonomy-panel">
      <p v-if="taxonomyError" class="form-error taxonomy-error" role="alert">
        {{ taxonomyError }}
      </p>
      <form class="taxonomy-add-row" @submit.prevent="saveCategory">
        <input
          v-model="categoryName"
          class="taxonomy-input"
          type="text"
          maxlength="60"
          :placeholder="editingCategoryId ? 'Category name' : 'New category'"
          aria-label="Category name"
          required
        />
        <button class="taxonomy-action primary" type="submit" :disabled="busy">
          <Check v-if="editingCategoryId" :size="15" />
          <Plus v-else :size="15" />
          <span>{{ editingCategoryId ? "Save" : "Add" }}</span>
        </button>
        <button
          v-if="editingCategoryId"
          class="taxonomy-icon-action"
          type="button"
          aria-label="Cancel category edit"
          @click="cancelEditing"
        >
          <X :size="15" />
        </button>
      </form>

      <div class="taxonomy-category-list">
        <div
          v-for="category in categoriesStore.categories"
          :key="category.id"
          class="taxonomy-category-block"
        >
          <div class="taxonomy-category-row">
            <span class="taxonomy-name">{{ category.name }}</span>
            <button
              class="taxonomy-icon-action"
              type="button"
              :aria-label="`Edit ${category.name}`"
              @click="startCategoryEdit(category.id, category.name)"
            >
              <Pencil :size="14" />
            </button>
            <button
              class="taxonomy-icon-action danger"
              type="button"
              :aria-label="`Delete ${category.name}`"
              @click="removeCategory(category.id)"
            >
              <Trash2 :size="14" />
            </button>
            <label class="taxonomy-switch">
              <span>Sub-categories</span>
              <input
                type="checkbox"
                :checked="subcategoriesEnabled(category.id)"
                :aria-label="`Enable sub-categories for ${category.name}`"
                @change="toggleSubcategories(category.id)"
              />
              <i></i>
            </label>
          </div>
          <div v-if="subcategoryToggles[category.id]" class="subcategory-panel">
            <div class="taxonomy-subheading">
              <span class="field-label"
                >Sub-categories for {{ category.name }}</span
              >
            </div>
            <form class="taxonomy-add-row" @submit.prevent="saveSubcategory">
              <input
                v-model="subcategoryNames[category.id]"
                class="taxonomy-input"
                type="text"
                maxlength="60"
                :placeholder="
                  editingSubcategoryId
                    ? 'Sub-category name'
                    : 'New sub-category'
                "
                aria-label="Sub-category name"
                required
                @focus="selectedCategoryId = category.id"
              />
              <button
                class="taxonomy-action primary"
                type="submit"
                :disabled="busy"
              >
                <Check v-if="editingSubcategoryId" :size="15" />
                <Plus v-else :size="15" />
                <span>{{ editingSubcategoryId ? "Save" : "Add" }}</span>
              </button>
              <button
                v-if="editingSubcategoryId"
                class="taxonomy-icon-action"
                type="button"
                aria-label="Cancel sub-category edit"
                @click="cancelEditing"
              >
                <X :size="15" />
              </button>
            </form>
            <div
              v-if="subcategoriesFor(category.id).length"
              class="subcategory-list"
            >
              <div
                v-for="subcategory in subcategoriesFor(category.id)"
                :key="subcategory.id"
                class="subcategory-row"
              >
                <span>{{ subcategory.name }}</span>
                <span class="taxonomy-row-actions">
                  <button
                    class="taxonomy-icon-action"
                    type="button"
                    :aria-label="`Edit ${subcategory.name}`"
                    @click="
                      selectedCategoryId = category.id;
                      startSubcategoryEdit(
                        category.id,
                        subcategory.id,
                        subcategory.name,
                      );
                    "
                  >
                    <Pencil :size="13" />
                  </button>
                  <button
                    class="taxonomy-icon-action danger"
                    type="button"
                    :aria-label="`Delete ${subcategory.name}`"
                    @click="removeSubcategory(subcategory.id)"
                  >
                    <Trash2 :size="13" />
                  </button>
                </span>
              </div>
            </div>
            <p v-else class="muted-empty">No sub-categories yet.</p>
          </div>
        </div>
      </div>
    </section>

    <button class="sign-out-button" type="button" @click="emit('sign-out')">
      <LogOut :size="17" /> Sign out
    </button>
  </section>
</template>
