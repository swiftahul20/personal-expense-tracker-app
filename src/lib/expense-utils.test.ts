import { describe, expect, it } from "vitest";
import { demoExpenses } from "../data/demo-data";
import type { ExpenseFilters } from "../types";
import { expensesToCsv, filterExpenses } from "./expense-utils";

const emptyFilters: ExpenseFilters = {
  category_id: "",
  search: "",
  from: "",
  to: "",
};

describe("filterExpenses", () => {
  it("filters by category ID, search text, and date range", () => {
    const results = filterExpenses(demoExpenses, {
      ...emptyFilters,
      category_id: "1",
      search: "dinner",
      from: "2026-09-24",
      to: "2026-09-24",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.description).toBe("Noodles for dinner");
  });

  it("returns every expense when filters are empty", () => {
    expect(filterExpenses(demoExpenses, emptyFilters)).toHaveLength(
      demoExpenses.length,
    );
  });
});

describe("expensesToCsv", () => {
  it("writes the documented columns and escapes quoted values", () => {
    const csv = expensesToCsv([
      {
        ...demoExpenses[0],
        description: 'Lunch, then "coffee"',
      },
    ]);

    expect(csv).toContain("ID,Amount,Category,Sub-Category,Description,Date");
    expect(csv).toContain('"Lunch, then ""coffee"""');
  });
});
