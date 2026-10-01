import type { Expense, ExpenseFilters } from "../types";

export function filterExpenses(
  expenses: Expense[],
  filters: ExpenseFilters,
): Expense[] {
  const search = filters.search.toLowerCase();

  return expenses.filter(
    (expense) =>
      (!filters.category_id ||
        String(expense.category_id) === filters.category_id) &&
      (!search ||
        `${expense.description} ${expense.category_name ?? ""}`
          .toLowerCase()
          .includes(search)) &&
      (!filters.from || expense.date.slice(0, 10) >= filters.from) &&
      (!filters.to || expense.date.slice(0, 10) <= filters.to),
  );
}

function escapeCsv(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function expensesToCsv(expenses: Expense[]): string {
  const header = "ID,Amount,Category,Sub-Category,Description,Date";
  const rows = expenses.map((expense) =>
    [
      expense.id,
      expense.amount,
      expense.category_name ?? "",
      expense.sub_category_name ?? "",
      expense.description,
      expense.date,
    ]
      .map(escapeCsv)
      .join(","),
  );

  return [header, ...rows].join("\n");
}
