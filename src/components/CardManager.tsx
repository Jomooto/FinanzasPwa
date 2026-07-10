import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../db/schema";
import { useTranslation } from "../hooks/useTranslation";
import { Trash, CreditCard, PlusCircle, Wallet } from "@phosphor-icons/react";

const CardManager: React.FC = () => {
  const { t, lang } = useTranslation();
  const [name, setName] = useState("");
  const [billingDay, setBillingDay] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cards = useLiveQuery(() => db.cards.toArray());
  const cashCard = cards?.find((c) => c.id === "card-cash");
  const creditCards = cards?.filter((c) => c.id !== "card-cash") || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name || !billingDay || !limit) return;

    const billingDayNum = parseInt(billingDay);
    if (isNaN(billingDayNum) || billingDayNum < 1 || billingDayNum > 31) {
      setError(t("billing_day_error"));
      return;
    }

    const limitNum = parseFloat(limit);
    if (isNaN(limitNum) || limitNum < 0) {
      setError(t("limit_error"));
      return;
    }

    await db.cards.add({
      id: crypto.randomUUID(),
      name,
      billingDay: billingDayNum,
      limit: limitNum,
      updatedAt: Date.now(),
    });

    setName("");
    setBillingDay("");
    setLimit("");
  };

  const handleDelete = async (cardId: string) => {
    setError(null);
    try {
      // Check if there are active debts or expenses linked to this card
      const linkedExpenses = await db.expenses
        .where("cardId")
        .equals(cardId)
        .count();
      const linkedDebts = await db.debts.where("cardId").equals(cardId).count();

      if (linkedExpenses > 0 || linkedDebts > 0) {
        setError(t("delete_error_linked"));
        return;
      }

      await db.cards.delete(cardId);
    } catch (err: any) {
      setError(err.message || t("delete_error_generic"));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(lang, {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleCashBillingDayChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const day = parseInt(e.target.value, 10);
    if (isNaN(day) || day < 1 || day > 31) return;
    await db.cards.update("card-cash", {
      billingDay: day,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t("cards")}</h2>
        <p className="text-sm text-slate-400">{t("manage_cards_desc")}</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl text-sm transition-all duration-300">
          {error}
        </div>
      )}

      {/* Cash card config card */}
      {cashCard && (
        <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Wallet weight="duotone" className="text-blue-400" size={20} />
            {t("cash_config")}
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("billing_day")}
              </label>
              <input
                type="number" inputMode="numeric"
                min="1"
                max="31"
                value={cashCard.billingDay}
                onChange={handleCashBillingDayChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-sm text-slate-400 mt-6">
              {t("cash_billing_day_hint")}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="md:col-span-1 bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm h-fit">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PlusCircle weight="duotone" className="text-blue-400" size={20} />
            {t("add_card")}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("card_name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("card_name_placeholder")}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("billing_day")}
              </label>
              <input
                type="number" inputMode="numeric"
                min="1"
                max="31"
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value)}
                placeholder={t("billing_day_placeholder")}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("limit")}
              </label>
              <input
                type="number" inputMode="numeric"
                step="0.01"
                min="0"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder={t("limit_placeholder")}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-medium py-2 rounded-lg transition-colors mt-2 cursor-pointer"
            >
              {t("save")}
            </button>
          </form>
        </div>

        {/* List Column */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CreditCard weight="duotone" className="text-blue-400" size={20} />
            {t("cards_list")}
          </h3>

          {creditCards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {creditCards.map((card) => (
                <div
                  key={card.id}
                  className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-800/80 p-5 rounded-2xl border border-slate-700/60 shadow-lg flex flex-col justify-between h-40 hover:border-slate-600 transition-all group"
                >
                  {/* Card Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600/10 rounded-lg text-blue-400">
                        <CreditCard size={24} weight="duotone" />
                      </div>
                      <h4 className="font-semibold text-white text-base truncate max-w-[130px]">
                        {card.name}
                      </h4>
                    </div>
                    <button
                      onClick={() => handleDelete(card.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900/50 hover:bg-rose-500/10 border border-slate-700/30 rounded-lg transition-colors cursor-pointer"
                      title={t("delete_card")}
                    >
                      <Trash size={16} />
                    </button>
                  </div>

                  {/* Card Details */}
                  <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      {t("credit_limit")}
                    </p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(card.limit)}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div className="flex justify-between items-center text-xs text-slate-400 mt-2 border-t border-slate-700/40 pt-2">
                    <span>
                      {t("billing_prefix")} {card.billingDay}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ID: {card.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-800/10 rounded-2xl border border-slate-700/30">
              <CreditCard
                size={48}
                className="mx-auto text-slate-600 mb-3"
                weight="thin"
              />
              <p className="text-slate-400">{t("no_cards")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardManager;
