import { vi } from "vitest";

// Mock crypto.randomUUID for jsdom
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      ...(globalThis.crypto || {}),
      randomUUID: () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }),
    },
    writable: true,
    configurable: true,
  });
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// ----- MOCK FACTORIES -----

/** Creates a mock db (Dexie) that mimics the schema tables */
export function createMockDb() {
  const stores: Record<string, Map<string, any>> = {
    cards: new Map(),
    categories: new Map(),
    expenses: new Map(),
    debts: new Map(),
    meta: new Map(),
  };

  const makeTable = (store: Map<string, any>) => ({
    toArray: vi.fn(() => Promise.resolve(Array.from(store.values()))),
    get: vi.fn((id: string) => Promise.resolve(store.get(id) ?? undefined)),
    add: vi.fn((item: any) => {
      store.set(item.id, { ...item });
      return Promise.resolve(item.id);
    }),
    put: vi.fn((item: any) => {
      store.set(item.id, { ...item });
      return Promise.resolve(item.id);
    }),
    update: vi.fn((id: string, changes: any) => {
      const existing = store.get(id);
      if (existing) {
        store.set(id, { ...existing, ...changes });
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

  return {
    cards: makeTable(stores.cards),
    categories: makeTable(stores.categories),
    expenses: makeTable(stores.expenses),
    debts: makeTable(stores.debts),
    meta: makeTable(stores.meta),
    transaction: vi.fn((...args: any[]) => {
      const cb = args[args.length - 1];
      return Promise.resolve(cb());
    }),
    // Stores reference for test inspection
    _stores: stores,
  };
}

export type MockDb = ReturnType<typeof createMockDb>;

/** Creates a mock useTranslation hook */
export function createMockTranslation() {
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

  const t = vi.fn((key: string) => dict[key] || key);

  return {
    t,
    lang: "es",
    setLang: vi.fn(),
  };
}

/** Creates mock periodUtils */
export function createMockPeriodUtils() {
  return {
    computePeriodKey: vi.fn((date: string, _billingDay?: number) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }),
  };
}