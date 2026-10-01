import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { demoExpenses } from "../data/demo-data";
import { api } from "../lib/api";
import type {
  Category,
  CategoryInput,
  SubCategory,
  SubCategoryInput,
} from "../types";
import { useAuthStore } from "./auth";

export const useCategoriesStore = defineStore("categories", () => {
  const auth = useAuthStore();
  const categories = ref<Category[]>([]);
  const subcategories = ref<SubCategory[]>([]);
  const loading = ref(false);
  const subcategoriesLoading = ref(false);
  const error = ref("");
  const loaded = ref(false);

  function reset() {
    categories.value = [];
    subcategories.value = [];
    loaded.value = false;
    error.value = "";
  }

  watch(
    () => auth.user?.id,
    () => reset(),
  );

  const categoryNames = computed(() =>
    categories.value.map((item) => item.name),
  );

  async function loadCategories() {
    if (loaded.value || loading.value) return;
    loading.value = true;
    error.value = "";
    try {
      if (auth.previewMode) {
        categories.value = [
          ...new Set(
            demoExpenses
              .map((expense) => expense.category_name)
              .filter((name): name is string => Boolean(name)),
          ),
        ].map((name, index) => ({ id: index + 1, name, sub_categories: [] }));
      } else {
        categories.value = await api.listCategories();
      }
      subcategories.value = categories.value.flatMap(
        (category) => category.sub_categories,
      );
      loaded.value = true;
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : "Could not load categories.";
    } finally {
      loading.value = false;
    }
  }

  async function loadSubcategories(categoryId?: number, categoryName?: string) {
    subcategoriesLoading.value = true;
    try {
      if (auth.previewMode) {
        const selectedCategoryName = categoryId
          ? categories.value.find((category) => category.id === categoryId)
              ?.name
          : categoryName;
        subcategories.value = demoExpenses
          .filter(
            (expense) =>
              (!selectedCategoryName ||
                expense.category_name === selectedCategoryName) &&
              expense.sub_category_name,
          )
          .map((expense, index) => ({
            id: index + 1,
            name: expense.sub_category_name ?? "",
            category_id:
              categoryId ??
              categories.value.find(
                (item) => item.name === expense.category_name,
              )?.id ??
              0,
          }))
          .filter(
            (item, index, items) =>
              items.findIndex((candidate) => candidate.name === item.name) ===
              index,
          );
      } else {
        const allSubcategories = categories.value.flatMap(
          (category) => category.sub_categories,
        );
        subcategories.value = categoryId
          ? allSubcategories.filter(
              (subcategory) => subcategory.category_id === categoryId,
            )
          : allSubcategories;
      }
    } catch (cause) {
      error.value =
        cause instanceof Error
          ? cause.message
          : "Could not load sub-categories.";
    } finally {
      subcategoriesLoading.value = false;
    }
  }

  async function saveCategory(input: CategoryInput, id?: number) {
    if (auth.previewMode) {
      if (id) {
        const category = categories.value.find((item) => item.id === id);
        if (category) category.name = input.name;
      } else {
        categories.value.push({
          id: Date.now(),
          name: input.name,
          sub_categories: [],
        });
      }
      return;
    }
    if (id) {
      const index = categories.value.findIndex((item) => item.id === id);
      const previous =
        index === -1 ? undefined : { ...categories.value[index] };
      if (index !== -1) categories.value[index].name = input.name;
      try {
        const category = await api.updateCategory(id, input);
        if (index !== -1)
          categories.value[index] = {
            ...category,
            sub_categories: categories.value[index].sub_categories,
          };
      } catch (cause) {
        if (index !== -1 && previous) categories.value[index] = previous;
        throw cause;
      }
      return;
    }

    const optimisticId = -Date.now();
    categories.value.push({
      id: optimisticId,
      name: input.name,
      sub_categories: [],
    });
    try {
      const category = await api.createCategory(input);
      const index = categories.value.findIndex(
        (item) => item.id === optimisticId,
      );
      if (index !== -1) categories.value[index] = category;
    } catch (cause) {
      categories.value = categories.value.filter(
        (category) => category.id !== optimisticId,
      );
      throw cause;
    }
  }

  async function removeCategory(id: number) {
    const index = categories.value.findIndex((item) => item.id === id);
    const category = index === -1 ? undefined : categories.value[index];
    const removedSubcategories = subcategories.value.filter(
      (item) => item.category_id === id,
    );
    categories.value = categories.value.filter((item) => item.id !== id);
    subcategories.value = subcategories.value.filter(
      (item) => item.category_id !== id,
    );
    if (auth.previewMode || !category) return;
    try {
      await api.deleteCategory(id);
    } catch (cause) {
      categories.value.splice(index, 0, category);
      subcategories.value.push(...removedSubcategories);
      throw cause;
    }
  }

  async function saveSubcategory(
    input: SubCategoryInput,
    id?: number,
  ): Promise<SubCategory> {
    if (auth.previewMode) {
      if (id) {
        const subcategory = subcategories.value.find((item) => item.id === id);
        if (subcategory) {
          Object.assign(subcategory, input);
          return subcategory;
        }
        throw new Error("Sub-category not found.");
      } else {
        const subcategory = { ...input, id: Date.now() };
        subcategories.value.push(subcategory);
        categories.value
          .find((category) => category.id === input.category_id)
          ?.sub_categories.push(subcategory);
        return subcategory;
      }
    }
    if (id) {
      const index = subcategories.value.findIndex((item) => item.id === id);
      const previous =
        index === -1 ? undefined : { ...subcategories.value[index] };
      if (index !== -1) subcategories.value[index].name = input.name;
      const category = categories.value.find(
        (item) => item.id === input.category_id,
      );
      const nestedIndex = category?.sub_categories.findIndex(
        (item) => item.id === id,
      );
      if (category && nestedIndex !== undefined && nestedIndex !== -1)
        category.sub_categories[nestedIndex].name = input.name;
      try {
        const subcategory = await api.updateSubCategory(
          input.category_id,
          id,
          input,
        );
        if (index !== -1) subcategories.value[index] = subcategory;
        if (category && nestedIndex !== undefined && nestedIndex !== -1)
          category.sub_categories[nestedIndex] = subcategory;
      } catch (cause) {
        if (index !== -1 && previous) subcategories.value[index] = previous;
        if (
          category &&
          nestedIndex !== undefined &&
          nestedIndex !== -1 &&
          previous
        )
          category.sub_categories[nestedIndex] = previous;
        throw cause;
      }
      return subcategories.value[index] ?? { ...input, id };
    }

    const optimisticId = -Date.now();
    const optimisticSubcategory = { ...input, id: optimisticId };
    subcategories.value.push(optimisticSubcategory);
    categories.value
      .find((category) => category.id === input.category_id)
      ?.sub_categories.push(optimisticSubcategory);
    try {
      const subcategory = await api.createSubCategory(input.category_id, input);
      const index = subcategories.value.findIndex(
        (item) => item.id === optimisticId,
      );
      if (index !== -1) subcategories.value[index] = subcategory;
      const category = categories.value.find(
        (item) => item.id === input.category_id,
      );
      const nestedIndex = category?.sub_categories.findIndex(
        (item) => item.id === optimisticId,
      );
      if (category && nestedIndex !== undefined && nestedIndex !== -1)
        category.sub_categories[nestedIndex] = subcategory;
      return subcategory;
    } catch (cause) {
      subcategories.value = subcategories.value.filter(
        (item) => item.id !== optimisticId,
      );
      const category = categories.value.find(
        (item) => item.id === input.category_id,
      );
      if (category)
        category.sub_categories = category.sub_categories.filter(
          (item) => item.id !== optimisticId,
        );
      throw cause;
    }
  }

  async function removeSubcategory(id: number) {
    const subcategory = subcategories.value.find((item) => item.id === id);
    if (!auth.previewMode && subcategory) {
      await api.deleteSubCategory(subcategory.category_id, id);
    }
    subcategories.value = subcategories.value.filter((item) => item.id !== id);
  }

  return {
    categories,
    subcategories,
    categoryNames,
    loading,
    subcategoriesLoading,
    error,
    loadCategories,
    loadSubcategories,
    saveCategory,
    removeCategory,
    saveSubcategory,
    removeSubcategory,
    reset,
  };
});
