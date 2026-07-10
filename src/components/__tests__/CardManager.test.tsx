import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- MOCK FACTORIES ----
const { mockDb, mockTranslation } = vi.hoisted(() => {
  const dict: Record<string, string> = {
    cards: "Tarjetas",
    manage_cards_desc: "Administra tus tarjetas de crédito y cuentas.",
    cash_config: "Configuración de Efectivo",
    billing_day: "Día de Corte (1-31)",
    cash_billing_day_hint: "Define el día de corte para gastos en efectivo.",
    add_card: "Agregar Tarjeta",
    card_name: "Nombre de la Tarjeta",
    card_name_placeholder: "Ej. Visa Premier",
    billing_day_placeholder: "Ej. 15",
    limit: "Límite de Crédito",
    limit_placeholder: "Ej. 5000",
    save: "Guardar",
    cards_list: "Mis Tarjetas",
    no_cards: "Aún no se han agregado tarjetas.",
    credit_limit: "Límite de Crédito",
    billing_prefix: "Corte: Día",
    delete_card: "Eliminar Tarjeta",
    delete_error_linked:
      "No se puede eliminar la tarjeta: hay deudas o gastos activos asociados a ella.",
    delete_error_generic: "Error al eliminar la tarjeta",
    billing_day_error: "El día de corte debe estar entre 1 y 31",
    limit_error: "El límite debe ser un número válido mayor o igual a 0",
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

  // Add default cash card
  stores.cards.set("card-cash", {
    id: "card-cash",
    name: "Efectivo",
    billingDay: 31,
    limit: 0,
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
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(() => mockCards.value),
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

import CardManager from "../CardManager";

describe("CardManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Include card-cash in useLiveQuery so cash config renders
    mockCards.value = [
      {
        id: "card-cash",
        name: "Efectivo",
        billingDay: 31,
        limit: 0,
        updatedAt: 1,
      },
      { id: "card-1", name: "Visa", billingDay: 15, limit: 5000, updatedAt: 1 },
      {
        id: "card-2",
        name: "Mastercard",
        billingDay: 10,
        limit: 3000,
        updatedAt: 1,
      },
    ];
    mockDb._stores.cards.clear();
    for (const c of mockCards.value) {
      mockDb._stores.cards.set((c as any).id, c);
    }
  });

  it("renderiza el título principal y la descripción", () => {
    render(<CardManager />);
    // Use getAllByRole and pick the first <h2>
    const headings = screen.getAllByRole("heading", { name: /tarjetas/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByText(/administra tus tarjetas/i)).toBeInTheDocument();
  });

  it("renderiza la configuración de efectivo", () => {
    render(<CardManager />);
    expect(screen.getByText("Configuración de Efectivo")).toBeInTheDocument();
  });

  it("muestra la lista de tarjetas", () => {
    render(<CardManager />);
    expect(screen.getByText("Visa")).toBeInTheDocument();
    expect(screen.getByText("Mastercard")).toBeInTheDocument();
  });

  it("agrega una nueva tarjeta al enviar el formulario", async () => {
    const user = userEvent.setup();
    render(<CardManager />);

    await user.type(
      screen.getByPlaceholderText(/ej. visa premier/i),
      "Nueva Card",
    );
    await user.type(screen.getByPlaceholderText(/ej. 15/i), "20");
    await user.type(screen.getByPlaceholderText(/ej. 5000/i), "10000");

    // Hay dos botones "Guardar": uno en cash config y otro en add card form
    const saveButtons = screen.getAllByRole("button", { name: /guardar/i });
    await user.click(saveButtons[1]); // el segundo es el del formulario add card

    await waitFor(() => {
      expect(mockDb.cards.add).toHaveBeenCalled();
    });

    const addedCard = (mockDb.cards.add as any).mock.calls[0][0];
    expect(addedCard.name).toBe("Nueva Card");
    expect(addedCard.billingDay).toBe(20);
    expect(addedCard.limit).toBe(10000);
  });
});
