import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useTranslation } from "./hooks/useTranslation";
import SyncButton from "./components/SyncButton";
import ExpenseForm from "./components/ExpenseForm";
import CardManager from "./components/CardManager";
import CategoryManager from "./components/CategoryManager";
import DebtDashboard from "./components/DebtDashboard";
import { useState, useMemo, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Expense } from "./db/schema";
import db from "./db/schema";
import { formatPeriodKey } from "./utils/periodUtils";
import { autoTable } from "jspdf-autotable";
import ExpenseChart, { type ChartType } from "./components/ExpenseChart";
import {
  Wallet,
  Cards,
  Gear,
  Receipt,
  PencilSimple,
  Trash,
  MagnifyingGlass,
  ChartBar,
  ChartLine,
  DownloadSimple,
} from "@phosphor-icons/react";

function Dashboard() {
  const { t, lang } = useTranslation();
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState("description");
  const [chartPeriod, setChartPeriod] = useState<string>("all");
  const [showChart, setShowChart] = useState(true);
  const chartType = (localStorage.getItem("chartType") || "bar") as ChartType;
  const allExpenses = useLiveQuery(() =>
    db.expenses.orderBy("date").reverse().toArray(),
  );
  const categories = useLiveQuery(() => db.categories.toArray());

  // Mapa de categoryId → nombre
  const categoryNames = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    categories?.forEach((cat) => {
      map[cat.id] = cat.name;
    });
    return map;
  }, [categories]);

  // Moneda configurada por el usuario
  const displayCurrency = localStorage.getItem("selectedCurrency") || "USD";

  const formatCurrency = useCallback(
    (amount: number) => {
      return new Intl.NumberFormat(lang, {
        style: "currency",
        currency: displayCurrency,
      }).format(amount);
    },
    [lang, displayCurrency],
  );

  const handleDelete = async (expenseId: string) => {
    await db.expenses.delete(expenseId);
    setDeleteConfirm(null);
  };

  // Filtro de búsqueda
  const filteredExpenses = useMemo(() => {
    if (!allExpenses) return [];
    if (!searchQuery.trim()) return allExpenses;
    const q = searchQuery.toLowerCase();
    return allExpenses.filter((exp) => {
      switch (searchField) {
        case "description":
          return exp.description.toLowerCase().includes(q);
        case "amount":
          return exp.originalAmount.toString().includes(q);
        case "date":
          return exp.date.includes(q);
        case "period": {
          const key = exp.periodKey || exp.date.slice(0, 7);
          if (key.includes(q)) return true;
          try {
            const formatted = formatPeriodKey(key, lang).toLowerCase();
            if (formatted.includes(q)) return true;
          } catch {
            // ignore
          }
          return false;
        }
        default:
          return exp.description.toLowerCase().includes(q);
      }
    });
  }, [allExpenses, searchQuery, searchField, lang]);

  // Periodos únicos
  const uniquePeriods = useMemo(() => {
    if (!allExpenses) return [];
    const keys = new Set<string>();
    allExpenses.forEach((exp) => {
      keys.add(exp.periodKey || exp.date.slice(0, 7));
    });
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [allExpenses]);

  // Expenses para la gráfica
  const chartExpenses = useMemo(() => {
    if (!allExpenses) return [];
    if (chartPeriod === "all") return filteredExpenses;
    return filteredExpenses.filter(
      (exp) => (exp.periodKey || exp.date.slice(0, 7)) === chartPeriod,
    );
  }, [filteredExpenses, chartPeriod]);

  // Agrupar por periodKey
  const grouped: Record<string, Expense[]> = {};
  filteredExpenses.forEach((exp) => {
    const key = exp.periodKey || exp.date.slice(0, 7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(exp);
  });

  const sortedPeriods = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const visiblePeriods = showAllPeriods
    ? sortedPeriods
    : sortedPeriods.slice(0, 3);

  const totalBalance = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Cabeceras CSV según idioma
  const csvHeaders = [
    t("csv_date"),
    t("csv_description"),
    t("csv_category"),
    t("csv_currency"),
    t("csv_amount"),
    t("csv_period"),
  ];

  // Exportar CSV
  const exportCSV = (expenses: Expense[], catNames: Record<string, string>) => {
    const rows = expenses.map((exp) => [
      exp.date,
      exp.description,
      catNames[exp.categoryId] || exp.categoryId,
      exp.currency,
      exp.originalAmount.toString(),
      exp.periodKey || "",
    ]);
    const csv = [csvHeaders, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Dibujar gráfica en el PDF según el tipo seleccionado
  const drawChartInPDF = (
    doc: any,
    expenses: Expense[],
    catNames: Record<string, string>,
    startY: number,
    chartType: ChartType,
  ) => {
    const grouped: Record<string, number> = {};
    expenses.forEach((exp) => {
      if (!grouped[exp.categoryId]) grouped[exp.categoryId] = 0;
      grouped[exp.categoryId] += exp.amount;
    });
    const entries = Object.entries(grouped).map(([id, total]) => ({
      name: catNames[id] || id,
      value: Math.round(total * 100) / 100,
    }));
    if (entries.length === 0) return startY;

    const currency = localStorage.getItem("selectedCurrency") || "USD";
    const fmt = (v: number) =>
      new Intl.NumberFormat(lang, { style: "currency", currency }).format(v);

    const barColors = [
      "#3b82f6",
      "#ef4444",
      "#22c55e",
      "#f59e0b",
      "#8b5cf6",
      "#ec4899",
      "#14b8a6",
      "#f97316",
      "#6366f1",
      "#84cc16",
    ];
    const pageWidth = doc.internal.pageSize.getWidth();
    const chartX = 20;
    const chartWidth = pageWidth - 40;
    const barAreaHeight = Math.max(40, entries.length * 22);
    const maxVal = Math.max(...entries.map((e) => e.value), 1);

    doc.text(t("expenses_chart"), 14, startY);

    if (chartType === "bar") {
      let y = startY + 10;
      entries.forEach((entry, i) => {
        const barWidth = (entry.value / maxVal) * chartWidth;
        const barHeight = 12;
        const col = barColors[i % barColors.length];
        doc.setFillColor(
          parseInt(col.slice(1, 3), 16),
          parseInt(col.slice(3, 5), 16),
          parseInt(col.slice(5, 7), 16),
        );
        doc.rect(chartX, y, Math.max(barWidth, 2), barHeight, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text(`${entry.name}: ${fmt(entry.value)}`, chartX + 2, y + 8);
        y += barHeight + 4;
      });
      return startY + 10 + barAreaHeight + 8;
    }

    // Pie / Doughnut: mostrar como leyenda de colores con porcentajes
    const total = entries.reduce((s, e) => s + e.value, 0);
    let y = startY + 10;
    const isDoughnut = chartType === "doughnut";
    const sliceH = isDoughnut ? 20 : 22;

    entries.forEach((entry, i) => {
      const pct = ((entry.value / total) * 100).toFixed(0);
      const col = barColors[i % barColors.length];
      // Círculo pequeño de color
      doc.setFillColor(
        parseInt(col.slice(1, 3), 16),
        parseInt(col.slice(3, 5), 16),
        parseInt(col.slice(5, 7), 16),
      );
      const dotR = isDoughnut ? 3 : 4;
      doc.circle(chartX + dotR, y + dotR, dotR, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(
        `${entry.name}: ${pct}% (${fmt(entry.value)})`,
        chartX + dotR * 2 + 4,
        y + dotR + 2,
      );
      y += sliceH;
    });

    return y + 10;
  };

  // Exportar PDF
  const exportPDF = (expenses: Expense[], catNames: Record<string, string>) => {
    import("jspdf").then(({ default: jsPDF }) => {
      const doc = new jsPDF();
      const title = t("app_title");
      const dateStr = new Date().toLocaleDateString(lang);
      doc.text(`${title} - ${t("expenses_report")}`, 14, 20);
      doc.text(`${t("csv_date")}: ${dateStr}`, 14, 28);

      // Tabla primero
      const rows = expenses.map((exp) => [
        exp.date,
        exp.description,
        catNames[exp.categoryId] || exp.categoryId,
        exp.originalAmount.toString(),
        exp.currency,
        exp.periodKey || "",
      ]);

      autoTable(doc, {
        head: [csvHeaders],
        body: rows,
        startY: 35,
        theme: "grid",
        styles: { fontSize: 8, textColor: [255, 255, 255] },
        headStyles: { fillColor: [59, 130, 246] },
        bodyStyles: { fillColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [51, 65, 85] },
      });

      // Gráfica después de la tabla (siempre barras en PDF)
      const lastAutoTable = (doc as any).lastAutoTable;
      const tableEndY = lastAutoTable ? lastAutoTable.finalY + 15 : 45;
      drawChartInPDF(doc, expenses, catNames, tableEndY, "bar");

      doc.save(`expenses_${new Date().toISOString().slice(0, 10)}.pdf`);
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="glass-container p-6 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-medium text-slate-300 mb-1">
              {t("total_balance_desc").replace("{currency}", displayCurrency)}
            </h2>
            <p className="text-3xl font-bold text-white">
              {formatCurrency(totalBalance)}
            </p>
          </div>
          <button
            onClick={() => setShowExpenseForm(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/20 cursor-pointer text-wrap break-words max-w-[160px] line-clamp-2"
          >
            {t("add_expense")}
          </button>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="glass-container rounded-2xl border border-white/10 backdrop-blur-md p-3">
        <div className="flex items-center gap-2">
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="description">{t("search_description")}</option>
            <option value="amount">{t("search_amount")}</option>
            <option value="date">{t("search_date")}</option>
            <option value="period">{t("search_period")}</option>
          </select>
          <div className="relative flex-1">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search") + "..."}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Botones: exportar CSV + toggle gráfica */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => exportCSV(filteredExpenses, categoryNames)}
          className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
        >
          <DownloadSimple size={16} />
          {t("export_csv")}
        </button>
        <button
          onClick={() => exportPDF(filteredExpenses, categoryNames)}
          className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
        >
          <DownloadSimple size={16} />
          {t("export_pdf")}
        </button>
        <button
          onClick={() => setShowChart(!showChart)}
          className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
        >
          {showChart ? <ChartLine size={16} /> : <ChartBar size={16} />}
          {showChart ? t("hide_chart") : t("show_chart")}
        </button>
      </div>

      {/* Contenido: gráfica + periodos en dos columnas cuando la gráfica está visible */}
      <div className={showChart ? "grid grid-cols-1 md:grid-cols-2 gap-6" : ""}>
        {/* Columna izquierda: periodos */}
        <div className={showChart ? "space-y-6" : "space-y-6"}>
          {visiblePeriods.length > 0 ? (
            visiblePeriods.map((periodKey) => {
              const periodExpenses = grouped[periodKey];
              const periodTotal = periodExpenses.reduce(
                (sum, e) => sum + e.amount,
                0,
              );
              return (
                <div
                  key={periodKey}
                  className="glass-container rounded-2xl border border-white/10 backdrop-blur-md p-6"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Receipt weight="duotone" className="text-blue-400" />
                      {formatPeriodKey(periodKey, lang)}
                    </h3>
                    <p className="text-rose-300 font-semibold">
                      -{formatCurrency(periodTotal)}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {periodExpenses.map((exp) => (
                      <div
                        key={exp.id}
                        className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {exp.description}
                          </p>
                          <p className="text-xs text-slate-300 mt-1">
                            {exp.date}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <button
                            onClick={() => setEditingExpense(exp)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 bg-slate-900/50 hover:bg-blue-500/10 border border-slate-700/30 rounded-lg transition-colors cursor-pointer"
                            title={t("edit_expense")}
                          >
                            <PencilSimple size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(exp.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900/50 hover:bg-rose-500/10 border border-slate-700/30 rounded-lg transition-colors cursor-pointer"
                            title={t("delete_expense")}
                          >
                            <Trash size={14} />
                          </button>
                          <p className="text-rose-300 font-semibold ml-1">
                            -{formatCurrency(exp.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="glass-container rounded-2xl border border-white/10 backdrop-blur-md p-6 text-center py-10">
              <p className="text-slate-300">{t("no_expenses_recorded")}</p>
            </div>
          )}

          {sortedPeriods.length > 3 && (
            <div className="text-center">
              <button
                onClick={() => setShowAllPeriods(!showAllPeriods)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              >
                {showAllPeriods
                  ? t("show_recent_only")
                  : `${t("show_all_periods")} (${sortedPeriods.length})`}
              </button>
            </div>
          )}
        </div>

        {/* Columna derecha: gráfica (solo cuando showChart) */}
        {showChart && chartExpenses.length > 0 && (
          <div className="glass-container rounded-2xl border border-white/10 backdrop-blur-md p-6 min-w-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ChartBar weight="duotone" className="text-blue-400" />
                {t("expenses_chart")}
              </h3>
              <select
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t("all_periods")}</option>
                {uniquePeriods.map((pk) => (
                  <option key={pk} value={pk}>
                    {formatPeriodKey(pk, lang)}
                  </option>
                ))}
              </select>
            </div>
            <ExpenseChart
              expenses={chartExpenses}
              chartType={chartType}
              categoryNames={categoryNames}
            />
          </div>
        )}
      </div>

      {/* Confirmación de eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6">
            <h3 className="text-lg font-bold text-white mb-2">
              {t("delete_expense_confirm")}
            </h3>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors shadow-lg shadow-rose-500/30 cursor-pointer"
              >
                {t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {(showExpenseForm || editingExpense) && (
        <ExpenseForm
          key={editingExpense?.id || "new"}
          expense={editingExpense ?? undefined}
          onClose={() => {
            setShowExpenseForm(false);
            setEditingExpense(null);
          }}
        />
      )}
    </div>
  );
}

function App() {
  const { t } = useTranslation();
  const location = useLocation();

  const getNavLinkClass = (path: string) => {
    return location.pathname === path
      ? "flex flex-col items-center gap-1 text-blue-300"
      : "flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors";
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 to-black text-slate-100 font-sans selection:bg-blue-500/30">
      <header className="sticky top-0 z-40 bg-black/50 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Wallet weight="duotone" className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              {t("app_title")}
            </h1>
          </div>
          <SyncButton />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cards" element={<CardManager />} />
          <Route path="/debts" element={<DebtDashboard />} />
          <Route path="/settings" element={<CategoryManager />} />
        </Routes>
      </main>

      <nav className="sticky bottom-0 bg-black/60 backdrop-blur-lg border-t border-white/10 pb-safe">
        <div className="max-w-md mx-auto flex justify-between items-center px-6 h-16">
          <Link to="/" className={getNavLinkClass("/")}>
            <Wallet weight="duotone" size={24} />
            <span className="text-[10px] font-medium">{t("dashboard")}</span>
          </Link>
          <Link to="/cards" className={getNavLinkClass("/cards")}>
            <Cards weight="duotone" size={24} />
            <span className="text-[10px] font-medium">{t("cards")}</span>
          </Link>
          <Link to="/debts" className={getNavLinkClass("/debts")}>
            <Receipt weight="duotone" size={24} />
            <span className="text-[10px] font-medium">{t("debts")}</span>
          </Link>
          <Link to="/settings" className={getNavLinkClass("/settings")}>
            <Gear weight="duotone" size={24} />
            <span className="text-[10px] font-medium">{t("settings")}</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export default App;
