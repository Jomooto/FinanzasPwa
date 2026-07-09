import { useCallback } from 'react';
import type { Debt, Card } from '../db/schema';

export const useDebtCalculator = () => {
  const calculateDebtDetails = useCallback((debt: Debt, card: Card | undefined) => {
    if (!debt) {
      return {
        monthsPaid: 0,
        monthsRemaining: 0,
        remainingBalance: 0,
        isInstallmentPending: false,
        monthlyPayment: 0
      };
    }

    const billingDay = card?.billingDay || 1;
    const today = new Date();
    // Parse the start date (ignoring timezone issues by replacing dashes or parsing YYYY-MM-DD local style)
    const [year, month, day] = debt.startDate.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);

    // Calculate elapsed months since the debt start date
    let elapsedMonths = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
    
    // Adjust elapsed months: if today hasn't reached the billing day of the card in the current month,
    // then the installment for this month is still "pending" (not fully billed/paid yet).
    if (today.getDate() < billingDay) {
      elapsedMonths -= 1;
    }
    
    // Clamp elapsed months to [0, totalMonths]
    const monthsPaid = Math.max(0, Math.min(debt.totalMonths, elapsedMonths));
    const monthsRemaining = debt.totalMonths - monthsPaid;
    
    // Calculate remaining balance
    const remainingBalance = Math.max(0, debt.totalAmount - (monthsPaid * debt.monthlyPayment));
    
    // An installment is "pending" for the current billing cycle if:
    // 1. There are still unpaid installments (monthsRemaining > 0)
    // 2. Today is before the billing day (meaning the current month's installment hasn't passed the billing date yet)
    // 3. The current month is within the active timeline of the debt
    const isInstallmentPending = monthsRemaining > 0 && today.getDate() < billingDay && today >= startDate;

    return {
      monthsPaid,
      monthsRemaining,
      remainingBalance,
      isInstallmentPending,
      monthlyPayment: debt.monthlyPayment
    };
  }, []);

  return { calculateDebtDetails };
};

