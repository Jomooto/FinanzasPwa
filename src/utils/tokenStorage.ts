import { encryptData, decryptData, generateCipherKey } from "./cryptoUtils";
import db from "../db/schema";

const CIPHER_KEY_STORAGE = "dropbox_cipher_key";

// ============================================================
// TOKEN FRAGMENTATION
// ============================================================
// El token de Dropbox se fragmenta en 3 partes:
//   head  (20 chars) → localStorage (cifrado con AES)
//   body  (resto)    → IndexedDB (Dexie, tabla meta)
//   tail  (20 chars) → variable en closure (solo memoria RAM)
// ============================================================

const FRAGMENT_HEAD_LENGTH = 20;
const FRAGMENT_TAIL_LENGTH = 20;
const TAIL_ACCESS_KEY = "dropbox_token_tail_access";
const TAIL_REFRESH_KEY = "dropbox_token_tail_refresh";

/** Lee el tail de sessionStorage (persiste entre reloads de la misma sesión) */
const getTail = (key: string): string | null => sessionStorage.getItem(key);
/** Guarda el tail en sessionStorage */
const setTail = (key: string, value: string) => sessionStorage.setItem(key, value);
/** Elimina el tail de sessionStorage */
const removeTail = (key: string) => sessionStorage.removeItem(key);

/** Obtiene o genera la clave de cifrado para tokens.
 *  Persiste en localStorage y sessionStorage para consistencia entre pestañas. */
export const getTokenCipherKey = (): string => {
  let key = sessionStorage.getItem(CIPHER_KEY_STORAGE);
  if (key) return key;

  key = localStorage.getItem(CIPHER_KEY_STORAGE);
  if (key) {
    sessionStorage.setItem(CIPHER_KEY_STORAGE, key);
    return key;
  }

  key = generateCipherKey();
  localStorage.setItem(CIPHER_KEY_STORAGE, key);
  sessionStorage.setItem(CIPHER_KEY_STORAGE, key);
  return key;
};

/** Guarda un fragmento cifrado en localStorage */
const saveFragmentToLocalStorage = (name: string, value: string) => {
  const key = getTokenCipherKey();
  localStorage.setItem(name, encryptData(value, key));
};

/** Lee y descifra un fragmento de localStorage */
const readFragmentFromLocalStorage = (name: string): string | null => {
  try {
    const encrypted = localStorage.getItem(name);
    if (!encrypted) return null;
    return decryptData(encrypted, getTokenCipherKey());
  } catch {
    return null;
  }
};

/** Guarda el body del token en IndexedDB (Dexie) */
const saveFragmentToIndexedDB = async (
  id: string,
  value: string,
): Promise<void> => {
  const key = getTokenCipherKey();
  await db.meta.put({
    id,
    lastSync: 0,
    version: 0,
    tokenFragment: encryptData(value, key),
  });
};

/** Lee y descifra el body del token desde IndexedDB */
const readFragmentFromIndexedDB = async (
  id: string,
): Promise<string | null> => {
  try {
    const record = await db.meta.get(id);
    if (!record?.tokenFragment) return null;
    return decryptData(record.tokenFragment, getTokenCipherKey());
  } catch {
    return null;
  }
};

/** Elimina fragmentos de IndexedDB */
const removeFragmentFromIndexedDB = async (id: string): Promise<void> => {
  await db.meta.delete(id);
};

// ============================================================
// PUBLIC API
// ============================================================

/** Almacena el token de acceso fragmentado en 3 ubicaciones distintas. */
export const saveAccessToken = async (fullToken: string): Promise<void> => {
  const head = fullToken.slice(0, FRAGMENT_HEAD_LENGTH);
  const tail = fullToken.slice(-FRAGMENT_TAIL_LENGTH);
  const body = fullToken.slice(
    FRAGMENT_HEAD_LENGTH,
    fullToken.length - FRAGMENT_TAIL_LENGTH,
  );

  saveFragmentToLocalStorage("dropbox_token_head", head);
  await saveFragmentToIndexedDB("dropbox_token_body", body);
  setTail(TAIL_ACCESS_KEY, tail);
};

/** Almacena el refresh token fragmentado en 3 ubicaciones distintas. */
export const saveRefreshToken = async (fullToken: string): Promise<void> => {
  const head = fullToken.slice(0, FRAGMENT_HEAD_LENGTH);
  const tail = fullToken.slice(-FRAGMENT_TAIL_LENGTH);
  const body = fullToken.slice(
    FRAGMENT_HEAD_LENGTH,
    fullToken.length - FRAGMENT_TAIL_LENGTH,
  );

  saveFragmentToLocalStorage("dropbox_refresh_token_head", head);
  await saveFragmentToIndexedDB("dropbox_refresh_token_body", body);
  setTail(TAIL_REFRESH_KEY, tail);
};

/** Reconstruye el token de acceso completo desde sus fragmentos.
 *  Retorna null si algún fragmento falta o es ilegible. */
export const rebuildAccessToken = async (): Promise<string | null> => {
  try {
    const head = readFragmentFromLocalStorage("dropbox_token_head");
    const body = await readFragmentFromIndexedDB("dropbox_token_body");
    const tail = getTail(TAIL_ACCESS_KEY);
    if (!head || !body || !tail) return null;
    return head + body + tail;
  } catch {
    return null;
  }
};

/** Reconstruye el refresh token completo desde sus fragmentos.
 *  Retorna null si algún fragmento falta o es ilegible. */
export const rebuildRefreshToken = async (): Promise<string | null> => {
  try {
    const head = readFragmentFromLocalStorage("dropbox_refresh_token_head");
    const body = await readFragmentFromIndexedDB("dropbox_refresh_token_body");
    const tail = getTail(TAIL_REFRESH_KEY);
    if (!head || !body || !tail) return null;
    return head + body + tail;
  } catch {
    return null;
  }
};

/** Verifica si el token de acceso existe en sus fragmentos (sin reconstruirlo).
 *  Útil para CategoryManager y UI. */
export const hasTokenFragments = (): boolean => {
  try {
    const head = localStorage.getItem("dropbox_token_head");
    const tail = getTail(TAIL_ACCESS_KEY);
    return !!head && !!tail;
  } catch {
    return false;
  }
};


/** Limpia todos los fragmentos de tokens (los 3 niveles). */
export const clearTokenCredentials = async (): Promise<void> => {
  localStorage.removeItem("dropbox_token_head");
  localStorage.removeItem("dropbox_refresh_token_head");
  localStorage.removeItem(CIPHER_KEY_STORAGE);
  sessionStorage.removeItem("pkce_verifier");
  sessionStorage.removeItem(CIPHER_KEY_STORAGE);

  await removeFragmentFromIndexedDB("dropbox_token_body");
  await removeFragmentFromIndexedDB("dropbox_refresh_token_body");

  removeTail(TAIL_ACCESS_KEY);
  removeTail(TAIL_REFRESH_KEY);
};

// ============================================================
// LEGACY SUPPORT
// ============================================================
// Mantiene compatibilidad con código que usaba saveEncryptedToken/readDecryptedToken.
// Ahora redirige al nuevo sistema fragmentado.

/** @deprecated Usar saveAccessToken/saveRefreshToken */
export const saveEncryptedToken = (name: string, value: string): void => {
  if (name === "dropbox_access_token" || name === "dropbox_refresh_token") {
    const head = value.slice(0, FRAGMENT_HEAD_LENGTH);
    saveFragmentToLocalStorage(name + "_head", head);
  }
};

/** @deprecated Usar rebuildAccessToken/rebuildRefreshToken — retorna string no vacío si el fragmento head existe */
export const readDecryptedToken = (name: string): string | null => {
  if (name === "dropbox_access_token") {
    const head = readFragmentFromLocalStorage("dropbox_token_head");
    return head ? "valid-token-present" : null;
  }
  if (name === "dropbox_refresh_token") {
    const head = readFragmentFromLocalStorage("dropbox_refresh_token_head");
    return head ? "valid-token-present" : null;
  }
  return null;
};
