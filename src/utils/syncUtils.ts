import db from '../db/schema';
import type { Card, Category, Debt, Expense, MetaData } from '../db/schema';

export type NormalizedData = {
  meta: MetaData;
  config: {
    cards: Record<string, Card>;
    categories: Record<string, Category>;
  };
  data: {
    debts: Record<string, Debt>;
    expenses: Record<string, Expense>;
  };
};

export const normalizeData = async (): Promise<NormalizedData> => {
  const cards = await db.cards.toArray();
  const categories = await db.categories.toArray();
  const debts = await db.debts.toArray();
  const expenses = await db.expenses.toArray();
  const meta = await db.meta.get('meta') || { id: 'meta', lastSync: Date.now(), version: 1 };

  const toRecord = <T extends { id: string }>(arr: T[]) =>
    arr.reduce((acc, item) => ({ ...acc, [item.id]: item }), {} as Record<string, T>);

  return {
    meta,
    config: {
      cards: toRecord(cards),
      categories: toRecord(categories),
    },
    data: {
      debts: toRecord(debts),
      expenses: toRecord(expenses),
    },
  };
};

export const denormalizeData = async (normalized: NormalizedData): Promise<void> => {
  await db.transaction('rw', db.cards, db.categories, db.debts, db.expenses, db.meta, async () => {
    
    const mergeTable = async <T extends { id: string; updatedAt: number }>(
      table: any,
      remoteData: Record<string, T>
    ) => {
      for (const id of Object.keys(remoteData)) {
        const remoteItem = remoteData[id];
        const localItem = await table.get(id);
        
        if (!localItem || remoteItem.updatedAt > localItem.updatedAt) {
          await table.put(remoteItem);
        }
      }
    };

    await mergeTable(db.cards, normalized.config.cards);
    await mergeTable(db.categories, normalized.config.categories);
    await mergeTable(db.debts, normalized.data.debts);
    await mergeTable(db.expenses, normalized.data.expenses);
    
    // Update meta
    if (normalized.meta) {
      await db.meta.put(normalized.meta);
    }
  });
};
