import CryptoJS from "crypto-js";

const SALT_KEY = "encryption_salt";

/** Genera un salt único para este dispositivo/navegador */
const getOrCreateSalt = (): string => {
  let salt = localStorage.getItem(SALT_KEY);
  if (!salt) {
    salt = Array.from({ length: 16 }, () =>
      Math.random().toString(36).charAt(2),
    ).join("");
    localStorage.setItem(SALT_KEY, salt);
  }
  return salt;
};

/** Deriva una clave AES-256 a partir de un secret base + salt */
export const deriveKey = (base: string): string => {
  const salt = getOrCreateSalt();
  // Combinar base + salt y hashear iterativamente
  return CryptoJS.SHA256(base + salt).toString();
};

/** Genera una clave aleatoria para cifrado de tokens */
export const generateCipherKey = (): string => {
  return Array.from({ length: 32 }, () =>
    Math.random().toString(36).charAt(2),
  ).join("");
};

/** Cifra un texto plano usando AES-256 */
export const encryptData = (data: string, secretKey: string): string => {
  return CryptoJS.AES.encrypt(data, secretKey).toString();
};

/** Descifra un texto cifrado con AES-256 */
export const decryptData = (
  cipherText: string,
  secretKey: string,
): string | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    if (!result) return null;
    return result;
  } catch {
    return null;
  }
};

/** Limpia el salt de cifrado (forzar regeneración) */
export const clearSalt = (): void => {
  localStorage.removeItem(SALT_KEY);
};