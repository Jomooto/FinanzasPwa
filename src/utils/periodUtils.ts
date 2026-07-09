/**
 * Calcula la clave del periodo de facturación para un gasto.
 *
 * Regla: si el día del mes de la transacción es MENOR que el día de corte,
 * el gasto pertenece al periodo que termina este mes.
 * Si es MAYOR O IGUAL, pertenece al periodo que termina el mes siguiente.
 *
 * Ejemplo: corte día 12
 *   - Gasto el 10 → periodo termina este mes → key: "2026-02" (Feb)
 *   - Gasto el 14 → periodo termina el próximo mes → key: "2026-03" (Mar)
 *
 * Para efectivo (sin tarjeta) se usa billingDay=31, así los cargos del día 1-30
 * se quedan en el periodo actual y solo los del día 31 cruzan al siguiente.
 *
 * @param date Fecha ISO (YYYY-MM-DD)
 * @param billingDay Día de corte de la tarjeta (1-31)
 * @returns Clave del periodo en formato "YYYY-MM" (el mes de cierre)
 */
export function computePeriodKey(date: string, billingDay: number): string {
  const d = new Date(date + "T12:00:00");
  const day = d.getDate();
  let year = d.getFullYear();
  let month = d.getMonth(); // 0-based

  if (day >= billingDay) {
    // Pasa al siguiente periodo → termina el próximo mes
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  // Si day < billingDay, el periodo termina este mes (month se queda igual)

  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Formatea un periodKey para mostrar como "Ene - Feb" o "Jan - Feb"
 * según el locale.
 */
export function formatPeriodKey(periodKey: string, locale: string): string {
  const [yearStr, monthStr] = periodKey.split("-");
  const year = parseInt(yearStr, 10);
  const endMonth = parseInt(monthStr, 10); // 1-based, mes de cierre

  // El periodo comienza en el mes anterior al de cierre
  let startMonth = endMonth - 1;
  let startYear = year;
  if (startMonth < 1) {
    startMonth = 12;
    startYear = year - 1;
  }

  const fmt = new Intl.DateTimeFormat(locale, { month: "short" });
  // Date usa meses 0-based: endMonth-1 = último día de endMonth? No, creamos el día 1
  const endDate = new Date(year, endMonth - 1, 1);
  const startDate = new Date(startYear, startMonth - 1, 1);

  return `${fmt.format(startDate)} - ${fmt.format(endDate)}`;
}