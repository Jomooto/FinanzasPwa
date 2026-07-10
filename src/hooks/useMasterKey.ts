import { useState, useCallback } from "react";
import { encryptData, decryptData, generateCipherKey } from "../utils/cryptoUtils";
import { rebuildAccessToken } from "../utils/tokenStorage";

const MASTER_KEY_PATH = "/Apps/FinanzasPWA/.crypto/master-key.json";
const LOCAL_MASTER_KEY_CACHE = "master_key_cache";
const MASTER_KEY_VERSION = 1;

export interface MasterKeyData {
  version: number;
  key: string; // AES-256 key, cifrada con el token de Dropbox
}

export type MasterKeyState =
  | { status: "loading" }
  | { status: "available"; key: string }
  | { status: "unavailable" }
  | { status: "error"; message: string };

/**
 * Hook que gestiona la clave maestra almacenada en Dropbox.
 * 
 * Flujo:
 * 1. Reconstruye el token de Dropbox desde fragmentos locales
 * 2. Descarga master-key.json desde Dropbox
 * 3. Si existe → descifra la clave maestra con el token
 * 4. Si no existe → genera una nueva, la cifra con el token y la sube
 * 5. Cachea la clave descifrada en sessionStorage para la sesión actual
 * 
 * La clave maestra es independiente del token de Dropbox: si el token
 * se rota, el archivo master-key.json puede re-cifrarse con el nuevo token
 * sin perder los datos cifrados localmente.
 */
export const useMasterKey = () => {
  const [state, setState] = useState<MasterKeyState>({ status: "loading" });

  const fetchOrCreateMasterKey = useCallback(async () => {
    try {
      // 1. Intentar leer del cache local
      const cached = sessionStorage.getItem(LOCAL_MASTER_KEY_CACHE);
      if (cached) {
        setState({ status: "available", key: cached });
        return cached;
      }

      // Si no hay cache, iniciar carga asíncrona
      setState({ status: "loading" });

      // 2. Reconstruir token de Dropbox
      const token = await rebuildAccessToken();
      if (!token) {
        setState({ status: "unavailable" });
        return null;
      }

      // 3. Intentar descargar master-key.json
      let masterKey: string | null = null;

      const dlResponse = await fetch(
        "https://content.dropboxapi.com/2/files/download",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Dropbox-API-Arg": JSON.stringify({ path: MASTER_KEY_PATH }),
          },
        },
      );

      if (dlResponse.ok) {
        const remote: MasterKeyData = JSON.parse(await dlResponse.text());
        if (remote.version === MASTER_KEY_VERSION) {
          masterKey = decryptData(remote.key, token);
        } else {
          console.warn(`[useMasterKey] Unknown version ${remote.version}, regenerating`);
        }
      }

      // 4. Si no se pudo obtener, crear nueva
      if (!masterKey) {
        masterKey = generateCipherKey();
        const encrypted = encryptData(masterKey, token);
        const payload: MasterKeyData = { version: MASTER_KEY_VERSION, key: encrypted };

        const ulResponse = await fetch(
          "https://content.dropboxapi.com/2/files/upload",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Dropbox-API-Arg": JSON.stringify({ path: MASTER_KEY_PATH, mode: "overwrite" }),
              "Content-Type": "application/octet-stream",
            },
            body: JSON.stringify(payload),
          },
        );

        if (!ulResponse.ok) {
          console.warn("[useMasterKey] Failed to upload master key, using in-memory only");
        }
      }

      if (!masterKey) {
        setState({ status: "error", message: "Failed to obtain master key" });
        return null;
      }

      // 5. Cachear
      sessionStorage.setItem(LOCAL_MASTER_KEY_CACHE, masterKey);
      setState({ status: "available", key: masterKey });
      return masterKey;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.warn("[useMasterKey]", msg);
      setState({ status: "error", message: msg });
      return null;
    }
  }, []);

  return {
    masterKeyState: state,
    fetchOrCreateMasterKey,
  };
};

/** Versión sincrónica para obtener la clave maestra del cache (para useFinanceCrypto). */
export const getCachedMasterKey = (): string | null => {
  return sessionStorage.getItem(LOCAL_MASTER_KEY_CACHE);
};

/** Limpia el cache de la clave maestra */
export const clearMasterKeyCache = (): void => {
  sessionStorage.removeItem(LOCAL_MASTER_KEY_CACHE);
};
