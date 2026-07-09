import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../db/schema";
import { useTranslation } from "../hooks/useTranslation";
import {
  Trash,
  Tag,
  PlusCircle,
  PencilSimple,
  ChartBar,
  CloudArrowUp,
} from "@phosphor-icons/react";

const CategoryManager: React.FC = () => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // State for reassignment modal
  const [reassignCategory, setReassignCategory] = useState<{
    id: string;
    name: string;
    count: number;
  } | null>(null);
  // State for rename modal
  const [renameCategory, setRenameCategory] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const categories = useLiveQuery(() => db.categories.toArray());

  const handleChartTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    localStorage.setItem("chartType", e.target.value);
    // Forzar re-render recargando la página
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;

    const trimmedName = name.trim();

    // Check if category name already exists (case-insensitive)
    const existing = await db.categories
      .filter((c) => c.name.toLowerCase() === trimmedName.toLowerCase())
      .first();
    if (existing) {
      setError(t("category_exists_error"));
      return;
    }

    await db.categories.add({
      id: crypto.randomUUID(),
      name: trimmedName,
      updatedAt: Date.now(),
    });

    setName("");
  };

  const handleDeleteClick = async (catId: string, catName: string) => {
    setError(null);

    // Prevent deleting the default uncategorized category
    if (catId === "cat-uncategorized") {
      setError(t("cannot_delete_default_category"));
      return;
    }

    try {
      const linkedExpenses = await db.expenses
        .where("categoryId")
        .equals(catId)
        .count();

      if (linkedExpenses > 0) {
        setReassignCategory({
          id: catId,
          name: catName,
          count: linkedExpenses,
        });
      } else {
        await db.categories.delete(catId);
      }
    } catch (err: any) {
      setError(err.message || t("delete_category_error"));
    }
  };

  const handleConfirmReassign = async () => {
    if (!reassignCategory) return;
    setError(null);

    try {
      await db.transaction("rw", db.expenses, db.categories, async () => {
        // Ensure default Uncategorized category exists
        let defaultCat = await db.categories.get("cat-uncategorized");
        if (!defaultCat) {
          defaultCat = {
            id: "cat-uncategorized",
            name: t("uncategorized"),
            updatedAt: Date.now(),
          };
          await db.categories.put(defaultCat);
        }

        // Reassign expenses
        const expensesToUpdate = await db.expenses
          .where("categoryId")
          .equals(reassignCategory.id)
          .toArray();
        for (const exp of expensesToUpdate) {
          await db.expenses.update(exp.id, {
            categoryId: "cat-uncategorized",
            updatedAt: Date.now(),
          });
        }

        // Delete the original category
        await db.categories.delete(reassignCategory.id);
      });

      setReassignCategory(null);
    } catch (err: any) {
      setError(err.message || t("reassign_error"));
    }
  };

  const handleRenameClick = (catId: string, catName: string) => {
    setRenameCategory({ id: catId, name: catName });
    setRenameValue(catName);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameCategory || !renameValue.trim()) return;
    try {
      await db.categories.update(renameCategory.id, {
        name: renameValue.trim(),
        updatedAt: Date.now(),
      });
      setRenameCategory(null);
    } catch (err: any) {
      setError(err.message || t("rename_error"));
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t("category")}</h2>
        <p className="text-sm text-slate-400">
          {t("organize_categories_desc")}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl text-sm transition-all duration-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="md:col-span-1 bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm h-fit">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PlusCircle weight="duotone" className="text-blue-400" size={20} />
            {t("add_category")}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t("category_name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("category_name_placeholder")}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors shadow-lg shadow-blue-500/20 mt-2 cursor-pointer"
            >
              {t("save")}
            </button>
          </form>
        </div>

        {/* List Column */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Tag weight="duotone" className="text-blue-400" size={20} />
            {t("categories_list")}
          </h3>

          {categories && categories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex justify-between items-center p-4 bg-slate-800/80 rounded-xl border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/10 rounded-lg text-blue-400">
                      <Tag size={20} weight="duotone" />
                    </div>
                    <span className="font-medium text-white">{cat.name}</span>
                  </div>
                  {cat.id !== "cat-uncategorized" && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRenameClick(cat.id, cat.name)}
                        className="p-1.5 text-slate-400 hover:text-blue-400 bg-slate-900/50 hover:bg-blue-500/10 border border-slate-700/30 rounded-lg transition-colors cursor-pointer"
                        title={t("rename_category")}
                      >
                        <PencilSimple size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(cat.id, cat.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900/50 hover:bg-rose-500/10 border border-slate-700/30 rounded-lg transition-colors cursor-pointer"
                        title={t("delete_category")}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-800/10 rounded-2xl border border-slate-700/30">
              <Tag
                size={48}
                className="mx-auto text-slate-600 mb-3"
                weight="thin"
              />
              <p className="text-slate-400">{t("no_categories")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Rename Modal */}
      {renameCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                {t("rename_category")}
              </h3>
              <form onSubmit={handleRenameSubmit} className="space-y-4">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setRenameCategory(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {t("rename")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Configuración de Dropbox */}
      <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CloudArrowUp weight="duotone" className="text-blue-400" size={20} />
          {t("dropbox_sync")}
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          {localStorage.getItem("dropbox_access_token")
            ? t("dropbox_connected")
            : t("dropbox_not_connected")}
        </p>
        {localStorage.getItem("dropbox_access_token") && (
          <button
            onClick={() => {
              localStorage.removeItem("dropbox_access_token");
              localStorage.removeItem("dropbox_refresh_token");
              sessionStorage.removeItem("pkce_verifier");
              window.location.reload();
            }}
            className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 font-medium px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
          >
            {t("dropbox_clear_credentials")}
          </button>
        )}
      </div>

      {/* Configuración de gráfica */}
      <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ChartBar weight="duotone" className="text-blue-400" size={20} />
          {t("chart_type")}
        </h3>
        <select
          value={localStorage.getItem("chartType") || "bar"}
          onChange={handleChartTypeChange}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="bar">{t("chart_bar")}</option>
          <option value="pie">{t("chart_pie")}</option>
          <option value="doughnut">{t("chart_doughnut")}</option>
        </select>
      </div>

      {/* Reassign Confirmation Modal */}
      {reassignCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2">
                {t("reassign_modal_title")}
              </h3>
              <p className="text-sm text-slate-300 mb-6 font-medium">
                {t("reassign_modal_desc_templated")
                  .replace("{name}", reassignCategory.name)
                  .replace("{count}", reassignCategory.count.toString())
                  .replace("{uncategorized}", t("uncategorized"))}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setReassignCategory(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleConfirmReassign}
                  className="px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors shadow-lg shadow-rose-500/30 cursor-pointer"
                >
                  {t("reassign_and_delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManager;
