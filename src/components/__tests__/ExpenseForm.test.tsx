import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- MOCK FACTORIES (inline since vi.hoisted runs before imports) ----
const { mockDb, mockTranslation, mockPeriodUtils } = vi.hoisted(() => {
  const dict: Record<string, string> = {
    add_expense: "Agregar Gasto",
    edit_expense: "Editar Gasto",
    amount: "Cantidad",
    description: "Descripción",
    category: "Categoría",
    card: "Tarjeta",
    cash: "Efectivo (Sin Tarjeta)",
    date: "Fecha",
    save: "Guardar",
    cancel: "Cancelar",
    syncing: "Sincronizando...",
    sync_now: "Sincronizar ahora",
    sync_with_dropbox: "Conectar con Dropbox",
  };

  const makeTable = (store: Map<string, unknown>) => ({
    toArray: vi.fn(() => Promise.resolve(Array.from(store.values()))),
    get: vi.fn((id: string) => Promise.resolve(store.get(id) ?? undefined)),
    add: vi.fn((item: Record<string, unknown>) => {
      store.set(item.id as string, { ...item });
      return Promise.resolve(item.id);
    }),
    put: vi.fn((item: Record<string, unknown>) => {
      store.set(item.id as string, { ...item });
      return Promise.resolve(item.id);
    }),
    update: vi.fn((id: string, changes: Record<string, unknown>) => {
      const existing = store.get(id);
      if (existing) {
        store.set(id, { ...(existing as object), ...changes });
      }
      return Promise.resolve(1);
    }),
    delete: vi.fn((id: string) => {
      store.delete(id);
      return Promise.resolve();
    }),
    count: vi.fn(() => Promise.resolve(store.size)),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
        count: vi.fn(() => Promise.resolve(0)),
        first: vi.fn(() => Promise.resolve(undefined)),
      })),
      filter: vi.fn(() => ({
        first: vi.fn(() => Promise.resolve(undefined)),
        toArray: vi.fn(() => Promise.resolve([])),
      })),
    })),
    filter: vi.fn(() => ({
      first: vi.fn(() => Promise.resolve(undefined)),
      toArray: vi.fn(() => Promise.resolve([])),
    })),
  });

  const stores = {
    cards: new Map(),
    categories: new Map(),
    expenses: new Map(),
    debts: new Map(),
    meta: new Map(),
  };

  const db = {
    cards: makeTable(stores.cards),
    categories: makeTable(stores.categories),
    expenses: makeTable(stores.expenses),
    debts: makeTable(stores.debts),
    meta: makeTable(stores.meta),
    transaction: vi.fn((...args: unknown[]) => {
      const cb = args[args.length - 1] as () => unknown;
      return Promise.resolve(cb());
    }),
    _stores: stores,
  };

  const trans = {
    t: vi.fn((key: string) => dict[key] || key),
    lang: "es",
    setLang: vi.fn(),
  };

  const period = {
    computePeriodKey: vi.fn((date: string) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }),
  };

  return { mockDb: db, mockTranslation: trans, mockPeriodUtils: period };
});

vi.mock("../../db/schema", () => ({
  default: mockDb,
}));

vi.mock("../../hooks/useTranslation", () => ({
  useTranslation: () => mockTranslation,
}));

vi.mock("../../utils/periodUtils", () => mockPeriodUtils);

// Mock useLiveQuery to return categories and cards arrays
const mockCategoriesState = vi.hoisted(() => ({ value: [] as unknown[] }));
const mockCardsState = vi.hoisted(() => ({ value: [] as unknown[] }));

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn((queryFn: () => unknown[]) => {
    const fnStr = queryFn.toString();
    if (fnStr.includes("categories")) {
      return mockCategoriesState.value;
    }
    if (fnStr.includes("cards")) {
      return mockCardsState.value;
    }
    return [];
  }),
}));

// Mock global fetch for exchange rates
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ---- Now import the component (imports are static, so this is fine after mocks) ----
import ExpenseForm from "../ExpenseForm";

describe("ExpenseForm", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoriesState.value = [
      { id: "cat-food", name: "Comida", updatedAt: 1 },
      { id: "cat-transport", name: "Transporte", updatedAt: 1 },
    ];
    // card-cash is rendered hardcoded in the component's <select>, so don't
    // return it from useLiveQuery to avoid duplicate options
    mockCardsState.value = [
      { id: "card-1", name: "Visa", billingDay: 15, limit: 5000, updatedAt: 1 },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          rates: { USD: 1, MXN: 20, EUR: 0.85 },
        }),
    });
    // Reset store data
    mockDb._stores.categories.clear();
    mockDb._stores.cards.clear();
    mockDb._stores.expenses.clear();
    for (const c of mockCategoriesState.value) {
      mockDb._stores.categories.set((c as any).id, c);
    }
    for (const c of mockCardsState.value) {
      mockDb._stores.cards.set((c as any).id, c);
    }
  });

  it("renderiza el formulario en modo creación con los campos requeridos", () => {
    render(<ExpenseForm onClose={onClose} />);

    // Modal title
    expect(
      screen.getByRole("heading", { name: /agregar gasto/i }),
    ).toBeInTheDocument();

    // Labels and inputs using getByLabelText (works because label is adjacent)
    expect(screen.getByLabelText(/cantidad/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/categoría/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tarjeta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();

    // Buttons
    expect(
      screen.getByRole("button", { name: /guardar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancelar/i }),
    ).toBeInTheDocument();
  });

  it("llama a onClose al hacer clic en cancelar", async () => {
    const user = userEvent.setup();
    render(<ExpenseForm onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("no envía el formulario si los campos obligatorios están vacíos", async () => {
    const user = userEvent.setup();
    render(<ExpenseForm onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mockDb.expenses.add).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("envía el formulario correctamente con datos válidos", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          rates: { USD: 1, MXN: 20, EUR: 0.85 },
        }),
    });

    const user = userEvent.setup();
    render(<ExpenseForm onClose={onClose} />);

    // Fill amount
    await user.type(screen.getByLabelText(/cantidad/i), "150");
    // Fill description
    await user.type(screen.getByLabelText(/descripción/i), "Cena");

    // Select category
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-food");
    // Select card
    await user.selectOptions(screen.getByLabelText(/tarjeta/i), "card-1");

    // Date
    const dateInput = screen.getByLabelText(/fecha/i) as HTMLInputElement;
    await user.clear(dateInput);
    await user.type(dateInput, "2026-09-07");

    // Submit
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockDb.expenses.add).toHaveBeenCalledTimes(1);
    });

    const addedExpense = (mockDb.expenses.add as any).mock.calls[0][0];
    expect(addedExpense.description).toBe("Cena");
    expect(addedExpense.originalAmount).toBe(150);
    expect(addedExpense.cardId).toBe("card-1");
    expect(addedExpense.categoryId).toBe("cat-food");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renderiza el formulario en modo edición con datos pre-cargados", () => {
    const existingExpense = {
      id: "exp-1",
      amount: 100,
      originalAmount: 100,
      currency: "USD",
      exchangeRate: 1,
      description: "Taxi",
      categoryId: "cat-transport",
      cardId: "card-cash",
      date: "2026-09-01",
      periodKey: "2026-09",
      updatedAt: Date.now(),
    };

    render(<ExpenseForm onClose={onClose} expense={existingExpense} />);

    expect(
      screen.getByRole("heading", { name: /editar gasto/i }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/descripción/i)).toHaveValue("Taxi");
    expect(screen.getByLabelText(/cantidad/i)).toHaveValue(100);
  });

  it("muestra las opciones de categorías y tarjetas", () => {
    render(<ExpenseForm onClose={onClose} />);

    const categorySelect = screen.getByLabelText(/categoría/i);
    const categoryOptions = categorySelect.querySelectorAll("option");
    // placeholder "----" + 2 categories = 3
    expect(categoryOptions.length).toBe(3);

    const cardSelect = screen.getByLabelText(/tarjeta/i);
    const cardOptions = cardSelect.querySelectorAll("option");
    // hardcoded "card-cash" + 1 card from useLiveQuery = 2
    expect(cardOptions.length).toBe(2);
  });
});
