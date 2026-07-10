import { useCallback } from "react";
import { encryptData, decryptData, deriveKey } from "../utils/cryptoUtils";
import type { Expense } from "../db/schema";

/** Obtiene la clave de cifrado derivada del token de Dropbox o una clave por defecto */
const getFinanceKey = (): string => {
  const token = localStorage.getItem("dropbox_access_token");
  const base = token || navigator.userAgent + new Date().toDateString();
  return deriveKey(base);
};

/** Cifra el payload de un Expense y lo agrega como campo ciphertext.
 *  Conserva los campos indexados (amount, periodKey, etc.) para que Dexie pueda hacer consultas. */
export const encryptExpense = (expense: Expense): Expense => {
  const key = getFinanceKey();
  const plaintext = JSON.stringify(expense);
  return {
    ...expense,
    ciphertext: encryptData(plaintext, key),
  };
};

/** Descifra el ciphertext de un Expense y retorna los datos originales.
 *  Si no hay ciphertext o falla el descifrado, retorna el expense tal cual. */
export const decryptExpense = (expense: Expense): Expense | null => {
  if (!expense.ciphertext) return expense;
  const key = getFinanceKey();
  const plaintext = decryptData(expense.ciphertext, key);
  if (!plaintext) return null;
  try {
    return JSON.parse(plaintext) as Expense;
  } catch {
    return null;
  }
};

/** Hook que provee funciones de cifrado/descifrado */
export const useFinanceCrypto = () => {
  const encrypt = useCallback((expense: Expense): Expense => {
    return encryptExpense(expense);
  }, []);

  const decrypt = useCallback((expense: Expense): Expense | null => {
    return decryptExpense(expense);
  }, []);

  return { encryptExpense: encrypt, decryptExpense: decrypt };
};
