import Dexie, { type EntityTable } from 'dexie';

export interface Card {
  id: string;
  name: string;
  billingDay: number; // day of the month (1-31)
  limit: number; // credit limit
  updatedAt: number;
}


export interface Category {
  id: string;
  name: string;
  icon?: string;
  updatedAt: number;
}

/** Versión actual del algoritmo de cifrado. Incrementar al cambiar el esquema. */
export const CURRENT_CRYPTO_VERSION = 1;

export interface Expense {
  id: string;
  amount: number; // Stored in defaultCurrency (USD)
  originalAmount: number; // Original amount entered by user
  currency: string; // Currency used by the user for this expense
  exchangeRate: number; // Exchange rate at the time of transaction
  description: string;
  categoryId: string;
  cardId?: string; // Optional if cash
  date: string; // YYYY-MM-DD
  periodKey: string; // "YYYY-MM" — mes de cierre del periodo según billingDay de la tarjeta
  updatedAt: number;
  ciphertext?: string; // AES-256 encrypted payload if encrypted
  cryptoVersion?: number; // Versión del algoritmo de cifrado (1 = AES-256-CBC)
}

export interface Debt {
  id: string;
  cardId: string;
  name: string;
  totalAmount: number;
  monthlyPayment: number;
  totalMonths: number;
  startDate: string; // YYYY-MM-DD
  updatedAt: number;
}

export interface MetaData {
  id: string; // usually 'meta'
  lastSync: number;
  version: number;
  tokenFragment?: string; // Fragmento cifrado del token (para fragmentación 3-way)
}

const db = new Dexie('FinancialPWA') as Dexie & {
  cards: EntityTable<Card, 'id'>;
  categories: EntityTable<Category, 'id'>;
  expenses: EntityTable<Expense, 'id'>;
  debts: EntityTable<Debt, 'id'>;
  meta: EntityTable<MetaData, 'id'>;
};

// Schema declaration
db.version(1).stores({
  cards: 'id, name, billingDay, updatedAt',
  categories: 'id, name, updatedAt',
  expenses: 'id, categoryId, cardId, date, periodKey, updatedAt',
  debts: 'id, cardId, startDate, updatedAt',
  meta: 'id'
});

// Seed default cash card if empty
const seedDefaultCashCard = async () => {
  try {
    const cashCard = await db.cards.get('card-cash');
    if (!cashCard) {
      const lang = navigator.language.split('-')[0];
      await db.cards.add({
        id: 'card-cash',
        name: lang === 'es' ? 'Efectivo' : 'Cash',
        billingDay: 31,
        limit: 0,
        updatedAt: Date.now(),
      });
    }
  } catch (error) {
    console.error('Failed to seed default cash card:', error);
  }
};
seedDefaultCashCard();

// Seed default categories if empty
const getDefaultCategoryNames = () => {
  const lang = navigator.language.split('-')[0];
  if (lang === 'es') {
    return {
      food: 'Comida',
      transport: 'Transporte',
      entertainment: 'Entretenimiento',
      uncategorized: 'Sin categoría',
    };
  }
  return {
    food: 'Food',
    transport: 'Transport',
    entertainment: 'Entertainment',
    uncategorized: 'Uncategorized',
  };
};

// Actualizar nombres de categorías por defecto al idioma del navegador (migración)
const updateDefaultCategoryNames = async () => {
  try {
    const names = getDefaultCategoryNames();
    const defaults = [
      { id: 'cat-food', name: names.food },
      { id: 'cat-transport', name: names.transport },
      { id: 'cat-entertainment', name: names.entertainment },
      { id: 'cat-uncategorized', name: names.uncategorized },
    ];
    for (const def of defaults) {
      const existing = await db.categories.get(def.id);
      if (existing && existing.name !== def.name) {
        await db.categories.update(def.id, { name: def.name, updatedAt: Date.now() });
      }
    }
  } catch (error) {
    console.error('Failed to update default category names:', error);
  }
};

const seedDefaultCategories = async () => {
  try {
    const count = await db.categories.count();
    if (count === 0) {
      const names = getDefaultCategoryNames();
      await db.categories.bulkAdd([
        { id: 'cat-food', name: names.food, updatedAt: Date.now() },
        { id: 'cat-transport', name: names.transport, updatedAt: Date.now() },
        { id: 'cat-entertainment', name: names.entertainment, updatedAt: Date.now() },
        { id: 'cat-uncategorized', name: names.uncategorized, updatedAt: Date.now() }
      ]);
    }
  } catch (error) {
    console.error('Failed to seed default categories:', error);
  }
};
updateDefaultCategoryNames();
seedDefaultCategories();

export default db;

