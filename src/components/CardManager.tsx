import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../db/schema";
import { useTranslation } from "../hooks/useTranslation";
import {
  Trash,
  CreditCard,
  PlusCircle,
  Wallet,
  PencilSimple,
} from "@phosphor-icons/react";

const CardManager: React.FC = () => {
  const { t, lang } = useTranslation();
  const [name, setName] = useState("");
  const [billingDay, setBillingDay] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBillingDay, setEditBillingDay] = useState("");
  const [editLimit, setEditLimit] = useState("");
  const [cashBillingDay, setCashBillingDay] = useState(31);
  const [cashLimit, setCashLimit] = useState(0);
  const [cashSaved, setCashSaved] = useState(false);

  const cards = useLiveQuery(() => db.cards.toArray());
  const cashCard = cards?.find((c) => c.id === "card-cash");
  const creditCards = cards?.filter((c) => c.id !== "card-cash") || [];

  // Sync cash states from DB when cashCard loads
  useEffect(() => {
    if (cashCard) {
      setCashBillingDay(cashCard.billingDay);
      setCashLimit(cashCard.limit);
    }
  }, [cashCard?.billingDay, cashCard?.limit]);

  const saveCashConfig = async () => {
    await db.cards.update("card-cash", {
      billingDay: cashBillingDay,
      limit: cashLimit,
      updatedAt: Date.now(),
    });
    setCashSaved(true);
    setTimeout(() => setCashSaved(false), 2500);
  };

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
    const currency = localStorage.getItem("selectedCurrency") || "USD";
    return new Intl.NumberFormat(lang, {
      style: "currency",
      currency,
    }).format(amount);
  };

  const startEdit = (card: {
    id: string;
    name: string;
    billingDay: number;
    limit: number;
  }) => {
    setEditingCard(card.id);
    setEditName(card.name);
    setEditBillingDay(card.billingDay.toString());
    setEditLimit(card.limit.toString());
  };

  const saveEdit = async () => {
    if (!editingCard) return;
    const billingDayNum = parseInt(editBillingDay);
    const limitNum = parseFloat(editLimit);
    if (isNaN(billingDayNum) || billingDayNum < 1 || billingDayNum > 31) return;
    if (isNaN(limitNum) || limitNum < 0) return;
    await db.cards.update(editingCard, {
      name: editName,
      billingDay: billingDayNum,
      limit: limitNum,
      updatedAt: Date.now(),
    });
    setEditingCard(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t("cards")}</h2>
        <p className="text-sm text-slate-400">{t("manage_cards_desc")}</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Cash card config */}
      {cashCard && (
        <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Wallet weight="duotone" className="text-emerald-400" size={20} />
            {t("cash_config")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={t("cash")}
                disabled
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("billing_day")}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                value={cashBillingDay}
                onChange={(e) => {
                  const day = parseInt(e.target.value, 10);
                  if (!isNaN(day) && day >= 1 && day <= 31)
                    setCashBillingDay(day);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("limit")}
              </label>
              <input
                type="number"
                inputMode="numeric"
                step="0.01"
                min="0"
                value={cashLimit}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0) setCashLimit(val);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            {cashSaved && (
              <p className="text-xs text-emerald-400 animate-pulse">
                ✅ Configuración guardada
              </p>
            )}
            {!cashSaved && (
              <p className="text-xs text-slate-500">
                {t("cash_billing_day_hint")}
              </p>
            )}
            <button
              onClick={saveCashConfig}
              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-medium px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
            >
              {t("save")}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add card form */}
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
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("billing_day")}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value)}
                placeholder={t("billing_day_placeholder")}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("limit")}
              </label>
              <input
                type="number"
                inputMode="numeric"
                step="0.01"
                min="0"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder={t("limit_placeholder")}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {/* Card list */}
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
                  className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-800/80 p-5 sm:p-6 rounded-2xl border border-slate-700/60 shadow-lg flex flex-col justify-between h-48 sm:h-52 hover:border-slate-600 transition-all group"
                >
                  {editingCard === card.id ? (
                    <div className="flex flex-col gap-3 h-full">
                      <div>
                        <label className="text-[10px] text-slate-500 mb-0.5 block">
                          {t("card_name")}
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-500 mb-0.5 block">
                            {t("billing_day")}
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="31"
                            value={editBillingDay}
                            onChange={(e) => setEditBillingDay(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-500 mb-0.5 block">
                            {t("limit")}
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            step="0.01"
                            min="0"
                            value={editLimit}
                            onChange={(e) => setEditLimit(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-auto">
                        <button
                          onClick={() => setEditingCard(null)}
                          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded"
                        >
                          {t("cancel")}
                        </button>
                        <button
                          onClick={saveEdit}
                          className="text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-4 py-1.5 rounded-lg"
                        >
                          {t("save")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-600/10 rounded-lg text-blue-400">
                            <CreditCard size={24} weight="duotone" />
                          </div>
                          <h4 className="font-semibold text-white text-base truncate max-w-[100px]">
                            {card.name}
                          </h4>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(card)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 bg-slate-900/50 hover:bg-blue-500/10 border border-slate-700/30 rounded-lg cursor-pointer"
                            title={t("rename_category")}
                          >
                            <PencilSimple size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(card.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900/50 hover:bg-rose-500/10 border border-slate-700/30 rounded-lg cursor-pointer"
                            title={t("delete_card")}
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          {t("credit_limit")}
                        </p>
                        <p className="text-lg font-bold text-white">
                          {formatCurrency(card.limit)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-400 mt-2 border-t border-slate-700/40 pt-2">
                        <span>
                          {t("billing_prefix")} {card.billingDay}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ID: {card.id.slice(0, 8)}
                        </span>
                      </div>
                    </>
                  )}
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
