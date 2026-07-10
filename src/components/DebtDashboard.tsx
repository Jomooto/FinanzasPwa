import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../db/schema";
import { useTranslation } from "../hooks/useTranslation";
import { useDebtCalculator } from "../hooks/useDebtCalculator";
import {
  Trash,
  CalendarBlank,
  PlusCircle,
  CreditCard,
  ChartBar,
} from "@phosphor-icons/react";

const DebtDashboard: React.FC = () => {
  const { t, lang } = useTranslation();
  const { calculateDebtDetails } = useDebtCalculator();

  const [name, setName] = useState("");
  const [cardId, setCardId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [totalMonths, setTotalMonths] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [error, setError] = useState<string | null>(null);

  const cards = useLiveQuery(() => db.cards.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !cardId || !totalAmount || !totalMonths || !startDate)
      return;

    const amountNum = parseFloat(totalAmount);
    const monthsNum = parseInt(totalMonths);

    if (isNaN(amountNum) || amountNum <= 0) {
      setError(
        lang === "es"
          ? "El monto total debe ser mayor a 0"
          : "Total amount must be greater than 0",
      );
      return;
    }

    if (isNaN(monthsNum) || monthsNum <= 0) {
      setError(
        lang === "es"
          ? "Los meses totales deben ser mayores a 0"
          : "Total months must be greater than 0",
      );
      return;
    }

    const monthlyPayment = parseFloat((amountNum / monthsNum).toFixed(2));

    await db.debts.add({
      id: crypto.randomUUID(),
      cardId,
      name: name.trim(),
      totalAmount: amountNum,
      monthlyPayment,
      totalMonths: monthsNum,
      startDate,
      updatedAt: Date.now(),
    });

    setName("");
    setCardId("");
    setTotalAmount("");
    setTotalMonths("");
    setStartDate(new Date().toISOString().split("T")[0]);
  };

  const handleDelete = async (debtId: string) => {
    if (
      confirm(lang === "es" ? "¿Eliminar esta deuda?" : "Delete this debt?")
    ) {
      await db.debts.delete(debtId);
    }
  };

  const formatCurrency = (amount: number) => {
    const currency =
      localStorage.getItem("selectedCurrency") ||
      (lang === "es" ? "MXN" : "USD");
    return new Intl.NumberFormat(lang, {
      style: "currency",
      currency,
    }).format(amount);
  };

  // Process data
  const cardMap = new Map(cards?.map((c) => [c.id, c]) || []);

  // Calculate aggregated stats
  const debtPerCardMap: Record<string, number> = {};

  const processedDebts = (debts || []).map((debt) => {
    const card = cardMap.get(debt.cardId);
    const details = calculateDebtDetails(debt, card);

    if (debt.cardId) {
      debtPerCardMap[debt.cardId] =
        (debtPerCardMap[debt.cardId] || 0) + details.remainingBalance;
    }

    return {
      debt,
      card,
      ...details,
    };
  });

  const overallTotalDebt = Object.values(debtPerCardMap).reduce(
    (sum, v) => sum + v,
    0,
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {t("debt_dashboard")}
        </h2>
        <p className="text-sm text-slate-400">
          {lang === "es"
            ? "Monitorea tus compras a meses sin intereses (MSI) y deudas por tarjeta."
            : "Track your months-without-interest (MSI) purchases and debt per credit card."}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Outstanding Debt Card */}
        <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 p-6 rounded-2xl border border-blue-500/30 shadow-lg">
          <p className="text-xs uppercase tracking-wider text-blue-300 font-semibold mb-1">
            {t("total_debt")}
          </p>
          <p className="text-3xl font-extrabold text-white">
            {formatCurrency(overallTotalDebt)}
          </p>
        </div>

        {/* Debt per Card breakdown */}
        <div className="md:col-span-2 bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <CreditCard weight="duotone" className="text-blue-400" />
            {t("debt_per_card")}
          </h3>
          {cards && cards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[120px] overflow-y-auto pr-1">
              {cards.map((card) => {
                const amount = debtPerCardMap[card.id] || 0;
                return (
                  <div
                    key={card.id}
                    className="flex justify-between items-center bg-slate-900/60 p-2 px-3 rounded-lg border border-slate-800"
                  >
                    <span className="text-slate-300 text-sm font-medium truncate max-w-[120px]">
                      {card.name}
                    </span>
                    <span className="text-white text-sm font-bold">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{t("no_cards")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Debt Form */}
        <div className="md:col-span-1 bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm h-fit">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PlusCircle weight="duotone" className="text-blue-400" size={20} />
            {t("add_debt")}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("debt_name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. iPhone 17"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label
                htmlFor="debt-card"
                className="block text-sm font-medium text-slate-400 mb-1"
              >
                {t("card")}
              </label>
              <select
                id="debt-card"
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              >
                <option value="" disabled>
                  -- {t("card")} --
                </option>
                {cards?.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("total_amount")}
              </label>
              <input
                type="number"
                inputMode="numeric"
                step="0.01"
                min="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="e.g. 1200"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("total_months")}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={totalMonths}
                onChange={(e) => setTotalMonths(e.target.value)}
                placeholder="e.g. 12"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("start_date")}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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

        {/* Debts & Upcoming Installments List */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CalendarBlank
              weight="duotone"
              className="text-blue-400"
              size={20}
            />
            {t("upcoming_installments")}
          </h3>

          {processedDebts && processedDebts.length > 0 ? (
            <div className="space-y-4">
              {processedDebts.map(
                ({
                  debt,
                  card,
                  monthsPaid,
                  remainingBalance,
                  isInstallmentPending,
                }) => (
                  <div
                    key={debt.id}
                    className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 flex flex-col gap-3 hover:border-slate-600 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white text-lg">
                          {debt.name}
                        </h4>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <CreditCard size={14} />
                          {card ? card.name : t("cash")} •{" "}
                          {lang === "es"
                            ? `Corte: Día ${card?.billingDay || 1}`
                            : `Billing: Day ${card?.billingDay || 1}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                            isInstallmentPending
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {isInstallmentPending ? t("pending") : t("billed")}
                        </span>
                        <button
                          onClick={() => handleDelete(debt.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900/50 hover:bg-rose-500/10 border border-slate-700/30 rounded-lg transition-colors cursor-pointer"
                          title={t("delete_debt")}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Pricing Info */}
                    <div className="grid grid-cols-3 gap-2 py-1 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                      <div>
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider">
                          {t("monthly_payment")}
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {formatCurrency(debt.monthlyPayment)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider">
                          {t("remaining_balance")}
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {formatCurrency(remainingBalance)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider">
                          {t("total_amount")}
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {formatCurrency(debt.totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>
                          {t("months_paid")}: {monthsPaid} / {debt.totalMonths}
                        </span>
                        <span>
                          {Math.round((monthsPaid / debt.totalMonths) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(monthsPaid / debt.totalMonths) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-800/10 rounded-2xl border border-slate-700/30">
              <ChartBar
                size={48}
                className="mx-auto text-slate-600 mb-3"
                weight="thin"
              />
              <p className="text-slate-400">{t("no_debts")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebtDashboard;
