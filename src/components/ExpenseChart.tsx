import { useMemo } from "react";
import type { Expense } from "../db/schema";

export type ChartType = "bar" | "pie" | "doughnut";

const COLORS = [
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
  "#06b6d4",
  "#d946ef",
  "#10b981",
  "#eab308",
  "#64748b",
];

interface ExpenseChartProps {
  expenses: Expense[];
  chartType: ChartType;
  categoryNames: Record<string, string>;
}

const formatCurrency = (value: number) => {
  const currency = localStorage.getItem("selectedCurrency") || "USD";
  return new Intl.NumberFormat(navigator.language, {
    style: "currency",
    currency,
  }).format(value);
};

/** Convierte ángulo en grados a path SVG para un sector de círculo */
function sectorPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const startRad = (startDeg - 90) * (Math.PI / 180);
  const endRad = (endDeg - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

const ExpenseChart: React.FC<ExpenseChartProps> = ({
  expenses,
  chartType,
  categoryNames,
}) => {
  const data = useMemo(() => {
    const grouped: Record<string, number> = {};
    expenses.forEach((exp) => {
      if (!grouped[exp.categoryId]) grouped[exp.categoryId] = 0;
      grouped[exp.categoryId] += exp.amount;
    });
    const entries = Object.entries(grouped).map(([catId, total]) => ({
      name: categoryNames[catId] || catId,
      value: Math.round(total * 100) / 100,
    }));
    entries.sort((a, b) => b.value - a.value);
    return entries;
  }, [expenses, categoryNames]);

  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="w-full py-2">
      {/* BAR CHART */}
      {chartType === "bar" && (
        <div className="space-y-3">
          {data.map((entry, i) => {
            const pct = (entry.value / maxVal) * 100;
            return (
              <div key={entry.name} className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="truncate mr-2">{entry.name}</span>
                  <span className="shrink-0 font-medium">
                    {formatCurrency(entry.value)}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PIE CHART - SVG con sectores */}
      {chartType === "pie" && (
        <PieOrDoughnutRenderer
          data={data}
          total={total}
          innerRadius={0}
          outerRadius={100}
          label="pie"
        />
      )}

      {/* DOUGHNUT CHART */}
      {chartType === "doughnut" && (
        <PieOrDoughnutRenderer
          data={data}
          total={total}
          innerRadius={55}
          outerRadius={100}
          label="doughnut"
        />
      )}
    </div>
  );
};

/** Componente interno para renderizar pie/doughnut con SVG */
const PieOrDoughnutRenderer: React.FC<{
  data: { name: string; value: number }[];
  total: number;
  innerRadius: number;
  outerRadius: number;
  label: "pie" | "doughnut";
}> = ({ data, total, innerRadius, outerRadius, label }) => {
  const cx = 150;
  const cy = 120;
  const size = 300;

  const slices = data.reduce<
    {
      name: string;
      value: number;
      start: number;
      end: number;
      angle: number;
      pct: string;
    }[]
  >((acc, entry) => {
    const angle = (entry.value / total) * 360;
    const start = acc.length > 0 ? acc[acc.length - 1].end : 0;
    const end = start + angle;
    acc.push({
      ...entry,
      start,
      end,
      angle,
      pct: ((entry.value / total) * 100).toFixed(0),
    });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size + 80}`}
        className="w-full max-w-xs"
        style={{ height: 380 }}
      >
        {/* Título */}
        <text x={cx} y={20} textAnchor="middle" fill="#94a3b8" fontSize={12}>
          {label === "pie" ? "Pastel" : "Dona"}
        </text>

        {/* Sectores */}
        {slices.map((slice, i) => {
          const color = COLORS[i % COLORS.length];
          if (slice.angle >= 360) {
            // Círculo completo
            return (
              <g key={slice.name}>
                <circle cx={cx} cy={cy} r={outerRadius} fill={color} />
                {innerRadius > 0 && (
                  <circle cx={cx} cy={cy} r={innerRadius} fill="#1e293b" />
                )}
              </g>
            );
          }
          const outerPath = sectorPath(
            cx,
            cy,
            outerRadius,
            slice.start,
            slice.end,
          );
          if (innerRadius > 0) {
            // Dona: recortar el centro con un círculo blanco sobrepuesto
            const innerStartRad = (slice.start - 90) * (Math.PI / 180);
            const innerEndRad = (slice.end - 90) * (Math.PI / 180);
            const ix1 = cx + innerRadius * Math.cos(innerStartRad);
            const iy1 = cy + innerRadius * Math.sin(innerStartRad);
            const ix2 = cx + innerRadius * Math.cos(innerEndRad);
            const iy2 = cy + innerRadius * Math.sin(innerEndRad);
            const innerArcLarge = slice.angle > 180 ? 1 : 0;
            const innerPath = `M ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${innerArcLarge} 0 ${ix1} ${iy1} L ${ix1} ${iy1}`;
            const fullPath = `${outerPath} ${innerPath} Z`;
            return <path key={slice.name} d={fullPath} fill={color} />;
          }
          return <path key={slice.name} d={outerPath} fill={color} />;
        })}

        {/* Centro blanco para dona */}
        {innerRadius > 0 && (
          <circle cx={cx} cy={cy} r={innerRadius - 1} fill="#0f172a" />
        )}

        {/* Leyenda */}
        {slices.map((slice, i) => {
          const color = COLORS[i % COLORS.length];
          const lx = 20;
          const ly = size + 20 + i * 22;
          return (
            <g key={`legend-${slice.name}`}>
              {innerRadius > 0 ? (
                <circle
                  cx={lx + 6}
                  cy={ly - 4}
                  r={6}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                />
              ) : (
                <circle cx={lx + 6} cy={ly - 4} r={7} fill={color} />
              )}
              <text x={lx + 18} y={ly} fill="#e2e8f0" fontSize={11}>
                {slice.name}: {slice.pct}%
              </text>
              <text x={lx + 18} y={ly + 12} fill="#94a3b8" fontSize={9}>
                {formatCurrency(slice.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default ExpenseChart;
