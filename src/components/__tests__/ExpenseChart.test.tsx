import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ExpenseChart from "../ExpenseChart";
import type { Expense } from "../../db/schema";

// Mock localStorage for formatCurrency
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((_: number) => null),
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

const categoryNames: Record<string, string> = {
  "cat-food": "Comida",
  "cat-transport": "Transporte",
  "cat-uncategorized": "Sin categoría",
};

const makeExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: "exp-1",
  amount: 100,
  originalAmount: 100,
  currency: "USD",
  exchangeRate: 1,
  description: "Test",
  categoryId: "cat-food",
  cardId: "card-cash",
  date: "2026-09-01",
  periodKey: "2026-09",
  updatedAt: Date.now(),
  ...overrides,
});

describe("ExpenseChart", () => {
  const defaultCurrency = "USD";
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.setItem("selectedCurrency", defaultCurrency);
  });

  it("renderiza null cuando no hay gastos", () => {
    const { container } = render(
      <ExpenseChart
        expenses={[]}
        chartType="bar"
        categoryNames={categoryNames}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renderiza gráfico de barras con datos", () => {
    const expenses = [
      makeExpense({ categoryId: "cat-food", amount: 200 }),
      makeExpense({ categoryId: "cat-transport", amount: 150 }),
    ];
    render(
      <ExpenseChart
        expenses={expenses}
        chartType="bar"
        categoryNames={categoryNames}
      />,
    );

    // Las categorías deben aparecer como texto
    expect(screen.getByText("Comida")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
  });

  it("renderiza gráfico de pastel (pie) con SVG", () => {
    const expenses = [
      makeExpense({ categoryId: "cat-food", amount: 200 }),
      makeExpense({ categoryId: "cat-transport", amount: 150 }),
    ];
    const { container } = render(
      <ExpenseChart
        expenses={expenses}
        chartType="pie"
        categoryNames={categoryNames}
      />,
    );

    // SVG debe estar presente
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    // Debe contener sectores (path)
    const paths = svg!.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("renderiza gráfico de dona (doughnut) con SVG", () => {
    const expenses = [makeExpense({ categoryId: "cat-food", amount: 200 })];
    const { container } = render(
      <ExpenseChart
        expenses={expenses}
        chartType="doughnut"
        categoryNames={categoryNames}
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("agrupa gastos por categoría", () => {
    const expenses = [
      makeExpense({ categoryId: "cat-food", amount: 100 }),
      makeExpense({ id: "exp-2", categoryId: "cat-food", amount: 50 }),
      makeExpense({ id: "exp-3", categoryId: "cat-transport", amount: 75 }),
    ];
    render(
      <ExpenseChart
        expenses={expenses}
        chartType="bar"
        categoryNames={categoryNames}
      />,
    );

    // Comida total: 150, Transporte: 75
    expect(screen.getByText("Comida")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
  });
});
