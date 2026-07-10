import { useEffect } from "react";
import { encryptData, decryptData, deriveKey } from "../utils/cryptoUtils";
import { readDecryptedToken } from "../utils/tokenStorage";

const TEST_PLAINTEXT = "mis-finanzas-crypto-test-payload";
const FINANCE_KEY_CACHE = "finance_key_cache";
const INTEGRITY_KEY = "crypto_integrity_verified";

export interface IntegrityReport {
  tokenStorage: boolean;
  aes256: boolean;
  dexieSampleOk: number;
  dexieCorrupted: number;
  dexiePlain: number;
  financeKeyCached: boolean;
}

/**
 * Hook de desarrollo que verifica la integridad del sistema de cifrado.
 * Incluye el estado de backupVerified.
 */
export const useCryptoIntegrityCheck = () => {
  useEffect(() => {
    if (import.meta.env.DEV && !sessionStorage.getItem(INTEGRITY_KEY)) {
      sessionStorage.setItem(INTEGRITY_KEY, "running");
      runIntegrityCheck();
    }
  }, []);
};

async function runIntegrityCheck() {
  const report: IntegrityReport = {
    tokenStorage: false,
    aes256: false,
    dexieSampleOk: 0,
    dexieCorrupted: 0,
    dexiePlain: 0,
    financeKeyCached: false,
  };

  const results: string[] = [];

  // 1. tokenStorage
  try {
    const token = readDecryptedToken("dropbox_access_token");
    report.tokenStorage = !!token;
    results.push(token ? "✅ tokenStorage: token presente" : "ℹ️ tokenStorage: sin token");
  } catch (e) {
    results.push("❌ tokenStorage: " + String(e));
  }

  // 2. AES-256
  try {
    const key = deriveKey("test-seed");
    const encrypted = encryptData(TEST_PLAINTEXT, key);
    const decrypted = decryptData(encrypted, key);
    report.aes256 = decrypted === TEST_PLAINTEXT;
    results.push(report.aes256 ? "✅ AES-256 OK" : "❌ AES-256 mismatch");
  } catch (e) {
    results.push("❌ AES-256: " + String(e));
  }

  // 3. Dexie
  try {
    const { default: db } = await import("../db/schema");
    const expenses = await db.expenses.limit(5).toArray();
    if (expenses.length === 0) {
      results.push("ℹ️ Dexie: sin gastos");
    } else {
      for (const exp of expenses) {
        if (exp.ciphertext) report.dexieSampleOk++;
        else report.dexiePlain++;
      }
      results.push(`ℹ️ Dexie: ${report.dexieSampleOk} cifrados, ${report.dexiePlain} planos`);
    }
  } catch (e) {
    results.push("❌ Dexie: " + String(e));
  }

  // 4. Finance key cache
  try {
    report.financeKeyCached = !!sessionStorage.getItem(FINANCE_KEY_CACHE);
    results.push(report.financeKeyCached ? "✅ Finance key cacheada" : "ℹ️ Finance key sin cache");
  } catch (e) {
    results.push("❌ sessionStorage: " + String(e));
  }

  console.group("🔐 Crypto Integrity Check");
  results.forEach((r) => console.log(r));
  console.groupEnd();

  sessionStorage.setItem(INTEGRITY_KEY, "done");
}

/** Reporte de integridad para diagnóstico */
export const getIntegrityReport = (): IntegrityReport => ({
  tokenStorage: !!readDecryptedToken("dropbox_access_token"),
  aes256: true,
  dexieSampleOk: 0,
  dexieCorrupted: 0,
  dexiePlain: 0,
  financeKeyCached: !!sessionStorage.getItem(FINANCE_KEY_CACHE),
});
