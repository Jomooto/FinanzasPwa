import CryptoJS from 'crypto-js';

// Encrypts a JSON string using AES-256
export const encryptData = (data: string, secretKey: string): string => {
  return CryptoJS.AES.encrypt(data, secretKey).toString();
};

// Decrypts an AES-256 encrypted string back to JSON
export const decryptData = (cipherText: string, secretKey: string): string => {
  const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};
