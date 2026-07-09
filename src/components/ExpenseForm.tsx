import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../db/schema";
import { useTranslation } from "../hooks/useTranslation";
import { X } from "@phosphor-icons/react";
import type { Expense, Card } from "../db/schema";
import { computePeriodKey } from "../utils/periodUtils";

interface ExchangeRate {
  [key: string]: number;
}

const fetchExchangeRates = async (
  base: string,
): Promise<ExchangeRate | null> => {
  try {
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${base}`,
    );
    const data = await response.json();
    return data.rates;
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    return null;
  }
};

interface ExpenseFormProps {
  onClose: () => void;
  expense?: Expense; // si se pasa, estamos en modo edición
}

const getInitialDate = () => new Date().toISOString().split("T")[0];
const getInitialCurrency = (expense?: Expense) => {
  if (expense) return expense.currency;
  return localStorage.getItem("selectedCurrency") || "USD";
};

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onClose, expense }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<string>(
    expense ? expense.originalAmount.toString() : "",
  );
  const [description, setDescription] = useState<string>(
    expense ? expense.description : "",
  );
  const [categoryId, setCategoryId] = useState<string>(
    expense ? expense.categoryId : "",
  );
  const [cardId, setCardId] = useState<string>(
    expense ? expense.cardId || "" : "",
  );
  const [date, setDate] = useState<string>(
    expense ? expense.date : getInitialDate(),
  );
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    getInitialCurrency(expense),
  );
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate | null>(null);

  const defaultCurrency = "USD";

  useEffect(() => {
    const fetchRates = async () => {
      const rates = await fetchExchangeRates(defaultCurrency);
      if (rates) {
        setExchangeRates(rates);
      }
    };
    fetchRates();
  }, []);

  useEffect(() => {
    if (!expense) {
      localStorage.setItem("selectedCurrency", selectedCurrency);
    }
  }, [selectedCurrency, expense]);

  const categories = useLiveQuery(() => db.categories.toArray());
  const cards = useLiveQuery(() => db.cards.toArray());

  const getCardBillingDay = (): number => {
    // Si no hay cardId, usamos la tarjeta de efectivo
    const effectiveCardId = cardId || "card-cash";
    const card = cards?.find((c: Card) => c.id === effectiveCardId);
    return card?.billingDay ?? 31;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !categoryId || !date) return;
    const billingDay = getCardBillingDay();
    const periodKey = computePeriodKey(date, billingDay);

    let finalAmount = parseFloat(amount);
    let exchangeRate = 1;

    if (selectedCurrency !== defaultCurrency) {
      const rates = await fetchExchangeRates(defaultCurrency);
      if (rates && rates[selectedCurrency]) {
        exchangeRate = 1 / rates[selectedCurrency];
        finalAmount = parseFloat(amount) * exchangeRate;
      } else {
        console.warn(
          "Could not fetch exchange rate for selected currency. Saving in default currency.",
        );
      }
    }

    if (expense) {
      // Modo edición: actualizar gasto existente
      await db.expenses.update(expense.id, {
        amount: finalAmount,
        originalAmount: parseFloat(amount),
        currency: selectedCurrency,
        exchangeRate,
        description,
        categoryId,
        cardId: cardId || "card-cash",
        date,
        periodKey,
        updatedAt: Date.now(),
      });
    } else {
      // Modo creación: agregar nuevo gasto
      await db.expenses.add({
        id: crypto.randomUUID(),
        amount: finalAmount,
        originalAmount: parseFloat(amount),
        currency: selectedCurrency,
        exchangeRate,
        description,
        categoryId,
        cardId: cardId || "card-cash",
        date,
        periodKey,
        updatedAt: Date.now(),
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 overflow-y-auto">
      <div className="glass-container border border-white/10 rounded-2xl shadow-xl w-full max-w-md my-8">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">
              {expense ? t("edit_expense") : t("add_expense")}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} weight="bold" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="expense-amount"
                className="block text-sm font-medium text-slate-400 mb-1"
              >
                {t("amount")}
              </label>
              <div className="flex rounded-lg shadow-sm">
                <input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-l-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="bg-slate-800 border border-slate-700 border-l-0 rounded-r-lg px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {exchangeRates &&
                    Object.keys(exchangeRates).map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="expense-description"
                className="block text-sm font-medium text-slate-400 mb-1"
              >
                {t("description")}
              </label>
              <input
                id="expense-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label
                htmlFor="expense-category"
                className="block text-sm font-medium text-slate-400 mb-1"
              >
                {t("category")}
              </label>
              <select
                id="expense-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="" disabled>
                  -- {t("category")} --
                </option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="expense-card"
                className="block text-sm font-medium text-slate-400 mb-1"
              >
                {t("card")}
              </label>
              <select
                id="expense-card"
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="card-cash">{t("cash")}</option>
                {cards?.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="expense-date"
                className="block text-sm font-medium text-slate-400 mb-1"
              >
                {t("date")}
              </label>
              <input
                id="expense-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-500/30"
              >
                {t("save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExpenseForm;
