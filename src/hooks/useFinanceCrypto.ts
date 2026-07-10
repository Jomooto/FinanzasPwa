import { useCallback } from "react";
import { encryptData, decryptData, deriveKey } from "../utils/cryptoUtils";
import type { Expense } from "../db/schema";
import { CURRENT_CRYPTO_VERSION } from "../db/schema";

const DEFAULT_KEY_SEED = "mis-finanzas-crypto-key-v1";
const FINANCE_KEY_CACHE = "finance_key_cache";
const FINANCE_KEY_SALT = "finance_key_salt_v1";

/** Obtiene la clave de cifrado derivada del token de Dropbox (estable entre sesiones).
 *  Usa una semilla fija + salt en lugar del token real, porque el token fragmentado
 *  requiere async para reconstruirse y getFinanceKey se usa en contextos sync.
 *  La clave es estable mientras el salt no cambie. */
const getFinanceKey = (): string => {
  try {
    const cached = sessionStorage.getItem(FINANCE_KEY_CACHE);
    if (cached) return cached;

    // Usar semilla fija + salt — NO depende del token para evitar async
    const key = deriveKey(FINANCE_KEY_SALT);
    sessionStorage.setItem(FINANCE_KEY_CACHE, key);
    return key;
  } catch {
    console.warn("[useFinanceCrypto] Error deriving key, using fallback");
    sessionStorage.removeItem(FINANCE_KEY_CACHE);
    return DEFAULT_KEY_SEED;
  }
};

/** Limpia el cache de clave financiera */
export const clearFinanceKeyCache = (): void => {
  sessionStorage.removeItem(FINANCE_KEY_CACHE);
};

// ============================================================
// VERSIONED ENCRYPT/DECRYPT
// ============================================================

/** Versión 1: AES-256-CBC con CryptoJS. payload = JSON.stringify(expense) */
const encryptV1 = (expense: Expense, key: string): string => {
  const plaintext = JSON.stringify(expense);
  return encryptData(plaintext, key);
};

const decryptV1 = (ciphertext: string, key: string): Expense | null => {
  const plaintext = decryptData(ciphertext, key);
  if (!plaintext) return null;
  try {
    return JSON.parse(plaintext) as Expense;
  } catch {
    return null;
  }
};

/** Cifra un Expense usando la versión actual del algoritmo.
 *  Registra cryptoVersion en el objeto para migraciones futuras. */
export const encryptExpense = (expense: Expense): Expense => {
  try {
    const key = getFinanceKey();
    const ciphertext = encryptV1(expense, key);
    return {
      ...expense,
      ciphertext,
      cryptoVersion: CURRENT_CRYPTO_VERSION,
    };
  } catch {
    console.warn("[useFinanceCrypto] Encryption failed, saving without ciphertext");
    return expense;
  }
};

/** Descifra un Expense según su cryptoVersion.
 *  - Sin `cryptoVersion` (legacy): se asume v1, se descifra con algoritmo v1.
 *  - v1: AES-256-CBC.
 *  - Versión futura desconocida: retorna null (gasto inaccesible).
 *  - Sin `ciphertext`: retorna el expense tal cual (sin cifrar).
 *  NUNCA lanza excepción. */
export const decryptExpense = (expense: Expense): Expense | null => {
  try {
    if (!expense.ciphertext) return expense;

    const version = expense.cryptoVersion ?? 1; // legacy → v1
    const key = getFinanceKey();

    switch (version) {
      case 1:
        return decryptV1(expense.ciphertext, key);
      default:
        // Versión futura no soportada — el gasto es inaccesible
        console.warn(
          `[useFinanceCrypto] Unsupported cryptoVersion ${version} for expense ${expense.id}`,
        );
        return null;
    }
  } catch {
    console.warn("[useFinanceCrypto] Decryption failed for expense", expense.id);
    return null;
  }
};

/** Hook que provee funciones de cifrado/descifrado versionadas */
export const useFinanceCrypto = () => {
  const encrypt = useCallback((expense: Expense): Expense => {
    return encryptExpense(expense);
  }, []);

  const decrypt = useCallback((expense: Expense): Expense | null => {
    return decryptExpense(expense);
  }, []);

  return { encryptExpense: encrypt, decryptExpense: decrypt };
};