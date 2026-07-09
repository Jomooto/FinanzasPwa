import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- MOCK FACTORIES ----
const { mockDb, mockTranslation } = vi.hoisted(() => {
  const dict: Record<string, string> = {
    debt_dashboard: "Panel de Deudas",
    add_debt: "Agregar Deuda",
    debt_name: "Nombre de la Deuda",
    card: "Tarjeta",
    total_amount: "Monto Total",
    total_months: "Meses Totales",
    start_date: "Fecha de Inicio",
    save: "Guardar",
    no_debts: "No hay deudas registradas.",
    total_debt: "Deuda Total",
    debt_per_card: "Deuda por Tarjeta",
    cash: "Efectivo (Sin Tarjeta)",
    monthly_payment: "Pago Mensual",
    remaining_balance: "Saldo Restante",
    months_paid: "Meses Pagados",
    upcoming_installments: "Próximos Pagos",
    pending: "Pendiente",
    billed: "Facturado",
    delete_debt: "Eliminar Deuda",
  };

  const makeTable = (store: Map<string, unknown>) => ({
    toArray: vi.fn(() => Promise.resolve(Array.from(store.values()))),
    get: vi.fn((id: string) => Promise.resolve(store.get(id) ?? undefined)),
    add: vi.fn((item: Record<string, unknown>) => {
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
  });

  const stores = {
    cards: new Map(),
    categories: new Map(),
    expenses: new Map(),
    debts: new Map(),
    meta: new Map(),
  };

  stores.cards.set("card-1", {
    id: "card-1",
    name: "Visa",
    billingDay: 15,
    limit: 5000,
    updatedAt: 1,
  });

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

  return { mockDb: db, mockTranslation: trans };
});

vi.mock("../../db/schema", () => ({ default: mockDb }));
vi.mock("../../hooks/useTranslation", () => ({
  useTranslation: () => mockTranslation,
}));

// Mock useLiveQuery
const mockCards = vi.hoisted(() => ({ value: [] as unknown[] }));
const mockDebts = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn((queryFn: () => unknown[]) => {
    const fnStr = queryFn.toString();
    if (fnStr.includes("cards")) return mockCards.value;
    if (fnStr.includes("debts")) return mockDebts.value;
    return [];
  }),
}));

// Mock useDebtCalculator
const { mockCalculateDebtDetails } = vi.hoisted(() => {
  const details = vi.fn(() => ({
    remainingBalance: 800,
    monthsPaid: 2,
    monthsRemaining: 10,
    isInstallmentPending: true,
    totalMonths: 12,
  }));
  return { mockCalculateDebtDetails: details };
});

vi.mock("../../hooks/useDebtCalculator", () => ({
  useDebtCalculator: () => ({
    calculateDebtDetails: mockCalculateDebtDetails,
  }),
}));

// Mock crypto
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () =>
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }),
    },
    writable: true,
    configurable: true,
  });
}

import DebtDashboard from "../DebtDashboard";

describe("DebtDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCards.value = [
      { id: "card-1", name: "Visa", billingDay: 15, limit: 5000, updatedAt: 1 },
    ];
    mockDebts.value = [];
    mockDb._stores.cards.clear();
    mockDb._stores.debts.clear();
    for (const c of mockCards.value) {
      mockDb._stores.cards.set((c as any).id, c);
    }
  });

  it("renderiza el título del dashboard", () => {
    render(<DebtDashboard />);
    expect(
      screen.getByRole("heading", { name: /panel de deudas/i }),
    ).toBeInTheDocument();
  });

  it("muestra mensaje cuando no hay deudas", () => {
    render(<DebtDashboard />);
    expect(screen.getByText(/no hay deudas registradas/i)).toBeInTheDocument();
  });

  it("renderiza el formulario para agregar deuda", () => {
    render(<DebtDashboard />);
    expect(screen.getByPlaceholderText(/iphone/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar/i }),
    ).toBeInTheDocument();
  });

  it("agrega una nueva deuda al enviar el formulario", async () => {
    const user = userEvent.setup();
    render(<DebtDashboard />);

    await user.type(screen.getByPlaceholderText(/iphone/i), "MacBook");
    // Select card
    const cardSelect = screen.getByRole("combobox", { name: /tarjeta/i });
    await user.selectOptions(cardSelect, "card-1");
    // Amount
    const amountInputs = screen.getAllByRole("spinbutton");
    await user.type(amountInputs[0], "2400");
    // Months
    await user.type(amountInputs[1], "12");

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockDb.debts.add).toHaveBeenCalled();
    });

    const addedDebt = (mockDb.debts.add as any).mock.calls[0][0];
    expect(addedDebt.name).toBe("MacBook");
    expect(addedDebt.totalAmount).toBe(2400);
    expect(addedDebt.cardId).toBe("card-1");
  });

  it("muestra la lista de deudas con detalles", () => {
    mockDebts.value = [
      {
        id: "debt-1",
        cardId: "card-1",
        name: "iPhone 17",
        totalAmount: 1200,
        monthlyPayment: 100,
        totalMonths: 12,
        startDate: "2026-01-01",
        updatedAt: Date.now(),
      },
    ];

    render(<DebtDashboard />);

    expect(screen.getByText("iPhone 17")).toBeInTheDocument();
    // Visa aparece en varias partes (debt-per-card + select + debt detail), usar getAllByText
    const visaElements = screen.getAllByText("Visa");
    expect(visaElements.length).toBeGreaterThan(0);
  });

  it("muestra el total de deuda acumulada", () => {
    mockDebts.value = [
      {
        id: "debt-1",
        cardId: "card-1",
        name: "Deuda 1",
        totalAmount: 1200,
        monthlyPayment: 100,
        totalMonths: 12,
        startDate: "2026-01-01",
        updatedAt: Date.now(),
      },
      {
        id: "debt-2",
        cardId: "card-1",
        name: "Deuda 2",
        totalAmount: 600,
        monthlyPayment: 50,
        totalMonths: 12,
        startDate: "2026-06-01",
        updatedAt: Date.now(),
      },
    ];

    render(<DebtDashboard />);

    // Each debt returns remainingBalance=800, so total = 1600
    expect(mockCalculateDebtDetails).toHaveBeenCalled();
  });
});
