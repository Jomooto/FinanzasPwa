/**
 * Crypto Diagnostic Tool
 * 
 * Úsalo desde la consola del navegador:  import { cryptoDiagnostic } from './utils/cryptoDiagnostic'; cryptoDiagnostic();
 * O pega este snippet en la consola para debug rápido.
 * 
 * Verifica los 4 estados críticos del sistema de seguridad.
 */

import { rebuildAccessToken } from "./tokenStorage";
import { getCachedMasterKey } from "../hooks/useMasterKey";
import db from "../db/schema";

export interface DiagnosticResult {
  test: string;
  status: "OK" | "FAIL" | "WARN";
  detail: string;
}

export const cryptoDiagnostic = async (): Promise<DiagnosticResult[]> => {
  const results: DiagnosticResult[] = [];

  // 1. Token Fragmentación (3/3)
  try {
    const tokenHead = localStorage.getItem("dropbox_token_head");
    const bodyRecord = await db.meta.get("dropbox_token_body");
    const tailAccess = sessionStorage.getItem("dropbox_token_tail_access");
    const tailRefresh = sessionStorage.getItem("dropbox_token_tail_refresh");

    const fragments = [tokenHead, bodyRecord, tailAccess];
    const allOk = fragments.every(Boolean);
    results.push({
      test: "Token Fragmentado (3/3)",
      status: allOk ? "OK" : "FAIL",
      detail: `localStorage:${fragments[0] ? "✓" : "✗"} IndexedDB:${fragments[1] ? "✓" : "✗"} sessionStorage:${fragments[2] ? "✓" : "✗"} (refresh:${!!tailRefresh ? "✓" : "✗"})`,
    });
  } catch (e) {
    results.push({ test: "Token Fragmentado", status: "FAIL", detail: String(e) });
  }

  // 2. Versión de Cifrado
  try {
    const sample = await db.expenses.limit(1).first();
    const version = sample?.cryptoVersion ?? "N/A (sin ciphertext)";
    results.push({
      test: "Versión de Cifrado",
      status: "OK",
      detail: `v${version} (actual esperada: v1)`,
    });
  } catch (e) {
    results.push({ test: "Versión de Cifrado", status: "FAIL", detail: String(e) });
  }

  // 3. Clave Maestra
  try {
    const cached = getCachedMasterKey();
    const canRebuild = await rebuildAccessToken();
    results.push({
      test: "Clave Maestra",
      status: cached ? "OK" : canRebuild ? "WARN" : "FAIL",
      detail: cached
        ? "Cacheada en sesión"
        : canRebuild
          ? "No cacheada (se descargará al primer uso)"
          : "No disponible (sin Dropbox)",
    });
  } catch (e) {
    results.push({ test: "Clave Maestra", status: "FAIL", detail: String(e) });
  }

  // 4. Recovery Backup
  try {
    const token = await rebuildAccessToken();
    if (token) {
      const dlResponse = await fetch(
        "https://content.dropboxapi.com/2/files/download",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Dropbox-API-Arg": JSON.stringify({
              path: "/Apps/FinanzasPWA/.crypto/recovery-backup.json",
            }),
          },
        },
      );
      results.push({
        test: "Recovery Backup (Dropbox)",
        status: dlResponse.ok ? "OK" : "WARN",
        detail: dlResponse.ok
          ? "Archivo recovery-backup.json encontrado"
          : "No existe backup de recovery",
      });
    } else {
      results.push({
        test: "Recovery Backup (Dropbox)",
        status: "WARN",
        detail: "No se pudo verificar (sin token Dropbox)",
      });
    }
  } catch (e) {
    results.push({ test: "Recovery Backup", status: "FAIL", detail: String(e) });
  }

  // 5. Integridad HMAC del master-key (si existe)
  try {
    const token = await rebuildAccessToken();
    if (token) {
      const dlResponse = await fetch(
        "https://content.dropboxapi.com/2/files/download",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Dropbox-API-Arg": JSON.stringify({
              path: "/Apps/FinanzasPWA/.crypto/master-key.json",
            }),
          },
        },
      );
      if (dlResponse.ok) {
        const data = JSON.parse(await dlResponse.text());
        const hasChecksum = !!data.checksum;
        results.push({
          test: "HMAC master-key.json",
          status: hasChecksum ? "OK" : "FAIL",
          detail: hasChecksum
            ? "Checksum HMAC presente"
            : "Sin checksum (archivo legacy, necesita regenerarse)",
        });
      } else {
        results.push({
          test: "HMAC master-key.json",
          status: "WARN",
          detail: "Archivo no existe (se creará al primer sync)",
        });
      }
    }
  } catch (e) {
    results.push({ test: "HMAC master-key.json", status: "FAIL", detail: String(e) });
  }

  console.group("🔐 Crypto Diagnostic Report");
  console.table(results);
  console.groupEnd();

  return results;
};

// Hacer accesible globalmente en desarrollo
if (import.meta.env.DEV) {
  (window as any).cryptoDiagnostic = cryptoDiagnostic;
}