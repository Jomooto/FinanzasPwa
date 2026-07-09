import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- MOCK FACTORIES ----
const { mockDb, mockTranslation } = vi.hoisted(() => {
  const dict: Record<string, string> = {
    category: "Categoría",
    organize_categories_desc:
      "Organiza tus gastos en categorías personalizadas.",
    add_category: "Agregar Categoría",
    category_name: "Nombre de la Categoría",
    category_name_placeholder: "Ej. Comida",
    save: "Guardar",
    categories_list: "Mis Categorías",
    no_categories: "Aún no se han agregado categorías.",
    uncategorized: "Sin categoría",
    rename_category: "Renombrar Categoría",
    rename: "Renombrar",
    rename_error: "Error al renombrar la categoría",
    delete_category: "Eliminar Categoría",
    cannot_delete_default_category:
      "No se puede eliminar la categoría predeterminada.",
    delete_category_error: "Error al eliminar la categoría",
    reassign_modal_title: "¿Reasignar Gastos?",
    reassign_modal_desc_templated:
      'La categoría "{name}" está asociada a {count} gasto(s). ¿Deseas reasignarlos a "{uncategorized}" y eliminar esta categoría?',
    reassign_and_delete: "Reasignar y Eliminar",
    cancel: "Cancelar",
    category_exists_error: "Esta categoría ya existe.",
    reassign_error: "Error durante la reasignación y eliminación",
    dropbox_sync: "Sincronización con Dropbox",
    dropbox_not_connected: "No hay sesión de Dropbox activa.",
    chart_type: "Tipo de gráfica",
    chart_bar: "Barras",
    chart_pie: "Pastel",
    chart_doughnut: "Dona",
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

  return { mockDb: db, mockTranslation: trans };
});

vi.mock("../../db/schema", () => ({ default: mockDb }));
vi.mock("../../hooks/useTranslation", () => ({
  useTranslation: () => mockTranslation,
}));

// Mock useLiveQuery
const mockCategories = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(() => mockCategories.value),
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

// Mock localStorage for chart type
const mockStorage = vi.hoisted(() => {
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
});
Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
  configurable: true,
});

import CategoryManager from "../CategoryManager";

describe("CategoryManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
    mockCategories.value = [
      { id: "cat-food", name: "Comida", updatedAt: 1 },
      { id: "cat-transport", name: "Transporte", updatedAt: 1 },
      { id: "cat-uncategorized", name: "Sin categoría", updatedAt: 1 },
    ];
    mockDb._stores.categories.clear();
    for (const c of mockCategories.value) {
      mockDb._stores.categories.set((c as any).id, c);
    }
  });

  it("renderiza el título y la descripción", () => {
    render(<CategoryManager />);
    const headings = screen.getAllByRole("heading", { name: /categoría/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByText(/organiza tus gastos/i)).toBeInTheDocument();
  });

  it("muestra la lista de categorías", () => {
    render(<CategoryManager />);
    expect(screen.getByText("Comida")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
    expect(screen.getByText("Sin categoría")).toBeInTheDocument();
  });

  it("agrega una nueva categoría al enviar el formulario", async () => {
    const user = userEvent.setup();
    render(<CategoryManager />);

    await user.type(screen.getByPlaceholderText(/ej. comida/i), "Salud");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockDb.categories.add).toHaveBeenCalled();
    });

    const addedCat = (mockDb.categories.add as any).mock.calls[0][0];
    expect(addedCat.name).toBe("Salud");
  });

  it("no permite eliminar la categoría predeterminada", () => {
    render(<CategoryManager />);

    // Uncategorized item doesn't have a delete button, so we verify it's not present
    const deleteButtons = screen.getAllByRole("button", {
      name: /eliminar categoría/i,
    });
    // Only non-default categories should have delete buttons
    expect(deleteButtons.length).toBe(2);
  });
});
