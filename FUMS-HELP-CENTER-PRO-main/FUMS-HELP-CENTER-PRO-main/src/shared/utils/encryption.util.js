import CryptoJS from "crypto-js";
import { env } from "../../config/env.js";

/**
 * Encryption utility for securing sensitive data (OAuth tokens, passwords)
 * Uses AES-256 encryption with environment-based key
 */

const ENCRYPTION_KEY = env.EMAIL_ENCRYPTION_KEY || env.JWT_SECRET || "default-encryption-key-change-in-production";

/**
 * Encrypts a string using AES-256
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted string
 */
export function encrypt(text) {
  if (!text) return null;
  try {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts an AES-256 encrypted string
 * @param {string} encryptedText - Encrypted string
 * @returns {string} Decrypted plain text
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Encrypts an object by converting to JSON first
 * @param {object} obj - Object to encrypt
 * @returns {string} Encrypted string
 */
export function encryptObject(obj) {
  if (!obj) return null;
  try {
    const jsonString = JSON.stringify(obj);
    return encrypt(jsonString);
  } catch (error) {
    console.error("Object encryption error:", error);
    throw new Error("Failed to encrypt object");
  }
}

/**
 * Decrypts an encrypted string back to an object
 * @param {string} encryptedText - Encrypted string
 * @returns {object} Decrypted object
 */
export function decryptObject(encryptedText) {
  if (!encryptedText) return null;
  try {
    const jsonString = decrypt(encryptedText);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Object decryption error:", error);
    throw new Error("Failed to decrypt object");
  }
}

/**
 * Hashes a string using SHA-256 (for comparison, not reversible)
 * @param {string} text - Plain text to hash
 * @returns {string} Hashed string
 */
export function hash(text) {
  if (!text) return null;
  try {
    return CryptoJS.SHA256(text).toString();
  } catch (error) {
    console.error("Hashing error:", error);
    throw new Error("Failed to hash data");
  }
}
